export const dynamic = "force-dynamic";

interface EnergyPrice {
  symbol: string;
  name: string;
  price: number | null;
  previousPrice: number | null;
  change: number | null;
  changePercent: number | null;
  unit: string;
}

let cache: { energy: EnergyPrice[] } | null = null;
let cacheTime = 0;
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

function getMockData(): EnergyPrice[] {
  return [
    {
      symbol: "WTI",
      name: "WTI Crude Oil",
      price: 78.45,
      previousPrice: 77.82,
      change: 0.63,
      changePercent: 0.81,
      unit: "$/barrel",
    },
    {
      symbol: "BRENT",
      name: "Brent Crude Oil",
      price: 82.31,
      previousPrice: 81.95,
      change: 0.36,
      changePercent: 0.44,
      unit: "$/barrel",
    },
    {
      symbol: "NG",
      name: "Natural Gas",
      price: 2.68,
      previousPrice: 2.55,
      change: 0.13,
      changePercent: 5.1,
      unit: "$/MMBtu",
    },
  ];
}

async function fetchPetroleumData(
  apiKey: string
): Promise<EnergyPrice[]> {
  const url = `https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=${apiKey}&frequency=daily&data[0]=value&sort[0][column]=period&sort[0][direction]=desc&length=10&facets[product][]=EPCWTI&facets[product][]=EPCBRE`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`EIA petroleum: ${res.status}`);

  const json = await res.json();
  const data = json.response?.data ?? [];

  const grouped: Record<string, { value: number; period: string }[]> = {};
  for (const row of data) {
    const key = row["product-name"] ?? row.product;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({ value: parseFloat(row.value), period: row.period });
  }

  const results: EnergyPrice[] = [];

  for (const [productName, rows] of Object.entries(grouped)) {
    rows.sort((a, b) => b.period.localeCompare(a.period));
    const price = rows[0]?.value ?? null;
    const previousPrice = rows[1]?.value ?? null;
    const change =
      price !== null && previousPrice !== null
        ? parseFloat((price - previousPrice).toFixed(2))
        : null;
    const changePercent =
      change !== null && previousPrice
        ? parseFloat(((change / previousPrice) * 100).toFixed(2))
        : null;

    const isWTI = productName.includes("WTI") || productName.includes("Cushing");
    results.push({
      symbol: isWTI ? "WTI" : "BRENT",
      name: isWTI ? "WTI Crude Oil" : "Brent Crude Oil",
      price,
      previousPrice,
      change,
      changePercent,
      unit: "$/barrel",
    });
  }

  return results;
}

async function fetchNaturalGasData(
  apiKey: string
): Promise<EnergyPrice | null> {
  const url = `https://api.eia.gov/v2/natural-gas/pri/fut/data/?api_key=${apiKey}&frequency=daily&data[0]=value&sort[0][column]=period&sort[0][direction]=desc&length=5&facets[process][]=FRP`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`EIA natural gas: ${res.status}`);

  const json = await res.json();
  const data = json.response?.data ?? [];

  if (data.length < 1) return null;

  data.sort(
    (a: { period: string }, b: { period: string }) =>
      b.period.localeCompare(a.period)
  );

  const price = parseFloat(data[0].value);
  const previousPrice = data[1] ? parseFloat(data[1].value) : null;
  const change =
    previousPrice !== null
      ? parseFloat((price - previousPrice).toFixed(2))
      : null;
  const changePercent =
    change !== null && previousPrice
      ? parseFloat(((change / previousPrice) * 100).toFixed(2))
      : null;

  return {
    symbol: "NG",
    name: "Natural Gas",
    price,
    previousPrice,
    change,
    changePercent,
    unit: "$/MMBtu",
  };
}

export async function GET() {
  try {
    const now = Date.now();
    if (cache && now - cacheTime < CACHE_DURATION) {
      return Response.json({ success: true, energy: cache.energy });
    }

    const apiKey = process.env.EIA_API_KEY;
    if (!apiKey) {
      const energy = getMockData();
      return Response.json({ success: true, energy, source: "mock" });
    }

    const [petroleum, gas] = await Promise.allSettled([
      fetchPetroleumData(apiKey),
      fetchNaturalGasData(apiKey),
    ]);

    const energy: EnergyPrice[] = [];
    if (petroleum.status === "fulfilled") {
      energy.push(...petroleum.value);
    }
    if (gas.status === "fulfilled" && gas.value) {
      energy.push(gas.value);
    }

    if (energy.length === 0) {
      const mock = getMockData();
      return Response.json({ success: true, energy: mock, source: "mock" });
    }

    cache = { energy };
    cacheTime = now;

    return Response.json({ success: true, energy });
  } catch (error) {
    console.error("EIA API error:", error);
    return Response.json(
      { success: false, error: "Failed to fetch EIA data" },
      { status: 500 }
    );
  }
}
