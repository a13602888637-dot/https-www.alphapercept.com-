import assert from "node:assert/strict";
import type { OsintDailyReportSnapshot } from "../../lib/osint/daily-report/contracts.ts";
import { buildVideoStoryboard, normalizeVideoHeadline } from "../../lib/osint/daily-video/storyboard.ts";
import { themeForDate, DAILY_VIDEO_THEMES } from "../../lib/osint/daily-video/themes.ts";
import { compactVideoShareName, videoShareAmount } from "../../lib/osint/daily-video/copy.ts";
import { pageIndexAtTime, pageTransitionAtTime, wrapMeasuredText } from "../../lib/osint/daily-video/canvas-renderer.ts";
import { mp4EncodingApisAvailable } from "../../lib/osint/daily-video/mp4-encoder.ts";

const MODULES = ["宏观", "科技", "能源"] as const;

const stories = Array.from({ length: 20 }, (_, index) => {
  const module = index < 6 ? MODULES[0] : index < 13 ? MODULES[1] : MODULES[2];
  return {
    id: `story-${index}`,
    title: `第${String(index + 1).padStart(2, "0")}条${module}重点新闻标题与核心变化`,
    originalTitle: `Original story ${index + 1}`,
    language: "zh",
    translationStatus: "native",
    summary: `这是第${index + 1}条新闻的完整摘要，说明事件背景、核心变化、可能影响和后续值得继续观察的数据。`,
    importance: 20 - index * 0.25,
    publishedAt: `2026-08-31T${String(index % 10).padStart(2, "0")}:00:00.000Z`,
    scheduledFor: null,
    eventType: "news",
    analysisStatus: "complete",
    tags: {
      topic: [module],
      region: [index % 2 === 0 ? "中国" : "美国"],
      assets: [module === "科技" ? "人工智能" : module === "能源" ? "原油" : "利率"],
      direction: index % 3 === 0 ? "risk-off" : "neutral",
      horizon: "1-3d",
      verification: "multi-source",
    },
    sources: [{ name: `官方来源${(index % 3) + 1}`, url: `https://example.com/${module}/story-${index}` }],
  };
});

const stocks = Array.from({ length: 20 }, (_, index) => {
  const positive = index < 10;
  const netAmount = (positive ? 1 : -1) * (500_000_000 - index * 10_000_000);
  return {
    tradeId: `trade-${index}`,
    code: `${600000 + index}`,
    name: `样本名称${index + 1}`,
    changePercent: positive ? 4.2 : -3.6,
    buyAmount: positive ? 700_000_000 - index * 5_000_000 : 80_000_000,
    sellAmount: positive ? 200_000_000 : 500_000_000 - index * 5_000_000,
    netAmount,
    reasons: [positive ? "当日换手率活跃" : "当日振幅较大"],
    buySeats: [],
    sellSeats: [],
  };
});

const hotMoneyFlows = Array.from({ length: 10 }, (_, index) => ({
  flowId: `active:${index}`,
  kind: index < 4 ? "known" : "active",
  label: `活跃席位${index + 1}`,
  confidence: index < 4 ? "A" : null,
  departmentNames: [`营业部${index + 1}`],
  totalNetAmount: (index % 2 === 0 ? 1 : -1) * (100_000_000 - index * 2_000_000),
  totalBuyAmount: 300_000_000 - index * 5_000_000,
  totalSellAmount: 200_000_000 - index * 3_000_000,
  stockCount: 2,
  stocks: [
    { code: stocks[index].code, name: stocks[index].name, reasons: [], buyAmount: 90_000_000, sellAmount: 20_000_000, netAmount: 70_000_000 },
    { code: stocks[index + 1].code, name: stocks[index + 1].name, reasons: [], buyAmount: 60_000_000, sellAmount: 30_000_000, netAmount: 30_000_000 },
  ],
}));

const snapshot = {
  schemaVersion: "1.0",
  reportDate: "2026-08-31",
  edition: "close",
  generatedAt: "2026-08-31T08:00:00.000Z",
  asOf: "2026-08-31T07:50:00.000Z",
  stories: { stories },
  lhb: { tradeDate: "2026-08-31", stocks, hotMoneyFlows },
} as unknown as OsintDailyReportSnapshot;

const reportUrl = "https://www.alphapercept.com/osint/reports/report-1";

const themeIds = Array.from({ length: 7 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 7, 31 + index)).toISOString().slice(0, 10);
  return themeForDate(date).id;
});
assert.equal(new Set(themeIds).size, 7);
assert.equal(new Set(DAILY_VIDEO_THEMES.map((theme) => theme.sound.join("-"))).size, 7);
assert.equal(compactVideoShareName("嘉立创"), "J立创");
assert.equal(compactVideoShareName("*ST萃华"), "C华");
assert.equal(videoShareAmount(652436808.6), "65,244🥣");

const morning = buildVideoStoryboard(snapshot, "morning", { reportUrl });
assert.equal(morning.mode, "morning");
assert.equal(morning.pages[0].kind, "cover");
const morningPages = morning.pages.filter((page) => page.kind === "stories");
const morningCards = morningPages.flatMap((page) => page.stories);
assert.equal(morningCards.length, 20);
assert.equal(new Set(morningCards.map((story) => story.id)).size, 20);
assert.equal(morningPages.length, 7);
assert.equal(morningPages.every((page) => page.stories.length >= 2 && page.stories.length <= 3), true);
assert.equal(morningPages.every((page) => new Set(page.stories.map((story) => story.module)).size === 1), true);
assert.equal(morningCards.every((story) => story.sourceName.length > 0 && story.sourceUrl.startsWith("https://")), true);
assert.equal(morningCards.some((story) => story.summary.includes("待补充")), false);
for (const module of new Set(morningCards.map((story) => story.module))) {
  const indexes = morningCards.flatMap((story, index) => story.module === module ? [index] : []);
  assert.equal(indexes.at(-1)! - indexes[0] + 1, indexes.length);
}
assert.equal(morning.pages[0].kind === "cover" && morning.pages[0].highlights.length, 6);
assert.equal(morning.pages.every((page) => page.reportUrl === reportUrl), true);
assert.equal(morning.durationMs >= 15_000 && morning.durationMs <= 20_000, true);
assert.equal(morning.pages[0].kind === "cover" && morning.pages[0].highlights.every((highlight) => !morningCards.some((story) => normalizeVideoHeadline(story.title) === normalizeVideoHeadline(highlight))), true);
assert.equal(pageIndexAtTime(morning, 0), 0);
assert.equal(pageIndexAtTime(morning, 1_200), 1);
assert.equal(pageIndexAtTime(morning, 3_599), 1);
assert.equal(pageIndexAtTime(morning, 3_600), 2);
assert.equal(pageTransitionAtTime(morning, 1_200), 0);
assert.equal(pageTransitionAtTime(morning, 1_480), 1);
assert.equal(pageTransitionAtTime(morning, 3_500), 1);
const wrappedSummary = wrapMeasuredText("一页内容必须完整呈现并保持手机可读", 320, (value) => Array.from(value).length * 40);
assert.equal(wrappedSummary.length > 1, true);
assert.equal(wrappedSummary.every((line) => Array.from(line).length * 40 <= 320), true);
assert.equal(mp4EncodingApisAvailable({ VideoEncoder: {}, AudioEncoder: {}, VideoFrame: {}, AudioData: {} }), true);
assert.equal(mp4EncodingApisAvailable({ VideoEncoder: {}, AudioEncoder: {}, VideoFrame: {} }), false);

const close = buildVideoStoryboard(snapshot, "close", { reportUrl });
assert.equal(close.mode, "close");
assert.equal(close.pages[0].kind, "cover");
assert.equal(close.durationMs >= 15_000 && close.durationMs <= 20_000, true);
const rankingEntries = close.pages.flatMap((page) => page.kind === "ranking" ? page.entries : []);
const accountCards = close.pages.flatMap((page) => page.kind === "accounts" ? page.accounts : []);
assert.equal(rankingEntries.length, 20);
assert.equal(accountCards.length, 10);
assert.equal(close.pages.filter((page) => page.kind === "ranking").every((page) => page.entries.length <= 10), true);
assert.equal(close.pages.filter((page) => page.kind === "accounts").every((page) => page.accounts.length <= 5), true);
assert.equal(accountCards.every((account) => account.relatedNames.length <= 2), true);
assert.equal(close.pages[0].kind === "cover" && close.pages[0].highlights.every((highlight) => !rankingEntries.some((entry) => highlight.includes(entry.label))), true);

const withEnglishLead = {
  ...snapshot,
  stories: {
    ...snapshot.stories,
    stories: [{ ...stories[0], id: "english", title: "纽约市场最新观察", summary: "English only", importance: 99 }, ...stories],
  },
};
const chineseMorning = buildVideoStoryboard(withEnglishLead, "morning", { reportUrl });
assert.equal(chineseMorning.pages.flatMap((page) => page.kind === "stories" ? page.stories : []).some((story) => story.id === "english"), false);

const retailLead = { ...stories[0], id: "retail", title: "零售市场更新", importance: 99, tags: { ...stories[0].tags, topic: ["Retail"], assets: [] } };
const retailMorning = buildVideoStoryboard({ ...snapshot, stories: { ...snapshot.stories, stories: [retailLead, ...stories] } }, "morning", { reportUrl });
const retailCard = retailMorning.pages.flatMap((page) => page.kind === "stories" ? page.stories : []).find((story) => story.id === "retail");
assert.notEqual(retailCard?.module, "科技产业");

const duplicateLead = { ...stories[0], id: "duplicate", title: `${stories[0].title} | 早间更新 2026年8月31日`, importance: 99 };
const deduplicatedMorning = buildVideoStoryboard({ ...snapshot, stories: { ...snapshot.stories, stories: [duplicateLead, ...stories] } }, "morning", { reportUrl });
const normalizedTitles = deduplicatedMorning.pages.flatMap((page) => page.kind === "stories" ? page.stories : []).map((story) => normalizeVideoHeadline(story.title));
assert.equal(normalizedTitles.filter((title) => title === normalizeVideoHeadline(stories[0].title)).length, 1);

const eventA = { ...stories[0], id: "event-a", title: "新兴市场股市下跌，沃什助长美联储加息预期", importance: 99 };
const eventB = { ...stories[1], id: "event-b", title: "美国市场震荡，沃什助长加息预期", importance: 98 };
const eventMorning = buildVideoStoryboard({ ...snapshot, stories: { ...snapshot.stories, stories: [eventA, eventB, ...stories] } }, "morning", { reportUrl });
const eventIds = eventMorning.pages.flatMap((page) => page.kind === "stories" ? page.stories : []).map((story) => story.id);
assert.equal(eventIds.includes("event-a") && eventIds.includes("event-b"), false);

const staleClose = buildVideoStoryboard({ ...snapshot, lhb: { ...snapshot.lhb, tradeDate: "2026-08-28" } }, "close", { reportUrl });
assert.equal(staleClose.date, "2026-08-31");
assert.equal(staleClose.dataDate, "2026-08-28");

console.log("DAILY_REPORT_VIDEO_TEST_OK");
