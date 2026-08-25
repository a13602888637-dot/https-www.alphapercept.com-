import { NextResponse } from "next/server";
import { MARKET_MANIFEST } from "@/lib/osint/market-manifest";
import { getTreasuryMarkets } from "@/lib/osint/market-service";

export const dynamic = "force-dynamic";

const MATURITY_ORDER = ["1Y", "10Y", "20Y", "30Y"] as const;

export async function GET() {
  const markets = await getTreasuryMarkets();
  const bySymbol = new Map(markets.map((market) => [market.symbol, market]));
  const yields = MATURITY_ORDER.map((maturity) => {
    const market = bySymbol.get(`UST${maturity}`);
    const manifest = MARKET_MANIFEST[`UST${maturity}`];
    return {
      maturity,
      name: manifest.name,
      rate: market?.value ?? null,
      previousRate:
        market?.value !== null && market?.value !== undefined && market.change !== null
          ? Number((market.value - market.change).toFixed(4))
          : null,
      delta: market?.change ?? null,
      asOf: market?.asOf ?? null,
      status: market?.status ?? "unavailable",
    };
  });
  const oneYear = yields.find((item) => item.maturity === "1Y")?.rate;
  const tenYear = yields.find((item) => item.maturity === "10Y")?.rate;

  return NextResponse.json(
    {
      success: yields.some((item) => item.rate !== null),
      yields,
      curveInverted:
        oneYear !== null && oneYear !== undefined && tenYear !== null && tenYear !== undefined
          ? tenYear < oneYear
          : false,
      curveBasis: "10Y-1Y",
      source: [...new Set(markets.map((market) => market.source))].join("+") || "unavailable",
      asOf: yields.find((item) => item.asOf)?.asOf ?? null,
    },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
  );
}
