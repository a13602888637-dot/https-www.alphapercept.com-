import { createHash } from "node:crypto";
import type { OsintStory, StorySnapshot, StoryTags } from "./contracts";

export interface RawStory {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  title: string;
  description: string;
  publishedAt: string;
}

interface BuildStoryOptions {
  apiKey?: string | null;
  fetchImpl?: typeof fetch;
  now?: Date;
  limit?: number;
  windowHours?: number;
}

interface SourceResult {
  name: string;
  stories: RawStory[];
  ok: boolean;
}

const CACHE_TTL_MS = 5 * 60 * 1_000;
let storyCache: { snapshot: StorySnapshot; timestamp: number } | null = null;

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function xmlTag(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return decodeXml(match?.[1] ?? "");
}

function validDate(value: unknown, fallback = new Date()): string {
  const date = typeof value === "number" ? new Date(value) : new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? fallback.toISOString() : date.toISOString();
}

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function storyId(title: string): string {
  return createHash("sha256").update(normalizeTitle(title)).digest("hex").slice(0, 20);
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "").slice(0, 80);
}

function storyLanguage(text: string): OsintStory["language"] {
  if (/\p{Script=Han}/u.test(text)) return "zh";
  if (/[A-Za-z]/.test(text)) return "en";
  return "other";
}

function areDuplicates(left: RawStory, right: RawStory): boolean {
  const a = normalizeTitle(left.title);
  const b = normalizeTitle(right.title);
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  return shorter.length >= 12 && longer.includes(shorter);
}

function matchesAny(text: string, words: string[]): boolean {
  const normalized = text.toLowerCase();
  return words.some((word) => normalized.includes(word.toLowerCase()));
}

const GLOBAL_MARKET_HEADLINE_WORDS = [
  "央行", "利率", "通胀", "就业", "消费者信心", "gdp", "关税", "制裁", "冲突", "战争", "停火",
  "海峡", "原油", "石油", "天然气", "黄金", "美元", "美债", "股指", "全球", "美国", "欧洲", "欧盟",
  "日本", "韩国", "中东", "伊朗", "以色列", "监管", "政策", "供应链", "航运", "港口", "地震", "海啸",
  "台风", "洪水", "人工智能法", "芯片禁令", "半导体出口", "军工", "国防",
];

export function isGlobalMarketHeadline(title: string): boolean {
  return matchesAny(title, GLOBAL_MARKET_HEADLINE_WORDS);
}

const TOPIC_RULES: Array<[string, string[]]> = [
  ["地缘", ["冲突", "战争", "制裁", "导弹", "军方", "国防", "海峡", "停火", "iran", "israel", "military", "sanction"]],
  ["宏观", ["央行", "利率", "通胀", "就业", "gdp", "fed", "ecb", "recession", "inflation"]],
  ["能源", ["原油", "石油", "天然气", "opec", "oil", "brent", "wti", "能源"]],
  ["科技", ["芯片", "半导体", "人工智能", "artificial intelligence", "大模型", "nvidia", "robot", "机器人", "科技"]],
  ["政策", ["法案", "监管", "关税", "政府", "政策", "regulation", "tariff"]],
  ["供应链", ["航运", "港口", "供应链", "物流", "shipping", "freight"]],
  ["灾害", ["地震", "海啸", "洪水", "飓风", "灾害", "earthquake", "hurricane"]],
];

const REGION_RULES: Array<[string, string[]]> = [
  ["中国", ["中国", "a股", "beijing", "china"]],
  ["美国", ["美国", "美联储", "华盛顿", "u.s.", "united states", "fed"]],
  ["欧洲", ["欧洲", "欧盟", "英国", "德国", "ecb", "europe"]],
  ["中东", ["中东", "伊朗", "以色列", "霍尔木兹", "iran", "israel", "gulf"]],
  ["亚太", ["日本", "韩国", "亚太", "japan", "korea", "asia-pacific"]],
];

const ASSET_RULES: Array<[string, string[]]> = [
  ["原油", ["原油", "石油", "opec", "oil", "brent", "wti", "霍尔木兹"]],
  ["黄金", ["黄金", "gold", "避险"]],
  ["美债", ["美债", "国债收益率", "treasury yield", "treasury bond", "u.s. bond"]],
  ["美元", ["美元", "dollar", "外汇"]],
  ["美股", ["美股", "标普", "纳斯达克", "nvidia", "wall street"]],
  ["A股", ["a股", "沪深", "上证", "中国股市"]],
];

function deterministicTags(story: { title: string; description: string; sources: RawStory[] }): StoryTags {
  const text = `${story.title} ${story.description}`;
  const topic = TOPIC_RULES.filter(([, words]) => matchesAny(text, words)).map(([tag]) => tag);
  const region = REGION_RULES.filter(([, words]) => matchesAny(text, words)).map(([tag]) => tag);
  const assets = ASSET_RULES.filter(([, words]) => matchesAny(text, words)).map(([tag]) => tag);
  const riskOff = matchesAny(text, ["冲突", "战争", "制裁", "短缺", "预警", "衰退", "下跌", "risk-off", "earthquake"]);
  const riskOn = matchesAny(text, ["停火", "协议", "刺激", "降息", "缓解", "回升", "risk-on"]);
  const official = story.sources.some((source) => matchesAny(source.sourceName, ["ReliefWeb", "UN", "政府", "央行", "官方"]));

  return {
    topic: topic.length > 0 ? [...new Set(topic)] : ["综合"],
    region: [...new Set(region)],
    assets: [...new Set(assets)],
    direction: riskOff && riskOn ? "mixed" : riskOff ? "risk-off" : riskOn ? "risk-on" : "neutral",
    horizon: matchesAny(text, ["今日", "盘中", "临时", "预警"]) ? "intraday" : "1-3d",
    verification: official ? "official" : story.sources.length > 1 ? "multi-source" : "single-source",
  };
}

function sourceTier(sourceName: string): number {
  if (matchesAny(sourceName, ["ReliefWeb", "UN", "官方", "央行"])) return 3;
  if (matchesAny(sourceName, ["Reuters", "BBC", "财联社", "新浪财经", "东方财富"])) return 2;
  return 1;
}

function importance(story: { publishedAt: string; sources: RawStory[]; tags: StoryTags }, now: Date): number {
  const tier = Math.max(...story.sources.map((source) => sourceTier(source.sourceName)), 0);
  const corroboration = Math.min(3, Math.max(0, story.sources.length - 1) * 1.5);
  const ageHours = Math.max(0, (now.getTime() - new Date(story.publishedAt).getTime()) / 3_600_000);
  const recency = ageHours <= 3 ? 2 : ageHours <= 12 ? 1 : 0;
  const relevance = Math.min(2, (story.tags.assets.length > 0 ? 1 : 0) + (story.tags.topic.some((tag) => ["地缘", "宏观", "能源"].includes(tag)) ? 1 : 0));
  return Number(Math.min(10, tier + corroboration + recency + relevance).toFixed(1));
}

function mergeStories(rawStories: RawStory[], now: Date): OsintStory[] {
  const groups: RawStory[][] = [];
  for (const raw of rawStories.filter((story) => story.title && story.sourceUrl)) {
    const group = groups.find((items) => items.some((item) => areDuplicates(item, raw)));
    if (group) group.push(raw);
    else groups.push([raw]);
  }

  return groups.map((items) => {
    const primary = [...items].sort((a, b) => b.description.length - a.description.length)[0];
    const latestPublishedAt = items.map((item) => item.publishedAt).sort().at(-1) ?? primary.publishedAt;
    const tags = deterministicTags({ title: primary.title, description: primary.description, sources: items });
    const sources = [...new Map(items.map((item) => [`${item.sourceName}|${item.sourceUrl}`, { name: item.sourceName, url: item.sourceUrl }])).values()];
    const story: OsintStory = {
      id: storyId(primary.title),
      publishedAt: latestPublishedAt,
      title: primary.title,
      originalTitle: primary.title,
      language: storyLanguage(primary.title),
      translationStatus: storyLanguage(primary.title) === "zh" ? "native" : "fallback",
      summary: cleanText(primary.description || primary.title).slice(0, 120),
      importance: 0,
      sources,
      tags,
      analysisStatus: "fallback",
    };
    story.importance = importance({ publishedAt: story.publishedAt, sources: items, tags }, now);
    return story;
  }).sort((left, right) => right.importance - left.importance || right.publishedAt.localeCompare(left.publishedAt));
}

function normalizeArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 6) : [];
}

async function enrichWithDeepSeek(stories: OsintStory[], apiKey: string, fetchImpl: typeof fetch): Promise<{ stories: OsintStory[]; advice: string } | null> {
  try {
    const response = await fetchImpl("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.2,
        max_tokens: 1800,
        messages: [
          { role: "system", content: "你是全球市场新闻编辑。只输出JSON，不得补写输入中不存在的事实。" },
          {
            role: "user",
            content: `将以下事件压缩为一句中文摘要并打标签；英文标题同时翻译为中文。advice不超过45字，titleZh不超过35字，summary不超过60字。\n${JSON.stringify(stories.slice(0, 12).map((story) => ({ id: story.id, title: story.originalTitle, summary: story.summary, language: story.language })))}\n输出：{"advice":"...","stories":[{"id":"...","titleZh":"中文标题","summary":"中文摘要","topic":[],"region":[],"assets":[],"direction":"risk-on|risk-off|mixed|neutral","horizon":"intraday|1-3d|1-3w|medium"}]}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const content = String(payload?.choices?.[0]?.message?.content ?? "").trim();
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(content.slice(start, end + 1));
    const enrichedRows = (Array.isArray(parsed.stories) ? parsed.stories : []) as Array<Record<string, unknown>>;
    const enrichedById = new Map<string, Record<string, unknown>>(
      enrichedRows.map((item): [string, Record<string, unknown>] => [String(item.id), item])
    );
    const enriched = stories.map((story) => {
      const item = enrichedById.get(story.id);
      if (!item) return story;
      const direction = ["risk-on", "risk-off", "mixed", "neutral"].includes(String(item.direction))
        ? (String(item.direction) as StoryTags["direction"])
        : story.tags.direction;
      const horizon = ["intraday", "1-3d", "1-3w", "medium"].includes(String(item.horizon))
        ? (String(item.horizon) as StoryTags["horizon"])
        : story.tags.horizon;
      const titleZh = cleanText(item.titleZh).slice(0, 80);
      const translatedTitle = story.language !== "zh" && titleZh ? titleZh : story.title;
      return {
        ...story,
        title: translatedTitle,
        translationStatus: story.language === "zh" ? "native" as const : titleZh ? "translated" as const : "fallback" as const,
        summary: cleanText(item.summary || story.summary).slice(0, 120),
        tags: {
          ...story.tags,
          topic: normalizeArray(item.topic).length > 0 ? normalizeArray(item.topic) : story.tags.topic,
          region: normalizeArray(item.region).length > 0 ? normalizeArray(item.region) : story.tags.region,
          assets: normalizeArray(item.assets).length > 0 ? normalizeArray(item.assets) : story.tags.assets,
          direction,
          horizon,
        },
        analysisStatus: "complete" as const,
      };
    });
    return { stories: enriched, advice: cleanText(parsed.advice).slice(0, 90) };
  } catch {
    return null;
  }
}

function fallbackAdvice(stories: OsintStory[]): string {
  const lead = stories.find((story) => story.importance >= 6 && story.tags.direction === "risk-off");
  if (lead) {
    const assets = lead.tags.assets.slice(0, 2).join("、") || "相关资产";
    return `风险偏好偏弱，关注${assets}并等待更多来源确认。`;
  }
  return "暂无明确跨市场共振信号，优先观察高重要度事件的二次确认。";
}

export async function buildStorySnapshot(rawStories: RawStory[], options: BuildStoryOptions = {}): Promise<StorySnapshot> {
  const now = options.now ?? new Date();
  const limit = Math.min(50, Math.max(1, options.limit ?? 20));
  const windowMs = Math.max(1, options.windowHours ?? 24) * 60 * 60 * 1_000;
  const currentStories = rawStories.filter((story) => {
    const publishedAt = new Date(story.publishedAt).getTime();
    const age = now.getTime() - publishedAt;
    return Number.isFinite(publishedAt) && age >= -5 * 60 * 1_000 && age <= windowMs;
  });
  let stories = mergeStories(currentStories, now).slice(0, limit);
  let advice = fallbackAdvice(stories);
  let adviceConfidence: "high" | "medium" | "low" = "low";
  let generatedAt: string | null = null;

  if (options.apiKey) {
    const enriched = await enrichWithDeepSeek(stories, options.apiKey, options.fetchImpl ?? fetch);
    if (enriched) {
      stories = enriched.stories;
      advice = enriched.advice || advice;
      adviceConfidence = stories.some((story) => story.tags.verification !== "single-source") ? "medium" : "low";
      generatedAt = now.toISOString();
    }
  }

  const sourceCounts = new Map<string, number>();
  for (const story of currentStories) sourceCounts.set(story.sourceName, (sourceCounts.get(story.sourceName) ?? 0) + 1);
  return {
    schemaVersion: "1.0",
    generatedAt: now.toISOString(),
    stories,
    advice: { text: advice, confidence: adviceConfidence, generatedAt },
    sources: [...sourceCounts.entries()].map(([name, count]) => ({ name, ok: count > 0, count })),
  };
}

async function fetchText(url: string, fetchImpl: typeof fetch): Promise<string> {
  const response = await fetchImpl(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AlphaQuant/1.0)" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function fetchRss(name: string, url: string, fetchImpl: typeof fetch): Promise<SourceResult> {
  try {
    const xml = await fetchText(url, fetchImpl);
    const stories = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match, index) => {
      const block = match[0];
      const title = xmlTag(block, "title");
      const link = xmlTag(block, "link") || xmlTag(block, "guid");
      return {
        sourceId: `${name}-${index}-${storyId(title)}`,
        sourceName: name,
        sourceUrl: link,
        title,
        description: xmlTag(block, "description"),
        publishedAt: validDate(xmlTag(block, "pubDate")),
      };
    }).filter((story) => story.title && story.sourceUrl).slice(0, 20);
    return { name, stories, ok: stories.length > 0 };
  } catch {
    return { name, stories: [], ok: false };
  }
}

async function fetchGdelt(fetchImpl: typeof fetch): Promise<SourceResult> {
  const name = "GDELT";
  try {
    const query = encodeURIComponent("(conflict OR sanctions OR central bank OR oil OR earthquake OR technology)");
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=ArtList&maxrecords=30&format=json&timespan=24h`;
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(7_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const stories = (Array.isArray(payload?.articles) ? payload.articles : []).map((item: Record<string, unknown>, index: number) => ({
      sourceId: `gdelt-${index}-${storyId(String(item.title ?? ""))}`,
      sourceName: cleanText(item.domain || name),
      sourceUrl: String(item.url ?? ""),
      title: cleanText(item.title),
      description: cleanText(item.socialimage ? "" : item.title),
      publishedAt: validDate(item.seendate),
    })).filter((story: RawStory) => story.title && story.sourceUrl).slice(0, 30);
    return { name, stories, ok: stories.length > 0 };
  } catch {
    return { name, stories: [], ok: false };
  }
}

async function fetchReliefWeb(fetchImpl: typeof fetch): Promise<SourceResult> {
  const name = "ReliefWeb";
  try {
    const url = "https://api.reliefweb.int/v1/reports?appname=alpha-quant-copilot&profile=list&preset=latest&limit=20&fields%5Binclude%5D%5B%5D=title&fields%5Binclude%5D%5B%5D=date&fields%5Binclude%5D%5B%5D=url_alias&fields%5Binclude%5D%5B%5D=body";
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(7_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const stories = (Array.isArray(payload?.data) ? payload.data : []).map((item: Record<string, unknown>) => {
      const fields = (item.fields ?? {}) as Record<string, unknown>;
      return {
        sourceId: `relief-${item.id}`,
        sourceName: name,
        sourceUrl: String(fields.url_alias ?? `https://reliefweb.int/node/${item.id}`),
        title: cleanText(fields.title),
        description: cleanText(fields.body).slice(0, 240),
        publishedAt: validDate((fields.date as Record<string, unknown> | undefined)?.created),
      };
    }).filter((story: RawStory) => story.title && story.sourceUrl);
    return { name, stories, ok: stories.length > 0 };
  } catch {
    return { name, stories: [], ok: false };
  }
}

async function fetchChineseFinance(fetchImpl: typeof fetch): Promise<SourceResult> {
  const name = "财联社";
  try {
    const url = "https://www.cls.cn/nodeapi/updateTelegraphList?app=CailianpressWeb&os=web&sv=7.7.5";
    const response = await fetchImpl(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const items = payload?.data?.roll_data ?? payload?.data ?? [];
    const stories = (Array.isArray(items) ? items : []).map((item: Record<string, unknown>, index: number) => {
      const title = cleanText(item.title || item.brief || item.content);
      const id = String(item.id ?? item.telegraph_id ?? index);
      return {
        sourceId: `cls-${id}`,
        sourceName: name,
        sourceUrl: item.shareurl ? String(item.shareurl) : `https://www.cls.cn/detail/${id}`,
        title,
        description: cleanText(item.brief || item.content),
        publishedAt: validDate(item.ctime ? Number(item.ctime) * 1_000 : item.time),
      };
    }).filter((story: RawStory) => story.title.length > 5 && isGlobalMarketHeadline(story.title)).slice(0, 20);
    return { name, stories, ok: stories.length > 0 };
  } catch {
    return { name, stories: [], ok: false };
  }
}

async function fetchSinaFinance(fetchImpl: typeof fetch): Promise<SourceResult> {
  const name = "新浪财经";
  try {
    const url = "https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&k=&num=20&page=1&r=0.1&callback=";
    const response = await fetchImpl(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const items = payload?.result?.data ?? payload?.data ?? [];
    const stories = (Array.isArray(items) ? items : []).map((item: Record<string, unknown>, index: number) => ({
      sourceId: `sina-${item.docid ?? index}`,
      sourceName: name,
      sourceUrl: String(item.url ?? item.wapurl ?? "https://finance.sina.com.cn"),
      title: cleanText(item.title || item.stitle),
      description: cleanText(item.summary || item.intro),
      publishedAt: validDate(item.ctime ? Number(item.ctime) * 1_000 : item.mtime ? Number(item.mtime) * 1_000 : null),
    })).filter((story: RawStory) => story.title.length > 5 && isGlobalMarketHeadline(story.title)).slice(0, 20);
    return { name, stories, ok: stories.length > 0 };
  } catch {
    return { name, stories: [], ok: false };
  }
}

async function fetchEastMoneyNews(fetchImpl: typeof fetch): Promise<SourceResult> {
  const name = "东方财富";
  try {
    const url = "https://newsapi.eastmoney.com/kuaixun/v1/getlist_102_ajaxResult_20_1_.html";
    const response = await fetchImpl(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("Invalid East Money payload");
    const payload = JSON.parse(text.slice(start, end + 1));
    const items = payload?.LivesList ?? payload?.data ?? [];
    const stories = (Array.isArray(items) ? items : []).map((item: Record<string, unknown>, index: number) => ({
      sourceId: `eastmoney-${item.id ?? index}`,
      sourceName: name,
      sourceUrl: String(item.url_w ?? item.url_m ?? "https://finance.eastmoney.com"),
      title: cleanText(item.title || item.simtitle),
      description: cleanText(item.digest || item.simdigest),
      publishedAt: validDate(item.showtime || item.ordertime),
    })).filter((story: RawStory) => story.title.length > 5 && isGlobalMarketHeadline(story.title)).slice(0, 20);
    return { name, stories, ok: stories.length > 0 };
  } catch {
    return { name, stories: [], ok: false };
  }
}

export async function getStorySnapshot(options: { window?: "24h"; limit?: number; fetchImpl?: typeof fetch } = {}): Promise<StorySnapshot> {
  const fetchImpl = options.fetchImpl ?? fetch;
  if (fetchImpl === fetch && storyCache && Date.now() - storyCache.timestamp < CACHE_TTL_MS) {
    return storyCache.snapshot;
  }
  const results = await Promise.all([
    fetchRss("BBC World", "https://feeds.bbci.co.uk/news/world/rss.xml", fetchImpl),
    fetchRss("Google News", "https://news.google.com/rss/search?q=geopolitics%20OR%20central%20bank%20OR%20oil%20OR%20markets&hl=zh-CN&gl=CN&ceid=CN:zh-Hans", fetchImpl),
    fetchGdelt(fetchImpl),
    fetchReliefWeb(fetchImpl),
    fetchChineseFinance(fetchImpl),
    fetchSinaFinance(fetchImpl),
    fetchEastMoneyNews(fetchImpl),
  ]);
  const snapshot = await buildStorySnapshot(results.flatMap((result) => result.stories), {
    apiKey: process.env.DEEPSEEK_API_KEY ?? null,
    fetchImpl,
    limit: options.limit,
  });
  snapshot.sources = results.map((result) => ({ name: result.name, ok: result.ok, count: result.stories.length }));
  if (fetchImpl === fetch && snapshot.stories.length > 0) storyCache = { snapshot, timestamp: Date.now() };
  return snapshot;
}
