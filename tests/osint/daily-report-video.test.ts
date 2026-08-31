import assert from "node:assert/strict";
import type { OsintDailyReportSnapshot } from "../../lib/osint/daily-report/contracts.ts";
import { buildVideoStoryboard } from "../../lib/osint/daily-video/storyboard.ts";
import { themeForDate } from "../../lib/osint/daily-video/themes.ts";
import { compactVideoShareName, videoShareAmount } from "../../lib/osint/daily-video/copy.ts";

const stories = Array.from({ length: 6 }, (_, index) => ({
  id: `story-${index}`,
  title: `第${index + 1}条全球市场重点新闻标题`,
  summary: `第${index + 1}条新闻摘要`,
  importance: 9 - index * 0.5,
  publishedAt: `2026-08-31T0${index}:00:00.000Z`,
  scheduledFor: null,
  eventType: "news",
  tags: { topic: ["宏观"], assets: ["黄金"], direction: "neutral", verification: "verified" },
  sources: [{ name: "官方来源", url: `https://example.com/${index}` }],
}));

const snapshot = {
  schemaVersion: "1.0",
  reportDate: "2026-08-31",
  edition: "close",
  generatedAt: "2026-08-31T08:00:00.000Z",
  asOf: "2026-08-31T07:50:00.000Z",
  stories: { stories },
  lhb: {
    tradeDate: "2026-08-31",
    stocks: [
      { code: "001232", name: "嘉立创", netAmount: 650_000_000, buyAmount: 800_000_000, sellAmount: 150_000_000 },
      { code: "600378", name: "昊华科技", netAmount: -310_000_000, buyAmount: 20_000_000, sellAmount: 330_000_000 },
    ],
    hotMoneyFlows: [
      { flowId: "known:1", kind: "known", label: "武汉紫阳东路", totalNetAmount: 80_000_000, totalBuyAmount: 490_000_000, totalSellAmount: 410_000_000, stocks: [{ name: "嘉立创", buyAmount: 460_000_000 }] },
    ],
  },
} as unknown as OsintDailyReportSnapshot;

const themeIds = Array.from({ length: 7 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 7, 31 + index)).toISOString().slice(0, 10);
  return themeForDate(date).id;
});
assert.equal(new Set(themeIds).size, 7);
assert.equal(compactVideoShareName("嘉立创"), "J立创");
assert.equal(compactVideoShareName("*ST萃华"), "C华");
assert.equal(videoShareAmount(652436808.6), "65,244🥣");

const morning = buildVideoStoryboard(snapshot, "morning");
assert.equal(morning.mode, "morning");
assert.equal(morning.scenes.length, 5);
assert.equal(morning.durationMs, 12_000);

const close = buildVideoStoryboard(snapshot, "close");
assert.equal(close.mode, "close");
assert.notEqual(close.cover.layout, morning.cover.layout);
assert.equal(close.scenes.length > 0, true);

assert.throws(
  () => buildVideoStoryboard({ ...snapshot, lhb: { ...snapshot.lhb, tradeDate: "2026-08-28" } }, "close"),
  /STALE_CLOSE_DATA:2026-08-28/
);

console.log("DAILY_REPORT_VIDEO_TEST_OK");
