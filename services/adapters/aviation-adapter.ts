/**
 * AviationAdapter: OpenSky Network REST API
 *
 * Fetches real-time aircraft state vectors from OpenSky.
 * Free tier: anonymous 10 req/min, authenticated 40 req/min
 *
 * Env vars (optional, for higher rate limits):
 *   OPENSKY_USERNAME
 *   OPENSKY_PASSWORD
 */

import {
  EntityType,
  type DataAdapter,
  type AviationEntity,
} from "../types";

// Hot zones to monitor (bounding boxes: [lat_min, lat_max, lng_min, lng_max])
const MONITORED_ZONES: Record<string, [number, number, number, number]> = {
  "taiwan_strait":  [22.0, 26.0, 117.0, 122.0],
  "south_china_sea": [5.0, 18.0, 106.0, 121.0],
  "persian_gulf":   [24.0, 30.0, 48.0, 57.0],
  "red_sea":        [12.0, 22.0, 36.0, 44.0],
};

const OPENSKY_API = "https://opensky-network.org/api/states/all";

export class AviationAdapter implements DataAdapter<AviationEntity> {
  readonly name = "aviation";
  readonly type = EntityType.AVIATION;
  readonly refreshIntervalMs = 15_000; // OpenSky updates every ~10s

  private zone: string;
  private bbox: [number, number, number, number];

  constructor(zone: string = "taiwan_strait") {
    this.zone = zone;
    this.bbox = MONITORED_ZONES[zone] ?? MONITORED_ZONES["taiwan_strait"];
  }

  async fetch(): Promise<AviationEntity[]> {
    const [latMin, latMax, lngMin, lngMax] = this.bbox;
    const url = `${OPENSKY_API}?lamin=${latMin}&lomin=${lngMin}&lamax=${latMax}&lomax=${lngMax}`;

    const headers: Record<string, string> = {};
    const username = process.env.OPENSKY_USERNAME;
    const password = process.env.OPENSKY_PASSWORD;
    if (username && password) {
      headers["Authorization"] = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
    }

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`OpenSky API returned ${res.status}`);
      return [];
    }

    const data = await res.json();
    if (!data.states || !Array.isArray(data.states)) return [];

    const now = Date.now();
    return data.states
      .filter((s: any[]) => s[5] != null && s[6] != null) // must have coords
      .slice(0, 200) // cap at 200 aircraft per zone
      .map((s: any[]): AviationEntity => {
        const icao24 = s[0] as string;
        const callsign = (s[1] as string || "").trim();
        const originCountry = s[2] as string;
        const lng = s[5] as number;
        const lat = s[6] as number;
        const alt = (s[7] as number) ?? (s[13] as number) ?? 0; // baro alt or geo alt
        const velocity = (s[9] as number) ?? 0;
        const heading = (s[10] as number) ?? 0;
        const onGround = s[8] as boolean;
        const squawk = s[14] as string | undefined;

        return {
          id: `avi-${icao24}`,
          type: EntityType.AVIATION,
          subtype: this.classifyAircraft(callsign, squawk),
          label: callsign || icao24,
          coordinates: { lat, lng, alt },
          value: alt,
          delta: null,
          deltaPercent: null,
          status: onGround ? "neutral" : "active",
          metadata: {
            icao24,
            callsign,
            originCountry,
            velocity,
            heading,
            onGround,
            squawk,
          },
          source: "opensky",
          timestamp: now,
        };
      });
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch("https://opensky-network.org/api/time", {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  setZone(zone: string) {
    if (MONITORED_ZONES[zone]) {
      this.zone = zone;
      this.bbox = MONITORED_ZONES[zone];
    }
  }

  private classifyAircraft(callsign: string, squawk?: string): AviationEntity["subtype"] {
    // Military squawk codes or callsign patterns
    if (squawk === "7700" || squawk === "7600" || squawk === "7500") return "military";
    const militaryPrefixes = ["CNV", "RCH", "DUKE", "TOPCAT", "EVAC", "SAM", "AF1", "AF2"];
    if (militaryPrefixes.some(p => callsign.toUpperCase().startsWith(p))) return "military";
    if (/^[A-Z]{3}\d/.test(callsign)) return "commercial";
    return "unknown";
  }
}

export const MONITORED_AVIATION_ZONES = MONITORED_ZONES;
