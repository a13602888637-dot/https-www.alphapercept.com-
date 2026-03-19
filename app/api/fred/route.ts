export const dynamic = "force-dynamic";

interface FredIndicator {
  seriesId: string;
  name: string;
  value: number | null;
  previousValue: number | null;
  delta: number | null;
  unit: string;
  frequency: string;
  lastUpdated: string | null;
}

const SERIES_MAP: Record<string, { name: string; unit: string; frequency: string }> = {
  GDP: { name: "GDP Growth Rate", unit: "%", frequency: "Quarterly" },
  UNRATE: { name: "Unemployment Rate", unit: "%", frequency: "Monthly" },
  CPIAUCSL: { name: "Consumer Price Index", unit: "Index", frequency: "Monthly" },
  FEDFUNDS: { name: "Fed Funds Rate", unit: "%", frequency: "Monthly" },
  T10Y2Y: { name: "10Y-2Y Yield Spread", unit: "%", frequency: "Daily" },
  DGS10: { name: "10Y Treasury Yield", unit: "%", frequency: "Daily" },
  VIXCLS: { name: "VIX Volatility Index", unit: "Index", frequency: "Daily" },
};

const SERIES_IDS = Object.keys(SERIES_MAP);

let cache: { indicators: FredIndicator[] } | null = null;
let cacheTime = 0;
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

function getMockData(): FredIndicator[] {
  const mockValues: Record<string, [number, number]> = {
    GDP: [2.1, 1.9],
    UNRATE: [3.9, 4.0],
    CPIAUCSL: [314.69, 313.55],
    FEDFUNDS: [5.33, 5.33],
    T10Y2Y: [-0.36, -0.42],
    DGS10: [4.25, 4.18],
    VIXCLS: [16.82, 15.45],
  };

  return SERIES_IDS.map((id) => {
    const [value, prev] = mockValues[id];
    const meta = SERIES_MAP[id];
    return {
      seriesId: id,
      name: meta.name,
      value,
      previousValue: prev,
      delta: parseFloat((value - prev).toFixed(4)),
      unit: meta.unit,
      frequency: meta.frequency,
      lastUpdated: new Date().toISOString(),
    };
  });
}

async function fetchSeries(
  seriesId: string,
  apiKey: string
): Promise<FredIndicator> {
  const meta = SERIES_MAP[seriesId];
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=2`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) {
    throw new Error(`FRED ${seriesId}: ${res.status}`);
  }

  const json = await res.json();
  const observations = json.observations ?? [];

  const parse = (v: string | undefined) => {
    if (!v || v === ".") return null;
    return parseFloat(v);
  };

  const value = parse(observations[0]?.value);
  const previousValue = parse(observations[1]?.value);
  const delta =
    value !== null && previousValue !== null
      ? parseFloat((value - previousValue).toFixed(4))
      : null;

  return {
    seriesId,
    name: meta.name,
    value,
    previousValue,
    delta,
    unit: meta.unit,
    frequency: meta.frequency,
    lastUpdated: observations[0]?.date ?? null,
  };
}

export async function GET() {
  try {
    const now = Date.now();
    if (cache && now - cacheTime < CACHE_DURATION) {
      return Response.json({ success: true, indicators: cache.indicators });
    }

    const apiKey = process.env.FRED_API_KEY;
    if (!apiKey) {
      const indicators = getMockData();
      return Response.json({ success: true, indicators, source: "mock" });
    }

    const results = await Promise.allSettled(
      SERIES_IDS.map((id) => fetchSeries(id, apiKey))
    );

    const indicators: FredIndicator[] = results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      const meta = SERIES_MAP[SERIES_IDS[i]];
      return {
        seriesId: SERIES_IDS[i],
        name: meta.name,
        value: null,
        previousValue: null,
        delta: null,
        unit: meta.unit,
        frequency: meta.frequency,
        lastUpdated: null,
      };
    });

    cache = { indicators };
    cacheTime = now;

    return Response.json({ success: true, indicators });
  } catch (error) {
    console.error("FRED API error:", error);
    return Response.json(
      { success: false, error: "Failed to fetch FRED data" },
      { status: 500 }
    );
  }
}
