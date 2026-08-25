import assert from "node:assert/strict";

import type { LhbSnapshot } from "../../lib/lhb/contracts";
import type {
  MarketSnapshot,
  StorySnapshot,
} from "../../lib/osint/contracts";
import { composeDailyReportSnapshot } from "../../lib/osint/daily-report/compose";
import { buildDailyReportHtml } from "../../lib/osint/daily-report/export-html";

const REQUIRED_WATERMARK = "AlphaPercept · 仅供参考";
const REQUIRED_DISCLAIMER =
  "本报告基于公开信息自动整理，仅供学习与复盘参考，不构成投资建议或任何买卖依据。数据可能延迟或存在误差，请以交易所、上市公司及原始来源为准。";

const markets: MarketSnapshot = {
  schemaVersion: "1.0",
  generatedAt: "2026-08-25T08:00:00.000Z",
  coverage: { available: 1, total: 2, ratio: 0.5, stale: 0 },
  markets: [
    {
      symbol: "CL=F",
      name: "WTI原油",
      category: "commodity",
      instrumentType: "commodity",
      region: "global",
      value: 85.4,
      change: 1.2,
      changePercent: 1.43,
      source: "yahoo",
      asOf: "2026-08-25T07:59:00.000Z",
      status: "live",
      confidence: "single-source",
    },
  ],
};

const stories: StorySnapshot = {
  schemaVersion: "1.0",
  generatedAt: "2026-08-25T08:01:00.000Z",
  windowHours: 72,
  stories: [
    {
      id: "story-1",
      publishedAt: "2026-08-25T07:30:00.000Z",
      title: "中东供应扰动推升油价",
      originalTitle: "Middle East supply disruption lifts oil",
      language: "en",
      translationStatus: "translated",
      summary: "原油短线走强，风险偏好承压。",
      importance: 8,
      sources: [{ name: "BBC", url: "https://example.com/story" }],
      tags: {
        topic: ["能源"],
        region: ["中东"],
        assets: ["原油"],
        direction: "risk-off",
        horizon: "1-3d",
        verification: "single-source",
      },
      analysisStatus: "complete",
    },
  ],
  pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
  advice: {
    text: "控制高波动仓位并关注原油。",
    confidence: "medium",
    generatedAt: "2026-08-25T08:01:00.000Z",
  },
  sources: [{ name: "BBC", ok: true, count: 1 }],
};

const lhb: LhbSnapshot = {
  schemaVersion: "1.0",
  status: "live",
  tradeDate: "2026-08-24",
  generatedAt: "2026-08-25T08:02:00.000Z",
  asOf: "2026-08-24T00:00:00+08:00",
  source: "eastmoney",
  sourceHealth: { summary: true, buySeats: true, sellSeats: true },
  errors: [],
  invalidRowCount: 0,
  stockCount: 1,
  seatCount: 1,
  stocks: [
    {
      tradeId: "trade-1",
      code: "600000",
      name: "浦发银行",
      changePercent: 10,
      buyAmount: 100_000_000,
      sellAmount: 20_000_000,
      netAmount: 80_000_000,
      reasons: ["日涨幅偏离值达7%"],
      buySeats: [],
      sellSeats: [],
    },
  ],
  seatFlows: [],
  hotMoneyFlows: [
    {
      flowId: "known:炒股养家观察席",
      kind: "known",
      label: "炒股养家观察席",
      confidence: "B",
      departmentNames: ["华鑫证券股份有限公司上海宛平南路证券营业部"],
      totalBuyAmount: 100_000_000,
      totalSellAmount: 20_000_000,
      totalNetAmount: 80_000_000,
      stockCount: 1,
      stocks: [{ code: "600000", name: "浦发银行", reasons: ["日涨幅偏离值达7%"], buyAmount: 100_000_000, sellAmount: 20_000_000, netAmount: 80_000_000 }],
    },
  ],
  disclaimer: "龙虎榜金额来自公开盘后数据。",
};

const report = composeDailyReportSnapshot({
  markets,
  stories,
  lhb,
  now: new Date("2026-08-25T08:05:00.000Z"),
});

assert.equal(report.schemaVersion, "1.0");
assert.equal(report.periodType, "daily");
assert.equal(report.periodKey, "2026-08-25");
assert.equal(report.asOf, "2026-08-25T08:02:00.000Z");
assert.equal(report.markets.markets[0].symbol, "CL=F");
assert.equal(report.stories.stories[0].id, "story-1");
assert.equal(report.lhb.tradeDate, "2026-08-24");
assert.equal(report.sourceHealth.markets.available, 1);
assert.equal(report.sourceHealth.stories[0].name, "BBC");
assert.equal(report.sourceHealth.lhb.status, "live");

const serialized = JSON.stringify(report).toLowerCase();
for (const forbidden of ["userid", "clerk", "watchlist", "portfolio"]) {
  assert.equal(serialized.includes(forbidden), false);
}

const fullHtml = buildDailyReportHtml(report, "full", { autoPrint: true });
assert.match(fullHtml, /全球行情/);
assert.match(fullHtml, /世界热点/);
assert.match(fullHtml, /资金龙虎榜/);
assert.match(fullHtml, /炒股养家观察席/);
assert.match(fullHtml, /买入 10,000 万/);
assert.match(fullHtml, /window\.print/);
assert.match(fullHtml, /@media print/);
assert.match(fullHtml, new RegExp(REQUIRED_WATERMARK));
assert.match(fullHtml, new RegExp(REQUIRED_DISCLAIMER));
assert.match(fullHtml, /\.watermark\{[^}]*position:fixed/);
assert.match(fullHtml, /<footer[^>]*>.*本报告基于公开信息自动整理/s);

const marketHtml = buildDailyReportHtml(report, "markets");
assert.match(marketHtml, /全球行情/);
assert.doesNotMatch(marketHtml, /世界热点/);
assert.doesNotMatch(marketHtml, /资金龙虎榜/);

console.log("DAILY_REPORT_CONTRACT_OK");
