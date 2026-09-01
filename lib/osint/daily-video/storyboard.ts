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

const MORNING_COVER_DURATION_MS = 1_200;
const MORNING_PAGE_DURATION_MS = 2_400;
const MORNING_OUTRO_DURATION_MS = 800;
const CLOSE_COVER_DURATION_MS = 1_200;
const CLOSE_PAGE_DURATION_MS = 3_600;
const CLOSE_OUTRO_DURATION_MS = 800;
const MORNING_STORIES_PER_PAGE = 3;

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

export function normalizeVideoHeadline(value: string): string {
  return compactShareHeadline(value)
    .split(/[|｜]/u)[0]
    .replace(/20\d{2}年\d{1,2}月\d{1,2}日/gu, "")
    .replace(/\d{1,2}月\d{1,2}日/gu, "")
    .replace(/重点新闻标题与核心变化|早间更新|最新|新闻|分析/gu, "")
    .replace(/[^\p{Letter}\p{Number}]/gu, "")
    .toLowerCase();
}

function longestCommonSubstringLength(left: string, right: string): number {
  const previous = new Array<number>(right.length + 1).fill(0);
  let longest = 0;
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = new Array<number>(right.length + 1).fill(0);
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      if (left[leftIndex - 1] === right[rightIndex - 1]) {
        current[rightIndex] = previous[rightIndex - 1] + 1;
        longest = Math.max(longest, current[rightIndex]);
      }
    }
    for (let index = 0; index < current.length; index += 1) previous[index] = current[index];
  }
  return longest;
}

function similarHeadline(left: VideoStoryCard, right: VideoStoryCard): boolean {
  const leftTitle = normalizeVideoHeadline(left.title);
  const rightTitle = normalizeVideoHeadline(right.title);
  if (!leftTitle || !rightTitle) return false;
  const sameConcreteSource = left.sourceUrl === right.sourceUrl && !left.sourceUrl.endsWith("/osint/reports");
  if (leftTitle === rightTitle || sameConcreteSource) return true;
  const common = longestCommonSubstringLength(leftTitle, rightTitle);
  const shorter = Math.min(leftTitle.length, rightTitle.length);
  if (left.module === right.module && common >= 4 && common / shorter >= 0.22) return true;
  return common >= 8 && common / shorter >= 0.32;
}

function storyModule(story: OsintStory): string {
  if (story.eventType === "upcoming") return "未来事件";
  const labels = [...story.tags.topic, ...story.tags.assets]
    .map((label) => label.trim().toLowerCase())
    .filter(Boolean);
  const matches = (keywords: string[]) => labels.some((label) => keywords.some((keyword) => label.includes(keyword)));
  if (matches(["宏观", "货币", "央行", "利率", "通胀", "债券", "macro", "rates"])) return "宏观政策";
  if (matches(["地缘", "外交", "制裁", "国防", "冲突", "战争"])) return "国际局势";
  if (matches(["能源", "原油", "天然气", "大宗", "黄金", "白银", "铜"])) return "能源商品";
  if (labels.some((label) => label === "ai") || matches(["科技", "人工智能", "芯片", "半导体", "英伟达"])) return "科技产业";
  return story.tags.topic.find(hasChinese) ? "市场公司" : "全球动态";
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
    summary: story.summary.trim(),
    tags: storyTags(story),
    publishedAt: shanghaiTime(story.scheduledFor || story.publishedAt),
    sourceName: source?.name?.trim() || "公开来源",
    sourceUrl: source?.url || "https://www.alphapercept.com/osint/reports",
  };
}

function morningPages(report: OsintDailyReportSnapshot, reportUrl: string): { pages: VideoPage[]; selected: VideoStoryCard[]; moduleCount: number; sourceCount: number } {
  const sortedStories = [...report.stories.stories]
    .filter((story) => isShareHeadlineReady(story.title) && isChineseReadableText(story.summary))
    .sort((left, right) => right.importance - left.importance || right.publishedAt.localeCompare(left.publishedAt));
  const candidates: VideoStoryCard[] = [];
  for (const story of sortedStories) {
    const card = toStoryCard(story);
    if (candidates.some((candidate) => similarHeadline(candidate, card))) continue;
    candidates.push(card);
    if (candidates.length === 20) break;
  }

  const grouped = new Map<string, VideoStoryCard[]>();
  for (const story of candidates) {
    const stories = grouped.get(story.module) || [];
    stories.push(story);
    grouped.set(story.module, stories);
  }

  const balancedGroups = new Map<string, VideoStoryCard[]>();
  const leftovers: VideoStoryCard[] = [];
  for (const [module, stories] of grouped) {
    const fullCount = stories.length - (stories.length % MORNING_STORIES_PER_PAGE);
    if (fullCount > 0) balancedGroups.set(module, stories.slice(0, fullCount));
    if (fullCount < stories.length) leftovers.push(...stories.slice(fullCount));
  }
  const finalRemainder = leftovers.length % MORNING_STORIES_PER_PAGE;
  const leftoverCount = finalRemainder === 1 ? leftovers.length - 1 : leftovers.length;
  const balancedLeftovers = leftovers
    .slice(0, leftoverCount)
    .map((story) => ({ ...story, module: "综合观察" }));
  if (balancedLeftovers.length > 0) balancedGroups.set("综合观察", balancedLeftovers);

  const contentPages: VideoStoriesPage[] = [];
  for (const [module, stories] of balancedGroups) {
    const modulePageTotal = Math.ceil(stories.length / MORNING_STORIES_PER_PAGE);
    for (let index = 0; index < stories.length; index += MORNING_STORIES_PER_PAGE) {
      contentPages.push({
        kind: "stories",
        module,
        modulePage: Math.floor(index / MORNING_STORIES_PER_PAGE) + 1,
        modulePageTotal,
        stories: stories.slice(index, index + MORNING_STORIES_PER_PAGE),
        reportUrl,
      });
    }
  }

  const selected = [...balancedGroups.values()].flat();
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
    highlights: [
      ...[...balancedGroups.entries()].map(([module, stories]) => `${module} · ${stories.length} 条`),
      `阅读节奏 · 每页最多 ${MORNING_STORIES_PER_PAGE} 条`,
      `数据截至 · ${shanghaiTime(report.asOf)}`,
    ].slice(0, 6),
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

  const dataDate = report.lhb.tradeDate || report.reportDate;
  const cover: VideoPage = {
    kind: "cover",
    kicker: "ALPHAPERCEPT CLOSE",
    title: "💰异动观察",
    subtitle: `${inflows.length + outflows.length} 项变化 · ${accounts.length} 个活跃account · 数据 ${dataDate}`,
    stats: [
      { label: "变化", value: String(inflows.length + outflows.length) },
      { label: "account", value: String(accounts.length) },
      { label: "数据", value: dataDate.slice(5).replace("-", "/") },
    ],
    highlights: [
      `流入方向 · ${inflows.length} 项`,
      `流出方向 · ${outflows.length} 项`,
      `活跃account · ${accounts.length} 个`,
      `榜单内容 · ${rankingPages.length} 页`,
      `account内容 · ${accountPages.length} 页`,
      `资金数据截至 · ${dataDate}`,
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
  const theme = themeForDate(report.reportDate);
  const pages = mode === "morning"
    ? morningPages(report, options.reportUrl).pages
    : closePages(report, options.reportUrl);
  const coverDurationMs = mode === "morning" ? MORNING_COVER_DURATION_MS : CLOSE_COVER_DURATION_MS;
  const pageDurationMs = mode === "morning" ? MORNING_PAGE_DURATION_MS : CLOSE_PAGE_DURATION_MS;
  const outroDurationMs = mode === "morning" ? MORNING_OUTRO_DURATION_MS : CLOSE_OUTRO_DURATION_MS;
  const contentPageCount = Math.max(0, pages.length - 1);
  return {
    mode,
    date: report.reportDate,
    dataDate: mode === "close" ? report.lhb.tradeDate || report.reportDate : report.reportDate,
    durationMs: coverDurationMs + contentPageCount * pageDurationMs + outroDurationMs,
    coverDurationMs,
    pageDurationMs,
    outroDurationMs,
    theme,
    pages,
    outro: {
      title: "AlphaPercept",
      disclaimer: "公开信息整理 · 不构成投资建议",
      asOf: shanghaiTime(report.asOf),
    },
  };
}
