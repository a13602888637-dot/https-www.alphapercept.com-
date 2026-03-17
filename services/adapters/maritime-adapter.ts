/**
 * MaritimeAdapter: AIS vessel tracking
 *
 * Primary: AISStream.com WebSocket API (requires free API key)
 * Fallback: REST polling mode with cached data
 *
 * Monitors 20 global maritime zones including chokepoints,
 * regional seas, and major ocean shipping routes.
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
  // Core chokepoints
  "malacca":  { name: "马六甲海峡", bbox: [0.5, 4.5, 99.0, 104.5] },
  "red_sea":  { name: "红海", bbox: [12.0, 30.0, 32.0, 44.0] },
  "hormuz":   { name: "霍尔木兹", bbox: [23.0, 28.0, 54.0, 60.0] },
  "taiwan":   { name: "台湾海峡", bbox: [21.0, 27.0, 116.0, 122.0] },
  "panama":   { name: "巴拿马运河", bbox: [7.0, 10.0, -81.0, -77.0] },
  // East & South Asia
  "south_china_sea": { name: "南海", bbox: [3.0, 22.0, 105.0, 121.0] },
  "east_china_sea":  { name: "东海", bbox: [25.0, 33.0, 120.0, 130.0] },
  "japan_sea":       { name: "日本海", bbox: [33.0, 43.0, 128.0, 142.0] },
  "korea_strait":    { name: "朝鲜海峡", bbox: [33.0, 36.0, 126.0, 132.0] },
  "singapore":       { name: "新加坡海峡", bbox: [1.0, 1.5, 103.5, 104.5] },
  // Middle East & Africa
  "persian_gulf":    { name: "波斯湾", bbox: [24.0, 30.5, 48.0, 56.5] },
  "gulf_of_aden":    { name: "亚丁湾", bbox: [10.0, 15.5, 43.0, 54.0] },
  "suez":            { name: "苏伊士运河", bbox: [29.5, 31.5, 32.0, 33.5] },
  // Europe
  "mediterranean":   { name: "地中海", bbox: [30.0, 45.0, -6.0, 36.0] },
  "english_channel": { name: "英吉利海峡", bbox: [49.0, 51.5, -5.5, 2.0] },
  "baltic":          { name: "波罗的海", bbox: [53.5, 60.0, 10.0, 30.0] },
  "black_sea":       { name: "黑海", bbox: [41.0, 46.5, 27.5, 42.0] },
  // Ocean routes
  "north_atlantic":  { name: "北大西洋航线", bbox: [35.0, 50.0, -45.0, -10.0] },
  "indian_ocean":    { name: "印度洋航线", bbox: [-5.0, 15.0, 55.0, 80.0] },
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

  constructor(zones: string[] = Object.keys(MARITIME_ZONES)) {
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
