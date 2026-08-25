import { NextResponse } from "next/server";
import { getMarketSnapshot } from "@/lib/osint/market-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getMarketSnapshot();
  const markets = snapshot.markets.map((market) => ({
    symbol: market.symbol,
    name: market.name,
    category: market.category,
    instrumentType: market.instrumentType,
    region: market.region,
    price: market.value,
    change: market.change,
    changePercent: market.changePercent,
    source: market.source,
    asOf: market.asOf,
    status: market.status,
    confidence: market.confidence,
  }));
  const availableSources = [
    ...new Set(
      snapshot.markets
        .filter((market) => market.status !== "unavailable")
        .map((market) => market.source)
    ),
  ];

  return NextResponse.json(
    {
      success: snapshot.coverage.available > 0,
      markets,
      primarySource: availableSources.length > 0 ? availableSources.join("+") : "unavailable",
      liveCount: snapshot.markets.filter((market) => market.status === "live").length,
      totalCount: snapshot.coverage.total,
      coverage: snapshot.coverage,
      timestamp: snapshot.generatedAt,
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
}
