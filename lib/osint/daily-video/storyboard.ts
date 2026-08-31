import type { OsintDailyReportSnapshot } from "../daily-report/contracts";
import { compactShareHeadline, isChineseReadableText, isShareHeadlineReady } from "../daily-report/image-copy";
import { selectReportHotMoney, selectReportStocks } from "../daily-report/story-curation";
import { compactVideoAccountLabel, compactVideoShareName, videoShareAmount } from "./copy";
import type { VideoMode, VideoScene, VideoStoryboard } from "./contracts";
import { themeForDate } from "./themes";

function shanghaiTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function morningScenes(report: OsintDailyReportSnapshot): VideoScene[] {
  return [...report.stories.stories]
    .filter((story) => isShareHeadlineReady(story.title))
    .sort((left, right) => right.importance - left.importance || right.publishedAt.localeCompare(left.publishedAt))
    .slice(0, 5)
    .map((story, index) => ({
      id: `story-${story.id || index}`,
      kind: "story",
      title: compactShareHeadline(story.title),
      eyebrow: story.eventType === "upcoming" ? "未来事件" : story.tags.topic[0] || "全球动态",
      items: [{ label: isChineseReadableText(story.summary) ? story.summary : "关注后续发展", detail: shanghaiTime(story.scheduledFor || story.publishedAt), tone: "neutral" }],
    }));
}

function signedGithubAmount(value: number): string {
  return `${value >= 0 ? "+" : "−"}${videoShareAmount(value)}`;
}

function closeScenes(report: OsintDailyReportSnapshot): VideoScene[] {
  const stocks = selectReportStocks(report.lhb.stocks);
  const flows = selectReportHotMoney(report.lhb.hotMoneyFlows).slice(0, 4);
  return [
    {
      id: "market-inflows",
      kind: "market",
      title: "资金流入观察",
      eyebrow: "收盘数据",
      items: stocks.inflows.slice(0, 4).map((stock) => ({ label: compactVideoShareName(stock.name), value: signedGithubAmount(stock.netAmount), tone: "positive" })),
    },
    {
      id: "market-outflows",
      kind: "market",
      title: "资金流出观察",
      eyebrow: "收盘数据",
      items: stocks.outflows.slice(0, 4).map((stock) => ({ label: compactVideoShareName(stock.name), value: signedGithubAmount(stock.netAmount), tone: "negative" })),
    },
    ...flows.map((flow, index) => ({
      id: `account-${flow.flowId || index}`,
      kind: "account" as const,
      title: compactVideoAccountLabel(flow.label),
      eyebrow: "活跃account",
      items: [
        { label: "净", value: signedGithubAmount(flow.totalNetAmount), tone: flow.totalNetAmount >= 0 ? "positive" as const : "negative" as const },
        { label: "入", value: videoShareAmount(flow.totalBuyAmount), tone: "positive" as const },
        { label: "出", value: videoShareAmount(flow.totalSellAmount), tone: "negative" as const },
      ],
    })),
  ];
}

export function buildVideoStoryboard(report: OsintDailyReportSnapshot, mode: VideoMode): VideoStoryboard {
  if (mode === "close" && report.lhb.tradeDate !== report.reportDate) {
    throw new Error(`STALE_CLOSE_DATA:${report.lhb.tradeDate || "missing"}`);
  }
  const theme = themeForDate(report.reportDate);
  const scenes = mode === "morning" ? morningScenes(report) : closeScenes(report);
  const firstTitle = scenes[0]?.title || (mode === "morning" ? "今日全球热点" : "今日收盘观察");
  return {
    mode,
    date: report.reportDate,
    durationMs: 12_000,
    theme,
    cover: {
      layout: mode === "morning" ? theme.morningLayout : theme.closeLayout,
      kicker: mode === "morning" ? "ALPHAPERCEPT MORNING" : "ALPHAPERCEPT CLOSE",
      title: mode === "morning" ? "今日早报" : "收盘观察",
      subtitle: firstTitle,
    },
    scenes,
    outro: {
      title: "AlphaPercept",
      disclaimer: "公开信息整理，仅供学习与复盘参考",
      asOf: shanghaiTime(report.asOf),
    },
  };
}
