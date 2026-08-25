import { getLhbSnapshot } from "../../lhb/service";
import type { LhbSnapshot } from "../../lhb/contracts";
import type { MarketSnapshot, StorySnapshot } from "../contracts";
import { getMarketSnapshot } from "../market-service";
import { getStorySnapshot } from "../story-service";
import { composeDailyReportSnapshot } from "./compose";
import type { OsintDailyReportSnapshot } from "./contracts";
import { saveDailyReport } from "./repository";

interface DailyReportDependencies {
  getMarkets: () => Promise<MarketSnapshot>;
  getStories: () => Promise<StorySnapshot>;
  getLhb: () => Promise<LhbSnapshot>;
}

const defaultDependencies: DailyReportDependencies = {
  getMarkets: () => getMarketSnapshot(),
  getStories: () => getStorySnapshot({ window: "72h", page: 1, pageSize: 50 }),
  getLhb: () => getLhbSnapshot(),
};

function unavailableMarkets(generatedAt: string): MarketSnapshot {
  return {
    schemaVersion: "1.0",
    generatedAt,
    coverage: { available: 0, total: 0, ratio: 0, stale: 0 },
    markets: [],
  };
}

function unavailableStories(generatedAt: string): StorySnapshot {
  return {
    schemaVersion: "1.0",
    generatedAt,
    windowHours: 72,
    stories: [],
    pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 },
    advice: {
      text: "热点数据暂不可用，请以原始来源为准。",
      confidence: "low",
      generatedAt: null,
    },
    sources: [],
  };
}

function unavailableLhb(generatedAt: string): LhbSnapshot {
  return {
    schemaVersion: "1.0",
    status: "unavailable",
    tradeDate: "",
    generatedAt,
    asOf: null,
    source: "eastmoney",
    sourceHealth: { summary: false, buySeats: false, sellSeats: false },
    errors: ["龙虎榜数据暂不可用"],
    invalidRowCount: 0,
    stockCount: 0,
    seatCount: 0,
    stocks: [],
    seatFlows: [],
    hotMoneyFlows: [],
    disclaimer:
      "龙虎榜金额来自公开盘后数据；游资别名仅为民间观察映射，不代表真实账户身份。",
  };
}

export async function collectDailyReportSnapshot(options: {
  now?: Date;
  dependencies?: Partial<DailyReportDependencies>;
} = {}): Promise<OsintDailyReportSnapshot> {
  const now = options.now ?? new Date();
  const generatedAt = now.toISOString();
  const dependencies = { ...defaultDependencies, ...options.dependencies };
  const [marketsResult, storiesResult, lhbResult] = await Promise.allSettled([
    dependencies.getMarkets(),
    dependencies.getStories(),
    dependencies.getLhb(),
  ]);

  return composeDailyReportSnapshot({
    markets:
      marketsResult.status === "fulfilled"
        ? marketsResult.value
        : unavailableMarkets(generatedAt),
    stories:
      storiesResult.status === "fulfilled"
        ? storiesResult.value
        : unavailableStories(generatedAt),
    lhb:
      lhbResult.status === "fulfilled"
        ? lhbResult.value
        : unavailableLhb(generatedAt),
    now,
  });
}

export async function generateAndSaveDailyReport() {
  const snapshot = await collectDailyReportSnapshot();
  return saveDailyReport(snapshot);
}
