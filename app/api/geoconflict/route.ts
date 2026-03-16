import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GeoConflict API proxy route.
 *
 * Primary: ACLED (if ACLED_API_KEY + ACLED_EMAIL env vars are set)
 * Fallback: GDELT GKG GeoJSON API (no key required)
 *
 * Returns events normalized to the same shape as ACLED records so
 * GeoConflictAdapter.normalizeEvent() works without changes.
 */

interface ACLEDLikeEvent {
  event_id_cnty: string;
  event_date: string;
  event_type: string;
  sub_event_type: string;
  country: string;
  admin1: string;
  latitude: string;
  longitude: string;
  fatalities: string;
  notes: string;
  source: string;
  actor1: string;
  actor2: string;
}

// ─── Cache ──────────────────────────────────────────────────────
let cache: { events: ACLEDLikeEvent[]; timestamp: number; source: string } | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 min

// ─── GDELT helpers ──────────────────────────────────────────────

const GDELT_URL =
  "https://api.gdeltproject.org/api/v2/geo/geo?query=conflict%20OR%20protest%20OR%20military&mode=PointData&format=GeoJSON&timespan=24h";

function classifyGDELTEventType(name: string): { eventType: string; subEventType: string } {
  const lower = (name || "").toLowerCase();
  if (lower.includes("protest") || lower.includes("demonstrat")) {
    return { eventType: "Protests", subEventType: "Protest" };
  }
  if (lower.includes("explo") || lower.includes("bomb") || lower.includes("shell") || lower.includes("airstrike")) {
    return { eventType: "Explosions/Remote violence", subEventType: "Shelling/artillery/missile attack" };
  }
  if (lower.includes("battle") || lower.includes("clash") || lower.includes("fighting")) {
    return { eventType: "Battles", subEventType: "Armed clash" };
  }
  if (lower.includes("riot")) {
    return { eventType: "Riots", subEventType: "Violent demonstration" };
  }
  if (lower.includes("violen") && lower.includes("civilian")) {
    return { eventType: "Violence against civilians", subEventType: "Attack" };
  }
  return { eventType: "Strategic developments", subEventType: "Other" };
}

function gdeltFeatureToACLED(feature: any, index: number): ACLEDLikeEvent {
  const props = feature.properties || {};
  const coords = feature.geometry?.coordinates || [0, 0]; // [lng, lat]
  const name = props.name || props.html || props.urlpubtimedate || "";
  const { eventType, subEventType } = classifyGDELTEventType(name);

  // Try to extract country from the name or use shareimage domain
  const country = props.country || props.countrycode || "";
  const sourceUrl = props.url || props.shareimage || "";

  return {
    event_id_cnty: `gdelt-${props.urlpubtimedate || index}-${index}`,
    event_date: props.urlpubtimedate
      ? new Date(props.urlpubtimedate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    event_type: eventType,
    sub_event_type: subEventType,
    country: country,
    admin1: "",
    latitude: String(coords[1]),
    longitude: String(coords[0]),
    fatalities: "0",
    notes: (name || "").slice(0, 500),
    source: sourceUrl,
    actor1: "",
    actor2: "",
  };
}

async function fetchFromACLED(): Promise<{ events: ACLEDLikeEvent[]; source: string } | null> {
  const apiKey = process.env.ACLED_API_KEY;
  const email = process.env.ACLED_EMAIL;
  if (!apiKey || !email) return null;

  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dateFrom = weekAgo.toISOString().split("T")[0];

  const params = new URLSearchParams({
    key: apiKey,
    email: email,
    event_date: dateFrom,
    event_date_where: ">=",
    limit: "200",
    fields:
      "event_id_cnty|event_date|event_type|sub_event_type|country|admin1|latitude|longitude|fatalities|notes|source|actor1|actor2",
  });

  const res = await fetch(`https://api.acleddata.com/acled/read?${params}`, {
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`ACLED API ${res.status}`);
  const data = await res.json();
  if (!data.data || !Array.isArray(data.data)) return null;

  return { events: data.data, source: "acled" };
}

async function fetchFromGDELT(): Promise<{ events: ACLEDLikeEvent[]; source: string }> {
  const res = await fetch(GDELT_URL, {
    signal: AbortSignal.timeout(12000),
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; StockAnalysis/1.0)",
    },
  });

  if (!res.ok) throw new Error(`GDELT API ${res.status}`);
  const geojson = await res.json();

  const features = geojson?.features || [];
  const events: ACLEDLikeEvent[] = features
    .slice(0, 200)
    .map((f: any, i: number) => gdeltFeatureToACLED(f, i))
    .filter((e: ACLEDLikeEvent) => {
      const lat = parseFloat(e.latitude);
      const lng = parseFloat(e.longitude);
      return !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0);
    });

  return { events, source: "gdelt" };
}

// ─── Route handler ──────────────────────────────────────────────

export async function GET() {
  try {
    const now = Date.now();

    // Return cache if fresh
    if (cache && now - cache.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        events: cache.events,
        count: cache.events.length,
        source: cache.source,
        lastFetchedAt: new Date(cache.timestamp).toISOString(),
        isLive: true,
        cached: true,
      });
    }

    // Try ACLED first (if credentials exist), then GDELT fallback
    let result: { events: ACLEDLikeEvent[]; source: string } | null = null;

    try {
      result = await fetchFromACLED();
    } catch (err) {
      console.warn("ACLED fetch failed in proxy:", err instanceof Error ? err.message : err);
    }

    if (!result || result.events.length === 0) {
      try {
        result = await fetchFromGDELT();
      } catch (err) {
        console.warn("GDELT fetch failed:", err instanceof Error ? err.message : err);
      }
    }

    if (!result || result.events.length === 0) {
      return NextResponse.json({
        success: true,
        events: cache?.events || [],
        count: cache?.events.length || 0,
        source: cache?.source || "none",
        lastFetchedAt: cache ? new Date(cache.timestamp).toISOString() : null,
        isLive: false,
        cached: !!cache,
      });
    }

    cache = { events: result.events, timestamp: now, source: result.source };

    return NextResponse.json({
      success: true,
      events: result.events,
      count: result.events.length,
      source: result.source,
      lastFetchedAt: new Date(now).toISOString(),
      isLive: true,
      cached: false,
    });
  } catch (error) {
    console.error("Error in geoconflict API:", error);
    return NextResponse.json(
      {
        success: false,
        events: [],
        count: 0,
        source: "none",
        lastFetchedAt: new Date().toISOString(),
        isLive: false,
        error: "Failed to fetch geoconflict data",
      },
      { status: 500 },
    );
  }
}
