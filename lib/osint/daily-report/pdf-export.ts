import PDFDocument from "pdfkit";
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
  rankReportStocks,
  type CuratedStoryCategory,
} from "./story-curation";

const FONT = "NotoSansSC";
const FONT_PATH = `${process.cwd()}/${DAILY_REPORT_PDF_FONT_ASSET}`;
const PAGE = { width: 595.28, height: 841.89, left: 38, right: 557.28, footer: 798 };
const COLORS = {
  canvas: "#F6FAFC",
  white: "#FFFFFF",
  ink: "#0B1B32",
  navy: "#0B1B32",
  navySoft: "#142D49",
  cyan: "#00B8C4",
  cyanSoft: "#E0F7F8",
  coral: "#F45B69",
  orange: "#F59E32",
  orangeSoft: "#FFF1D9",
  green: "#11966F",
  slate: "#66788C",
  muted: "#93A2B3",
  line: "#D6E3EB",
  row: "#EAF2F6",
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
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function amount(value: number): string {
  return `${(value / 10_000).toLocaleString("zh-CN", { maximumFractionDigits: 0 })}万`;
}

function signedAmount(value: number): string {
  return `${value >= 0 ? "+" : ""}${amount(value)}`;
}

function shanghaiTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "--";
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function shortShanghaiTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "--";
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function drawPageBase(
  doc: PDFKit.PDFDocument,
  report: OsintDailyReportSnapshot,
  pageNumber: number,
  totalPages: number
): void {
  doc.rect(0, 0, PAGE.width, PAGE.height).fill(COLORS.canvas);
  doc.rect(0, 0, 5, PAGE.height).fill(COLORS.cyan);
  doc.font(FONT).fontSize(6.5).fillColor(COLORS.muted)
    .text("ALPHAPERCEPT / OSINT DAILY REVIEW", PAGE.left, 20, { lineBreak: false });
  doc.moveTo(PAGE.left, 33).lineTo(PAGE.right, 33).lineWidth(0.5).strokeColor(COLORS.line).stroke();
  doc.save().opacity(0.043).font(FONT).fontSize(29).fillColor(COLORS.navy)
    .rotate(-24, { origin: [PAGE.width / 2, PAGE.height / 2] })
    .text(DAILY_REPORT_WATERMARK, 123, 404, { width: 350, align: "center", lineBreak: false })
    .restore();
  doc.moveTo(PAGE.left, PAGE.footer).lineTo(PAGE.right, PAGE.footer).lineWidth(0.45).strokeColor(COLORS.line).stroke();
  doc.font(FONT).fontSize(5.3).fillColor(COLORS.slate)
    .text(DAILY_REPORT_DISCLAIMER, PAGE.left, 806, { width: 450, height: 15, ellipsis: true });
  doc.fontSize(6).fillColor(COLORS.muted)
    .text(`${pageNumber} / ${totalPages}`, PAGE.right - 40, 807, { width: 40, align: "right", lineBreak: false });
  doc.fontSize(5.6).fillColor(COLORS.muted)
    .text(`数据截至 ${shanghaiTime(report.asOf)}`, PAGE.left, 822, { lineBreak: false });
}

function drawTitle(
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle: string,
  accent = COLORS.cyan
): void {
  doc.rect(PAGE.left, 47, 5, 48).fill(accent);
  doc.font(FONT).fontSize(7).fillColor(accent)
    .text("DAILY REVIEW", 53, 49, { characterSpacing: 1.2, lineBreak: false });
  doc.fontSize(20).fillColor(COLORS.ink).text(title, 53, 63, { lineBreak: false });
  doc.fontSize(7).fillColor(COLORS.slate).text(subtitle, 53, 87, { width: 500, lineBreak: false });
}

function storyTags(story: CuratedStoryCategory["stories"][number]): string {
  return [...story.tags.topic, ...story.tags.region, ...story.tags.assets]
    .filter((tag, index, all) => all.indexOf(tag) === index)
    .slice(0, 5)
    .map((tag) => `#${tag}`)
    .join("  ");
}

function drawUpcomingBand(
  doc: PDFKit.PDFDocument,
  category: CuratedStoryCategory | undefined,
  startY: number
): number {
  const x = PAGE.left;
  const width = PAGE.right - PAGE.left;
  const events = category?.stories.slice(0, 5) ?? [];
  doc.roundedRect(x, startY, width, 28, 6).fill(COLORS.navy);
  doc.font(FONT).fontSize(9.5).fillColor(COLORS.white)
    .text("未来 7 天大事件", x + 13, startY + 8, { lineBreak: false });
  doc.fontSize(6.5).fillColor("#A8E8EB")
    .text("结构化日历 + 官方来源 · 北京时间", x + width - 190, startY + 9, { width: 177, align: "right", lineBreak: false });
  if (events.length === 0) {
    const y = startY + 31;
    doc.roundedRect(x, y, width, 38, 5).fillAndStroke(COLORS.orangeSoft, "#F1D59D");
    doc.fontSize(8).fillColor(COLORS.slate)
      .text("未来7天暂无达到展示门槛的已确认事件", x + 13, y + 14, { lineBreak: false });
    return y + 48;
  }
  let y = startY + 31;
  events.forEach((story, index) => {
    const height = 29;
    doc.rect(x, y, width, height).fill(index % 2 === 0 ? COLORS.white : COLORS.row);
    doc.fontSize(7.2).fillColor(COLORS.ink)
      .text(shortShanghaiTime(story.scheduledFor || story.publishedAt), x + 9, y + 10, { width: 88, lineBreak: false });
    doc.fontSize(7.3).fillColor(COLORS.ink)
      .text(clip(story.title, 35), x + 101, y + 9, { width: 265, lineBreak: false, ellipsis: true });
    doc.fontSize(6.4).fillColor(COLORS.coral)
      .text(clip(story.tags.assets.join(" / ") || "相关市场", 24), x + 370, y + 9, { width: 104, lineBreak: false, ellipsis: true });
    doc.fontSize(6.2).fillColor(COLORS.orange)
      .text("★".repeat(Math.max(3, Math.min(5, Math.round(story.importance / 2)))), x + width - 42, y + 9, { width: 34, align: "right", lineBreak: false });
    doc.moveTo(x, y + height).lineTo(x + width, y + height).lineWidth(0.3).strokeColor(COLORS.line).stroke();
    y += height;
  });
  return y + 9;
}

function drawStoryModule(
  doc: PDFKit.PDFDocument,
  category: CuratedStoryCategory | undefined,
  key: CuratedStoryCategory["key"],
  label: string,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const accent = CATEGORY_COLORS[key];
  doc.roundedRect(x, y, width, height, 7).fillAndStroke(COLORS.white, COLORS.line);
  doc.rect(x, y, 5, height).fill(accent);
  doc.font(FONT).fontSize(10.5).fillColor(COLORS.ink).text(label, x + 14, y + 12, { lineBreak: false });
  const insight = category?.insight ?? "暂无达到展示门槛的高价值事件。";
  doc.fontSize(6.5).fillColor(COLORS.slate)
    .text(clip(insight, 58), x + 14, y + 32, { width: width - 28, height: 20, ellipsis: true });
  const stories = category?.stories.slice(0, 2) ?? [];
  const contentTop = y + 61;
  const slotHeight = (height - 68) / 2;
  if (stories.length === 0) {
    doc.fontSize(7.4).fillColor(COLORS.muted)
      .text("等待更多官方或多源事件确认", x + 14, contentTop + 24, { width: width - 28, align: "center" });
    return;
  }
  stories.forEach((story, index) => {
    const sy = contentTop + index * slotHeight;
    doc.moveTo(x + 14, sy - 6).lineTo(x + width - 14, sy - 6).lineWidth(0.35).strokeColor(COLORS.line).stroke();
    doc.fontSize(8).fillColor(COLORS.ink)
      .text(clip(story.title, 31), x + 14, sy, { width: width - 28, height: 13, ellipsis: true });
    doc.fontSize(6.7).fillColor(COLORS.slate)
      .text(clip(story.summary, 62), x + 14, sy + 18, { width: width - 28, height: 27, ellipsis: true });
    doc.fontSize(5.9).fillColor(accent)
      .text(clip(storyTags(story), 48), x + 14, sy + 49, { width: width - 28, lineBreak: false, ellipsis: true });
    doc.fontSize(5.7).fillColor(COLORS.muted)
      .text(`${shortShanghaiTime(story.publishedAt)} · ${story.importance.toFixed(1)}/10`, x + 14, sy + 64, { lineBreak: false });
  });
}

export function drawStoryBoardPage(doc: PDFKit.PDFDocument, report: OsintDailyReportSnapshot): void {
  drawTitle(doc, "热点新闻榜", `过去3天新闻 + 未来7天事件 · 原始事件 ${report.stories.stories.length} 条`);
  const curated = curateReportStories(report.stories.stories);
  const upcoming = curated.categories.find((category) => category.key === "upcoming");
  const gridY = drawUpcomingBand(doc, upcoming, 111);
  const gap = 10;
  const width = (PAGE.right - PAGE.left - gap) / 2;
  const gridBottom = 780;
  const height = Math.max(168, (gridBottom - gridY - gap) / 2);
  const modules: Array<{ key: CuratedStoryCategory["key"]; label: string }> = [
    { key: "macro", label: "宏观与利率" },
    { key: "geopolitics", label: "地缘与安全" },
    { key: "energy", label: "能源与大宗" },
    { key: "technology", label: "科技与产业" },
  ];
  modules.forEach((module, index) => {
    const row = Math.floor(index / 2);
    const column = index % 2;
    drawStoryModule(
      doc,
      curated.categories.find((category) => category.key === module.key),
      module.key,
      module.label,
      PAGE.left + column * (width + gap),
      gridY + row * (height + gap),
      width,
      height
    );
  });
}

export function drawStockBoardPage(doc: PDFKit.PDFDocument, report: OsintDailyReportSnapshot): void {
  const stocks = rankReportStocks(report.lhb.stocks);
  const displayed = stocks.slice(0, 36);
  drawTitle(doc, "个股资金榜", `交易日 ${report.lhb.tradeDate || "--"} · 股票代码去重 · 展示 ${displayed.length}/${stocks.length} 只`);
  const widths = [24, 102, 69, 69, 73, 182];
  const labels = ["#", "股票", "买入", "卖出", "净额", "上榜原因"];
  const x = PAGE.left;
  const headerY = 111;
  doc.rect(x, headerY, 519, 23).fill(COLORS.navy);
  let offset = x;
  labels.forEach((label, index) => {
    doc.font(FONT).fontSize(6.4).fillColor("#C5D6E4")
      .text(label, offset + 5, headerY + 8, { width: widths[index] - 8, lineBreak: false });
    offset += widths[index];
  });
  const rowHeight = (780 - headerY - 23) / Math.max(1, displayed.length);
  displayed.forEach((stock, index) => {
    const y = headerY + 23 + index * rowHeight;
    doc.rect(x, y, 519, rowHeight).fill(index % 2 === 0 ? COLORS.white : COLORS.row);
    const values = [
      String(index + 1).padStart(2, "0"),
      `${stock.name} ${stock.code}`,
      amount(stock.buyAmount),
      amount(stock.sellAmount),
      signedAmount(stock.netAmount),
      clip(stock.reasons.join(" / "), 34),
    ];
    let rx = x;
    values.forEach((value, column) => {
      const color = column === 2 ? COLORS.coral : column === 3 ? COLORS.green : column === 4 ? (stock.netAmount >= 0 ? COLORS.coral : COLORS.green) : COLORS.ink;
      doc.fontSize(column === 1 ? 5.8 : 5.5).fillColor(color)
        .text(value, rx + 4, y + Math.max(5, rowHeight / 2 - 3), { width: widths[column] - 7, lineBreak: false, ellipsis: true });
      rx += widths[column];
    });
    doc.moveTo(x, y + rowHeight).lineTo(x + 519, y + rowHeight).lineWidth(0.3).strokeColor(COLORS.line).stroke();
  });
}

export function drawHotMoneyBoardPage(doc: PDFKit.PDFDocument, report: OsintDailyReportSnapshot): void {
  const flows = report.lhb.hotMoneyFlows.slice(0, 28);
  drawTitle(doc, "游资席位榜", `交易日 ${report.lhb.tradeDate || "--"} · 前 ${flows.length} 组席位 · 每席仅保留主要买入股票`);
  const widths = [24, 151, 70, 70, 72, 132];
  const labels = ["#", "游资/席位", "买入", "卖出", "净额", "主要买入股票"];
  const x = PAGE.left;
  const headerY = 111;
  doc.rect(x, headerY, 519, 23).fill(COLORS.navy);
  let offset = x;
  labels.forEach((label, index) => {
    doc.font(FONT).fontSize(6.4).fillColor("#C5D6E4")
      .text(label, offset + 5, headerY + 8, { width: widths[index] - 8, lineBreak: false });
    offset += widths[index];
  });
  const rowHeight = (780 - headerY - 23) / Math.max(1, flows.length);
  flows.forEach((flow, index) => {
    const y = headerY + 23 + index * rowHeight;
    doc.rect(x, y, 519, rowHeight).fill(index % 2 === 0 ? COLORS.white : COLORS.row);
    const lead = [...flow.stocks].sort((left, right) => right.buyAmount - left.buyAmount)[0];
    const values = [
      String(index + 1).padStart(2, "0"),
      flow.label,
      amount(flow.totalBuyAmount),
      amount(flow.totalSellAmount),
      signedAmount(flow.totalNetAmount),
      lead ? `${lead.name} ${amount(lead.buyAmount)}` : "--",
    ];
    let rx = x;
    values.forEach((value, column) => {
      const color = column === 2 ? COLORS.coral : column === 3 ? COLORS.green : column === 4 ? (flow.totalNetAmount >= 0 ? COLORS.coral : COLORS.green) : COLORS.ink;
      doc.fontSize(column === 1 ? 6.1 : 5.7).fillColor(color)
        .text(clip(value, column === 1 ? 19 : 22), rx + 4, y + Math.max(6, rowHeight / 2 - 3), { width: widths[column] - 7, lineBreak: false, ellipsis: true });
      rx += widths[column];
    });
    doc.moveTo(x, y + rowHeight).lineTo(x + 519, y + rowHeight).lineWidth(0.3).strokeColor(COLORS.line).stroke();
  });
}

function addReportPage(
  doc: PDFKit.PDFDocument,
  report: OsintDailyReportSnapshot,
  pageNumber: number,
  totalPages: number,
  draw: (doc: PDFKit.PDFDocument, report: OsintDailyReportSnapshot) => void
): void {
  doc.addPage({ size: "A4", margin: 0 });
  doc.font(FONT);
  drawPageBase(doc, report, pageNumber, totalPages);
  draw(doc, report);
}

export async function buildDailyReportPdf(
  report: OsintDailyReportSnapshot,
  section: DailyReportExportSection
): Promise<Buffer> {
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
    : section === "stories"
      ? [drawStoryBoardPage]
      : section === "stocks"
        ? [drawStockBoardPage]
        : [drawHotMoneyBoardPage];
  pages.forEach((draw, index) => addReportPage(doc, report, index + 1, pages.length, draw));

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
