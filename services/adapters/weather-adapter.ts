/**
 * WeatherAdapter: NOAA weather alerts
 *
 * Data flow:
 *   NOAA alerts -> /api/noaa-alerts
 *
 * All outputs normalized to WeatherEntity[]
 */

import {
  EntityType,
  type DataAdapter,
  type WeatherEntity,
  type Coordinates,
} from "../types";

// ─── US state -> approximate coordinates ────────────────────

const STATE_COORDS: Record<string, Coordinates> = {
  "Alabama":        { lat: 32.32, lng: -86.90 },
  "Alaska":         { lat: 63.59, lng: -154.49 },
  "Arizona":        { lat: 34.05, lng: -111.09 },
  "Arkansas":       { lat: 35.20, lng: -91.83 },
  "California":     { lat: 36.78, lng: -119.42 },
  "Colorado":       { lat: 39.55, lng: -105.78 },
  "Connecticut":    { lat: 41.60, lng: -72.90 },
  "Delaware":       { lat: 38.91, lng: -75.53 },
  "Florida":        { lat: 27.66, lng: -81.52 },
  "Georgia":        { lat: 32.17, lng: -82.91 },
  "Hawaii":         { lat: 19.90, lng: -155.58 },
  "Idaho":          { lat: 44.07, lng: -114.74 },
  "Illinois":       { lat: 40.63, lng: -89.40 },
  "Indiana":        { lat: 40.27, lng: -86.13 },
  "Iowa":           { lat: 41.88, lng: -93.10 },
  "Kansas":         { lat: 39.01, lng: -98.48 },
  "Kentucky":       { lat: 37.84, lng: -84.27 },
  "Louisiana":      { lat: 31.17, lng: -91.87 },
  "Maine":          { lat: 45.25, lng: -69.45 },
  "Maryland":       { lat: 39.05, lng: -76.64 },
  "Massachusetts":  { lat: 42.41, lng: -71.38 },
  "Michigan":       { lat: 44.31, lng: -85.60 },
  "Minnesota":      { lat: 46.73, lng: -94.69 },
  "Mississippi":    { lat: 32.35, lng: -89.40 },
  "Missouri":       { lat: 37.96, lng: -91.83 },
  "Montana":        { lat: 46.88, lng: -110.36 },
  "Nebraska":       { lat: 41.49, lng: -99.90 },
  "Nevada":         { lat: 38.80, lng: -116.42 },
  "New Hampshire":  { lat: 43.19, lng: -71.57 },
  "New Jersey":     { lat: 40.06, lng: -74.41 },
  "New Mexico":     { lat: 34.52, lng: -105.87 },
  "New York":       { lat: 43.30, lng: -74.22 },
  "North Carolina": { lat: 35.76, lng: -79.02 },
  "North Dakota":   { lat: 47.55, lng: -101.00 },
  "Ohio":           { lat: 40.42, lng: -82.91 },
  "Oklahoma":       { lat: 35.47, lng: -97.52 },
  "Oregon":         { lat: 43.80, lng: -120.55 },
  "Pennsylvania":   { lat: 41.20, lng: -77.19 },
  "Rhode Island":   { lat: 41.58, lng: -71.48 },
  "South Carolina": { lat: 33.84, lng: -81.16 },
  "South Dakota":   { lat: 43.97, lng: -99.90 },
  "Tennessee":      { lat: 35.52, lng: -86.58 },
  "Texas":          { lat: 31.97, lng: -99.90 },
  "Utah":           { lat: 39.32, lng: -111.09 },
  "Vermont":        { lat: 44.56, lng: -72.58 },
  "Virginia":       { lat: 37.43, lng: -78.66 },
  "Washington":     { lat: 47.75, lng: -120.74 },
  "West Virginia":  { lat: 38.60, lng: -80.45 },
  "Wisconsin":      { lat: 43.78, lng: -88.79 },
  "Wyoming":        { lat: 43.08, lng: -107.29 },
};

// ─── Impacted commodity from weather event type ─────────────

function deriveImpactedCommodity(event: string): string | undefined {
  const e = event.toLowerCase();
  if (e.includes("hurricane") || e.includes("tropical") || e.includes("flood")) {
    return "energy";
  }
  if (e.includes("winter storm") || e.includes("blizzard") || e.includes("ice storm") || e.includes("freeze")) {
    return "natural_gas";
  }
  if (e.includes("drought") || e.includes("heat") || e.includes("excessive heat")) {
    return "agriculture";
  }
  if (e.includes("tornado") || e.includes("severe thunderstorm")) {
    return "agriculture";
  }
  return undefined;
}

// ─── Trading signal from weather event ──────────────────────

function deriveTradingSignal(
  event: string,
  severity: string,
): "bullish" | "bearish" | "neutral" {
  const e = event.toLowerCase();
  const s = severity.toLowerCase();

  // Major energy-disrupting events are bullish for commodity prices
  if (
    (e.includes("hurricane") || e.includes("tropical")) &&
    (s === "extreme" || s === "severe")
  ) {
    return "bullish";
  }

  // Winter storms bullish for natural gas
  if (e.includes("winter storm") || e.includes("blizzard")) {
    if (s === "extreme" || s === "severe") return "bullish";
  }

  // Drought bullish for agriculture commodities
  if (e.includes("drought") && (s === "extreme" || s === "severe")) {
    return "bullish";
  }

  return "neutral";
}

// ─── Extract state from areaDesc ────────────────────────────

function extractState(areaDesc: string): string | undefined {
  // Try to match known state names from the area description
  for (const state of Object.keys(STATE_COORDS)) {
    if (areaDesc.includes(state)) return state;
  }
  return undefined;
}

// ─── Adapter Implementation ─────────────────────────────────

export class WeatherAdapter implements DataAdapter<WeatherEntity> {
  readonly name = "weather";
  readonly type = EntityType.WEATHER;
  readonly refreshIntervalMs = 300_000; // 5 min

  async fetch(): Promise<WeatherEntity[]> {
    try {
      const res = await fetch("/api/noaa-alerts", {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return [];

      const data = await res.json();
      if (!data.success || !Array.isArray(data.alerts)) return [];

      const now = Date.now();

      return data.alerts.map((alert: any): WeatherEntity => {
        const event = alert.event || "Unknown";
        const severity = alert.severity || "Unknown";
        const areaDesc = alert.areaDesc || "";
        const state = extractState(areaDesc);
        const coords = state ? STATE_COORDS[state] : null;
        const impactedCommodity = deriveImpactedCommodity(event);

        const isHurricane = event.toLowerCase().includes("hurricane") ||
          event.toLowerCase().includes("tropical");

        return {
          id: `weather-${alert.id || `${event}-${now}`}`,
          type: EntityType.WEATHER,
          subtype: isHurricane ? "hurricane" : "alert",
          label: `${event}: ${areaDesc.substring(0, 60)}`,
          coordinates: coords,
          value: null,
          delta: null,
          deltaPercent: null,
          status: severity.toLowerCase() === "extreme" ? "critical"
            : severity.toLowerCase() === "severe" ? "warning"
            : "active",
          metadata: {
            event,
            severity,
            areaDesc,
            headline: alert.headline || "",
            onset: alert.onset || "",
            expires: alert.expires || "",
            impactedCommodity,
            tradingSignal: deriveTradingSignal(event, severity),
          },
          source: "noaa",
          timestamp: now,
        };
      });
    } catch (err) {
      console.warn("WeatherAdapter: fetch failed:", err);
      return [];
    }
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }
}
