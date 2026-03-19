export const dynamic = "force-dynamic";

interface YieldPoint {
  maturity: string;
  rate: number | null;
  previousRate: number | null;
  delta: number | null;
}

interface TreasuryResponse {
  success: boolean;
  yields: YieldPoint[];
  curveInverted: boolean;
}

let cache: TreasuryResponse | null = null;
let cacheTime = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const TARGET_MATURITIES: Record<string, string> = {
  "1 Month": "1M",
  "3 Month": "3M",
  "6 Month": "6M",
  "1 Year": "1Y",
  "2 Year": "2Y",
  "5 Year": "5Y",
  "10 Year": "10Y",
  "30 Year": "30Y",
};

function getMockData(): TreasuryResponse {
  const yields: YieldPoint[] = [
    { maturity: "1M", rate: 5.53, previousRate: 5.52, delta: 0.01 },
    { maturity: "3M", rate: 5.46, previousRate: 5.45, delta: 0.01 },
    { maturity: "6M", rate: 5.36, previousRate: 5.37, delta: -0.01 },
    { maturity: "1Y", rate: 5.02, previousRate: 5.05, delta: -0.03 },
    { maturity: "2Y", rate: 4.72, previousRate: 4.74, delta: -0.02 },
    { maturity: "5Y", rate: 4.38, previousRate: 4.41, delta: -0.03 },
    { maturity: "10Y", rate: 4.25, previousRate: 4.28, delta: -0.03 },
    { maturity: "30Y", rate: 4.45, previousRate: 4.47, delta: -0.02 },
  ];
  const twoY = yields.find((y) => y.maturity === "2Y")?.rate ?? 0;
  const tenY = yields.find((y) => y.maturity === "10Y")?.rate ?? 0;
  return { success: true, yields, curveInverted: tenY < twoY };
}

export async function GET() {
  try {
    const now = Date.now();
    if (cache && now - cacheTime < CACHE_DURATION) {
      return Response.json(cache);
    }

    const url =
      "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates?sort=-record_date&page[size]=30";

    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    } catch {
      const mock = getMockData();
      return Response.json({ ...mock, source: "mock" });
    }

    if (!res.ok) {
      const mock = getMockData();
      return Response.json({ ...mock, source: "mock" });
    }

    const json = await res.json();
    const records = json.data ?? [];

    // Group by security description, keep latest two per maturity
    const grouped: Record<string, { rate: number; date: string }[]> = {};
    for (const rec of records) {
      const desc: string = rec.security_desc ?? "";
      const avgRate = parseFloat(rec.avg_interest_rate_amt);
      if (isNaN(avgRate)) continue;

      // Match against target maturities
      for (const [keyword, label] of Object.entries(TARGET_MATURITIES)) {
        if (desc.includes(keyword)) {
          if (!grouped[label]) grouped[label] = [];
          grouped[label].push({ rate: avgRate, date: rec.record_date });
          break;
        }
      }
    }

    const maturityOrder = ["1M", "3M", "6M", "1Y", "2Y", "5Y", "10Y", "30Y"];
    const yields: YieldPoint[] = maturityOrder.map((maturity) => {
      const entries = grouped[maturity] ?? [];
      entries.sort((a, b) => b.date.localeCompare(a.date));
      const rate = entries[0]?.rate ?? null;
      const previousRate = entries[1]?.rate ?? null;
      const delta =
        rate !== null && previousRate !== null
          ? parseFloat((rate - previousRate).toFixed(4))
          : null;
      return { maturity, rate, previousRate, delta };
    });

    const twoY = yields.find((y) => y.maturity === "2Y")?.rate ?? 0;
    const tenY = yields.find((y) => y.maturity === "10Y")?.rate ?? 0;
    const curveInverted = tenY < twoY;

    const result: TreasuryResponse = { success: true, yields, curveInverted };

    // Only cache if we got meaningful data
    if (yields.some((y) => y.rate !== null)) {
      cache = result;
      cacheTime = now;
    }

    return Response.json(result);
  } catch (error) {
    console.error("Treasury API error:", error);
    return Response.json(
      { success: false, error: "Failed to fetch Treasury data" },
      { status: 500 }
    );
  }
}
