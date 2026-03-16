/**
 * Maritime API: AISStream.io WebSocket → REST cache
 *
 * AISStream uses WebSocket for real-time streaming.
 * This route opens a short-lived 6s WebSocket connection,
 * collects vessel data, caches and returns as REST JSON.
 *
 * Cache tiers:
 *   FRESH   (< 60s)  — returned immediately, stale: false
 *   SEMI    (60–300s) — used as fallback if live fetch returns 0 vessels, stale: true
 *   EXPIRED (> 300s) — discarded
 *
 * Env vars:
 *   AISSTREAM_API_KEY
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// Cache tiers (milliseconds)
const CACHE_FRESH_TTL  = 60  * 1000; //  60s — serve immediately
const CACHE_SEMI_TTL   = 300 * 1000; // 300s — use as stale fallback
const LIVE_THRESHOLD   = 120 * 1000; // data is "live" if fetched within 120s

const vesselCache = new Map<string, {
  data: VesselData[];
  timestamp: number;
  connected: boolean;
}>();

// Ship type classification based on AIS type codes
function classifyShipType(code: number): string {
  if (code >= 70 && code <= 79) return "cargo";
  if (code >= 80 && code <= 89) return "tanker";
  if (code >= 60 && code <= 69) return "passenger";
  if (code >= 35 && code <= 39) return "military";
  return "unknown";
}

interface VesselData {
  mmsi: string;
  imo?: string;
  shipName: string;
  lat: number;
  lng: number;
  speed: number;
  course: number;
  shipType: number;
  shipTypeLabel: string;
  destination?: string;
  flag?: string;
  zone: string;
}

// Monitored chokepoint bounding boxes
const MARITIME_ZONES: Record<string, {
  name: string;
  bbox: { min_latitude: number; max_latitude: number; min_longitude: number; max_longitude: number };
}> = {
  malacca:  { name: "马六甲海峡", bbox: { min_latitude: 0.5, max_latitude: 4.5, min_longitude: 99.0, max_longitude: 104.5 } },
  red_sea:  { name: "红海", bbox: { min_latitude: 12.0, max_latitude: 22.0, min_longitude: 36.0, max_longitude: 44.0 } },
  hormuz:   { name: "霍尔木兹", bbox: { min_latitude: 25.0, max_latitude: 27.5, min_longitude: 55.0, max_longitude: 58.0 } },
  taiwan:   { name: "台湾海峡", bbox: { min_latitude: 22.5, max_latitude: 26.0, min_longitude: 117.5, max_longitude: 121.0 } },
  panama:   { name: "巴拿马运河", bbox: { min_latitude: 8.5, max_latitude: 9.5, min_longitude: -80.0, max_longitude: -79.0 } },
};

interface FetchResult {
  vessels: VesselData[];
  connected: boolean;
  noApiKey?: boolean;
}

async function fetchFromAISStream(zoneKeys: string[]): Promise<FetchResult> {
  const apiKey = process.env.AISSTREAM_API_KEY;
  if (!apiKey) return { vessels: [], connected: false, noApiKey: true };

  const vessels: VesselData[] = [];
  const seenMMSI = new Set<string>();
  // Track IMO numbers from ShipStaticData messages keyed by MMSI
  const imoByMMSI = new Map<string, string>();

  const boundingBoxes = zoneKeys
    .filter(k => MARITIME_ZONES[k])
    .map(k => MARITIME_ZONES[k].bbox);

  if (boundingBoxes.length === 0) return { vessels: [], connected: false };

  return new Promise((resolve) => {
    let ws: any;
    let timeout: NodeJS.Timeout;
    let dataTimeout: NodeJS.Timeout;
    let didConnect = false;
    let resolved = false;

    function doResolve(result: FetchResult) {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      clearTimeout(dataTimeout);
      // Backfill IMO numbers
      for (const v of result.vessels) {
        if (!v.imo && imoByMMSI.has(v.mmsi)) {
          v.imo = imoByMMSI.get(v.mmsi);
        }
      }
      resolve(result);
    }

    try {
      const WebSocket = require('ws');
      ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

      // Hard wall: must return within 7.5s total (Vercel Hobby = 10s, leave 2.5s margin)
      timeout = setTimeout(() => {
        console.log(`AISStream timeout hit: vessels=${vessels.length} connected=${didConnect}`);
        try { ws?.close(); } catch {}
        doResolve({ vessels, connected: didConnect });
      }, 7500);

      ws.on('open', () => {
        didConnect = true;
        const subscribeMsg = {
          APIKey: apiKey,
          BoundingBoxes: boundingBoxes.map(b => [[b.min_latitude, b.min_longitude], [b.max_latitude, b.max_longitude]]),
          FilterMessageTypes: ["PositionReport", "ShipStaticData"],
        };
        ws.send(JSON.stringify(subscribeMsg));
        console.log(`AISStream subscription sent for zones: ${zoneKeys.join(',')}`);

        // If no data arrives within 3s of connection, close and resolve early
        // (prevents holding the function alive if AISStream is not responding with data)
        dataTimeout = setTimeout(() => {
          if (vessels.length === 0) {
            console.warn(`AISStream: no data received 3s after subscription, closing early`);
            try { ws?.close(); } catch {}
          }
        }, 3000);
      });

      ws.on('message', (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          const meta = msg.MetaData;
          if (!meta?.MMSI) {
            // Log non-vessel messages (e.g. auth errors, server notices)
            if (msg.error || msg.message || msg.status) {
              console.warn('AISStream server message:', JSON.stringify(msg).substring(0, 200));
            }
            return;
          }

          // First data received — cancel the early-close dataTimeout
          if (vessels.length === 0) {
            clearTimeout(dataTimeout);
          }

          const mmsi = String(meta.MMSI);

          // Extract IMO from ShipStaticData messages
          if (msg.MessageType === 'ShipStaticData' && msg.Message?.ShipStaticData?.ImoNumber) {
            const imo = String(msg.Message.ShipStaticData.ImoNumber);
            if (imo && imo !== '0') {
              imoByMMSI.set(mmsi, imo);
            }
          }

          if (seenMMSI.has(mmsi)) {
            // Even if we already have this vessel, update its IMO if newly available
            if (imoByMMSI.has(mmsi)) {
              const existing = vessels.find(v => v.mmsi === mmsi);
              if (existing && !existing.imo) {
                existing.imo = imoByMMSI.get(mmsi);
              }
            }
            return;
          }
          seenMMSI.add(mmsi);

          // Find which zone this vessel is in
          const lat = meta.latitude ?? 0;
          const lng = meta.longitude ?? 0;
          let zone = 'unknown';
          for (const [zk, zv] of Object.entries(MARITIME_ZONES)) {
            if (zoneKeys.includes(zk)) {
              const b = zv.bbox;
              if (lat >= b.min_latitude && lat <= b.max_latitude &&
                  lng >= b.min_longitude && lng <= b.max_longitude) {
                zone = zk;
                break;
              }
            }
          }

          const shipTypeCode = meta.ShipType ?? 0;
          const vessel: VesselData = {
            mmsi,
            imo: imoByMMSI.get(mmsi),
            shipName: (meta.ShipName ?? '').trim() || mmsi,
            lat: parseFloat(lat.toFixed(4)),
            lng: parseFloat(lng.toFixed(4)),
            speed: parseFloat((meta.Sog ?? 0).toFixed(1)),
            course: parseFloat((meta.Cog ?? 0).toFixed(1)),
            shipType: shipTypeCode,
            shipTypeLabel: classifyShipType(shipTypeCode),
            destination: meta.Destination?.trim() || undefined,
            flag: meta.Flag || undefined,
            zone,
          };

          vessels.push(vessel);

          // Stop after collecting 300 unique vessels
          if (vessels.length >= 300) {
            try { ws?.close(); } catch {}
            doResolve({ vessels, connected: didConnect });
          }
        } catch { /* skip malformed messages */ }
      });

      ws.on('error', (err: Error) => {
        console.warn('AISStream WebSocket error:', err.message);
        doResolve({ vessels, connected: didConnect });
      });

      ws.on('close', (code: number, reason: Buffer) => {
        console.warn(`AISStream WS closed: code=${code} reason=${reason?.toString() || 'none'} didConnect=${didConnect} vessels=${vessels.length}`);
        doResolve({ vessels, connected: didConnect });
      });
    } catch (err) {
      console.warn('AISStream connection failed:', err);
      doResolve({ vessels, connected: false });
    }
  });
}

/** Build the vesselsByZone summary map from a vessel list. */
function buildVesselsByZone(vessels: VesselData[], zoneKeys: string[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const zk of zoneKeys) {
    if (MARITIME_ZONES[zk]) summary[zk] = 0;
  }
  for (const v of vessels) {
    if (v.zone in summary) summary[v.zone]++;
  }
  return summary;
}

export async function POST(request: NextRequest) {
  try {
    const { zones = ['malacca', 'red_sea', 'taiwan'] } = await request.json().catch(() => ({}));
    const cacheKey = [...zones].sort().join(',');
    const now = Date.now();

    const cached = vesselCache.get(cacheKey);
    const cacheAge = cached ? now - cached.timestamp : Infinity;

    // --- TIER 1: FRESH cache (< 60s) — return immediately ---
    if (cached && cacheAge < CACHE_FRESH_TTL) {
      const isLive = cacheAge < LIVE_THRESHOLD;
      return NextResponse.json({
        success: true,
        vessels: cached.data,
        count: cached.data.length,
        vesselCount: cached.data.length,
        connected: cached.connected,
        isLive,
        lastFetchedAt: new Date(cached.timestamp).toISOString(),
        zones: zones.filter((z: string) => MARITIME_ZONES[z]).map((z: string) => ({
          key: z,
          name: MARITIME_ZONES[z].name,
          count: cached.data.filter((v: VesselData) => v.zone === z).length,
        })),
        vesselsByZone: buildVesselsByZone(cached.data, zones),
        cached: true,
        stale: false,
        timestamp: new Date().toISOString(),
      });
    }

    // --- Attempt live fetch ---
    const result = await fetchFromAISStream(zones);
    const fetchedAt = Date.now();

    if (result.vessels.length > 0) {
      // Live fetch succeeded — update cache and return fresh data
      vesselCache.set(cacheKey, {
        data: result.vessels,
        timestamp: fetchedAt,
        connected: result.connected,
      });

      return NextResponse.json({
        success: true,
        vessels: result.vessels,
        count: result.vessels.length,
        vesselCount: result.vessels.length,
        connected: result.connected,
        isLive: result.connected,
        lastFetchedAt: new Date(fetchedAt).toISOString(),
        zones: zones.filter((z: string) => MARITIME_ZONES[z]).map((z: string) => ({
          key: z,
          name: MARITIME_ZONES[z].name,
          count: result.vessels.filter((v: VesselData) => v.zone === z).length,
        })),
        vesselsByZone: buildVesselsByZone(result.vessels, zones),
        cached: false,
        stale: false,
        timestamp: new Date().toISOString(),
      });
    }

    // --- Live fetch returned 0 vessels ---

    // TIER 2: SEMI-FRESH stale cache (60–300s) — return with stale flag
    if (cached && cacheAge < CACHE_SEMI_TTL) {
      console.warn(`AISStream returned 0 vessels; serving semi-fresh stale cache (age: ${Math.round(cacheAge / 1000)}s)`);
      return NextResponse.json({
        success: true,
        vessels: cached.data,
        count: cached.data.length,
        vesselCount: cached.data.length,
        connected: false,
        isLive: false,
        lastFetchedAt: new Date(cached.timestamp).toISOString(),
        zones: zones.filter((z: string) => MARITIME_ZONES[z]).map((z: string) => ({
          key: z,
          name: MARITIME_ZONES[z].name,
          count: cached.data.filter((v: VesselData) => v.zone === z).length,
        })),
        vesselsByZone: buildVesselsByZone(cached.data, zones),
        cached: true,
        stale: true,
        staleSince: new Date(cached.timestamp).toISOString(),
        timestamp: new Date().toISOString(),
      });
    }

    // TIER 3: No usable cache at all — return empty with explanation
    return NextResponse.json({
      success: true,
      vessels: [],
      count: 0,
      vesselCount: 0,
      connected: result.connected,
      isLive: false,
      lastFetchedAt: null,
      zones: zones.filter((z: string) => MARITIME_ZONES[z]).map((z: string) => ({
        key: z,
        name: MARITIME_ZONES[z].name,
        count: 0,
      })),
      vesselsByZone: buildVesselsByZone([], zones),
      cached: false,
      stale: false,
      noDataReason: result.noApiKey
        ? "AISSTREAM_API_KEY not configured — maritime data unavailable"
        : "AISStream returned no vessels for these zones at this time",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Maritime API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Maritime data fetch failed',
        vessels: [],
        vesselCount: 0,
        connected: false,
        isLive: false,
        lastFetchedAt: null,
        stale: false,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    zones: Object.entries(MARITIME_ZONES).map(([key, z]) => ({ key, name: z.name })),
    configured: !!process.env.AISSTREAM_API_KEY,
  });
}
