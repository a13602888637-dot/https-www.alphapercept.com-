import { readFile } from "node:fs/promises";
import React from "react";
import { ImageResponse } from "next/og";
import type { OsintStory } from "../contracts";
import type { LhbHotMoneyFlow, LhbStock } from "../../lhb/contracts";
import type { OsintDailyReportSnapshot } from "./contracts";
import { compactShareHeadline, compactShareLabel, sharePosterDate } from "./image-copy";
import { DAILY_REPORT_DISCLAIMER, DAILY_REPORT_WATERMARK } from "./export-html";
import {
  curateReportStories,
  plainCategoryLabel,
  selectReportHotMoney,
  selectReportStocks,
} from "./story-curation";
import {
  DAILY_REPORT_IMAGE_FONT_ASSET,
  isDailyReportImageReady,
} from "./image-readiness";

export type DailyReportImageSection = "stories" | "hotlist";

const WIDTH = 1080;
const HEIGHT = 1920;
const COLORS = {
  paper: "#F0EFEB",
  ink: "#2B2C30",
  muted: "#6F7178",
  rule: "#CFC8B8",
  red: "#9F2336",
  redSoft: "#F3E4E7",
  teal: "#2A5D69",
  tealSoft: "#E0ECEE",
  violet: "#97637C",
  yellow: "#D6CD95",
  white: "#FFFFFF",
} as const;

let fontDataPromise: Promise<ArrayBuffer> | null = null;

function fontData(): Promise<ArrayBuffer> {
  if (!fontDataPromise) {
    fontDataPromise = readFile(`${process.cwd()}/${DAILY_REPORT_IMAGE_FONT_ASSET}`).then(
      (buffer) => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    );
  }
  return fontDataPromise;
}

function amount(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 100_000_000) return `${(absolute / 100_000_000).toFixed(2)}亿`;
  return `${Math.round(absolute / 10_000).toLocaleString("zh-CN")}万`;
}

function signedAmount(value: number): string {
  return `${value >= 0 ? "+" : "−"}${amount(value)}`;
}

function shanghaiDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "--";
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function posterShell(
  report: OsintDailyReportSnapshot,
  title: string,
  kicker: string,
  children: React.ReactNode
): React.ReactElement {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: COLORS.paper,
        color: COLORS.ink,
        fontFamily: "NotoSansSC",
        padding: "68px 64px 48px",
      }}
    >
      <div style={{ position: "absolute", left: 90, top: 720, display: "flex", transform: "rotate(-18deg)", fontSize: 116, fontWeight: 700, letterSpacing: 12, color: "rgba(43,44,48,0.035)" }}>
        ALPHAPERCEPT
      </div>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", borderBottom: `5px solid ${COLORS.ink}`, paddingBottom: 32 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: 5, color: COLORS.teal }}>{kicker}</span>
          <h1 style={{ margin: "12px 0 0", fontSize: 76, lineHeight: 1.05, fontWeight: 700, letterSpacing: -2 }}>{title}</h1>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <span style={{ fontSize: 34, fontWeight: 700 }}>{sharePosterDate(title === "当日热点" ? "stories" : "hotlist", { reportDate: report.reportDate, generatedAt: report.generatedAt, tradeDate: report.lhb.tradeDate })}</span>
          <span style={{ marginTop: 8, fontSize: 26, color: COLORS.muted }}>{title === "当日热点" ? "早间热点" : "收盘热榜"}</span>
        </div>
      </header>
      <main style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: "column", paddingTop: 34 }}>{children}</main>
      <footer style={{ display: "flex", flexDirection: "column", borderTop: `3px solid ${COLORS.rule}`, paddingTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26, fontWeight: 700 }}>
          <span style={{ color: COLORS.red }}>{DAILY_REPORT_WATERMARK}</span>
          <span style={{ color: COLORS.muted }}>数据截至 {shanghaiDate(report.asOf)}</span>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 26, lineHeight: 1.35, color: COLORS.muted }}>{DAILY_REPORT_DISCLAIMER}</p>
      </footer>
    </div>
  );
}

function selectedStories(report: OsintDailyReportSnapshot): Array<{ story: OsintStory; category: string }> {
  const curated = curateReportStories(report.stories.stories, { maxPerCategory: 2 });
  const firstPass = curated.categories.flatMap((category) =>
    category.stories.slice(0, 1).map((story) => ({ story, category: category.label }))
  );
  const secondPass = curated.categories.flatMap((category) =>
    category.stories.slice(1, 2).map((story) => ({ story, category: category.label }))
  );
  const selected = [...firstPass, ...secondPass];
  const selectedIds = new Set(selected.map(({ story }) => story.id));
  const fillers = [...report.stories.stories]
    .filter((story) => !selectedIds.has(story.id))
    .sort((left, right) => right.importance - left.importance || right.publishedAt.localeCompare(left.publishedAt))
    .map((story) => ({
      story,
      category: story.eventType === "upcoming" ? "未来事件" : story.tags.topic[0] || "市场动态",
    }));
  return [...selected, ...fillers].slice(0, 10);
}

export function renderHotspotPoster(report: OsintDailyReportSnapshot): React.ReactElement {
  const stories = selectedStories(report);
  return posterShell(
    report,
    "当日热点",
    "ALPHAPERCEPT · MORNING BRIEF",
    <div style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: "column", justifyContent: "space-between", gap: 8 }}>
      {stories.map(({ story, category }, index) => {
        const upcoming = story.eventType === "upcoming";
        return (
          <article
            key={story.id}
            style={{
              display: "flex",
              minHeight: 108,
              alignItems: "stretch",
              border: `3px solid ${upcoming ? COLORS.yellow : COLORS.rule}`,
              background: COLORS.white,
              borderRadius: 18,
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", width: 82, flexShrink: 0, alignItems: "center", justifyContent: "center", background: upcoming ? COLORS.red : COLORS.ink, color: COLORS.white, fontSize: 34, fontWeight: 700 }}>
              {String(index + 1).padStart(2, "0")}
            </div>
            <div style={{ display: "flex", minWidth: 0, flex: 1, flexDirection: "column", justifyContent: "center", padding: "8px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, color: upcoming ? COLORS.red : COLORS.teal, fontSize: 26, fontWeight: 700 }}>
                <span>{upcoming ? "未来事件" : category || plainCategoryLabel("markets")}</span>
                <span style={{ color: COLORS.muted, fontWeight: 400 }}>{shanghaiDate(story.scheduledFor || story.publishedAt)}</span>
              </div>
              <h2 style={{ margin: "4px 0 0", fontSize: 34, lineHeight: 1.3, fontWeight: 700, color: COLORS.ink }}>{compactShareHeadline(story.title)}</h2>
            </div>
          </article>
        );
      })}
      {stories.length === 0 && (
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", fontSize: 34, color: COLORS.muted }}>暂无已归档热点</div>
      )}
    </div>
  );
}

function stockColumn(title: string, stocks: LhbStock[], positive: boolean): React.ReactElement {
  const accent = positive ? COLORS.red : COLORS.teal;
  const soft = positive ? COLORS.redSoft : COLORS.tealSoft;
  return (
    <section style={{ display: "flex", minWidth: 0, flex: 1, flexDirection: "column", overflow: "hidden", border: `3px solid ${COLORS.rule}`, borderRadius: 18, background: COLORS.white }}>
      <h3 style={{ display: "flex", margin: 0, padding: "14px 20px", background: soft, color: accent, fontSize: 32, fontWeight: 700 }}>{title}</h3>
      <div style={{ display: "flex", flexDirection: "column", padding: "4px 18px 8px" }}>
        {stocks.slice(0, 8).map((stock, index) => (
          <div key={stock.tradeId} style={{ display: "flex", minHeight: 64, alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: index === Math.min(stocks.length, 8) - 1 ? "none" : `2px solid ${COLORS.rule}` }}>
            <div style={{ display: "flex", minWidth: 0, alignItems: "baseline", gap: 9 }}>
              <span style={{ width: 32, fontSize: 26, color: COLORS.muted }}>{index + 1}</span>
              <span style={{ fontSize: 31, fontWeight: 700 }}>{stock.name}</span>
              <span style={{ fontSize: 24, color: COLORS.muted }}>{stock.code}</span>
            </div>
            <span style={{ flexShrink: 0, fontSize: 30, fontWeight: 700, color: accent }}>{signedAmount(stock.netAmount)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function hotMoneyCard(flow: LhbHotMoneyFlow, index: number): React.ReactElement {
  const positive = flow.totalNetAmount >= 0;
  const topStocks = [...flow.stocks].sort((left, right) => right.buyAmount - left.buyAmount).slice(0, 2);
  return (
    <article style={{ display: "flex", width: "100%", minHeight: 176, flexDirection: "column", justifyContent: "space-between", border: `3px solid ${COLORS.rule}`, borderLeft: `10px solid ${positive ? COLORS.red : COLORS.teal}`, borderRadius: 18, background: COLORS.white, padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <h3 style={{ margin: 0, width: "100%", whiteSpace: "nowrap", fontSize: 29, fontWeight: 700 }}>{index + 1}. {compactShareLabel(flow.label)}</h3>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 25 }}>
        <span style={{ whiteSpace: "nowrap", color: positive ? COLORS.red : COLORS.teal }}>净 {signedAmount(flow.totalNetAmount)}</span>
        <span style={{ whiteSpace: "nowrap", color: COLORS.red }}>买 {amount(flow.totalBuyAmount)}</span>
        <span style={{ whiteSpace: "nowrap", color: COLORS.teal }}>卖 {amount(flow.totalSellAmount)}</span>
      </div>
      <p style={{ margin: 0, fontSize: 27, lineHeight: 1.35, color: COLORS.ink }}>
        主要买入：{topStocks.length > 0 ? topStocks.map((stock) => `${stock.name} ${amount(stock.buyAmount)}`).join("、") : "暂无明确买入标的"}
      </p>
    </article>
  );
}

export function renderStockHotlistPoster(report: OsintDailyReportSnapshot): React.ReactElement {
  const { inflows, outflows } = selectReportStocks(report.lhb.stocks);
  const flows = selectReportHotMoney(report.lhb.hotMoneyFlows).slice(0, 6);
  return posterShell(
    report,
    "个股热榜",
    "ALPHAPERCEPT · CLOSING BOARD",
    <div style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: "column", gap: 22 }}>
      <section style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 40, fontWeight: 700 }}>个股资金榜</h2>
          <span style={{ fontSize: 26, color: COLORS.muted }}>交易日 {report.lhb.tradeDate || "--"}</span>
        </div>
        <div style={{ display: "flex", gap: 18 }}>
          {stockColumn("净买入靠前", inflows, true)}
          {stockColumn("净卖出靠前", outflows, false)}
        </div>
      </section>
      <section style={{ display: "flex", minHeight: 0, flex: 1, flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 40, fontWeight: 700 }}>游资席位榜</h2>
          <span style={{ fontSize: 26, color: COLORS.muted }}>净额 / 买入红 · 卖出绿</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          {flows.map((flow, index) => (
            <div key={flow.flowId} style={{ display: "flex", width: "49%" }}>{hotMoneyCard(flow, index)}</div>
          ))}
        </div>
      </section>
    </div>
  );
}

export async function buildDailyReportPng(
  report: OsintDailyReportSnapshot,
  section: DailyReportImageSection
): Promise<Buffer> {
  if (!isDailyReportImageReady(report)) throw new Error("IMAGE_EXPORT_NOT_READY");
  const data = await fontData();
  const image = new ImageResponse(
    section === "stories" ? renderHotspotPoster(report) : renderStockHotlistPoster(report),
    {
      width: 1080,
      height: 1920,
      fonts: [
        { name: "NotoSansSC", data, weight: 400, style: "normal" },
      ],
    }
  );
  return Buffer.from(await image.arrayBuffer());
}

export const DAILY_REPORT_IMAGE_WIDTH = WIDTH;
export const DAILY_REPORT_IMAGE_HEIGHT = HEIGHT;
