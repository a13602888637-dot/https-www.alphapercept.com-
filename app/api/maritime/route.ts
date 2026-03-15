/**
 * Maritime API: AISStream.io WebSocket → REST cache
 *
 * AISStream uses WebSocket for real-time streaming.
 * This route opens a short-lived WebSocket connection,
 * collects vessel data for 10s, then caches and returns as REST JSON.
 *
 * Env vars:
 *   AISSTREAM_API_KEY
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// Cache vessels for 60 seconds to avoid rate limits
const vesselCache = new Map<string, {
  data: VesselData[];
  timestamp: number;
}>();
const CACHE_TTL = 60 * 1000;

interface VesselData {
  mmsi: string;
  imo?: string;
  shipName: string;
  lat: number;
  lng: number;
  speed: number;
  course: number;
  shipType: number;
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

async function fetchFromAISStream(zoneKeys: string[]): Promise<VesselData[]> {
  const apiKey = process.env.AISSTREAM_API_KEY;
  if (!apiKey) return [];

  const vessels: VesselData[] = [];
  const seenMMSI = new Set<string>();

  const boundingBoxes = zoneKeys
    .filter(k => MARITIME_ZONES[k])
    .map(k => MARITIME_ZONES[k].bbox);

  if (boundingBoxes.length === 0) return [];

  return new Promise((resolve) => {
    let ws: any;
    let timeout: NodeJS.Timeout;

    try {
      const WebSocket = require('ws');
      ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

      timeout = setTimeout(() => {
        try { ws?.close(); } catch {}
        resolve(vessels);
      }, 10000); // 10 second collection window

      ws.on('open', () => {
        const subscribeMsg = {
          APIKey: apiKey,
          BoundingBoxes: boundingBoxes.map(b => [[b.min_latitude, b.min_longitude], [b.max_latitude, b.max_longitude]]),
          FilterMessageTypes: ["PositionReport", "ShipStaticData"],
        };
        ws.send(JSON.stringify(subscribeMsg));
      });

      ws.on('message', (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          const meta = msg.MetaData;
          if (!meta?.MMSI) return;

          const mmsi = String(meta.MMSI);
          if (seenMMSI.has(mmsi)) return;
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

          const vessel: VesselData = {
            mmsi,
            shipName: (meta.ShipName ?? '').trim() || mmsi,
            lat: parseFloat(lat.toFixed(4)),
            lng: parseFloat(lng.toFixed(4)),
            speed: parseFloat((meta.Sog ?? 0).toFixed(1)),
            course: parseFloat((meta.Cog ?? 0).toFixed(1)),
            shipType: meta.ShipType ?? 0,
            destination: meta.Destination?.trim() || undefined,
            flag: meta.Flag || undefined,
            zone,
          };

          vessels.push(vessel);

          // Stop after collecting 300 unique vessels
          if (vessels.length >= 300) {
            clearTimeout(timeout);
            try { ws?.close(); } catch {}
            resolve(vessels);
          }
        } catch { /* skip malformed messages */ }
      });

      ws.on('error', (err: Error) => {
        console.warn('AISStream WebSocket error:', err.message);
        clearTimeout(timeout);
        resolve(vessels);
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        resolve(vessels);
      });
    } catch (err) {
      console.warn('AISStream connection failed:', err);
      clearTimeout(timeout!);
      resolve(vessels);
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const { zones = ['malacca', 'red_sea', 'taiwan'] } = await request.json().catch(() => ({}));
    const cacheKey = zones.sort().join(',');

    // Return cached data if fresh
    const cached = vesselCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        vessels: cached.data,
        count: cached.data.length,
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    const vessels = await fetchFromAISStream(zones);

    vesselCache.set(cacheKey, { data: vessels, timestamp: Date.now() });

    return NextResponse.json({
      success: true,
      vessels,
      count: vessels.length,
      zones: zones.filter((z: string) => MARITIME_ZONES[z]).map((z: string) => ({
        key: z,
        name: MARITIME_ZONES[z].name,
        count: vessels.filter(v => v.zone === z).length,
      })),
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Maritime API error:', error);
    return NextResponse.json(
      { success: false, error: 'Maritime data fetch failed', vessels: [] },
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
