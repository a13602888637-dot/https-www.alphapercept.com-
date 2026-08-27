import type { OsintStory } from "../contracts";
import type { LhbHotMoneyFlow, LhbStock } from "../../lhb/contracts";
import { aggregateLhbStocksByCode } from "../../lhb/stock-aggregation";

export type ReportStoryCategoryKey =
  | "upcoming"
  | "macro"
  | "geopolitics"
  | "energy"
  | "technology"
  | "markets";

export interface CuratedStoryCategory {
  key: ReportStoryCategoryKey;
  label: string;
  insight: string;
  stories: OsintStory[];
}

export interface CuratedStoryReport {
  totalCount: number;
  selectedCount: number;
  categories: CuratedStoryCategory[];
}

const CATEGORY_RULES: Array<{
  key: ReportStoryCategoryKey;
  label: string;
  keywords: string[];
}> = [
  { key: "upcoming", label: "接下来要留意", keywords: ["未来事件"] },
  { key: "macro", label: "今天市场在看什么", keywords: ["宏观", "货币政策", "通胀", "央行", "利率", "债券", "macro", "rates"] },
  { key: "geopolitics", label: "海外发生了什么", keywords: ["地缘", "外交", "制裁", "国防", "冲突", "战争"] },
  { key: "energy", label: "能源怎么走", keywords: ["能源", "原油", "天然气", "大宗商品", "黄金", "白银", "铜"] },
  { key: "technology", label: "科技有什么变化", keywords: ["科技", "人工智能", "ai", "芯片", "半导体", "英伟达"] },
  { key: "markets", label: "公司和市场", keywords: [] },
];

export function plainCategoryLabel(key: ReportStoryCategoryKey): string {
  return CATEGORY_RULES.find((rule) => rule.key === key)?.label ?? "今天值得关注";
}

function categoryForStory(story: OsintStory) {
  if (story.eventType === "upcoming") return CATEGORY_RULES[0];
  const labels = [...story.tags.topic, ...story.tags.assets].map((label) => label.toLowerCase());
  return CATEGORY_RULES.find((rule) =>
    rule.key !== "markets" && rule.keywords.some((keyword) =>
      labels.some((label) => label.includes(keyword.toLowerCase()))
    )
  ) ?? CATEGORY_RULES[CATEGORY_RULES.length - 1];
}

function reportWorthy(story: OsintStory, category: ReportStoryCategoryKey): boolean {
  if (category === "upcoming") return story.importance >= 8;
  if (category !== "markets") {
    return (
      story.importance >= 4 ||
      story.tags.verification !== "single-source"
    );
  }
  return (
    story.importance >= 5.5 ||
    story.tags.verification !== "single-source"
  );
}

function topAssets(stories: OsintStory[]): string[] {
  const counts = new Map<string, number>();
  for (const story of stories) {
    for (const asset of story.tags.assets) {
      const label = humanAsset(asset);
      if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN"))
    .slice(0, 3)
    .map(([asset]) => asset);
}

function humanAsset(asset: string): string | null {
  const normalized = asset.trim();
  const aliases: Record<string, string> = {
    equities: "股票",
    equity: "股票",
    stocks: "股票",
    stock: "股票",
    bonds: "债券",
    bond: "债券",
    rates: "利率",
    ai: "人工智能",
    nvidia: "英伟达",
    haidilao: "海底捞",
  };
  const alias = aliases[normalized.toLowerCase()];
  if (alias) return alias;
  return /\p{Script=Han}/u.test(normalized) ? normalized : null;
}

function categoryInsight(stories: OsintStory[]): string {
  const riskOff = stories.filter((story) => story.tags.direction === "risk-off").length;
  const riskOn = stories.filter((story) => story.tags.direction === "risk-on").length;
  const assets = topAssets(stories);
  const direction = riskOff > riskOn
    ? "消息偏谨慎"
    : riskOn > riskOff
      ? "消息偏积极"
      : "消息有多有空";
  const assetText = assets.length > 0 ? assets.join("、") : "市场走势";
  return `${direction}，重点看${assetText}。`;
}

export function plainStoryImpact(story: OsintStory): string {
  const assets = [...new Set(story.tags.assets.map(humanAsset).filter((asset): asset is string => Boolean(asset)))].slice(0, 3);
  if (assets.length === 0) return "留意后续消息和市场反应。";
  const action = story.tags.direction === "risk-off"
    ? "短期可能带来压力"
    : story.tags.direction === "risk-on"
      ? "短期可能带来提振"
      : "短期可能出现波动";
  return `${assets.join("、")}${action}。`;
}

export function plainStockReason(reasons: string[]): string {
  const text = reasons.join(" ");
  if (/换手率/i.test(text)) return "换手活跃，登上龙虎榜";
  if (/涨幅|偏离值达到7%|偏离值达到15%/i.test(text)) return "涨幅明显，登上龙虎榜";
  if (/跌幅|偏离值达到-7%|偏离值达到-15%/i.test(text)) return "跌幅明显，登上龙虎榜";
  if (/振幅/i.test(text)) return "盘中波动较大，登上龙虎榜";
  if (/连续三个交易日/i.test(text)) return "连续三天波动明显";
  return reasons.find(Boolean)?.replace(/的前\d+只(?:证券|股票)/g, "").slice(0, 18) || "当日登上龙虎榜";
}

export function curateReportStories(
  stories: OsintStory[],
  options: { maxPerCategory?: number } = {}
): CuratedStoryReport {
  const maxPerCategory = Math.min(8, Math.max(1, options.maxPerCategory ?? 6));
  const sorted = [...stories].sort((left, right) => {
    const leftUpcoming = left.eventType === "upcoming";
    const rightUpcoming = right.eventType === "upcoming";
    if (leftUpcoming && rightUpcoming) {
      return String(left.scheduledFor ?? left.publishedAt).localeCompare(String(right.scheduledFor ?? right.publishedAt));
    }
    if (leftUpcoming) return -1;
    if (rightUpcoming) return 1;
    return right.publishedAt.localeCompare(left.publishedAt) || right.importance - left.importance;
  });
  const categories = CATEGORY_RULES.map((rule) => {
    const selected = sorted
      .filter((story) => categoryForStory(story).key === rule.key && reportWorthy(story, rule.key))
      .slice(0, maxPerCategory);
    return selected.length === 0
      ? null
      : {
          key: rule.key,
          label: rule.label,
          insight: categoryInsight(selected),
          stories: selected,
        };
  }).filter((category): category is CuratedStoryCategory => category !== null);

  return {
    totalCount: stories.length,
    selectedCount: categories.reduce((sum, category) => sum + category.stories.length, 0),
    categories,
  };
}

export function rankReportStocks(stocks: LhbStock[]): LhbStock[] {
  return aggregateLhbStocksByCode(stocks);
}

export function selectReportStocks(stocks: LhbStock[]): { inflows: LhbStock[]; outflows: LhbStock[] } {
  const ranked = rankReportStocks(stocks);
  return {
    inflows: ranked.filter((stock) => stock.netAmount >= 0).slice(0, 10),
    outflows: ranked.filter((stock) => stock.netAmount < 0).sort((left, right) => left.netAmount - right.netAmount).slice(0, 10),
  };
}

export function selectReportHotMoney(flows: LhbHotMoneyFlow[]): LhbHotMoneyFlow[] {
  return [...flows]
    .sort((left, right) =>
      Number(right.kind === "known") - Number(left.kind === "known") ||
      right.totalBuyAmount - left.totalBuyAmount ||
      right.totalNetAmount - left.totalNetAmount
    )
    .slice(0, 15);
}
