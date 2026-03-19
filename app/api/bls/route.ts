export const dynamic = "force-dynamic";

interface LaborStat {
  seriesId: string;
  name: string;
  value: number | null;
  previousValue: number | null;
  delta: number | null;
  period: string | null;
}

const SERIES_META: Record<string, { name: string }> = {
  CUSR0000SA0: { name: "Consumer Price Index (CPI-U)" },
  LNS14000000: { name: "Unemployment Rate" },
  CES0000000001: { name: "Nonfarm Payrolls" },
};

const SERIES_IDS = Object.keys(SERIES_META);

let cache: { labor: LaborStat[] } | null = null;
let cacheTime = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

function getMockData(): LaborStat[] {
  return [
    {
      seriesId: "CUSR0000SA0",
      name: "Consumer Price Index (CPI-U)",
      value: 314.69,
      previousValue: 313.55,
      delta: 1.14,
      period: "M01 2026",
    },
    {
      seriesId: "LNS14000000",
      name: "Unemployment Rate",
      value: 3.9,
      previousValue: 4.0,
      delta: -0.1,
      period: "M01 2026",
    },
    {
      seriesId: "CES0000000001",
      name: "Nonfarm Payrolls",
      value: 157234,
      previousValue: 157012,
      delta: 222,
      period: "M01 2026",
    },
  ];
}

export async function GET() {
  try {
    const now = Date.now();
    if (cache && now - cacheTime < CACHE_DURATION) {
      return Response.json({ success: true, labor: cache.labor });
    }

    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 1;

    let labor: LaborStat[];

    try {
      const res = await fetch(
        "https://api.bls.gov/publicAPI/v2/timeseries/data/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seriesid: SERIES_IDS,
            startyear: String(startYear),
            endyear: String(currentYear),
          }),
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!res.ok) {
        throw new Error(`BLS API: ${res.status}`);
      }

      const json = await res.json();
      const seriesResults = json.Results?.series ?? [];

      labor = seriesResults.map(
        (series: {
          seriesID: string;
          data: { value: string; period: string; year: string }[];
        }) => {
          const id = series.seriesID;
          const meta = SERIES_META[id] ?? { name: id };
          // BLS returns data in reverse chronological order
          const data = series.data ?? [];

          const parseVal = (d: { value: string } | undefined) => {
            if (!d) return null;
            const v = parseFloat(d.value);
            return isNaN(v) ? null : v;
          };

          const value = parseVal(data[0]);
          const previousValue = parseVal(data[1]);
          const delta =
            value !== null && previousValue !== null
              ? parseFloat((value - previousValue).toFixed(2))
              : null;
          const period = data[0]
            ? `${data[0].period} ${data[0].year}`
            : null;

          return { seriesId: id, name: meta.name, value, previousValue, delta, period };
        }
      );

      if (labor.length === 0) {
        labor = getMockData();
        return Response.json({ success: true, labor, source: "mock" });
      }
    } catch {
      labor = getMockData();
      return Response.json({ success: true, labor, source: "mock" });
    }

    cache = { labor };
    cacheTime = now;

    return Response.json({ success: true, labor });
  } catch (error) {
    console.error("BLS API error:", error);
    return Response.json(
      { success: false, error: "Failed to fetch BLS data" },
      { status: 500 }
    );
  }
}
