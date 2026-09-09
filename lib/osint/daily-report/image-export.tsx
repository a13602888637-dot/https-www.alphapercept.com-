import { readFile } from "node:fs/promises";
import React from "react";
import { ImageResponse } from "next/og";
import type { OsintStory } from "../contracts";
import type { LhbHotMoneyFlow, LhbStock } from "../../lhb/contracts";
import type { OsintDailyReportSnapshot } from "./contracts";
import {
  compactShareHeadline,
  compactShareLabel,
  isShareHeadlineReady,
  sharePosterDate,
  shareSourceKey,
} from "./image-copy";
import { DAILY_REPORT_DISCLAIMER, DAILY_REPORT_WATERMARK } from "./export-html";
import { themeForDate } from "../daily-video/themes";
import type { VideoTheme } from "../daily-video/contracts";
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

type PosterColors = { [Key in keyof typeof COLORS]: string };

function posterTheme(report: OsintDailyReportSnapshot, section: DailyReportImageSection): VideoTheme {
  const date = sharePosterDate(section, { reportDate: report.reportDate, generatedAt: report.generatedAt, tradeDate: report.lhb.tradeDate });
  return themeForDate(date, section === "stories" ? "morning" : "close");
}

function posterColors(theme: VideoTheme): PosterColors {
  if (!theme.layout) return COLORS;
  return {
    paper: theme.background, white: theme.surface, ink: theme.ink, muted: theme.muted,
    rule: theme.muted, red: theme.accent, redSoft: theme.surface,
    teal: theme.secondary, tealSoft: theme.surface, violet: theme.accent, yellow: theme.secondary,
  };
}

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
  children: React.ReactNode,
  theme: VideoTheme
): React.ReactElement {
  const COLORS = posterColors(theme);
  const family = theme.layout?.cover ?? -1;
  const headerVariant = family % 10;
  const reverse = family >= 10;
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
      <header style={{ display: "flex", flexDirection: [1, 6].includes(headerVariant) ? (reverse ? "column-reverse" : "column") : reverse ? "row-reverse" : "row", gap: theme.layout ? 18 : 0, alignItems: [1, 6].includes(headerVariant) ? "flex-start" : "flex-end", justifyContent: "space-between", borderBottom: `5px solid ${COLORS.ink}`, ...([3, 8].includes(headerVariant) ? { borderLeft: `12px solid ${COLORS.red}` } : {}), ...([2, 4, 7].includes(headerVariant) ? { background: COLORS.white } : {}), padding: [2, 3, 4, 7, 8].includes(headerVariant) ? "24px 24px 28px" : "0 0 32px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: 5, color: COLORS.teal }}>{kicker}</span>
          <h1 style={{ margin: "12px 0 0", fontSize: headerVariant === 5 || headerVariant === 9 ? 90 : 76, lineHeight: 1.05, fontWeight: 700, letterSpacing: headerVariant === 0 ? 6 : -2 }}>{title}</h1>
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
  const shareReadyStories = report.stories.stories.filter((story) =>
    isShareHeadlineReady(story.title)
  );
  const curated = curateReportStories(shareReadyStories, { maxPerCategory: 2 });
  const firstPass = curated.categories.flatMap((category) =>
    category.stories.slice(0, 1).map((story) => ({ story, category: category.label }))
  );
  const secondPass = curated.categories.flatMap((category) =>
    category.stories.slice(1, 2).map((story) => ({ story, category: category.label }))
  );
  const prioritized = [...firstPass, ...secondPass];
  const prioritizedIds = new Set(prioritized.map(({ story }) => story.id));
  const fillers = [...shareReadyStories]
    .filter((story) => !prioritizedIds.has(story.id))
    .sort((left, right) => right.importance - left.importance || right.publishedAt.localeCompare(left.publishedAt))
    .map((story) => ({
      story,
      category: story.eventType === "upcoming" ? "未来事件" : story.tags.topic[0] || "市场动态",
    }));
  const unique: Array<{ story: OsintStory; category: string }> = [];
  const seen = new Set<string>();
  for (const item of [...prioritized, ...fillers]) {
    const key = shareSourceKey(item.story.sources[0]?.url, item.story.title);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
    if (unique.length === 10) break;
  }
  return unique;
}

export function renderHotspotPoster(report: OsintDailyReportSnapshot, theme = posterTheme(report, "stories")): React.ReactElement {
  const stories = selectedStories(report);
  const COLORS = posterColors(theme);
  const layout = theme.layout?.content ?? -1;
  const columns = [1, 2, 4, 7].includes(layout);
  return posterShell(
    report,
    "当日热点",
    "ALPHAPERCEPT · MORNING BRIEF",
    <div style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: columns ? "row" : "column", flexWrap: columns ? "wrap" : "nowrap", justifyContent: "space-between", gap: columns ? 14 : 8 }}>
      {stories.map(({ story, category }, index) => {
        const upcoming = story.eventType === "upcoming";
        return (
          <article
            key={story.id}
            style={{
              display: "flex",
              width: columns ? "49%" : layout === 5 ? "94%" : "100%",
              marginLeft: layout === 5 && index % 2 ? "6%" : 0,
              flexDirection: layout === 1 ? "column" : layout === 4 ? "column-reverse" : [6, 7, 9].includes(layout) ? "row-reverse" : "row",
              minHeight: columns ? 248 : 108,
              ...(columns ? { height: 248, flexShrink: 0 } : {}),
              minWidth: 0,
              alignItems: "stretch",
              border: `3px solid ${upcoming ? COLORS.yellow : COLORS.rule}`,
              background: COLORS.white,
              borderRadius: theme.layout?.frame === "rule" || layout === 8 ? 0 : 18,
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", width: [1, 4].includes(layout) ? "100%" : [2, 3, 7, 8, 9].includes(layout) ? 52 : 82, flexShrink: 0, alignItems: "center", justifyContent: [1, 4].includes(layout) ? "flex-start" : "center", padding: [1, 4].includes(layout) ? "4px 18px" : 0, background: layout === 8 ? COLORS.white : upcoming ? COLORS.red : COLORS.ink, color: layout === 8 ? COLORS.red : COLORS.white, fontSize: columns ? 26 : 34, fontWeight: 700 }}>
              {String(index + 1).padStart(2, "0")}
            </div>
            <div style={{ display: "flex", minWidth: 0, flex: 1, flexDirection: "column", justifyContent: "center", padding: "8px 22px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: columns ? 4 : 14, color: upcoming ? COLORS.red : COLORS.teal, fontSize: columns ? 24 : 26, fontWeight: 700 }}>
                <span>{upcoming ? "未来事件" : category || plainCategoryLabel("markets")}</span>
                <span style={{ color: COLORS.muted, fontWeight: 400 }}>{shanghaiDate(story.scheduledFor || story.publishedAt)}</span>
              </div>
              <h2 style={{ margin: "4px 0 0", fontSize: columns ? 30 : 34, lineHeight: 1.3, fontWeight: 700, color: COLORS.ink }}>{compactShareHeadline(story.title)}</h2>
            </div>
          </article>
        );
      })}
      {stories.length === 0 && (
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", fontSize: 34, color: COLORS.muted }}>暂无已归档热点</div>
      )}
    </div>,
    theme
  );
}

function stockColumn(title: string, stocks: LhbStock[], positive: boolean, COLORS: PosterColors, layout: number): React.ReactElement {
  const accent = positive ? COLORS.red : COLORS.teal;
  const soft = positive ? COLORS.redSoft : COLORS.tealSoft;
  return (
    <section style={{ display: "flex", minWidth: 0, flex: 1, flexDirection: "column", overflow: "hidden", border: `3px solid ${COLORS.rule}`, borderRadius: layout < 0 ? 18 : [0, 10, 18, 28][layout % 4], background: COLORS.white }}>
      <h3 style={{ display: "flex", margin: 0, padding: "14px 20px", background: soft, color: accent, fontSize: 32, fontWeight: 700 }}>{title}</h3>
      <div style={{ display: "flex", flexDirection: "column", padding: "4px 18px 8px" }}>
        {stocks.slice(0, 8).map((stock, index) => (
          <div key={stock.tradeId} style={{ display: "flex", flexDirection: [7, 8, 9].includes(layout) ? "row-reverse" : "row", minHeight: 64, alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: index === Math.min(stocks.length, 8) - 1 ? "none" : `2px solid ${COLORS.rule}` }}>
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

function hotMoneyCard(flow: LhbHotMoneyFlow, index: number, COLORS: PosterColors, layout: number): React.ReactElement {
  const positive = flow.totalNetAmount >= 0;
  const topStocks = [...flow.stocks].sort((left, right) => right.buyAmount - left.buyAmount).slice(0, 2);
  return (
    <article style={{ display: "flex", width: "100%", minHeight: 176, flexDirection: "column", justifyContent: "space-between", border: `3px solid ${COLORS.rule}`, ...(layout >= 5 ? { borderRight: `10px solid ${positive ? COLORS.red : COLORS.teal}` } : { borderLeft: `10px solid ${positive ? COLORS.red : COLORS.teal}` }), borderRadius: layout < 0 ? 18 : [0, 10, 18, 28][layout % 4], background: COLORS.white, padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <h3 style={{ margin: 0, width: "100%", whiteSpace: "nowrap", fontSize: 29, fontWeight: 700 }}>{index + 1}. {compactShareLabel(flow.label)}</h3>
      </div>
      <div style={{ display: "flex", flexDirection: [2, 4, 8].includes(layout) ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 25 }}>
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

export function renderStockHotlistPoster(report: OsintDailyReportSnapshot, theme = posterTheme(report, "hotlist")): React.ReactElement {
  const { inflows, outflows } = selectReportStocks(report.lhb.stocks);
  const flows = selectReportHotMoney(report.lhb.hotMoneyFlows).slice(0, 6);
  const COLORS = posterColors(theme);
  const layout = theme.layout?.content ?? -1;
  return posterShell(
    report,
    "个股热榜",
    "ALPHAPERCEPT · CLOSING BOARD",
    <div style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: theme.layout?.order === "accounts-first" ? "column-reverse" : "column", gap: 22 }}>
      <section style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 40, fontWeight: 700 }}>个股资金榜</h2>
          <span style={{ fontSize: 26, color: COLORS.muted }}>交易日 {report.lhb.tradeDate || "--"}</span>
        </div>
        <div style={{ display: "flex", flexDirection: theme.layout?.order === "outflows-first" ? "row-reverse" : "row", gap: 18 }}>
          {stockColumn("净买入靠前", inflows, true, COLORS, layout)}
          {stockColumn("净卖出靠前", outflows, false, COLORS, layout)}
        </div>
      </section>
      <section style={{ display: "flex", minHeight: 0, flex: 1, flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 40, fontWeight: 700 }}>游资席位榜</h2>
          <span style={{ fontSize: 26, color: COLORS.muted }}>净额 / 买入 / 卖出</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", flexDirection: [6, 9].includes(layout) ? "row-reverse" : "row", gap: 14 }}>
          {flows.map((flow, index) => (
            <div key={flow.flowId} style={{ display: "flex", width: "49%" }}>{hotMoneyCard(flow, index, COLORS, layout)}</div>
          ))}
        </div>
      </section>
    </div>,
    theme
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
