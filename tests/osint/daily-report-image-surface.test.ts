import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  compactShareHeadline,
  compactShareLabel,
  isShareHeadlineReady,
  shareSourceKey,
  sharePosterDate,
} from "../../lib/osint/daily-report/image-copy.ts";

function read(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

const imageExportPath = "lib/osint/daily-report/image-export.tsx";
assert.equal(existsSync(resolve(imageExportPath)), true);
const imageExport = read(imageExportPath);
for (const contract of [
  "ImageResponse",
  "renderHotspotPoster",
  "renderStockHotlistPoster",
  "selectReportStocks",
  "selectReportHotMoney",
  "curateReportStories",
  "DAILY_REPORT_WATERMARK",
  "DAILY_REPORT_DISCLAIMER",
  "width: 1080",
  "height: 1920",
  "NotoSansSC",
]) {
  assert.equal(imageExport.includes(contract), true, `missing ${contract}`);
}
assert.match(imageExport, /fontSize:\s*(?:3[0-9]|[4-9][0-9])/);
assert.equal(imageExport.includes("fontSize: 18"), false);
assert.equal(imageExport.includes("fontSize: 20"), false);
assert.equal(imageExport.includes("fontSize: 22"), false);
assert.equal(imageExport.includes("unique.length === 10"), true);
assert.equal(imageExport.includes("slice(0, 6)"), true);
assert.equal(imageExport.includes('justifyContent: "space-between"'), true);
assert.equal(imageExport.includes("calc(50%"), false);
assert.equal(imageExport.includes('whiteSpace: "nowrap"'), true);
assert.equal(imageExport.includes("主要买入："), true);
assert.equal(imageExport.includes("compactShareHeadline"), true);
assert.equal(imageExport.includes("compactShareLabel"), true);
assert.equal(imageExport.includes("isShareHeadlineReady"), true);
assert.equal(imageExport.includes("shareSourceKey"), true);

const longHeadline = "超长财经新闻标题".repeat(12);
const compactHeadline = compactShareHeadline(longHeadline);
assert.equal(compactHeadline.endsWith("…"), false);
assert.equal(isShareHeadlineReady(longHeadline), false);
assert.equal(
  compactShareHeadline("Inside India's AI Ambitions | Bloomberg Tech: Asia 8/28/2026"),
  "印度加速布局人工智能产业 | 彭博亚洲科技 8/28/2026"
);
assert.equal(isShareHeadlineReady("Inside India's AI Ambitions | Bloomberg Tech: Asia 8/28/2026"), true);
assert.equal(compactShareHeadline("美联储主席Kevin Warsh：Keynote Remarks"), "美联储主席Kevin Warsh：主题演讲");
assert.equal(compactShareHeadline("美联储发布Beige Book"), "美联储发布褐皮书");
assert.equal(
  shareSourceKey("https://www.bloomberg.com/a?utm_source=x", "Yotta董事长称将IPO"),
  shareSourceKey("https://www.bloomberg.com/a", "Yotta CEO称将IPO")
);
const compactLabel = compactShareLabel("某某证券股份有限公司超长地区证券营业部观察席");
assert.ok(Array.from(compactLabel).length <= 12);
assert.equal(/[\r\n]/.test(compactLabel), false);
assert.equal(
  sharePosterDate("stories", {
    reportDate: "2026-08-27",
    generatedAt: "2026-08-28T01:03:10.814Z",
    tradeDate: "2026-08-27",
  }),
  "2026-08-28"
);
assert.equal(
  sharePosterDate("hotlist", {
    reportDate: "2026-08-27",
    generatedAt: "2026-08-28T01:03:10.814Z",
    tradeDate: "2026-08-27",
  }),
  "2026-08-27"
);

const imageContract = read("lib/osint/daily-report/image-contract.ts");
assert.equal(imageContract.includes('DAILY_REPORT_IMAGE_LAYOUT_VERSION = "tiktok-v2"'), true);
const readiness = read("lib/osint/daily-report/image-readiness.ts");
assert.equal(readiness.includes("isDailyReportImageReady"), true);
assert.equal(readiness.includes("NotoSansSC-Medium-static.ttf"), true);
assert.equal(readiness.includes("existsSync"), true);
assert.equal(readiness.includes("createHash"), true);
assert.equal(readiness.includes("readFileSync"), true);
assert.match(readiness, /DAILY_REPORT_IMAGE_FONT_SHA256\s*=\s*"[a-f0-9]{64}"/);

const exportRoute = read("app/api/osint/v1/reports/[reportId]/export/route.ts");
assert.equal(exportRoute.includes("buildDailyReportPng"), true);
assert.equal(exportRoute.includes("image/png"), true);
assert.equal(exportRoute.includes(".png"), true);
assert.equal(exportRoute.includes("buildDailyReportPdf"), false);
assert.equal(exportRoute.includes("application/pdf"), false);
assert.equal(exportRoute.includes('"stories"'), true);
assert.equal(exportRoute.includes('"hotlist"'), true);
for (const removedSection of ['"full"', '"stocks"', '"lhb"']) {
  assert.equal(exportRoute.includes(removedSection), false);
}

const actions = read("components/osint-reports/PrintActions.tsx");
assert.equal(actions.includes('section: "stories"'), true);
assert.equal(actions.includes('section: "hotlist"'), true);
assert.equal(actions.includes("下载当日热点图片"), true);
assert.equal(actions.includes("下载个股热榜图片"), true);
assert.equal(actions.includes("PDF"), false);

const view = read("components/osint-reports/DailyReportView.tsx");
assert.equal(view.includes('{ value: "stories", label: "当日热点" }'), true);
assert.equal(view.includes('{ value: "hotlist", label: "个股热榜" }'), true);
assert.equal(view.includes('{ value: "stocks"'), false);
assert.equal(view.includes('{ value: "lhb"'), false);
assert.equal(view.includes("个股资金榜"), true);
assert.equal(view.includes("游资席位榜"), true);
assert.equal(view.includes("whitespace-nowrap"), true);

const center = read("components/osint-reports/DailyReportCenter.tsx");
assert.equal(center.includes("当日热点"), true);
assert.equal(center.includes("个股热榜"), true);
assert.equal(center.includes("PDF"), false);
assert.equal(center.includes("个股 {report.lhbStockCount}"), false);
assert.equal(center.includes("游资 {report.lhbHotMoneyCount}"), false);
assert.equal(center.includes("热榜 {report.lhbStockCount + report.lhbHotMoneyCount}"), true);

console.log("DAILY_REPORT_IMAGE_SURFACE_OK");
