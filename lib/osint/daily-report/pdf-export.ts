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
  curateReportStories,
  rankReportStocks,
  type CuratedStoryCategory,
} from "./story-curation";
import {
  DAILY_REPORT_PDF_FONT_ASSET,
  isDailyReportPdfReady,
} from "./pdf-readiness";

const NOTO_SANS_SC_REGULAR = `${process.cwd()}/${DAILY_REPORT_PDF_FONT_ASSET}`;
const FONT = "NotoSansSC";
const COLORS = {
  paper: "#F4F7FA",
  card: "#FFFFFF",
  ink: "#07111F",
  navy: "#0B1929",
  navySoft: "#13263B",
  teal: "#20BFC4",
  tealSoft: "#E6F7F7",
  slate: "#65758A",
  muted: "#8A98AA",
  line: "#D8E1EB",
  amber: "#D99B22",
  amberSoft: "#FFF5DA",
  red: "#C94755",
  green: "#17845D",
} as const;

const CATEGORY_COLORS: Record<CuratedStoryCategory["key"], string> = {
  macro: "#2D78C4",
  geopolitics: "#C94755",
  energy: "#D99B22",
  technology: "#20AEB4",
  markets: "#7656A8",
};

type PdfSection = DailyReportExportSection;

function formatShanghaiTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "--";
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });
}

function amount(value: number): string {
  return `${(value / 10_000).toLocaleString("zh-CN", { maximumFractionDigits: 0 })} 万`;
}

function signedAmount(value: number): string {
  return `${value >= 0 ? "+" : ""}${amount(value)}`;
}

function shorten(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function contentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function preserveCursor(doc: PDFKit.PDFDocument, draw: () => void): void {
  const x = doc.x;
  const y = doc.y;
  draw();
  doc.x = x;
  doc.y = y;
}

function drawPageBase(doc: PDFKit.PDFDocument): void {
  preserveCursor(doc, () => {
    doc.save();
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.paper);
    doc.rect(0, 0, 5, doc.page.height).fill(COLORS.teal);
    doc.font(FONT).fontSize(6.5).fillColor(COLORS.muted)
      .text("ALPHAPERCEPT  /  OSINT DAILY REVIEW", doc.page.margins.left, 21, {
        lineBreak: false,
      });
    doc.moveTo(doc.page.margins.left, 34)
      .lineTo(doc.page.width - doc.page.margins.right, 34)
      .lineWidth(0.6)
      .strokeColor(COLORS.line)
      .stroke();
    doc.restore();
  });
}

function addPage(doc: PDFKit.PDFDocument): void {
  doc.addPage();
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number): void {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + height > bottom) addPage(doc);
}

function drawCover(
  doc: PDFKit.PDFDocument,
  report: OsintDailyReportSnapshot,
  selectedStories: number
): void {
  doc.save();
  doc.rect(5, 0, doc.page.width - 5, 132).fill(COLORS.navy);
  doc.rect(doc.page.margins.left, 28, 54, 3).fill(COLORS.teal);
  doc.font(FONT).fontSize(8).fillColor("#89E7E9")
    .text("ALPHAPERCEPT REVIEW", doc.page.margins.left, 41, { characterSpacing: 1.5 });
  doc.font(FONT).fontSize(22).fillColor("#FFFFFF")
    .text(report.title, doc.page.margins.left, 61, { width: contentWidth(doc) });
  doc.font(FONT).fontSize(8).fillColor("#9EB0C4")
    .text(`数据截至 ${formatShanghaiTime(report.asOf)}  ·  ${report.edition === "global" ? "全球终版" : "收盘版"}  ·  v${report.version}`, doc.page.margins.left, 101, { lineBreak: false });
  doc.restore();

  const cardY = 151;
  const gap = 10;
  const cardWidth = (contentWidth(doc) - gap * 2) / 3;
  const cards = [
    { label: "热点精选", value: `${selectedStories}/${report.stories.stories.length}`, note: "分类后高价值事件" },
    { label: "个股资金", value: `${rankReportStocks(report.lhb.stocks).length}`, note: "按净买入额排序" },
    { label: "游资席位", value: `${report.lhb.hotMoneyFlows.length}`, note: "实名观察与活跃席位" },
  ];
  cards.forEach((card, index) => {
    const x = doc.page.margins.left + index * (cardWidth + gap);
    doc.roundedRect(x, cardY, cardWidth, 58, 7).fillAndStroke(COLORS.card, COLORS.line);
    doc.font(FONT).fontSize(7.5).fillColor(COLORS.slate).text(card.label, x + 12, cardY + 10, { lineBreak: false });
    doc.font(FONT).fontSize(17).fillColor(COLORS.ink).text(card.value, x + 12, cardY + 23, { lineBreak: false });
    doc.font(FONT).fontSize(6.5).fillColor(COLORS.muted).text(card.note, x + 12, cardY + 45, { lineBreak: false });
  });
  doc.x = doc.page.margins.left;
  doc.y = 231;
}

function sectionHeading(
  doc: PDFKit.PDFDocument,
  code: string,
  title: string,
  meta: string
): void {
  ensureSpace(doc, 60);
  const x = doc.page.margins.left;
  const y = doc.y;
  doc.rect(x, y, 4, 43).fill(COLORS.teal);
  doc.font(FONT).fontSize(6.5).fillColor(COLORS.teal).text(code, x + 13, y + 1, { characterSpacing: 1 });
  doc.font(FONT).fontSize(16).fillColor(COLORS.ink).text(title, x + 13, y + 13, { lineBreak: false });
  doc.font(FONT).fontSize(7).fillColor(COLORS.slate).text(meta, x + 13, y + 34, { lineBreak: false });
  doc.y = y + 56;
}

function drawStoryCard(
  doc: PDFKit.PDFDocument,
  category: CuratedStoryCategory,
  story: CuratedStoryCategory["stories"][number]
): void {
  const width = contentWidth(doc);
  const innerWidth = width - 28;
  doc.font(FONT).fontSize(10.5);
  const titleHeight = Math.min(30, doc.heightOfString(story.title, { width: innerWidth - 66 }));
  doc.font(FONT).fontSize(8.2);
  const summaryHeight = Math.min(35, doc.heightOfString(story.summary, { width: innerWidth }));
  const height = Math.max(94, 50 + titleHeight + summaryHeight);
  ensureSpace(doc, height + 8);
  const x = doc.page.margins.left;
  const y = doc.y;
  const accent = CATEGORY_COLORS[category.key];
  doc.roundedRect(x, y, width, height, 7).fillAndStroke(COLORS.card, COLORS.line);
  doc.roundedRect(x, y, 4, height, 2).fill(accent);
  doc.font(FONT).fontSize(6.8).fillColor(COLORS.muted)
    .text(formatShanghaiTime(story.publishedAt), x + 14, y + 10, { lineBreak: false });
  doc.roundedRect(x + width - 62, y + 8, 49, 17, 8).fill(COLORS.amberSoft);
  doc.font(FONT).fontSize(6.5).fillColor(COLORS.amber)
    .text(`${story.importance.toFixed(1)} / 10`, x + width - 56, y + 13, { lineBreak: false });
  doc.font(FONT).fontSize(10.5).fillColor(COLORS.ink)
    .text(story.title, x + 14, y + 30, {
      width: innerWidth - 66,
      height: titleHeight,
      ellipsis: true,
    });
  const summaryY = y + 35 + titleHeight;
  doc.font(FONT).fontSize(8.2).fillColor(COLORS.slate)
    .text(story.summary, x + 14, summaryY, {
      width: innerWidth,
      height: summaryHeight,
      ellipsis: true,
    });
  const tagText = [...story.tags.topic, ...story.tags.region, ...story.tags.assets]
    .slice(0, 6)
    .map((tag) => `#${tag}`)
    .join("  ");
  doc.font(FONT).fontSize(6.7).fillColor(accent)
    .text(tagText || "#综合", x + 14, y + height - 28, { width: innerWidth, lineBreak: false });
  const source = story.sources.slice(0, 2).map((item) => item.name).join(" · ") || "公开来源";
  doc.font(FONT).fontSize(6.5).fillColor(COLORS.muted)
    .text(`来源：${shorten(source, 55)}`, x + 14, y + height - 15, {
      width: innerWidth,
      lineBreak: false,
      link: story.sources[0]?.url,
    });
  doc.y = y + height + 8;
}

function drawStories(doc: PDFKit.PDFDocument, report: OsintDailyReportSnapshot): void {
  const curated = curateReportStories(report.stories.stories);
  sectionHeading(
    doc,
    "01 / INTELLIGENCE",
    "热点复盘",
    `从 ${curated.totalCount} 条事件中精选 ${curated.selectedCount} 条 · 分类展示 · 组内最新优先`
  );
  ensureSpace(doc, 56);
  const adviceY = doc.y;
  doc.roundedRect(doc.page.margins.left, adviceY, contentWidth(doc), 45, 7)
    .fillAndStroke(COLORS.amberSoft, "#F0D68D");
  doc.font(FONT).fontSize(7).fillColor(COLORS.amber).text("总览建议", doc.page.margins.left + 13, adviceY + 9, { lineBreak: false });
  doc.font(FONT).fontSize(8.2).fillColor(COLORS.ink)
    .text(report.stories.advice.text || "暂无明确跨市场信号。", doc.page.margins.left + 13, adviceY + 22, { width: contentWidth(doc) - 26, height: 17, ellipsis: true });
  doc.y = adviceY + 57;

  for (const category of curated.categories) {
    ensureSpace(doc, 78);
    const x = doc.page.margins.left;
    const y = doc.y;
    const accent = CATEGORY_COLORS[category.key];
    doc.roundedRect(x, y, contentWidth(doc), 58, 7).fillAndStroke(COLORS.navySoft, COLORS.navySoft);
    doc.rect(x, y, 5, 58).fill(accent);
    doc.font(FONT).fontSize(11.5).fillColor("#FFFFFF").text(category.label, x + 16, y + 10, { lineBreak: false });
    doc.font(FONT).fontSize(7).fillColor("#AFC0D2")
      .text(category.insight, x + 16, y + 29, { width: contentWidth(doc) - 84, height: 22, ellipsis: true });
    doc.roundedRect(x + contentWidth(doc) - 57, y + 10, 42, 18, 9).fill("#17384A");
    doc.font(FONT).fontSize(6.5).fillColor("#8FE4E6")
      .text(`${category.stories.length} 条`, x + contentWidth(doc) - 48, y + 16, { lineBreak: false });
    doc.y = y + 68;
    for (const story of category.stories) drawStoryCard(doc, category, story);
  }
  if (curated.selectedCount === 0) {
    doc.font(FONT).fontSize(9).fillColor(COLORS.slate).text("暂无达到日报筛选标准的热点。", { align: "center" });
    doc.moveDown(1.5);
  }
}

function drawStockTableHeader(doc: PDFKit.PDFDocument): void {
  const x = doc.page.margins.left;
  const y = doc.y;
  const widths = [25, 112, 67, 67, 70, 158];
  const labels = ["#", "股票", "买入", "卖出", "净额", "上榜原因"];
  doc.rect(x, y, contentWidth(doc), 25).fill(COLORS.navySoft);
  let offset = x;
  labels.forEach((label, index) => {
    doc.font(FONT).fontSize(7).fillColor("#BFD0E0").text(label, offset + 5, y + 9, { width: widths[index] - 8, lineBreak: false });
    offset += widths[index];
  });
  doc.y = y + 25;
}

function drawStocks(doc: PDFKit.PDFDocument, report: OsintDailyReportSnapshot): void {
  const rows = rankReportStocks(report.lhb.stocks);
  sectionHeading(doc, "02 / CAPITAL FLOW", "个股资金榜", `交易日 ${report.lhb.tradeDate || "暂无"} · 按净买入额排序 · ${rows.length} 只上榜股票`);
  drawStockTableHeader(doc);
  const x = doc.page.margins.left;
  const widths = [25, 112, 67, 67, 70, 158];
  rows.forEach((stock, index) => {
    if (doc.y + 38 > doc.page.height - doc.page.margins.bottom) {
      addPage(doc);
      sectionHeading(doc, "02 / CAPITAL FLOW", "个股资金榜 · 续", `交易日 ${report.lhb.tradeDate || "暂无"}`);
      drawStockTableHeader(doc);
    }
    const y = doc.y;
    const rowHeight = 38;
    if (index % 2 === 0) doc.rect(x, y, contentWidth(doc), rowHeight).fill("#EBF1F6");
    const values = [
      String(index + 1).padStart(2, "0"),
      `${stock.name}\n${stock.code}${stock.changePercent === null ? "" : ` · ${stock.changePercent >= 0 ? "+" : ""}${stock.changePercent.toFixed(2)}%`}`,
      amount(stock.buyAmount),
      amount(stock.sellAmount),
      signedAmount(stock.netAmount),
      shorten(stock.reasons.join(" / "), 48),
    ];
    let offset = x;
    values.forEach((value, column) => {
      const color = column === 4 ? (stock.netAmount >= 0 ? COLORS.red : COLORS.green) : column === 2 ? COLORS.red : column === 3 ? COLORS.green : COLORS.ink;
      doc.font(FONT).fontSize(column === 1 ? 7.5 : 6.8).fillColor(color)
        .text(value, offset + 5, y + 8, { width: widths[column] - 8, height: 25, ellipsis: true });
      offset += widths[column];
    });
    doc.moveTo(x, y + rowHeight).lineTo(x + contentWidth(doc), y + rowHeight).lineWidth(0.4).strokeColor(COLORS.line).stroke();
    doc.y = y + rowHeight;
  });
  doc.moveDown(1.2);
}

function drawHotMoney(doc: PDFKit.PDFDocument, report: OsintDailyReportSnapshot): void {
  const flows = report.lhb.hotMoneyFlows.slice(0, 28);
  sectionHeading(doc, "03 / HOT MONEY", "游资席位榜", `交易日 ${report.lhb.tradeDate || "暂无"} · 精选前 ${flows.length} 组游资/活跃席位`);
  for (const flow of flows) {
    const stocks = flow.stocks.slice(0, 3);
    const height = 73 + stocks.length * 17;
    ensureSpace(doc, height + 8);
    const x = doc.page.margins.left;
    const y = doc.y;
    const width = contentWidth(doc);
    doc.roundedRect(x, y, width, height, 7).fillAndStroke(COLORS.card, COLORS.line);
    doc.rect(x, y, 4, height).fill(flow.kind === "known" ? COLORS.teal : "#6D7F92");
    doc.font(FONT).fontSize(10.5).fillColor(COLORS.ink).text(flow.label, x + 14, y + 10, { width: width - 120, lineBreak: false });
    const badge = flow.kind === "known" ? `观察可信度 ${flow.confidence ?? "C"}` : "活跃席位";
    doc.roundedRect(x + width - 86, y + 8, 72, 18, 9).fill(COLORS.tealSoft);
    doc.font(FONT).fontSize(6.5).fillColor("#14777B").text(badge, x + width - 78, y + 14, { lineBreak: false });
    doc.font(FONT).fontSize(6.5).fillColor(COLORS.muted)
      .text(shorten(flow.departmentNames.join(" / "), 72), x + 14, y + 29, { width: width - 28, lineBreak: false });
    doc.font(FONT).fontSize(7.5).fillColor(COLORS.red).text(`买 ${amount(flow.totalBuyAmount)}`, x + 14, y + 44, { lineBreak: false });
    doc.fillColor(COLORS.green).text(`卖 ${amount(flow.totalSellAmount)}`, x + 112, y + 44, { lineBreak: false });
    doc.fillColor(flow.totalNetAmount >= 0 ? COLORS.red : COLORS.green).text(`净 ${signedAmount(flow.totalNetAmount)}`, x + 210, y + 44, { lineBreak: false });
    let stockY = y + 62;
    stocks.forEach((stock) => {
      doc.moveTo(x + 14, stockY - 3).lineTo(x + width - 14, stockY - 3).lineWidth(0.35).strokeColor("#E8EDF2").stroke();
      doc.font(FONT).fontSize(7).fillColor(COLORS.ink).text(`${stock.name}  ${stock.code}`, x + 14, stockY + 1, { width: 180, lineBreak: false });
      doc.fillColor(COLORS.red).text(`买 ${amount(stock.buyAmount)}`, x + width - 110, stockY + 1, { width: 96, align: "right", lineBreak: false });
      stockY += 17;
    });
    doc.y = y + height + 8;
  }
}

function drawLegalPanel(doc: PDFKit.PDFDocument, report: OsintDailyReportSnapshot): void {
  ensureSpace(doc, 88);
  const x = doc.page.margins.left;
  const y = doc.y;
  doc.roundedRect(x, y, contentWidth(doc), 72, 7).fill(COLORS.navy);
  doc.font(FONT).fontSize(7).fillColor("#82DFE2").text("分享与使用边界", x + 14, y + 11, { lineBreak: false });
  doc.font(FONT).fontSize(7.2).fillColor("#D5E0EB").text(DAILY_REPORT_DISCLAIMER, x + 14, y + 26, { width: contentWidth(doc) - 28, height: 25, ellipsis: true });
  doc.font(FONT).fontSize(6.3).fillColor("#8FA3B7")
    .text(`数据来源：公开财经资讯、交易所及公开龙虎榜数据 · 快照状态：${report.lhb.status}`, x + 14, y + 55, { lineBreak: false });
  doc.y = y + 84;
}

function drawPageOverlays(doc: PDFKit.PDFDocument): void {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    preserveCursor(doc, () => {
      const originalBottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      const width = contentWidth(doc);
      const centerX = doc.page.width / 2;
      const centerY = doc.page.height / 2;
      doc.save();
      doc.opacity(0.055).fillColor("#17364A").font(FONT).fontSize(30);
      doc.rotate(-24, { origin: [centerX, centerY] });
      doc.text(DAILY_REPORT_WATERMARK, centerX - 175, centerY - 14, { width: 350, align: "center", lineBreak: false });
      doc.restore();
      doc.moveTo(doc.page.margins.left, doc.page.height - 44)
        .lineTo(doc.page.width - doc.page.margins.right, doc.page.height - 44)
        .lineWidth(0.45)
        .strokeColor(COLORS.line)
        .stroke();
      doc.font(FONT).fontSize(5.5).fillColor(COLORS.slate)
        .text("本报告基于公开信息自动整理，仅供学习与复盘参考，不构成投资建议或任何买卖依据。", doc.page.margins.left, doc.page.height - 36, { width, lineBreak: false });
      doc.text("数据可能延迟或存在误差，请以交易所、上市公司及原始来源为准。", doc.page.margins.left, doc.page.height - 27, { width: width - 45, lineBreak: false });
      doc.fontSize(6).fillColor(COLORS.muted)
        .text(`${index - range.start + 1} / ${range.count}`, doc.page.width - doc.page.margins.right - 40, doc.page.height - 27, { width: 40, align: "right", lineBreak: false });
      doc.page.margins.bottom = originalBottomMargin;
    });
  }
}

export async function buildDailyReportPdf(
  report: OsintDailyReportSnapshot,
  section: PdfSection
): Promise<Buffer> {
  if (!isDailyReportPdfReady(report)) throw new Error("PDF_EXPORT_NOT_READY");
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 48, right: 48, bottom: 62, left: 48 },
    bufferPages: true,
    autoFirstPage: true,
    info: {
      Title: report.title,
      Author: "AlphaPercept",
      Subject: "OSINT 每日复盘",
      Keywords: "OSINT, 热点, 个股资金, 游资",
      CreationDate: new Date(report.generatedAt),
    },
  });
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  doc.registerFont(FONT, NOTO_SANS_SC_REGULAR);
  doc.font(FONT);
  doc.on("pageAdded", () => drawPageBase(doc));
  drawPageBase(doc);

  const curated = curateReportStories(report.stories.stories);
  drawCover(doc, report, curated.selectedCount);
  drawLegalPanel(doc, report);
  if (section === "full" || section === "stories") drawStories(doc, report);
  if (section === "full" || section === "stocks") drawStocks(doc, report);
  if (section === "full" || section === "lhb") drawHotMoney(doc, report);
  drawPageOverlays(doc);

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
