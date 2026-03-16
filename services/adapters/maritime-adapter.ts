/**
 * MaritimeAdapter: AIS vessel tracking
 *
 * Primary: AISStream.com WebSocket API (requires free API key)
 * Fallback: REST polling mode with cached data
 *
 * Monitors key chokepoints:
 *   - Strait of Malacca
 *   - Red Sea / Bab el-Mandeb
 *   - Panama Canal
 *   - Strait of Hormuz
 *   - Taiwan Strait
 *
 * Env vars:
 *   AISSTREAM_API_KEY - AISStream API key (free tier available)
 */

import {
  EntityType,
  type DataAdapter,
  type MaritimeEntity,
} from "../types";

// Chokepoint bounding boxes [lat_min, lat_max, lng_min, lng_max]
export const MARITIME_ZONES: Record<string, { name: string; bbox: [number, number, number, number] }> = {
  "malacca":  { name: "马六甲海峡", bbox: [0.5, 4.5, 99.0, 104.5] },
  "red_sea":  { name: "红海", bbox: [12.0, 22.0, 36.0, 44.0] },
  "hormuz":   { name: "霍尔木兹海峡", bbox: [25.0, 27.5, 55.0, 58.0] },
  "panama":   { name: "巴拿马运河", bbox: [8.5, 9.5, -80.0, -79.0] },
  "taiwan":   { name: "台湾海峡", bbox: [22.5, 26.0, 117.5, 121.0] },
};

// Ship type codes (AIS standard)
const SHIP_TYPES: Record<number, MaritimeEntity["subtype"]> = {
  70: "cargo",
  80: "tanker",
  60: "passenger",
  35: "military",
};

function classifyShipType(shipType: number): MaritimeEntity["subtype"] {
  // AIS type ranges: 70-79 cargo, 80-89 tanker, 60-69 passenger
  if (shipType >= 70 && shipType <= 79) return "cargo";
  if (shipType >= 80 && shipType <= 89) return "tanker";
  if (shipType >= 60 && shipType <= 69) return "passenger";
  if (shipType >= 35 && shipType <= 39) return "military";
  return "unknown";
}

export class MaritimeAdapter implements DataAdapter<MaritimeEntity> {
  readonly name = "maritime";
  readonly type = EntityType.MARITIME;
  readonly refreshIntervalMs = 60_000; // 60s for maritime

  private activeZones: string[];
  private cachedVessels: MaritimeEntity[] = [];
  private lastFetchTime = 0;
  lastFetchSuccess = false;

  constructor(zones: string[] = ["malacca", "red_sea", "taiwan"]) {
    this.activeZones = zones;
  }

  async fetch(): Promise<MaritimeEntity[]> {
    // Use server-side API route to proxy AISStream requests
    try {
      const res = await fetch("/api/maritime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zones: this.activeZones }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        console.warn(`Maritime API returned ${res.status}`);
        this.lastFetchSuccess = false;
        return this.cachedVessels;
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.vessels)) {
        this.cachedVessels = data.vessels.map(this.normalizeVessel);
        this.lastFetchTime = Date.now();
        this.lastFetchSuccess = true;
      } else {
        this.lastFetchSuccess = false;
      }

      return this.cachedVessels;
    } catch (err) {
      console.warn("Maritime fetch failed:", err);
      this.lastFetchSuccess = false;
      return this.cachedVessels;
    }
  }

  async isHealthy(): Promise<boolean> {
    // Client-side: track health based on last fetch outcome
    // (process.env.AISSTREAM_API_KEY is not available in the browser)
    return this.lastFetchSuccess;
  }

  setZones(zones: string[]) {
    this.activeZones = zones.filter(z => z in MARITIME_ZONES);
  }

  private normalizeVessel = (v: any): MaritimeEntity => ({
    id: `mar-${v.mmsi}`,
    type: EntityType.MARITIME,
    subtype: classifyShipType(v.shipType ?? 0),
    label: v.shipName || v.mmsi,
    coordinates: { lat: v.lat, lng: v.lng },
    value: v.speed ?? null,
    delta: null,
    deltaPercent: null,
    status: (v.speed ?? 0) > 0.5 ? "active" : "neutral",
    metadata: {
      mmsi: String(v.mmsi),
      imo: v.imo ? String(v.imo) : undefined,
      shipName: v.shipName || "Unknown",
      destination: v.destination,
      draught: v.draught,
      speed: v.speed ?? 0,
      course: v.course ?? 0,
      flag: v.flag,
    },
    source: "aisstream",
    timestamp: Date.now(),
  });
}
