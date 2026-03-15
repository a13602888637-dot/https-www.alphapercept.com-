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

// Internal proxy endpoint — avoids CORS issues when called from the browser
const AVIATION_PROXY_API = "/api/aviation";

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
    const url = `${AVIATION_PROXY_API}?zone=${this.zone}`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`Aviation proxy returned ${res.status}`);
      return [];
    }

    const data = await res.json();
    if (!data.success || !Array.isArray(data.aircraft)) return [];

    const now = Date.now();
    return data.aircraft.map((a: {
      icao24: string;
      callsign: string;
      originCountry: string;
      lat: number;
      lng: number;
      alt: number;
      onGround: boolean;
      velocity: number;
      heading: number;
      squawk?: string;
      subtype: AviationEntity["subtype"];
    }): AviationEntity => ({
      id: `avi-${a.icao24}`,
      type: EntityType.AVIATION,
      subtype: a.subtype,
      label: a.callsign || a.icao24,
      coordinates: { lat: a.lat, lng: a.lng, alt: a.alt },
      value: a.alt,
      delta: null,
      deltaPercent: null,
      status: a.onGround ? "neutral" : "active",
      metadata: {
        icao24: a.icao24,
        callsign: a.callsign,
        originCountry: a.originCountry,
        velocity: a.velocity,
        heading: a.heading,
        onGround: a.onGround,
        squawk: a.squawk,
      },
      source: "opensky",
      timestamp: now,
    }));
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${AVIATION_PROXY_API}?zone=${this.zone}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return false;
      const data = await res.json();
      return data.success === true;
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
