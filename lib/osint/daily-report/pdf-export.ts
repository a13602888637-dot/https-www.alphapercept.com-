import PDFDocument from "pdfkit";
import type { LhbHotMoneyFlow, LhbStock } from "../../lhb/contracts";
import type { OsintStory } from "../contracts";
import type {
  DailyReportExportSection,
  OsintDailyReportSnapshot,
} from "./contracts";
import {
  DAILY_REPORT_DISCLAIMER,
  DAILY_REPORT_WATERMARK,
} from "./export-html";
import {
  DAILY_REPORT_PDF_FONT_ASSET,
  isDailyReportPdfReady,
} from "./pdf-readiness";
import {
  curateReportStories,
  plainStockReason,
  plainStoryImpact,
  selectReportHotMoney,
  selectReportStocks,
  type CuratedStoryCategory,
} from "./story-curation";

export const DAILY_REPORT_PDF_LAYOUT_VERSION = "social-v2";

const FONT = "NotoSansSC";
const FONT_PATH = `${process.cwd()}/${DAILY_REPORT_PDF_FONT_ASSET}`;
const PAGE = { width: 1080, height: 1350, left: 64, right: 1016, footer: 1272 };
const COLORS = {
  canvas: "#F6FAFC",
  white: "#FFFFFF",
  ink: "#0B1B32",
  navy: "#0B1B32",
  cyan: "#00B8C4",
  coral: "#F45B69",
  coralSoft: "#FFF0F2",
  orange: "#F59E32",
  green: "#11966F",
  greenSoft: "#E8F7F1",
  slate: "#607489",
  muted: "#8C9BAD",
  line: "#D6E3EB",
  row: "#EDF4F7",
} as const;

const CATEGORY_COLORS: Record<CuratedStoryCategory["key"], string> = {
  upcoming: COLORS.orange,
  macro: "#2F7DD1",
  geopolitics: COLORS.coral,
  energy: "#DB9B22",
  technology: COLORS.cyan,
  markets: "#7758B5",
};

function clip(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}

function amount(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 100_000_000) return `${(absolute / 100_000_000).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}亿`;
  return `${(absolute / 10_000).toLocaleString("zh-CN", { maximumFractionDigits: 0 })}万`;
}

function shanghaiTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "--";
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function shortShanghaiTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "--";
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai", month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function shortEventTime(story: OsintStory): string {
  const value = story.scheduledFor || story.publishedAt;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "--";
  if (story.scheduledPrecision === "date" || story.scheduledPrecision === "session") {
    const day = date.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric" });
    const session = story.scheduledSession === "bmo" ? "盘前" : story.scheduledSession === "dmh" ? "盘中" : story.scheduledSession === "amc" ? "盘后" : "";
    return `${day}${session ? ` ${session}` : ""}`;
  }
  return shortShanghaiTime(value);
}

function drawPageBase(doc: PDFKit.PDFDocument, report: OsintDailyReportSnapshot, pageNumber: number, totalPages: number): void {
  doc.rect(0, 0, PAGE.width, PAGE.height).fill(COLORS.canvas);
  doc.rect(0, 0, 10, PAGE.height).fill(COLORS.cyan);
  doc.font(FONT).fontSize(17).fillColor(COLORS.muted).text("ALPHAPERCEPT 每日复盘", PAGE.left, 30, { lineBreak: false });
  doc.moveTo(PAGE.left, 62).lineTo(PAGE.right, 62).lineWidth(1).strokeColor(COLORS.line).stroke();
  doc.save().opacity(0.035).font(FONT).fontSize(76).fillColor(COLORS.navy)
    .rotate(-22, { origin: [PAGE.width / 2, PAGE.height / 2] })
    .text(DAILY_REPORT_WATERMARK, 210, 620, { width: 660, align: "center", lineBreak: false }).restore();
  doc.moveTo(PAGE.left, PAGE.footer).lineTo(PAGE.right, PAGE.footer).lineWidth(1).strokeColor(COLORS.line).stroke();
  doc.font(FONT).fontSize(15).fillColor(COLORS.slate)
    .text(DAILY_REPORT_DISCLAIMER, PAGE.left, 1286, { width: 800, height: 25, ellipsis: true });
  doc.fontSize(16).fillColor(COLORS.muted)
    .text(`${pageNumber} / ${totalPages}`, PAGE.right - 76, 1288, { width: 76, align: "right", lineBreak: false });
  doc.fontSize(14).fillColor(COLORS.muted).text(`数据截至 ${shanghaiTime(report.asOf)}`, PAGE.left, 1320, { lineBreak: false });
}

function drawTitle(doc: PDFKit.PDFDocument, title: string, subtitle: string, accent = COLORS.cyan): void {
  doc.rect(PAGE.left, 88, 10, 106).fill(accent);
  doc.font(FONT).fontSize(18).fillColor(accent).text("每日复盘", 94, 88, { characterSpacing: 2, lineBreak: false });
  doc.fontSize(48).fillColor(COLORS.ink).text(title, 94, 116, { lineBreak: false });
  doc.fontSize(22).fillColor(COLORS.slate).text(clip(subtitle, 44), 94, 174, { width: 900, lineBreak: false, ellipsis: true });
}

function drawUpcoming(doc: PDFKit.PDFDocument, stories: OsintStory[], startY: number): number {
  const events = stories.slice(0, 4);
  if (events.length === 0) return startY;
  const width = PAGE.right - PAGE.left;
  const headerHeight = 50;
  const rowHeight = 80;
  doc.roundedRect(PAGE.left, startY, width, headerHeight + events.length * rowHeight, 14).fillAndStroke(COLORS.white, COLORS.line);
  doc.roundedRect(PAGE.left, startY, width, headerHeight, 14).fill(COLORS.navy);
  doc.rect(PAGE.left, startY + 28, width, 22).fill(COLORS.navy);
  doc.font(FONT).fontSize(27).fillColor(COLORS.white).text("接下来要留意", PAGE.left + 22, startY + 12, { lineBreak: false });
  events.forEach((story, index) => {
    const y = startY + headerHeight + index * rowHeight;
    if (index % 2 === 1) doc.rect(PAGE.left, y, width, rowHeight).fill(COLORS.row);
    doc.fontSize(21).fillColor(COLORS.orange).text(shortEventTime(story), PAGE.left + 22, y + 24, { width: 158, lineBreak: false });
    doc.fontSize(25).fillColor(COLORS.ink).text(clip(story.title, 24), PAGE.left + 188, y + 18, { width: 474, height: 36, ellipsis: true });
    doc.fontSize(19).fillColor(COLORS.slate).text(clip(plainStoryImpact(story), 22), PAGE.left + 674, y + 21, { width: 254, height: 32, align: "right", ellipsis: true });
  });
  return startY + headerHeight + events.length * rowHeight + 20;
}

function drawStoryModule(doc: PDFKit.PDFDocument, category: CuratedStoryCategory, x: number, y: number, width: number, height: number): void {
  const accent = CATEGORY_COLORS[category.key];
  doc.roundedRect(x, y, width, height, 14).fillAndStroke(COLORS.white, COLORS.line);
  doc.rect(x, y, 9, height).fill(accent);
  doc.font(FONT).fontSize(28).fillColor(COLORS.ink).text(category.label, x + 24, y + 18, { width: width - 48, lineBreak: false });
  doc.fontSize(19).fillColor(COLORS.slate).text(clip(category.insight, 30), x + 24, y + 58, { width: width - 48, height: 30, ellipsis: true });
  const stories = category.stories.slice(0, 2);
  const contentTop = y + 104;
  const slotHeight = Math.max(116, (height - 112) / Math.max(1, stories.length));
  stories.forEach((story, index) => {
    const storyY = contentTop + index * slotHeight;
    doc.moveTo(x + 24, storyY - 8).lineTo(x + width - 24, storyY - 8).lineWidth(1).strokeColor(COLORS.line).stroke();
    doc.fontSize(24).fillColor(COLORS.ink).text(clip(story.title, 28), x + 24, storyY + 3, { width: width - 48, height: 35, ellipsis: true });
    doc.fontSize(20).fillColor(COLORS.slate).text(clip(story.summary, 52), x + 24, storyY + 42, { width: width - 48, height: 54, ellipsis: true });
    doc.fontSize(18).fillColor(accent).text(clip(plainStoryImpact(story), 32), x + 24, storyY + 102, { width: width - 48, height: 28, ellipsis: true });
    doc.fontSize(16).fillColor(COLORS.muted).text(shortShanghaiTime(story.publishedAt), x + 24, storyY + 135, { lineBreak: false });
  });
}

export function drawStoryBoardPage(doc: PDFKit.PDFDocument, report: OsintDailyReportSnapshot): void {
  const curated = curateReportStories(report.stories.stories, { maxPerCategory: 2 });
  const upcoming = curated.categories.find((category) => category.key === "upcoming");
  const categories = curated.categories.filter((category) => category.key !== "upcoming").slice(0, 4);
  const lead = categories.flatMap((category) => category.stories).sort((left, right) => right.importance - left.importance)[0];
  drawTitle(doc, "热点复盘", lead ? `今天重点：${lead.title}` : "把今天最值得关注的消息放在一页里");
  const gridY = drawUpcoming(doc, upcoming?.stories ?? [], 225);
  if (categories.length === 0) return;
  const gap = 20;
  const columns = categories.length === 1 ? 1 : 2;
  const rows = Math.ceil(categories.length / columns);
  const width = (PAGE.right - PAGE.left - gap * (columns - 1)) / columns;
  const height = (1240 - gridY - gap * (rows - 1)) / rows;
  categories.forEach((category, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    drawStoryModule(doc, category, PAGE.left + column * (width + gap), gridY + row * (height + gap), width, height);
  });
}

function drawStockColumn(doc: PDFKit.PDFDocument, title: string, stocks: LhbStock[], x: number, y: number, width: number, accent: string, soft: string): void {
  if (stocks.length === 0) return;
  doc.roundedRect(x, y, width, 58, 14).fill(accent);
  doc.font(FONT).fontSize(28).fillColor(COLORS.white).text(title, x + 22, y + 14, { lineBreak: false });
  const rowHeight = Math.min(96, (1238 - y - 70) / stocks.length);
  stocks.forEach((stock, index) => {
    const rowY = y + 70 + index * rowHeight;
    doc.roundedRect(x, rowY, width, rowHeight - 8, 12).fillAndStroke(index % 2 === 0 ? COLORS.white : soft, COLORS.line);
    doc.fontSize(18).fillColor(COLORS.muted).text(String(index + 1).padStart(2, "0"), x + 16, rowY + 14, { width: 32, lineBreak: false });
    doc.fontSize(24).fillColor(COLORS.ink).text(clip(stock.name, 8), x + 54, rowY + 10, { width: 160, lineBreak: false, ellipsis: true });
    doc.fontSize(16).fillColor(COLORS.muted).text(stock.code, x + 54, rowY + 43, { lineBreak: false });
    const netLabel = stock.netAmount >= 0 ? "净买入" : "净卖出";
    doc.fontSize(18).fillColor(COLORS.slate).text(netLabel, x + width - 174, rowY + 17, { width: 66, lineBreak: false });
    doc.fontSize(24).fillColor(accent).text(amount(stock.netAmount), x + width - 106, rowY + 12, { width: 88, align: "right", lineBreak: false });
    doc.fontSize(16).fillColor(COLORS.slate).text(`买入 ${amount(stock.buyAmount)}  卖出 ${amount(stock.sellAmount)}`, x + 218, rowY + 43, { width: width - 236, align: "right", lineBreak: false });
    doc.fontSize(17).fillColor(COLORS.slate).text(clip(plainStockReason(stock.reasons), 18), x + 54, rowY + 67, { width: width - 72, lineBreak: false, ellipsis: true });
  });
}

export function drawStockBoardPage(doc: PDFKit.PDFDocument, report: OsintDailyReportSnapshot): void {
  const { inflows, outflows } = selectReportStocks(report.lhb.stocks);
  drawTitle(doc, "个股资金", `交易日 ${report.lhb.tradeDate || "--"} · 左边看净买入，右边看净卖出`);
  const gap = 22;
  const hasBoth = inflows.length > 0 && outflows.length > 0;
  const width = hasBoth ? (PAGE.right - PAGE.left - gap) / 2 : PAGE.right - PAGE.left;
  if (inflows.length > 0) drawStockColumn(doc, "净买入靠前", inflows, PAGE.left, 225, width, COLORS.coral, COLORS.coralSoft);
  if (outflows.length > 0) drawStockColumn(doc, "净卖出靠前", outflows, hasBoth ? PAGE.left + width + gap : PAGE.left, 225, width, COLORS.green, COLORS.greenSoft);
}

function leadStocks(flow: LhbHotMoneyFlow): string {
  return [...flow.stocks].sort((left, right) => right.buyAmount - left.buyAmount).slice(0, 2)
    .map((stock) => `${stock.name} ${amount(stock.buyAmount)}`).join("、") || "--";
}

function drawHotMoneyColumn(doc: PDFKit.PDFDocument, flows: LhbHotMoneyFlow[], startIndex: number, x: number, y: number, width: number): void {
  const rowHeight = Math.min(130, (1238 - y) / Math.max(1, flows.length));
  flows.forEach((flow, index) => {
    const rowY = y + index * rowHeight;
    const netPositive = flow.totalNetAmount >= 0;
    const accent = netPositive ? COLORS.coral : COLORS.green;
    doc.roundedRect(x, rowY, width, rowHeight - 10, 14).fillAndStroke(index % 2 === 0 ? COLORS.white : COLORS.row, COLORS.line);
    doc.rect(x, rowY, 8, rowHeight - 10).fill(accent);
    doc.fontSize(17).fillColor(COLORS.muted).text(String(startIndex + index + 1).padStart(2, "0"), x + 20, rowY + 17, { width: 30, lineBreak: false });
    doc.fontSize(24).fillColor(COLORS.ink).text(clip(flow.label, 12), x + 58, rowY + 13, { width: width - 226, lineBreak: false, ellipsis: true });
    doc.fontSize(18).fillColor(COLORS.slate).text(netPositive ? "净买入" : "净卖出", x + width - 164, rowY + 17, { width: 64, lineBreak: false });
    doc.fontSize(24).fillColor(accent).text(amount(flow.totalNetAmount), x + width - 98, rowY + 12, { width: 78, align: "right", lineBreak: false });
    doc.fontSize(17).fillColor(COLORS.slate).text(clip(flow.departmentNames[0] || "席位观察", 22), x + 58, rowY + 50, { width: width - 78, lineBreak: false, ellipsis: true });
    doc.fontSize(17).fillColor(COLORS.slate).text(`买入 ${amount(flow.totalBuyAmount)}  卖出 ${amount(flow.totalSellAmount)}`, x + 58, rowY + 78, { width: width - 78, lineBreak: false });
    doc.fontSize(18).fillColor(accent).text(`主要买入：${clip(leadStocks(flow), 22)}`, x + 58, rowY + 103, { width: width - 78, lineBreak: false, ellipsis: true });
  });
}

export function drawHotMoneyBoardPage(doc: PDFKit.PDFDocument, report: OsintDailyReportSnapshot): void {
  const flows = selectReportHotMoney(report.lhb.hotMoneyFlows);
  drawTitle(doc, "游资席位", `交易日 ${report.lhb.tradeDate || "--"} · 看谁在买、买了什么`);
  const gap = 22;
  const width = (PAGE.right - PAGE.left - gap) / 2;
  const split = Math.ceil(flows.length / 2);
  drawHotMoneyColumn(doc, flows.slice(0, split), 0, PAGE.left, 225, width);
  drawHotMoneyColumn(doc, flows.slice(split), split, PAGE.left + width + gap, 225, width);
}

function addReportPage(doc: PDFKit.PDFDocument, report: OsintDailyReportSnapshot, pageNumber: number, totalPages: number, draw: (doc: PDFKit.PDFDocument, report: OsintDailyReportSnapshot) => void): void {
  doc.addPage({ size: [PAGE.width, PAGE.height], margin: 0 });
  doc.font(FONT);
  drawPageBase(doc, report, pageNumber, totalPages);
  draw(doc, report);
}

export async function buildDailyReportPdf(report: OsintDailyReportSnapshot, section: DailyReportExportSection): Promise<Buffer> {
  if (!isDailyReportPdfReady(report)) throw new Error("PDF_EXPORT_NOT_READY");
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({
    autoFirstPage: false,
    bufferPages: true,
    margin: 0,
    info: {
      Title: report.title,
      Author: "AlphaPercept",
      Subject: "OSINT 每日复盘",
      Keywords: "OSINT, 热点, 未来事件, 个股资金, 游资",
      CreationDate: new Date(report.generatedAt),
    },
  });
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  doc.registerFont(FONT, FONT_PATH);
  const pages = section === "full"
    ? [drawStoryBoardPage, drawStockBoardPage, drawHotMoneyBoardPage]
    : section === "stories" ? [drawStoryBoardPage]
      : section === "stocks" ? [drawStockBoardPage]
        : [drawHotMoneyBoardPage];
  pages.forEach((draw, index) => addReportPage(doc, report, index + 1, pages.length, draw));
  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
