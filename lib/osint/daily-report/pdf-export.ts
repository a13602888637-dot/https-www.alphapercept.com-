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

export const DAILY_REPORT_PDF_LAYOUT_VERSION = "pantone-v3";

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
  doc.fontSize(50).fillColor(COLORS.ink).text(title, 96, 120, { lineBreak: false });
  const subtitleY = 180;
  const subtitleHeight = textHeight(doc, subtitle, 22, 880, 2);
  doc.fontSize(22).fillColor(COLORS.ink).text(clean(subtitle), 96, subtitleY, { width: 880, lineGap: 2 });
  return Math.max(232, subtitleY + subtitleHeight + 22);
}

function measureUpcoming(doc: PDFKit.PDFDocument, story: OsintStory, width: number): number {
  const inner = width - 44;
  const titleHeight = textHeight(doc, story.title, 23, inner - 170, 2);
  const impactHeight = textHeight(doc, plainStoryImpact(story), 17, inner - 170, 1);
  return Math.max(68, 18 + titleHeight + 6 + impactHeight + 16);
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
  doc.font(FONT).fontSize(27).fillColor(COLORS.white).text("接下来要留意", PAGE.left + 22, startY + 12, { lineBreak: false });
  let y = startY + 50;
  stories.forEach(({ item: story, height }, index) => {
    if (index % 2 === 1) doc.rect(PAGE.left, y, width, height).fill(COLORS.row);
    doc.fontSize(19).fillColor(COLORS.red).text(eventTime(story), PAGE.left + 22, y + 20, { width: 148 });
    doc.fontSize(23).fillColor(COLORS.ink).text(clean(story.title), PAGE.left + 188, y + 14, { width: width - 232, lineGap: 2 });
    const titleHeight = textHeight(doc, story.title, 23, width - 232, 2);
    doc.fontSize(17).fillColor(COLORS.teal).text(clean(plainStoryImpact(story)), PAGE.left + 188, y + 18 + titleHeight, { width: width - 232, lineGap: 1 });
    y += height;
  });
  return startY + totalHeight + 18;
}

function storyCards(curated: ReturnType<typeof curateReportStories>): StoryCard[] {
  const categories = curated.categories.filter((category) => category.key !== "upcoming");
  const primary = categories.flatMap((category) => category.stories.slice(0, 1).map((story) => ({ story, label: category.label, accent: CATEGORY_COLORS[category.key] })));
  const secondary = categories.flatMap((category) => category.stories.slice(1).map((story) => ({ story, label: category.label, accent: CATEGORY_COLORS[category.key] })));
  return [...primary, ...secondary].slice(0, 6);
}

function measureStoryCard(doc: PDFKit.PDFDocument, card: StoryCard, width: number): number {
  const inner = width - 40;
  const meta = `${shortShanghaiTime(card.story.publishedAt)} · ${card.story.sources.map((source) => source.name).join("、")}`;
  return 22 +
    textHeight(doc, card.label, 18, inner) + 7 +
    textHeight(doc, card.story.title, 22, inner, 2) + 8 +
    textHeight(doc, card.story.summary, 18, inner, 2) + 8 +
    textHeight(doc, plainStoryImpact(card.story), 17, inner, 1) + 8 +
    textHeight(doc, meta, 16, inner, 1) + 18;
}

function fitTwoColumns<T>(items: T[], measure: (item: T) => number, maxHeight: number, gap: number): [Positioned<T>[], Positioned<T>[]] {
  const columns: [Positioned<T>[], Positioned<T>[]] = [[], []];
  const heights = [0, 0];
  for (const item of items) {
    const height = measure(item);
    const preferred = heights[0] <= heights[1] ? 0 : 1;
    const fallback = preferred === 0 ? 1 : 0;
    const preferredNext = heights[preferred] + (columns[preferred].length > 0 ? gap : 0) + height;
    const fallbackNext = heights[fallback] + (columns[fallback].length > 0 ? gap : 0) + height;
    const column = preferredNext <= maxHeight ? preferred : fallbackNext <= maxHeight ? fallback : -1;
    if (column === 0) {
      columns[0].push({ item, height });
      heights[0] += (columns[0].length > 1 ? gap : 0) + height;
    } else if (column === 1) {
      columns[1].push({ item, height });
      heights[1] += (columns[1].length > 1 ? gap : 0) + height;
    } else {
      break;
    }
  }
  return columns;
}

function drawStoryCard(doc: PDFKit.PDFDocument, card: StoryCard, x: number, y: number, width: number, height: number): void {
  const inner = width - 40;
  doc.roundedRect(x, y, width, height, 14).fillAndStroke(COLORS.white, COLORS.satin);
  doc.rect(x, y, 9, height).fill(card.accent);
  let cursor = y + 18;
  doc.font(FONT).fontSize(18).fillColor(card.accent).text(clean(card.label), x + 22, cursor, { width: inner });
  cursor += textHeight(doc, card.label, 18, inner) + 7;
  doc.fontSize(22).fillColor(COLORS.ink).text(clean(card.story.title), x + 22, cursor, { width: inner, lineGap: 2 });
  cursor += textHeight(doc, card.story.title, 22, inner, 2) + 8;
  doc.fontSize(18).fillColor(COLORS.ink).text(clean(card.story.summary), x + 22, cursor, { width: inner, lineGap: 2 });
  cursor += textHeight(doc, card.story.summary, 18, inner, 2) + 8;
  doc.fontSize(17).fillColor(card.accent).text(clean(plainStoryImpact(card.story)), x + 22, cursor, { width: inner, lineGap: 1 });
  cursor += textHeight(doc, plainStoryImpact(card.story), 17, inner, 1) + 8;
  const meta = `${shortShanghaiTime(card.story.publishedAt)} · ${card.story.sources.map((source) => source.name).join("、")}`;
  doc.fontSize(16).fillColor(COLORS.muted).text(clean(meta), x + 22, cursor, { width: inner, lineGap: 1 });
}

export function drawStoryBoardPage(doc: PDFKit.PDFDocument, report: OsintDailyReportSnapshot): void {
  const curated = curateReportStories(report.stories.stories, { maxPerCategory: 2 });
  const upcomingCategory = curated.categories.find((category) => category.key === "upcoming");
  const candidates = storyCards(curated);
  const lead = candidates[0]?.story;
  const contentStart = drawTitle(doc, "热点复盘", lead ? `今天重点：${clean(lead.title)}` : "把今天最值得关注的消息放在一页里");
  const upcoming = fitUpcoming(doc, upcomingCategory?.stories ?? [], PAGE.right - PAGE.left, 270);
  const gridY = drawUpcoming(doc, upcoming, contentStart);
  const gap = 16;
  const width = (PAGE.right - PAGE.left - gap) / 2;
  const available = PAGE.contentBottom - gridY;
  const columns = fitTwoColumns(candidates, (card) => measureStoryCard(doc, card, width), available, gap);
  columns.forEach((column, columnIndex) => {
    let y = gridY;
    column.forEach(({ item, height }) => {
      drawStoryCard(doc, item, PAGE.left + columnIndex * (width + gap), y, width, height);
      y += height + gap;
    });
  });
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
  doc.font(FONT).fontSize(27).fillColor(COLORS.white).text(title, x + 20, y + 13, { lineBreak: false });
  const selected = fitSingleColumn(stocks, (stock) => measureStockRow(doc, stock, width), PAGE.contentBottom - y - headerHeight - 10, gap);
  let cursor = y + headerHeight + 10;
  selected.forEach(({ item: stock, height }, index) => {
    doc.roundedRect(x, cursor, width, height, 10).fillAndStroke(index % 2 === 0 ? COLORS.white : soft, COLORS.satin);
    const inner = width - 36;
    let textY = cursor + 7;
    doc.fontSize(17).fillColor(COLORS.ink).text(`${index + 1}. ${stock.name}  ${stock.code}`, x + 18, textY, { width: inner });
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

function measureHotMoneyRow(doc: PDFKit.PDFDocument, flow: LhbHotMoneyFlow, width: number): number {
  const inner = width - 38;
  const nameLine = `${flow.label} · ${flow.totalNetAmount >= 0 ? "净买入" : "净卖出"} ${amount(flow.totalNetAmount)}`;
  const departments = flow.departmentNames.join(" / ") || "席位观察";
  const detail = `买入 ${amount(flow.totalBuyAmount)} · 卖出 ${amount(flow.totalSellAmount)} · 主要买入 ${leadStocks(flow)}`;
  return 9 + textHeight(doc, nameLine, 17, inner) + 3 + textHeight(doc, departments, 16, inner, 1) + 3 + textHeight(doc, detail, 16, inner, 1) + 9;
}

function drawHotMoneyColumn(doc: PDFKit.PDFDocument, flows: Positioned<LhbHotMoneyFlow>[], startIndex: number, x: number, y: number, width: number): void {
  let cursor = y;
  flows.forEach(({ item: flow, height }, index) => {
    const positive = flow.totalNetAmount >= 0;
    const accent = positive ? COLORS.red : COLORS.teal;
    doc.roundedRect(x, cursor, width, height, 10).fillAndStroke(index % 2 === 0 ? COLORS.white : COLORS.row, COLORS.satin);
    doc.rect(x, cursor, 8, height).fill(accent);
    const inner = width - 38;
    let textY = cursor + 7;
    const nameLine = `${startIndex + index + 1}. ${flow.label} · ${positive ? "净买入" : "净卖出"} ${amount(flow.totalNetAmount)}`;
    doc.fontSize(17).fillColor(accent).text(clean(nameLine), x + 20, textY, { width: inner });
    textY += textHeight(doc, nameLine, 17, inner) + 3;
    const departments = flow.departmentNames.join(" / ") || "席位观察";
    doc.fontSize(16).fillColor(COLORS.ink).text(clean(departments), x + 20, textY, { width: inner, lineGap: 1 });
    textY += textHeight(doc, departments, 16, inner, 1) + 3;
    const detail = `买入 ${amount(flow.totalBuyAmount)} · 卖出 ${amount(flow.totalSellAmount)} · 主要买入 ${leadStocks(flow)}`;
    doc.fontSize(16).fillColor(COLORS.ink).text(clean(detail), x + 20, textY, { width: inner, lineGap: 1 });
    cursor += height + 5;
  });
}

export function drawHotMoneyBoardPage(doc: PDFKit.PDFDocument, report: OsintDailyReportSnapshot): void {
  const flows = selectReportHotMoney(report.lhb.hotMoneyFlows);
  const contentStart = drawTitle(doc, "游资席位", `交易日 ${report.lhb.tradeDate || "--"} · 看谁在买、买了什么`);
  const gap = 18;
  const width = (PAGE.right - PAGE.left - gap) / 2;
  const available = PAGE.contentBottom - contentStart;
  const columns = fitTwoColumns(flows, (flow) => measureHotMoneyRow(doc, flow, width), available, 5);
  drawHotMoneyColumn(doc, columns[0], 0, PAGE.left, contentStart, width);
  drawHotMoneyColumn(doc, columns[1], columns[0].length, PAGE.left + width + gap, contentStart, width);
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
