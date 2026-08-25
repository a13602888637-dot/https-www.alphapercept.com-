export interface AihotV1Item {
  id: string;
  title: string;
  originalTitle: string | null;
  summary: string | null;
  source: { name: string };
  links: { original: string; aihot: string };
  publishedAt: string | null;
  discoveredAt: string;
  category: string | null;
  score: number | null;
  selected: boolean;
}

export interface AihotMappedStory {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  additionalSources: Array<{ name: string; url: string }>;
  title: string;
  originalTitle: string;
  description: string;
  publishedAt: string;
  topicHints: string[];
  preAnalyzed: true;
  importanceHint: number | null;
}

interface AihotItemsResponse {
  schemaVersion: number;
  items: AihotV1Item[];
}

const AIHOT_ITEMS_V1 = "https://aihot.virxact.com/api/v1/items";
const ALLOWED_CATEGORIES = new Set(["ai-models", "ai-products", "industry"]);

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizedDate(value: string | null, fallback: string): string | null {
  const date = new Date(value || fallback);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function mapAihotV1Item(item: AihotV1Item): AihotMappedStory {
  const publishedAt = normalizedDate(item.publishedAt, item.discoveredAt) ?? item.discoveredAt;
  return {
    sourceId: `aihot-${item.id}`,
    sourceName: cleanText(item.source.name) || "AIHOT 来源",
    sourceUrl: item.links.original,
    additionalSources: [{ name: "AIHOT", url: item.links.aihot }],
    title: cleanText(item.title),
    originalTitle: cleanText(item.originalTitle) || cleanText(item.title),
    description: cleanText(item.summary) || cleanText(item.title),
    publishedAt,
    topicHints: ["科技"],
    preAnalyzed: true,
    importanceHint: item.score === null || !Number.isFinite(item.score)
      ? null
      : Number((Math.max(0, Math.min(100, item.score)) / 10).toFixed(1)),
  };
}

export async function fetchAihotItemsV1(options: {
  fetchImpl?: typeof fetch;
  now?: Date;
} = {}): Promise<AihotMappedStory[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const url = new URL(AIHOT_ITEMS_V1);
  url.searchParams.set("mode", "selected");
  url.searchParams.set("window", "7d");
  url.searchParams.set("by", "published");
  url.searchParams.set("limit", "100");

  const response = await fetchImpl(url, {
    headers: { "User-Agent": "AlphaPercept/1.0 (non-commercial OSINT reader)" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`AIHOT v1: HTTP ${response.status}`);
  const payload = (await response.json()) as AihotItemsResponse;
  if (payload.schemaVersion !== 1 || !Array.isArray(payload.items)) throw new Error("AIHOT v1: invalid payload");

  const windowMs = 72 * 60 * 60 * 1_000;
  return payload.items
    .filter((item) => item.selected && item.category !== null && ALLOWED_CATEGORIES.has(item.category))
    .filter((item) => {
      const publishedAt = new Date(item.publishedAt || item.discoveredAt).getTime();
      const age = now.getTime() - publishedAt;
      return Number.isFinite(publishedAt) && age >= -5 * 60 * 1_000 && age <= windowMs;
    })
    .map(mapAihotV1Item);
}
