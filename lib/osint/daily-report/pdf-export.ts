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
  selectReportHotMoney,
  selectReportStocks,
  type CuratedStoryCategory,
} from "./story-curation";

export const DAILY_REPORT_PDF_LAYOUT_VERSION = "pantone-v7";

const FONT = "NotoSansSC";
const FONT_PATH = `${process.cwd()}/${DAILY_REPORT_PDF_FONT_ASSET}`;
const PAGE = { width: 1080, height: 1350, left: 64, right: 1016, footer: 1272, contentBottom: 1240 };
const COLORS = {
  canvas: "#F0EFEB",
  white: "#FFFFFF",
  ink: "#2B2C30",
  dark: "#2B2C30",
  red: "#9F2336",
  redSoft: "#F4E6E8",
  teal: "#2A5D69",
  tealSoft: "#E4EEED",
  bordeaux: "#97637C",
  gold: "#D6CD95",
  graphite: "#55543B",
  satin: "#948A76",
  muted: "#646667",
  line: "#948A76",
  row: "#F7F6F2",
} as const;

const CATEGORY_COLORS: Record<CuratedStoryCategory["key"], string> = {
  upcoming: COLORS.gold,
  macro: COLORS.teal,
  geopolitics: COLORS.red,
  energy: COLORS.graphite,
  technology: COLORS.bordeaux,
  markets: COLORS.dark,
};

type StoryCard = { story: OsintStory; label: string; accent: string };
type Positioned<T> = { item: T; height: number };
type AlignedRow<T> = { left: Positioned<T>; right?: Positioned<T>; height: number };
type RankedFlow = { flow: LhbHotMoneyFlow; rank: number };

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
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

function eventTime(story: OsintStory): string {
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

function textHeight(doc: PDFKit.PDFDocument, text: string, size: number, width: number, lineGap = 0): number {
  doc.font(FONT).fontSize(size);
  return doc.heightOfString(clean(text), { width, lineGap });
}

function drawSemiboldText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  options: PDFKit.Mixins.TextOptions = {}
): void {
  const strokeWidth = Math.min(0.9, Math.max(0.3, size * 0.018));
  doc.font(FONT).fontSize(size).fillColor(color).strokeColor(color).lineWidth(strokeWidth)
    .text(clean(text), x, y, { ...options, fill: true, stroke: true });
  doc.lineWidth(1);
}

function drawPageBase(doc: PDFKit.PDFDocument, report: OsintDailyReportSnapshot, pageNumber: number, totalPages: number): void {
  doc.rect(0, 0, PAGE.width, PAGE.height).fill(COLORS.canvas);
  doc.rect(0, 0, 12, PAGE.height).fill(COLORS.teal);
  doc.rect(PAGE.left, 24, PAGE.right - PAGE.left, 44).fill(COLORS.dark);
  doc.font(FONT).fontSize(17).fillColor(COLORS.canvas).text("ALPHAPERCEPT 每日复盘", PAGE.left + 18, 36, { lineBreak: false });
  doc.save().opacity(0.045).font(FONT).fontSize(76).fillColor(COLORS.dark)
    .rotate(-22, { origin: [PAGE.width / 2, PAGE.height / 2] })
    .text(DAILY_REPORT_WATERMARK, 210, 620, { width: 660, align: "center", lineBreak: false }).restore();
  doc.moveTo(PAGE.left, PAGE.footer).lineTo(PAGE.right, PAGE.footer).lineWidth(1.5).strokeColor(COLORS.satin).stroke();
  doc.font(FONT).fontSize(14).fillColor(COLORS.ink).text(DAILY_REPORT_DISCLAIMER, PAGE.left, 1282, { width: 810, lineGap: 2 });
  doc.fontSize(16).fillColor(COLORS.ink).text(`${pageNumber} / ${totalPages}`, PAGE.right - 76, 1288, { width: 76, align: "right", lineBreak: false });
  doc.fontSize(14).fillColor(COLORS.muted).text(`数据截至 ${shanghaiTime(report.asOf)}`, PAGE.left, 1323, { lineBreak: false });
}

function drawTitle(doc: PDFKit.PDFDocument, title: string, subtitle: string): number {
  doc.rect(PAGE.left, 92, 12, 104).fill(COLORS.red);
  doc.font(FONT).fontSize(18).fillColor(COLORS.teal).text("每日复盘", 96, 92, { characterSpacing: 2, lineBreak: false });
  drawSemiboldText(doc, title, 96, 120, 50, COLORS.ink, { lineBreak: false });
  const subtitleY = 180;
  const subtitleHeight = textHeight(doc, subtitle, 22, 880, 2);
  drawSemiboldText(doc, subtitle, 96, subtitleY, 22, COLORS.ink, { width: 880, lineGap: 2 });
  return Math.max(232, subtitleY + subtitleHeight + 22);
}

function measureUpcoming(doc: PDFKit.PDFDocument, story: OsintStory, width: number): number {
  const inner = width - 44;
  const titleHeight = textHeight(doc, story.title, 23, inner - 170, 2);
  return Math.max(58, 16 + titleHeight + 16);
}

function fitUpcoming(doc: PDFKit.PDFDocument, stories: OsintStory[], width: number, maxHeight: number): Positioned<OsintStory>[] {
  const selected: Positioned<OsintStory>[] = [];
  let used = 50;
  for (const story of stories.slice(0, 3)) {
    const height = measureUpcoming(doc, story, width);
    if (used + height > maxHeight) break;
    selected.push({ item: story, height });
    used += height;
  }
  return selected;
}

function drawUpcoming(doc: PDFKit.PDFDocument, stories: Positioned<OsintStory>[], startY: number): number {
  if (stories.length === 0) return startY;
  const width = PAGE.right - PAGE.left;
  const totalHeight = 50 + stories.reduce((sum, story) => sum + story.height, 0);
  doc.roundedRect(PAGE.left, startY, width, totalHeight, 14).fillAndStroke(COLORS.white, COLORS.satin);
  doc.roundedRect(PAGE.left, startY, width, 50, 14).fill(COLORS.teal);
  doc.rect(PAGE.left, startY + 28, width, 22).fill(COLORS.teal);
  drawSemiboldText(doc, "接下来要留意", PAGE.left + 22, startY + 12, 27, COLORS.white, { lineBreak: false });
  let y = startY + 50;
  stories.forEach(({ item: story, height }, index) => {
    if (index % 2 === 1) doc.rect(PAGE.left, y, width, height).fill(COLORS.row);
    doc.fontSize(19).fillColor(COLORS.red).text(eventTime(story), PAGE.left + 22, y + 20, { width: 148 });
    doc.fontSize(23).fillColor(COLORS.ink).text(clean(story.title), PAGE.left + 188, y + 14, { width: width - 232, lineGap: 2 });
    y += height;
  });
  return startY + totalHeight + 18;
}

function storyCards(curated: ReturnType<typeof curateReportStories>, limit: number): StoryCard[] {
  const categories = curated.categories.filter((category) => category.key !== "upcoming");
  const primary = categories.flatMap((category) => category.stories.slice(0, 1).map((story) => ({ story, label: category.label, accent: CATEGORY_COLORS[category.key] })));
  const secondary = categories.flatMap((category) => category.stories.slice(1).map((story) => ({ story, label: category.label, accent: CATEGORY_COLORS[category.key] })));
  return [...primary, ...secondary].slice(0, limit);
}

function measureStoryCard(doc: PDFKit.PDFDocument, card: StoryCard, width: number): number {
  const inner = width - 40;
  const meta = `${card.label} · ${shortShanghaiTime(card.story.publishedAt)} · ${card.story.sources.map((source) => source.name).join("、")}`;
  return 14 +
    textHeight(doc, meta, 14, inner, 2) + 6 +
    textHeight(doc, card.story.title, 20, inner, 3) + 8 +
    textHeight(doc, card.story.summary, 16, inner, 3) + 14;
}

function fitAlignedRows<T>(items: T[], measure: (item: T) => number, maxHeight: number, gap: number): AlignedRow<T>[] {
  const rows: AlignedRow<T>[] = [];
  let used = 0;
  for (let index = 0; index < items.length; index += 2) {
    const left = { item: items[index], height: measure(items[index]) };
    const rightItem = items[index + 1];
    const right = rightItem === undefined ? undefined : { item: rightItem, height: measure(rightItem) };
    const height = Math.max(left.height, right?.height ?? 0);
    const next = used + (rows.length > 0 ? gap : 0) + height;
    if (next > maxHeight) break;
    rows.push({ left, right, height });
    used = next;
  }
  return rows;
}

function drawStoryCard(doc: PDFKit.PDFDocument, card: StoryCard, x: number, y: number, width: number, height: number): void {
  const inner = width - 40;
  doc.roundedRect(x, y, width, height, 14).fillAndStroke(COLORS.white, COLORS.satin);
  doc.rect(x, y, 9, height).fill(card.accent);
  let cursor = y + 12;
  const meta = `${card.label} · ${shortShanghaiTime(card.story.publishedAt)} · ${card.story.sources.map((source) => source.name).join("、")}`;
  doc.font(FONT).fontSize(14).fillColor(card.accent).text(clean(meta), x + 22, cursor, { width: inner, lineGap: 2 });
  cursor += textHeight(doc, meta, 14, inner, 2) + 6;
  drawSemiboldText(doc, card.story.title, x + 22, cursor, 20, COLORS.ink, { width: inner, lineGap: 3 });
  cursor += textHeight(doc, card.story.title, 20, inner, 3) + 8;
  doc.fontSize(16).fillColor(COLORS.ink).text(clean(card.story.summary), x + 22, cursor, { width: inner, lineGap: 3 });
}

function drawAlignedStoryRows(doc: PDFKit.PDFDocument, rows: AlignedRow<StoryCard>[], y: number, width: number, gap: number): void {
  let cursor = y;
  rows.forEach((row) => {
    drawStoryCard(doc, row.left.item, PAGE.left, cursor, width, row.height);
    if (row.right) drawStoryCard(doc, row.right.item, PAGE.left + width + gap, cursor, width, row.height);
    cursor += row.height + gap;
  });
}

export function drawStoryBoardPage(doc: PDFKit.PDFDocument, report: OsintDailyReportSnapshot): void {
  const curated = curateReportStories(report.stories.stories, { maxPerCategory: 2 });
  const upcomingCategory = curated.categories.find((category) => category.key === "upcoming");
  const upcoming = fitUpcoming(doc, upcomingCategory?.stories ?? [], PAGE.right - PAGE.left, 230);
  const candidates = storyCards(curated, Math.max(0, 10 - upcoming.length));
  const lead = candidates[0]?.story;
  const contentStart = drawTitle(doc, "热点复盘", `${report.reportDate} · 重点新闻与未来事件${lead ? ` · ${clean(lead.tags.topic[0] || "市场")}` : ""}`);
  const gridY = drawUpcoming(doc, upcoming, contentStart);
  const gap = 18;
  const width = (PAGE.right - PAGE.left - gap) / 2;
  const available = PAGE.contentBottom - gridY;
  const rows = fitAlignedRows(candidates, (card) => measureStoryCard(doc, card, width), available, gap);
  drawAlignedStoryRows(doc, rows, gridY, width, gap);
}

function measureStockRow(doc: PDFKit.PDFDocument, stock: LhbStock, width: number): number {
  const inner = width - 36;
  const nameLine = `${stock.name}  ${stock.code}`;
  const amountLine = `${stock.netAmount >= 0 ? "净买入" : "净卖出"} ${amount(stock.netAmount)} · 买入 ${amount(stock.buyAmount)} · 卖出 ${amount(stock.sellAmount)}`;
  return 9 + textHeight(doc, nameLine, 17, inner) + 3 + textHeight(doc, amountLine, 16, inner) + 3 + textHeight(doc, plainStockReason(stock.reasons), 16, inner) + 9;
}

function fitSingleColumn<T>(items: T[], measure: (item: T) => number, maxHeight: number, gap: number): Positioned<T>[] {
  const selected: Positioned<T>[] = [];
  let used = 0;
  for (const item of items) {
    const height = measure(item);
    const next = used + (selected.length > 0 ? gap : 0) + height;
    if (next > maxHeight) break;
    selected.push({ item, height });
    used = next;
  }
  return selected;
}

function drawStockColumn(doc: PDFKit.PDFDocument, title: string, stocks: LhbStock[], x: number, y: number, width: number, accent: string, soft: string): void {
  if (stocks.length === 0) return;
  const headerHeight = 54;
  const gap = 5;
  doc.roundedRect(x, y, width, headerHeight, 12).fill(accent);
  drawSemiboldText(doc, title, x + 20, y + 13, 27, COLORS.white, { lineBreak: false });
  const selected = fitSingleColumn(stocks, (stock) => measureStockRow(doc, stock, width), PAGE.contentBottom - y - headerHeight - 10, gap);
  let cursor = y + headerHeight + 10;
  selected.forEach(({ item: stock, height }, index) => {
    doc.roundedRect(x, cursor, width, height, 10).fillAndStroke(index % 2 === 0 ? COLORS.white : soft, COLORS.satin);
    const inner = width - 36;
    let textY = cursor + 7;
    drawSemiboldText(doc, `${index + 1}. ${stock.name}  ${stock.code}`, x + 18, textY, 17, COLORS.ink, { width: inner });
    textY += textHeight(doc, `${index + 1}. ${stock.name}  ${stock.code}`, 17, inner) + 3;
    doc.fontSize(16).fillColor(accent).text(`${stock.netAmount >= 0 ? "净买入" : "净卖出"} ${amount(stock.netAmount)} · 买入 ${amount(stock.buyAmount)} · 卖出 ${amount(stock.sellAmount)}`, x + 18, textY, { width: inner });
    textY += textHeight(doc, `${stock.netAmount >= 0 ? "净买入" : "净卖出"} ${amount(stock.netAmount)} · 买入 ${amount(stock.buyAmount)} · 卖出 ${amount(stock.sellAmount)}`, 16, inner) + 3;
    doc.fontSize(16).fillColor(COLORS.ink).text(clean(plainStockReason(stock.reasons)), x + 18, textY, { width: inner });
    cursor += height + gap;
  });
}

export function drawStockBoardPage(doc: PDFKit.PDFDocument, report: OsintDailyReportSnapshot): void {
  const { inflows, outflows } = selectReportStocks(report.lhb.stocks);
  const contentStart = drawTitle(doc, "个股资金", `交易日 ${report.lhb.tradeDate || "--"} · 左边看净买入，右边看净卖出`);
  const gap = 18;
  const hasBoth = inflows.length > 0 && outflows.length > 0;
  const width = hasBoth ? (PAGE.right - PAGE.left - gap) / 2 : PAGE.right - PAGE.left;
  if (inflows.length > 0) drawStockColumn(doc, "净买入靠前", inflows, PAGE.left, contentStart, width, COLORS.red, COLORS.redSoft);
  if (outflows.length > 0) drawStockColumn(doc, "净卖出靠前", outflows, hasBoth ? PAGE.left + width + gap : PAGE.left, contentStart, width, COLORS.teal, COLORS.tealSoft);
}

function leadStocks(flow: LhbHotMoneyFlow): string {
  return [...flow.stocks].sort((left, right) => right.buyAmount - left.buyAmount).slice(0, 2)
    .map((stock) => `${stock.name} ${amount(stock.buyAmount)}`).join("、") || "--";
}

function hotMoneyAmountLine(flow: LhbHotMoneyFlow): string {
  return `${flow.totalNetAmount >= 0 ? "净买入" : "净卖出"} ${amount(flow.totalNetAmount)} · 买入 ${amount(flow.totalBuyAmount)} · 卖出 ${amount(flow.totalSellAmount)}`;
}

function hotMoneyStockLine(flow: LhbHotMoneyFlow): string {
  return `主要买入：${leadStocks(flow)}`;
}

function measureHotMoneyRow(doc: PDFKit.PDFDocument, flow: LhbHotMoneyFlow, width: number): number {
  const inner = width - 38;
  return 9 + textHeight(doc, flow.label, 17, inner) + 5 + textHeight(doc, hotMoneyAmountLine(flow), 15, inner) + 5 + textHeight(doc, hotMoneyStockLine(flow), 16, inner, 1) + 9;
}

function drawHotMoneyCard(doc: PDFKit.PDFDocument, ranked: RankedFlow, x: number, y: number, width: number, height: number): void {
    const flow = ranked.flow;
    const positive = flow.totalNetAmount >= 0;
    const accent = positive ? COLORS.red : COLORS.teal;
    doc.roundedRect(x, y, width, height, 10).fillAndStroke(ranked.rank % 2 === 1 ? COLORS.white : COLORS.row, COLORS.satin);
    doc.rect(x, y, 8, height).fill(accent);
    const inner = width - 38;
    let textY = y + 7;
    const nameLine = `${ranked.rank}. ${flow.label}`;
    drawSemiboldText(doc, nameLine, x + 20, textY, 17, COLORS.ink, { width: inner });
    textY += textHeight(doc, nameLine, 17, inner) + 5;
    doc.fontSize(15).fillColor(accent).text(`${positive ? "净买入" : "净卖出"} ${amount(flow.totalNetAmount)}`, x + 20, textY, { width: inner, continued: true });
    doc.fillColor(COLORS.red).text(` · 买入 ${amount(flow.totalBuyAmount)}`, { continued: true });
    doc.fillColor(COLORS.teal).text(` · 卖出 ${amount(flow.totalSellAmount)}`);
    textY += textHeight(doc, hotMoneyAmountLine(flow), 15, inner) + 5;
    doc.fontSize(16).fillColor(COLORS.ink).text(clean(hotMoneyStockLine(flow)), x + 20, textY, { width: inner, lineGap: 1 });
}

function drawAlignedHotMoneyRows(doc: PDFKit.PDFDocument, rows: AlignedRow<RankedFlow>[], y: number, width: number, gap: number): void {
  let cursor = y;
  rows.forEach((row) => {
    drawHotMoneyCard(doc, row.left.item, PAGE.left, cursor, width, row.height);
    if (row.right) drawHotMoneyCard(doc, row.right.item, PAGE.left + width + gap, cursor, width, row.height);
    cursor += row.height + 5;
  });
}

export function drawHotMoneyBoardPage(doc: PDFKit.PDFDocument, report: OsintDailyReportSnapshot): void {
  const flows = selectReportHotMoney(report.lhb.hotMoneyFlows);
  const contentStart = drawTitle(doc, "游资席位", `交易日 ${report.lhb.tradeDate || "--"} · 看谁在买、买了什么`);
  const gap = 18;
  const width = (PAGE.right - PAGE.left - gap) / 2;
  const available = PAGE.contentBottom - contentStart;
  const paired: RankedFlow[] = flows.map((flow, index) => ({ flow, rank: index + 1 }));
  const rows = fitAlignedRows(paired, (item) => measureHotMoneyRow(doc, item.flow, width), available, 5);
  drawAlignedHotMoneyRows(doc, rows, contentStart, width, gap);
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
