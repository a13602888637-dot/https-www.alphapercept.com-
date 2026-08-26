import assert from "node:assert/strict";
import type { OsintStory } from "../../lib/osint/contracts";
import { composeDailyReportSnapshot } from "../../lib/osint/daily-report/compose";
import { buildDailyReportPdf } from "../../lib/osint/daily-report/pdf-export";
import { curateReportStories } from "../../lib/osint/daily-report/story-curation";
import * as reportCuration from "../../lib/osint/daily-report/story-curation";

function story(input: Partial<OsintStory> & Pick<OsintStory, "id" | "publishedAt" | "title">): OsintStory {
  return {
    id: input.id,
    publishedAt: input.publishedAt,
    title: input.title,
    originalTitle: input.originalTitle ?? input.title,
    language: input.language ?? "zh",
    translationStatus: input.translationStatus ?? "native",
    summary: input.summary ?? `${input.title}摘要`,
    importance: input.importance ?? 6,
    sources: input.sources ?? [{ name: "测试来源", url: `https://example.com/${input.id}` }],
    tags: input.tags ?? {
      topic: ["综合"],
      region: [],
      assets: [],
      direction: "neutral",
      horizon: "1-3d",
      verification: "single-source",
    },
    analysisStatus: input.analysisStatus ?? "fallback",
    eventType: input.eventType ?? "news",
    scheduledFor: input.scheduledFor ?? null,
  };
}

async function verifyPdfContract() {
  const curated = curateReportStories([
    story({
      id: "future-event",
      title: "未来美联储主席讲话",
      publishedAt: "2026-08-26T14:00:00.000Z",
      importance: 9,
      analysisStatus: "complete",
      eventType: "upcoming",
      scheduledFor: "2026-08-26T14:00:00.000Z",
      tags: { topic: ["未来事件", "宏观"], region: ["美国"], assets: ["美债"], direction: "neutral", horizon: "1-3d", verification: "official" },
    }),
    story({
      id: "future-later",
      title: "未来美国就业报告",
      publishedAt: "2026-08-27T14:00:00.000Z",
      importance: 9,
      analysisStatus: "complete",
      eventType: "upcoming",
      scheduledFor: "2026-08-27T14:00:00.000Z",
      tags: { topic: ["未来事件", "宏观"], region: ["美国"], assets: ["美元"], direction: "neutral", horizon: "1-3d", verification: "official" },
    }),
    story({
      id: "tech-new",
      title: "芯片产业更新",
      publishedAt: "2026-08-25T10:00:00.000Z",
      importance: 7.2,
      analysisStatus: "complete",
      tags: { topic: ["科技"], region: ["美国"], assets: ["半导体"], direction: "risk-on", horizon: "1-3d", verification: "multi-source" },
    }),
    story({
      id: "tech-old",
      title: "较早的人工智能行业事件",
      publishedAt: "2026-08-25T08:00:00.000Z",
      importance: 6.5,
      tags: { topic: ["科技"], region: [], assets: ["AI"], direction: "neutral", horizon: "1-3d", verification: "official" },
    }),
    story({
      id: "energy",
      title: "原油供应扰动",
      publishedAt: "2026-08-25T09:30:00.000Z",
      importance: 7.8,
      tags: { topic: ["能源"], region: ["中东"], assets: ["原油"], direction: "risk-off", horizon: "intraday", verification: "multi-source" },
    }),
    story({
      id: "noise",
      title: "低价值单源杂讯",
      publishedAt: "2026-08-25T10:30:00.000Z",
      importance: 2,
    }),
    story({
      id: "analyzed-noise",
      title: "已经分析但仍是低价值单源杂讯",
      publishedAt: "2026-08-25T10:20:00.000Z",
      importance: 2,
      analysisStatus: "complete",
      tags: { topic: ["科技"], region: [], assets: [], direction: "neutral", horizon: "1-3d", verification: "single-source" },
    }),
  ]);

  assert.equal(curated.totalCount, 7);
  assert.equal(curated.selectedCount, 5);
  assert.deepEqual(curated.categories.map((item: { label: string }) => item.label), ["接下来要留意", "能源怎么走", "科技有什么变化"]);
  assert.deepEqual(curated.categories.find((item: { key: string }) => item.key === "technology")?.stories.map((item: OsintStory) => item.id), ["tech-new", "tech-old"]);
  assert.deepEqual(curated.categories.find((item) => item.key === "upcoming")?.stories.map((item) => item.id), ["future-event", "future-later"]);
  const energyCategory = curated.categories.find((item) => item.key === "energy");
  assert.match(energyCategory?.insight ?? "", /原油/);
  assert.doesNotMatch(energyCategory?.insight ?? "", /多源|验证|风险偏好/);
  const plainCategoryLabel = (reportCuration as unknown as Record<string, (...args: never[]) => unknown>).plainCategoryLabel;
  const plainStockReason = (reportCuration as unknown as Record<string, (...args: never[]) => unknown>).plainStockReason;
  const selectReportStocks = (reportCuration as unknown as Record<string, (...args: never[]) => unknown>).selectReportStocks;
  const selectReportHotMoney = (reportCuration as unknown as Record<string, (...args: never[]) => unknown>).selectReportHotMoney;
  assert.equal(typeof plainCategoryLabel, "function");
  assert.equal(typeof plainStockReason, "function");
  assert.equal(typeof selectReportStocks, "function");
  assert.equal(typeof selectReportHotMoney, "function");
  if (plainCategoryLabel && plainStockReason && selectReportStocks && selectReportHotMoney) {
    assert.equal(plainCategoryLabel("macro" as never), "今天市场在看什么");
    assert.equal(plainStockReason(["日涨幅偏离值达到7%的前5只证券"] as never), "涨幅明显，登上龙虎榜");
    const selection = selectReportStocks(Array.from({ length: 25 }, (_, index) => ({
      tradeId: `selection-${index}`,
      code: String(index).padStart(6, "0"),
      name: `测试${index}`,
      changePercent: 0,
      buyAmount: 10_000 - index * 100,
      sellAmount: index * 500,
      netAmount: 10_000 - index * 600,
      reasons: ["涨幅偏离"],
      buySeats: [],
      sellSeats: [],
    })) as never) as { inflows: unknown[]; outflows: unknown[] };
    assert.ok(selection.inflows.length <= 10);
    assert.ok(selection.outflows.length <= 10);
    const selectedFlows = selectReportHotMoney(Array.from({ length: 20 }, (_, index) => ({
      flowId: `flow-${index}`,
      kind: "known",
      label: `游资${index}`,
      confidence: "A",
      departmentNames: [`席位${index}`],
      totalBuyAmount: 20_000 - index * 100,
      totalSellAmount: index * 100,
      totalNetAmount: 20_000 - index * 200,
      stockCount: 1,
      stocks: [],
    })) as never) as unknown[];
    assert.ok(selectedFlows.length <= 15);
  }
  const rankReportStocks = (reportCuration as unknown as Record<string, unknown>).rankReportStocks;
  assert.equal(typeof rankReportStocks, "function", "个股资金榜应按股票代码去重");
  if (typeof rankReportStocks === "function") {
    const ranked = rankReportStocks([
      { tradeId: "dup-1", code: "000001", name: "测试股份", changePercent: 9.9, buyAmount: 100, sellAmount: 20, netAmount: 80, reasons: ["涨幅偏离"], buySeats: [], sellSeats: [] },
      { tradeId: "dup-2", code: "000001", name: "测试股份", changePercent: 9.9, buyAmount: 100, sellAmount: 20, netAmount: 80, reasons: ["换手率"], buySeats: [], sellSeats: [] },
    ]);
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].buyAmount, 100);
    assert.deepEqual(ranked[0].reasons, ["涨幅偏离", "换手率"]);
  }
  const snapshot = composeDailyReportSnapshot({
      now: new Date("2026-08-25T08:05:00.000Z"),
      markets: {
        schemaVersion: "1.0",
        generatedAt: "2026-08-25T08:00:00.000Z",
        coverage: { available: 1, total: 1, ratio: 1, stale: 0 },
        markets: [{ symbol: "CL=F", name: "不应进入PDF的行情", category: "commodity", instrumentType: "commodity", region: "全球", value: 80, change: 1, changePercent: 1, asOf: "2026-08-25T08:00:00.000Z", source: "test", status: "live", confidence: "single-source" }],
      },
      stories: {
        schemaVersion: "1.0",
        generatedAt: "2026-08-25T08:01:00.000Z",
        windowHours: 72,
        stories: [story({ id: "pdf-story", title: "芯片供应链出现重要变化", publishedAt: "2026-08-25T08:00:00.000Z", importance: 8, analysisStatus: "complete", tags: { topic: ["科技"], region: ["中国"], assets: ["半导体"], direction: "risk-on", horizon: "1-3d", verification: "multi-source" } })],
        pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
        advice: { text: "关注科技产业链的多源确认信号。", confidence: "medium", generatedAt: "2026-08-25T08:01:00.000Z" },
        sources: [{ name: "测试来源", ok: true, count: 1 }],
      },
      lhb: {
        schemaVersion: "1.0",
        status: "live",
        tradeDate: "2026-08-25",
        generatedAt: "2026-08-25T08:02:00.000Z",
        asOf: "2026-08-25T08:02:00.000Z",
        source: "eastmoney",
        sourceHealth: { summary: true, buySeats: true, sellSeats: true },
        errors: [],
        invalidRowCount: 0,
        stockCount: 1,
        seatCount: 1,
        stocks: [{ tradeId: "stock-1", code: "000001", name: "测试股份", changePercent: 9.9, buyAmount: 100_000_000, sellAmount: 20_000_000, netAmount: 80_000_000, reasons: ["日涨幅偏离值达到7%"], buySeats: [], sellSeats: [] }],
        seatFlows: [],
        hotMoneyFlows: [{ flowId: "flow-1", kind: "known", label: "测试游资席位", confidence: "A", departmentNames: ["测试证券营业部"], totalBuyAmount: 100_000_000, totalSellAmount: 20_000_000, totalNetAmount: 80_000_000, stockCount: 1, stocks: [{ code: "000001", name: "测试股份", reasons: ["日涨幅偏离值达到7%"], buyAmount: 100_000_000, sellAmount: 20_000_000, netAmount: 80_000_000 }] }],
        disclaimer: "席位映射仅供观察。",
      },
  });
  const pdf = await buildDailyReportPdf(snapshot, "full");
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.length > 5_000);
  assert.ok(pdf.length < 5_000_000, `移动端 PDF 体积过大：${pdf.length}`);
  const pageCount = (buffer: Buffer) => (buffer.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length;
  assert.equal(pageCount(pdf), 3);
  assert.equal(pageCount(await buildDailyReportPdf(snapshot, "stories")), 1);
  assert.equal(pageCount(await buildDailyReportPdf(snapshot, "stocks")), 1);
  assert.equal(pageCount(await buildDailyReportPdf(snapshot, "lhb")), 1);

  console.log("DAILY_REPORT_PDF_CONTRACT_OK");
}

void verifyPdfContract();
