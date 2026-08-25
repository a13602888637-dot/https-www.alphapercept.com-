import type { MarketSnapshot, OsintContext, StorySnapshot } from "./contracts";

export function composePublicContext(markets: MarketSnapshot, stories: StorySnapshot): OsintContext {
  const marketSourceMap = new Map<string, { name: string; available: number; stale: number }>();
  for (const market of markets.markets) {
    const current = marketSourceMap.get(market.source) ?? { name: market.source, available: 0, stale: 0 };
    if (market.status !== "unavailable") current.available += 1;
    if (market.status === "stale") current.stale += 1;
    marketSourceMap.set(market.source, current);
  }
  return {
    schemaVersion: "1.0",
    generatedAt: [markets.generatedAt, stories.generatedAt].sort().at(-1) ?? new Date().toISOString(),
    coverage: markets.coverage,
    markets: markets.markets,
    stories: stories.stories,
    advice: stories.advice,
    sourceHealth: {
      markets: [...marketSourceMap.values()],
      stories: stories.sources,
    },
  };
}
