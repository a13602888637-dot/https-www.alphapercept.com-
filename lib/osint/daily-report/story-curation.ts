import type { OsintStory } from "../contracts";
import type { LhbStock } from "../../lhb/contracts";

export type ReportStoryCategoryKey =
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
  { key: "macro", label: "宏观与利率", keywords: ["宏观", "货币政策", "通胀", "央行", "利率", "债券", "macro", "rates"] },
  { key: "geopolitics", label: "地缘与安全", keywords: ["地缘", "外交", "制裁", "国防", "冲突", "战争"] },
  { key: "energy", label: "能源与大宗", keywords: ["能源", "原油", "天然气", "大宗商品", "黄金", "白银", "铜"] },
  { key: "technology", label: "科技与产业", keywords: ["科技", "人工智能", "ai", "芯片", "半导体", "英伟达"] },
  { key: "markets", label: "市场与公司", keywords: [] },
];

function categoryForStory(story: OsintStory) {
  const labels = [...story.tags.topic, ...story.tags.assets].map((label) => label.toLowerCase());
  return CATEGORY_RULES.find((rule) =>
    rule.key !== "markets" && rule.keywords.some((keyword) =>
      labels.some((label) => label.includes(keyword.toLowerCase()))
    )
  ) ?? CATEGORY_RULES[CATEGORY_RULES.length - 1];
}

function reportWorthy(story: OsintStory, category: ReportStoryCategoryKey): boolean {
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
      counts.set(asset, (counts.get(asset) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN"))
    .slice(0, 3)
    .map(([asset]) => asset);
}

function categoryInsight(stories: OsintStory[]): string {
  const riskOff = stories.filter((story) => story.tags.direction === "risk-off").length;
  const riskOn = stories.filter((story) => story.tags.direction === "risk-on").length;
  const verified = stories.filter((story) => story.tags.verification !== "single-source").length;
  const assets = topAssets(stories);
  const direction = riskOff > riskOn
    ? "风险信号偏谨慎"
    : riskOn > riskOff
      ? "风险偏好偏积极"
      : "多空信号分化";
  const assetText = assets.length > 0 ? assets.join("、") : "相关市场";
  return `${direction}；主要影响 ${assetText}；${verified}/${stories.length} 条获得官方或多源验证。`;
}

export function curateReportStories(
  stories: OsintStory[],
  options: { maxPerCategory?: number } = {}
): CuratedStoryReport {
  const maxPerCategory = Math.min(8, Math.max(1, options.maxPerCategory ?? 6));
  const sorted = [...stories].sort((left, right) =>
    right.publishedAt.localeCompare(left.publishedAt) || right.importance - left.importance
  );
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
  const byCode = new Map<string, LhbStock>();
  for (const stock of stocks) {
    const existing = byCode.get(stock.code);
    if (!existing) {
      byCode.set(stock.code, { ...stock, reasons: [...new Set(stock.reasons)] });
      continue;
    }
    const reasons = [...new Set([...existing.reasons, ...stock.reasons])];
    const existingTurnover = existing.buyAmount + existing.sellAmount;
    const currentTurnover = stock.buyAmount + stock.sellAmount;
    const preferred = currentTurnover > existingTurnover ? stock : existing;
    byCode.set(stock.code, { ...preferred, reasons });
  }
  return [...byCode.values()].sort((left, right) =>
    right.netAmount - left.netAmount || right.buyAmount - left.buyAmount
  );
}
