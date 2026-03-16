/**
 * GeoConflictAdapter: ACLED (Armed Conflict Location & Event Data)
 *
 * Fetches recent conflict/protest events with coordinates.
 * ACLED API is free for research/non-commercial use.
 *
 * Env vars:
 *   ACLED_API_KEY - ACLED API key
 *   ACLED_EMAIL - registered email
 */

import {
  EntityType,
  Severity,
  type DataAdapter,
  type GeoConflictEntity,
} from "../types";

const ACLED_API = "https://api.acleddata.com/acled/read";

// Event type mapping
const EVENT_TYPE_MAP: Record<string, GeoConflictEntity["subtype"]> = {
  "Battles": "battle",
  "Protests": "protest",
  "Explosions/Remote violence": "explosion",
  "Strategic developments": "strategic_development",
  "Violence against civilians": "violence_against_civilians",
  "Riots": "protest",
};

function eventSeverity(fatalities: number, eventType: string): Severity {
  if (fatalities > 50) return Severity.CRITICAL;
  if (fatalities > 10) return Severity.HIGH;
  if (eventType === "Battles" || eventType === "Explosions/Remote violence") return Severity.HIGH;
  if (fatalities > 0) return Severity.MEDIUM;
  return Severity.LOW;
}

export class GeoConflictAdapter implements DataAdapter<GeoConflictEntity> {
  readonly name = "geoconflict";
  readonly type = EntityType.GEO_CONFLICT;
  readonly refreshIntervalMs = 300_000; // 5min, ACLED updates daily

  private cachedEvents: GeoConflictEntity[] = [];
  private lastFetchTime = 0;
  private cacheValidMs = 600_000; // 10min cache
  private lastFetchSuccess = false;

  async fetch(): Promise<GeoConflictEntity[]> {
    // If cache is fresh, return cached
    if (this.cachedEvents.length > 0 && Date.now() - this.lastFetchTime < this.cacheValidMs) {
      return this.cachedEvents;
    }

    const apiKey = typeof process !== "undefined" ? process.env?.ACLED_API_KEY : undefined;
    const email = typeof process !== "undefined" ? process.env?.ACLED_EMAIL : undefined;

    if (!apiKey || !email) {
      console.warn("ACLED credentials not configured, using server proxy");
      return this.fetchViaProxy();
    }

    try {
      // Fetch last 7 days of events
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const dateFrom = weekAgo.toISOString().split("T")[0];

      const params = new URLSearchParams({
        key: apiKey,
        email: email,
        event_date: dateFrom,
        event_date_where: ">=",
        limit: "200",
        fields: "event_id_cnty|event_date|event_type|sub_event_type|country|admin1|latitude|longitude|fatalities|notes|source|actor1|actor2",
      });

      const res = await fetch(`${ACLED_API}?${params}`, {
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) throw new Error(`ACLED API ${res.status}`);

      const data = await res.json();
      if (!data.data || !Array.isArray(data.data)) return this.cachedEvents;

      this.cachedEvents = data.data.map(this.normalizeEvent);
      this.lastFetchTime = Date.now();
      this.lastFetchSuccess = true;
      return this.cachedEvents;
    } catch (err) {
      console.warn("ACLED fetch failed, trying proxy:", err);
      this.lastFetchSuccess = false;
      return this.fetchViaProxy();
    }
  }

  async isHealthy(): Promise<boolean> {
    // Health is based on last fetch success, not env var presence
    // (env vars are not available client-side, and the proxy route
    // handles GDELT fallback server-side)
    if (this.lastFetchSuccess) return true;
    if (this.cachedEvents.length > 0 && Date.now() - this.lastFetchTime < this.cacheValidMs) {
      return true;
    }
    // If we've never fetched, optimistically assume proxy is available
    if (this.lastFetchTime === 0) return true;
    return false;
  }

  private async fetchViaProxy(): Promise<GeoConflictEntity[]> {
    try {
      const res = await fetch("/api/geoconflict", {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        this.lastFetchSuccess = false;
        return this.cachedEvents.length > 0 ? this.cachedEvents : [];
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.events)) {
        this.cachedEvents = data.events.map(this.normalizeEvent);
        this.lastFetchTime = Date.now();
        this.lastFetchSuccess = true;
      }
      return this.cachedEvents;
    } catch {
      this.lastFetchSuccess = false;
      return this.cachedEvents.length > 0 ? this.cachedEvents : [];
    }
  }

  private normalizeEvent = (e: any): GeoConflictEntity => {
    const fatalities = parseInt(e.fatalities) || 0;
    const lat = parseFloat(e.latitude);
    const lng = parseFloat(e.longitude);
    const eventType = e.event_type || "Unknown";
    const sev = eventSeverity(fatalities, eventType);

    return {
      id: `geo-${e.event_id_cnty || `${lat}-${lng}-${Date.now()}`}`,
      type: EntityType.GEO_CONFLICT,
      subtype: EVENT_TYPE_MAP[eventType] ?? "strategic_development",
      label: `${e.country}: ${e.sub_event_type || eventType}`,
      coordinates: isNaN(lat) || isNaN(lng) ? null : { lat, lng },
      value: fatalities,
      delta: null,
      deltaPercent: null,
      status: sev === Severity.CRITICAL ? "critical" : sev === Severity.HIGH ? "warning" : "active",
      metadata: {
        eventDate: e.event_date || "",
        country: e.country || "",
        region: e.admin1 || "",
        actor1: e.actor1,
        actor2: e.actor2,
        fatalities,
        notes: e.notes || "",
        sourceUrl: e.source,
      },
      source: "acled",
      timestamp: Date.now(),
    };
  };
}
