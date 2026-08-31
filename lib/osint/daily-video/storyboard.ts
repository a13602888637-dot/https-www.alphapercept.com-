import type { OsintStory } from "../contracts";
import type { OsintDailyReportSnapshot } from "../daily-report/contracts";
import { compactShareHeadline, isChineseReadableText, isShareHeadlineReady } from "../daily-report/image-copy";
import { selectReportStocks } from "../daily-report/story-curation";
import { compactVideoAccountLabel, compactVideoShareName, videoShareAmount } from "./copy";
import type {
  BuildVideoStoryboardOptions,
  VideoAccountCard,
  VideoMode,
  VideoPage,
  VideoRankingEntry,
  VideoStoriesPage,
  VideoStoryCard,
  VideoStoryboard,
} from "./contracts";
import { themeForDate } from "./themes";

const COVER_DURATION_MS = 1_800 as const;
const OUTRO_DURATION_MS = 1_200 as const;
const MORNING_PAGE_DURATION_MS = 4_200;
const CLOSE_PAGE_DURATION_MS = 4_800;

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

function hasChinese(value: string): boolean {
  return /\p{Script=Han}/u.test(value);
}

function storyModule(story: OsintStory): string {
  return story.eventType === "upcoming"
    ? "未来事件"
    : story.tags.topic.find(hasChinese) || "全球动态";
}

function storyTags(story: OsintStory): string[] {
  const direction = story.tags.direction === "risk-on"
    ? "偏积极"
    : story.tags.direction === "risk-off"
      ? "偏谨慎"
      : story.tags.direction === "mixed"
        ? "多空交织"
        : "影响中性";
  return [...story.tags.region, ...story.tags.assets, direction]
    .filter((label) => label && hasChinese(label))
    .filter((label, index, labels) => labels.indexOf(label) === index)
    .slice(0, 4);
}

function toStoryCard(story: OsintStory): VideoStoryCard {
  const source = story.sources.find((item) => item.url.startsWith("http")) || story.sources[0];
  return {
    id: story.id,
    module: storyModule(story),
    title: compactShareHeadline(story.title),
    summary: isChineseReadableText(story.summary)
      ? story.summary.trim()
      : "信息摘要待补充，请通过下方来源查看原文。",
    tags: storyTags(story),
    publishedAt: shanghaiTime(story.scheduledFor || story.publishedAt),
    sourceName: source?.name?.trim() || "公开来源",
    sourceUrl: source?.url || "https://www.alphapercept.com/osint/reports",
  };
}

function morningPages(report: OsintDailyReportSnapshot, reportUrl: string): { pages: VideoPage[]; selected: VideoStoryCard[]; moduleCount: number; sourceCount: number } {
  const selected = [...report.stories.stories]
    .filter((story) => isShareHeadlineReady(story.title))
    .sort((left, right) => right.importance - left.importance || right.publishedAt.localeCompare(left.publishedAt))
    .slice(0, 20)
    .map(toStoryCard);

  const grouped = new Map<string, VideoStoryCard[]>();
  for (const story of selected) {
    const stories = grouped.get(story.module) || [];
    stories.push(story);
    grouped.set(story.module, stories);
  }

  const contentPages: VideoStoriesPage[] = [];
  for (const [module, stories] of grouped) {
    const modulePageTotal = Math.ceil(stories.length / 2);
    for (let index = 0; index < stories.length; index += 2) {
      contentPages.push({
        kind: "stories",
        module,
        modulePage: Math.floor(index / 2) + 1,
        modulePageTotal,
        stories: stories.slice(index, index + 2),
        reportUrl,
      });
    }
  }

  const sourceCount = new Set(selected.map((story) => story.sourceName)).size;
  const cover: VideoPage = {
    kind: "cover",
    kicker: "ALPHAPERCEPT MORNING",
    title: "今日早报",
    subtitle: `${selected.length} 条公开信息 · ${grouped.size} 个模块`,
    stats: [
      { label: "新闻", value: String(selected.length) },
      { label: "模块", value: String(grouped.size) },
      { label: "来源", value: String(sourceCount) },
    ],
    highlights: selected.slice(0, 3).map((story) => story.title),
    reportUrl,
  };
  return { pages: [cover, ...contentPages], selected, moduleCount: grouped.size, sourceCount };
}

function signedAmount(value: number): string {
  return `${value >= 0 ? "+" : "−"}${videoShareAmount(value)}`;
}

function rankingEntry(name: string, netAmount: number): VideoRankingEntry {
  return {
    label: compactVideoShareName(name),
    value: signedAmount(netAmount),
    tone: netAmount >= 0 ? "positive" : "negative",
  };
}

function accountCard(flow: OsintDailyReportSnapshot["lhb"]["hotMoneyFlows"][number]): VideoAccountCard {
  return {
    label: compactVideoAccountLabel(flow.label),
    net: signedAmount(flow.totalNetAmount),
    incoming: videoShareAmount(flow.totalBuyAmount),
    outgoing: videoShareAmount(flow.totalSellAmount),
    stockCount: flow.stockCount,
    relatedNames: flow.stocks.slice(0, 2).map((stock) => compactVideoShareName(stock.name)),
    tone: flow.totalNetAmount >= 0 ? "positive" : "negative",
  };
}

function closePages(report: OsintDailyReportSnapshot, reportUrl: string): VideoPage[] {
  const stocks = selectReportStocks(report.lhb.stocks);
  const inflows = stocks.inflows.slice(0, 10).map((stock) => rankingEntry(stock.name, stock.netAmount));
  const outflows = stocks.outflows.slice(0, 10).map((stock) => rankingEntry(stock.name, stock.netAmount));
  const accounts = [...report.lhb.hotMoneyFlows]
    .sort((left, right) => Math.abs(right.totalNetAmount) - Math.abs(left.totalNetAmount) || right.totalBuyAmount - left.totalBuyAmount)
    .slice(0, 10)
    .map(accountCard);

  const rankingPages: VideoPage[] = [];
  if (inflows.length > 0) rankingPages.push({ kind: "ranking", direction: "in", entries: inflows, reportUrl });
  if (outflows.length > 0) rankingPages.push({ kind: "ranking", direction: "out", entries: outflows, reportUrl });

  const accountPages: VideoPage[] = [];
  const accountPageTotal = Math.ceil(accounts.length / 5);
  for (let index = 0; index < accounts.length; index += 5) {
    accountPages.push({
      kind: "accounts",
      page: Math.floor(index / 5) + 1,
      pageTotal: accountPageTotal,
      accounts: accounts.slice(index, index + 5),
      reportUrl,
    });
  }

  const strongestIn = inflows[0];
  const strongestOut = outflows[0];
  const cover: VideoPage = {
    kind: "cover",
    kicker: "ALPHAPERCEPT CLOSE",
    title: "💰异动观察",
    subtitle: `${inflows.length + outflows.length} 项变化 · ${accounts.length} 个活跃account`,
    stats: [
      { label: "变化", value: String(inflows.length + outflows.length) },
      { label: "account", value: String(accounts.length) },
      { label: "数据源", value: report.lhb.source === "eastmoney" ? "公开" : "--" },
    ],
    highlights: [
      strongestIn ? `正向 ${strongestIn.label} ${strongestIn.value}` : "暂无正向数据",
      strongestOut ? `负向 ${strongestOut.label} ${strongestOut.value}` : "暂无负向数据",
    ],
    reportUrl,
  };
  return [cover, ...rankingPages, ...accountPages];
}

export function buildVideoStoryboard(
  report: OsintDailyReportSnapshot,
  mode: VideoMode,
  options: BuildVideoStoryboardOptions
): VideoStoryboard {
  if (mode === "close" && report.lhb.tradeDate !== report.reportDate) {
    throw new Error(`STALE_CLOSE_DATA:${report.lhb.tradeDate || "missing"}`);
  }
  const theme = themeForDate(report.reportDate);
  const pages = mode === "morning"
    ? morningPages(report, options.reportUrl).pages
    : closePages(report, options.reportUrl);
  const pageDurationMs = mode === "morning" ? MORNING_PAGE_DURATION_MS : CLOSE_PAGE_DURATION_MS;
  const contentPageCount = Math.max(0, pages.length - 1);
  return {
    mode,
    date: report.reportDate,
    durationMs: COVER_DURATION_MS + contentPageCount * pageDurationMs + OUTRO_DURATION_MS,
    coverDurationMs: COVER_DURATION_MS,
    pageDurationMs,
    outroDurationMs: OUTRO_DURATION_MS,
    theme,
    pages,
    outro: {
      title: "AlphaPercept",
      disclaimer: "公开信息整理 · 不构成投资建议",
      asOf: shanghaiTime(report.asOf),
    },
  };
}
