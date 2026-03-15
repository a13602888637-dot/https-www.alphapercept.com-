import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// Monitored zones bounding boxes [latMin, latMax, lngMin, lngMax]
const ZONES: Record<string, { name: string; bbox: [number, number, number, number] }> = {
  taiwan_strait:   { name: "台湾海峡", bbox: [22.0, 26.0, 117.0, 122.0] },
  south_china_sea: { name: "南海",     bbox: [5.0, 18.0, 106.0, 121.0] },
  persian_gulf:    { name: "波斯湾",   bbox: [24.0, 30.0, 48.0, 57.0] },
  red_sea:         { name: "红海",     bbox: [12.0, 22.0, 36.0, 44.0] },
};

const CACHE_TTL = 15_000; // 15s - OpenSky updates every ~10s
const cache = new Map<string, { data: unknown; timestamp: number }>();

function classifyAircraft(callsign: string, squawk?: string): string {
  if (squawk === "7700" || squawk === "7600" || squawk === "7500") return "military";
  const militaryPrefixes = ["CNV", "RCH", "DUKE", "TOPCAT", "EVAC", "SAM", "AF1", "AF2", "KING", "HAWK"];
  if (militaryPrefixes.some(p => callsign.toUpperCase().startsWith(p))) return "military";
  if (/^[A-Z]{3}\d/.test(callsign)) return "commercial";
  return "unknown";
}

export async function GET(request: NextRequest) {
  const zone = request.nextUrl.searchParams.get("zone") || "taiwan_strait";
  const zoneConfig = ZONES[zone] || ZONES["taiwan_strait"];
  const [latMin, latMax, lngMin, lngMax] = zoneConfig.bbox;

  // Check cache
  const cached = cache.get(zone);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const url = `https://opensky-network.org/api/states/all?lamin=${latMin}&lomin=${lngMin}&lamax=${latMax}&lomax=${lngMax}`;

    const headers: Record<string, string> = {
      "User-Agent": "StockAnalysis/1.0",
    };

    const username = process.env.OPENSKY_USERNAME;
    const password = process.env.OPENSKY_PASSWORD;
    if (username && password) {
      headers["Authorization"] = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
    }

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        aircraft: [],
        zone,
        error: `OpenSky ${res.status}`,
      });
    }

    const data = await res.json();
    const states: unknown[] = data.states || [];

    const aircraft = (states as unknown[][])
      .filter((s) => s[5] != null && s[6] != null)
      .slice(0, 150)
      .map((s) => ({
        icao24: s[0] as string,
        callsign: ((s[1] as string) || "").trim(),
        originCountry: s[2] as string,
        lng: s[5] as number,
        lat: s[6] as number,
        alt: (s[7] as number) ?? (s[13] as number) ?? 0,
        onGround: s[8] as boolean,
        velocity: (s[9] as number) ?? 0,
        heading: (s[10] as number) ?? 0,
        squawk: s[14] as string | undefined,
        subtype: classifyAircraft(((s[1] as string) || "").trim(), s[14] as string | undefined),
      }));

    const response = {
      success: true,
      aircraft,
      count: aircraft.length,
      zone,
      zoneName: zoneConfig.name,
      timestamp: new Date().toISOString(),
    };

    cache.set(zone, { data: response, timestamp: Date.now() });
    return NextResponse.json(response);
  } catch (err) {
    console.warn("Aviation API error:", err);
    return NextResponse.json({
      success: false,
      aircraft: [],
      zone,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

export async function POST() {
  return NextResponse.json({
    zones: Object.entries(ZONES).map(([k, v]) => ({ key: k, name: v.name })),
  });
}
