import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildStorySnapshot, getStorySnapshot, isGlobalMarketHeadline, parsePublishedAt, sliceStorySnapshot, type RawStory } from "../../lib/osint/story-service";
import { parseStoryRequest } from "../../lib/osint/story-query";

const rawStories: RawStory[] = [
  {
    sourceId: "reuters-1",
    sourceName: "Reuters",
    sourceUrl: "https://example.com/reuters-hormuz",
    title: "霍尔木兹海峡临时航道接近敲定，原油供应风险缓解",
    description: "伊朗与阿曼就临时航道坐标达成一致。",
    publishedAt: "2026-08-24T10:00:00.000Z",
  },
  {
    sourceId: "bbc-1",
    sourceName: "BBC World",
    sourceUrl: "https://example.com/bbc-hormuz",
    title: "霍尔木兹海峡临时航道接近敲定 原油供应风险缓解",
    description: "第二来源确认相关谈判取得进展。",
    publishedAt: "2026-08-24T10:03:00.000Z",
  },
  {
    sourceId: "relief-1",
    sourceName: "ReliefWeb",
    sourceUrl: "https://example.com/relief-earthquake",
    title: "日本近海地震触发短时海啸预警",
    description: "暂无重大伤亡报告。",
    publishedAt: "2026-08-24T09:00:00.000Z",
  },
  {
    sourceId: "old-1",
    sourceName: "Google News",
    sourceUrl: "https://example.com/old-oil-story",
    title: "Oil market story from two days ago",
    description: "This item is outside the requested 24 hour window.",
    publishedAt: "2026-08-22T08:00:00.000Z",
  },
];

async function verifyStories() {
  assert.equal(parseStoryRequest(new URLSearchParams("limit=1")).pageSize, 1);
  assert.equal(parseStoryRequest(new URLSearchParams("limit=50")).pageSize, 50);
  assert.equal(parseStoryRequest(new URLSearchParams("page=2&pageSize=20&topic=能源")).page, 2);
  assert.equal(parseStoryRequest(new URLSearchParams("page=2&pageSize=20&topic=能源")).topic, "能源");
  assert.equal(parseStoryRequest(new URLSearchParams("topic=未来事件")).topic, "未来事件");
  const snapshot = await buildStorySnapshot(rawStories, {
    apiKey: null,
    now: new Date("2026-08-24T11:00:00.000Z"),
    windowHours: 24,
  });

  assert.equal(snapshot.stories.length, 2);
  assert.equal(snapshot.stories[0].analysisStatus, "fallback");
  assert.ok(snapshot.stories[0].sources[0].url.startsWith("https://"));
  assert.ok(snapshot.stories[0].tags.topic.length > 0);
  assert.ok(snapshot.stories[0].importance >= 0 && snapshot.stories[0].importance <= 10);
  const hormuz = snapshot.stories.find((story) => story.title.includes("霍尔木兹"));
  assert.equal(hormuz?.sources.length, 2);
  assert.equal(hormuz?.tags.verification, "multi-source");
  assert.equal(hormuz?.tags.assets.includes("原油"), true);
  assert.equal(typeof snapshot.advice.text, "string");
  const treasurySecretary = await buildStorySnapshot([
    {
      sourceId: "policy-1",
      sourceName: "BBC World",
      sourceUrl: "https://example.com/treasury-secretary",
      title: "US treasury secretary announces new sanctions",
      description: "The policy targets cross-border payments.",
      publishedAt: "2026-08-24T10:00:00.000Z",
    },
  ], { apiKey: null, now: new Date("2026-08-24T11:00:00.000Z") });
  assert.equal(treasurySecretary.stories[0].tags.assets.includes("美债"), false);
  assert.equal(isGlobalMarketHeadline("英科医疗：目前客户下单意愿强烈"), false);
  assert.equal(isGlobalMarketHeadline("韩国消费者信心指数四个月来首降，央行称股市下跌有影响"), true);
  const ukraine = await buildStorySnapshot([
    {
      sourceId: "ukraine-1",
      sourceName: "BBC World",
      sourceUrl: "https://example.com/ukraine",
      title: "UK prime minister supports Ukraine despite Russian drone threats",
      description: "Diplomatic and military update.",
      publishedAt: "2026-08-24T10:00:00.000Z",
    },
  ], { apiKey: null, now: new Date("2026-08-24T11:00:00.000Z") });
  assert.equal(ukraine.stories[0].tags.topic.includes("科技"), false);

  const englishRaw: RawStory[] = [{
    sourceId: "translate-1",
    sourceName: "BBC World",
    sourceUrl: "https://example.com/translate",
    title: "Oil rises as shipping risk increases",
    description: "Markets react to supply concerns.",
    publishedAt: "2026-08-24T10:00:00.000Z",
  }];
  const englishBase = await buildStorySnapshot(englishRaw, { apiKey: null, now: new Date("2026-08-24T11:00:00.000Z") });
  const translated = await buildStorySnapshot(englishRaw, {
    apiKey: "test-key",
    now: new Date("2026-08-24T11:00:00.000Z"),
    fetchImpl: async () => Response.json({ choices: [{ message: { content: JSON.stringify({
      advice: "关注原油供应风险。",
      stories: [{
        id: englishBase.stories[0].id,
        titleZh: "航运风险上升推动油价上涨",
        summary: "市场正对供应中断风险重新定价。",
        topic: ["能源"],
        region: [],
        assets: ["原油"],
        direction: "risk-off",
        horizon: "1-3d",
      }],
    }) } }] }),
  });
  assert.equal(translated.stories[0].title, "航运风险上升推动油价上涨");
  assert.equal(translated.stories[0].originalTitle, "Oil rises as shipping risk increases");
  assert.equal(translated.stories[0].translationStatus, "translated");
  let cachedAnalysisCalls = 0;
  const cachedSnapshot = await buildStorySnapshot(englishRaw, {
    apiKey: "test-key",
    now: new Date("2026-08-24T11:00:00.000Z"),
    cachedStories: new Map([[translated.stories[0].id, translated.stories[0]]]),
    fetchImpl: async () => {
      cachedAnalysisCalls += 1;
      return new Response(null, { status: 500 });
    },
  } as Parameters<typeof buildStorySnapshot>[1] & { cachedStories: Map<string, typeof translated.stories[0]> });
  assert.equal(cachedAnalysisCalls, 0);
  assert.equal(cachedSnapshot.stories[0].title, "航运风险上升推动油价上涨");
  assert.equal(cachedSnapshot.stories[0].analysisStatus, "complete");
  assert.equal(cachedSnapshot.stories[0].cacheStatus, "live");
  const cachedFallback = await buildStorySnapshot([], {
    apiKey: "test-key",
    now: new Date("2026-08-24T11:00:00.000Z"),
    cachedStories: new Map([[translated.stories[0].id, translated.stories[0]]]),
    fetchImpl: async () => {
      throw new Error("cached story must not call DeepSeek");
    },
  } as Parameters<typeof buildStorySnapshot>[1] & { cachedStories: Map<string, typeof translated.stories[0]> });
  assert.equal(cachedFallback.stories.length, 1);
  assert.equal(cachedFallback.stories[0].title, "航运风险上升推动油价上涨");
  assert.equal(cachedFallback.stories[0].cacheStatus, "cached");
  const futureRaw: RawStory[] = [{
    sourceId: "future-news-1",
    sourceName: "Reuters",
    sourceUrl: "https://example.com/future-news",
    title: "NVIDIA will report earnings on August 27 at 5:00 PM ET",
    description: "The company explicitly scheduled its earnings call for August 27 at 5:00 PM ET.",
    publishedAt: "2026-08-25T10:30:00.000Z",
  }];
  const futureAnalyzed = await buildStorySnapshot(futureRaw, {
    apiKey: "test-key",
    now: new Date("2026-08-25T11:00:00.000Z"),
    fetchImpl: async () => Response.json({ choices: [{ message: { content: JSON.stringify({
      advice: "关注英伟达财报。",
      stories: [{
        id: (await buildStorySnapshot(futureRaw, { apiKey: null, now: new Date("2026-08-25T11:00:00.000Z") })).stories[0].id,
        titleZh: "英伟达将公布财报",
        summary: "公司将在明确时间公布财报。",
        topic: ["科技"],
        region: ["美国"],
        assets: ["NVDA", "半导体"],
        direction: "neutral",
        horizon: "1-3d",
        scheduledFor: "2026-08-27T21:00:00.000Z",
        scheduledPrecision: "exact",
      }],
    }) } }] }),
  });
  assert.equal(futureAnalyzed.stories[0].eventType, "upcoming");
  assert.equal(futureAnalyzed.stories[0].scheduledFor, "2026-08-27T21:00:00.000Z");
  assert.equal(futureAnalyzed.stories[0].scheduledPrecision, "exact");
  assert.equal(futureAnalyzed.stories[0].tags.topic.includes("未来事件"), true);
  const vagueFutureRaw: RawStory[] = [{
    sourceId: "vague-future-news",
    sourceName: "Reuters",
    sourceUrl: "https://example.com/vague-future-news",
    title: "Company plans an investor update tomorrow",
    description: "The company did not provide a calendar date or exact time.",
    publishedAt: "2026-08-25T10:30:00.000Z",
  }];
  const vagueFutureBase = await buildStorySnapshot(vagueFutureRaw, { apiKey: null, now: new Date("2026-08-25T11:00:00.000Z") });
  const vagueFuture = await buildStorySnapshot(vagueFutureRaw, {
    apiKey: "test-key",
    now: new Date("2026-08-25T11:00:00.000Z"),
    fetchImpl: async () => Response.json({ choices: [{ message: { content: JSON.stringify({
      advice: "等待官方日历。",
      stories: [{
        id: vagueFutureBase.stories[0].id,
        titleZh: "公司计划明日更新",
        summary: "未披露明确日历日期。",
        topic: ["科技"],
        region: ["美国"],
        assets: [],
        direction: "neutral",
        horizon: "1-3d",
        scheduledFor: "2026-08-26T12:00:00.000Z",
        scheduledPrecision: "date",
      }],
    }) } }] }),
  });
  assert.equal(vagueFuture.stories[0].eventType, "news");
  assert.equal(vagueFuture.stories[0].scheduledFor, null);
  const dateOnlyRaw: RawStory[] = [{
    sourceId: "date-only-news",
    sourceName: "Reuters",
    sourceUrl: "https://example.com/date-only-news",
    title: "Company will publish results on August 27",
    description: "The announcement gives a date but no clock time or market session.",
    publishedAt: "2026-08-25T10:30:00.000Z",
  }];
  const dateOnlyBase = await buildStorySnapshot(dateOnlyRaw, { apiKey: null, now: new Date("2026-08-25T11:00:00.000Z") });
  const dateOnlyFuture = await buildStorySnapshot(dateOnlyRaw, {
    apiKey: "test-key",
    now: new Date("2026-08-25T11:00:00.000Z"),
    fetchImpl: async () => Response.json({ choices: [{ message: { content: JSON.stringify({
      advice: "关注公司公告。",
      stories: [{
        id: dateOnlyBase.stories[0].id,
        titleZh: "公司将公布业绩",
        summary: "公告只给出日期。",
        topic: ["市场"],
        region: ["美国"],
        assets: [],
        direction: "neutral",
        horizon: "1-3d",
        scheduledFor: "2026-08-27T16:00:00.000Z",
        scheduledPrecision: "exact",
      }],
    }) } }] }),
  });
  assert.equal(dateOnlyFuture.stories[0].eventType, "upcoming");
  assert.equal(dateOnlyFuture.stories[0].scheduledFor, "2026-08-27T12:00:00.000Z");
  assert.equal(dateOnlyFuture.stories[0].scheduledPrecision, "date");
  const cachedFutureFiltered = await buildStorySnapshot(futureRaw, {
    apiKey: null,
    now: new Date("2026-08-25T11:00:00.000Z"),
    topic: "未来事件",
    cachedStories: new Map([[futureAnalyzed.stories[0].id, futureAnalyzed.stories[0]]]),
  } as Parameters<typeof buildStorySnapshot>[1] & { cachedStories: Map<string, typeof futureAnalyzed.stories[0]> });
  assert.equal(cachedFutureFiltered.stories.length, 1);
  assert.equal(parsePublishedAt("not-a-date"), null);
  assert.equal(parsePublishedAt("20260825T091500Z"), "2026-08-25T09:15:00.000Z");

  let aihotDeepSeekCalls = 0;
  const aihotSnapshot = await buildStorySnapshot([{
    sourceId: "aihot-ready-1",
    sourceName: "NVIDIA Blog",
    sourceUrl: "https://example.com/nvidia-original",
    additionalSources: [{ name: "AIHOT", url: "https://aihot.virxact.com/items/ready-1" }],
    title: "NVIDIA 发布新一代 AI 芯片",
    originalTitle: "NVIDIA launches a new AI chip",
    description: "新芯片提升推理效率。",
    publishedAt: "2026-08-24T10:00:00.000Z",
    topicHints: ["科技"],
    preAnalyzed: true,
    importanceHint: 7.2,
  }], {
    apiKey: "test-key",
    now: new Date("2026-08-24T11:00:00.000Z"),
    fetchImpl: async () => {
      aihotDeepSeekCalls += 1;
      return new Response(null, { status: 500 });
    },
  });
  assert.equal(aihotDeepSeekCalls, 0);
  assert.equal(aihotSnapshot.stories[0].title, "NVIDIA 发布新一代 AI 芯片");
  assert.equal(aihotSnapshot.stories[0].originalTitle, "NVIDIA launches a new AI chip");
  assert.equal(aihotSnapshot.stories[0].translationStatus, "translated");
  assert.equal(aihotSnapshot.stories[0].analysisStatus, "complete");
  assert.equal(aihotSnapshot.stories[0].tags.topic.includes("科技"), true);
  assert.equal(aihotSnapshot.stories[0].sources.some((item) => item.name === "AIHOT"), true);
  assert.ok(aihotSnapshot.stories[0].importance >= 7.2);

  const pagingNow = new Date("2026-08-25T12:00:00.000Z");
  const energyStories: RawStory[] = Array.from({ length: 55 }, (_, index) => ({
    sourceId: `energy-${index}`,
    sourceName: index % 2 === 0 ? "Bloomberg" : "Reuters",
    sourceUrl: `https://example.com/energy-${index}`,
    title: `Oil supply market update number ${String(index).padStart(2, "0")}`,
    description: "Crude oil and listed energy stocks react to supply changes.",
    publishedAt: new Date(pagingNow.getTime() - index * 45 * 60_000).toISOString(),
  }));
  const energyPage = await buildStorySnapshot(energyStories, {
    apiKey: null,
    now: pagingNow,
    windowHours: 72,
    page: 2,
    pageSize: 20,
    topic: "能源",
  });
  assert.equal(energyPage.pagination.page, 2);
  assert.equal(energyPage.pagination.pageSize, 20);
  assert.equal(energyPage.pagination.total, 55);
  assert.equal(energyPage.pagination.totalPages, 3);
  assert.equal(energyPage.stories.length, 20);
  assert.equal(energyPage.stories.every((story) => story.tags.topic.includes("能源")), true);

  const qualityRanked = await buildStorySnapshot([
    {
      sourceId: "quality-bloomberg",
      sourceName: "Bloomberg Markets",
      sourceUrl: "https://www.bloomberg.com/news/articles/quality",
      title: "Global stocks rise after central bank decision",
      description: "Equity markets react to policy guidance.",
      publishedAt: "2026-08-25T11:00:00.000Z",
    },
    {
      sourceId: "quality-generic",
      sourceName: "Generic Blog",
      sourceUrl: "https://example.com/generic",
      title: "Regional stocks move after corporate update",
      description: "Equity markets react to a company update.",
      publishedAt: "2026-08-25T11:00:00.000Z",
    },
    {
      sourceId: "quality-fed",
      sourceName: "Federal Reserve",
      sourceUrl: "https://www.federalreserve.gov/newsevents/pressreleases/test.htm",
      title: "Federal Reserve issues policy statement on rates",
      description: "The central bank publishes an official decision.",
      publishedAt: "2026-08-25T11:00:00.000Z",
    },
  ], { apiKey: null, now: pagingNow, windowHours: 72, pageSize: 20 });
  const bloombergImportance = qualityRanked.stories.find((story) => story.sources.some((item) => item.name === "Bloomberg Markets"))?.importance ?? 0;
  const genericImportance = qualityRanked.stories.find((story) => story.sources.some((item) => item.name === "Generic Blog"))?.importance ?? 0;
  assert.ok(bloombergImportance > genericImportance);
  assert.equal(qualityRanked.stories.find((story) => story.sources.some((item) => item.name === "Federal Reserve"))?.tags.verification, "official");

  const chronological = await buildStorySnapshot([
    {
      sourceId: "new-generic",
      sourceName: "Generic Blog",
      sourceUrl: "https://example.com/new-generic",
      title: "Latest stock market update with limited context",
      description: "A recent market update.",
      publishedAt: "2026-08-25T11:55:00.000Z",
    },
    {
      sourceId: "older-official",
      sourceName: "Federal Reserve",
      sourceUrl: "https://www.federalreserve.gov/newsevents/pressreleases/older.htm",
      title: "Federal Reserve issues an earlier official market statement",
      description: "An official and higher importance policy statement.",
      publishedAt: "2026-08-25T09:00:00.000Z",
    },
  ], { apiKey: null, now: pagingNow, windowHours: 72, pageSize: 20 });
  assert.equal(chronological.stories[0].publishedAt, "2026-08-25T11:55:00.000Z");
  assert.ok(chronological.stories[0].importance < chronological.stories[1].importance);

  const mixedTiming = await buildStorySnapshot([
    {
      sourceId: "future-fed",
      sourceName: "Federal Reserve",
      sourceUrl: "https://www.federalreserve.gov/calendar",
      title: "未来美联储主席讲话",
      description: "官方日历事件。",
      publishedAt: "2026-08-25T14:00:00.000Z",
      scheduledFor: "2026-08-25T14:00:00.000Z",
      eventType: "upcoming",
      topicHints: ["未来事件", "宏观"],
      preAnalyzed: true,
      importanceHint: 9,
    },
    {
      sourceId: "current-news",
      sourceName: "Reuters",
      sourceUrl: "https://example.com/current-news",
      title: "当前股票市场新闻",
      description: "已发生新闻。",
      publishedAt: "2026-08-25T11:30:00.000Z",
    },
  ], { apiKey: null, now: pagingNow, windowHours: 72, pageSize: 20 });
  assert.deepEqual(mixedTiming.stories.map((story) => story.id.length > 0 ? story.eventType : ""), ["upcoming", "news"]);
  assert.equal(mixedTiming.stories[0].tags.topic.includes("未来事件"), true);
  const officialCalendar = await buildStorySnapshot([{
    sourceId: "bls-official",
    sourceName: "U.S. Bureau of Labor Statistics",
    sourceUrl: "https://www.bls.gov/schedule/",
    title: "美国非农就业报告",
    description: "官方日历事件。",
    publishedAt: "2026-08-25T14:00:00.000Z",
    scheduledFor: "2026-08-25T14:00:00.000Z",
    eventType: "upcoming",
    topicHints: ["未来事件", "宏观"],
    preAnalyzed: true,
    importanceHint: 10,
  }], { apiKey: null, now: pagingNow, windowHours: 72, pageSize: 20 });
  assert.equal(officialCalendar.stories[0].tags.verification, "official");

  const manyRaw: RawStory[] = Array.from({ length: 13 }, (_, index) => ({
    sourceId: `many-${index}`,
    sourceName: "BBC World",
    sourceUrl: `https://example.com/many-${index}`,
    title: `English market story number ${String(index).padStart(2, "0")}`,
    description: `Market description ${index}`,
    publishedAt: `2026-08-24T${String(10 - Math.floor(index / 6)).padStart(2, "0")}:${String(index).padStart(2, "0")}:00.000Z`,
  }));
  const manyBase = await buildStorySnapshot(manyRaw, { apiKey: null, now: new Date("2026-08-24T11:00:00.000Z"), limit: 20 });
  let batchCalls = 0;
  const manyTranslated = await buildStorySnapshot(manyRaw, {
    apiKey: "test-key",
    now: new Date("2026-08-24T11:00:00.000Z"),
    limit: 20,
    fetchImpl: async (_input, init) => {
      batchCalls += 1;
      const request = JSON.parse(String(init?.body));
      const content = String(request.messages[1].content);
      const start = content.indexOf("[{");
      const end = content.indexOf("]\n输出");
      const rows = JSON.parse(content.slice(start, end + 1));
      return Response.json({ choices: [{ message: { content: JSON.stringify({
        advice: "批量翻译完成。",
        stories: rows.map((row: { id: string }, index: number) => ({
          id: row.id,
          titleZh: `中文标题${batchCalls}-${index}`,
          summary: `中文摘要${batchCalls}-${index}`,
          topic: ["宏观"],
          region: [],
          assets: [],
          direction: "neutral",
          horizon: "1-3d",
        })),
      }) } }] });
    },
  });
  assert.equal(batchCalls, 2);
  assert.equal(manyTranslated.stories.filter((story) => story.translationStatus === "translated").length, 13);
  assert.equal(manyTranslated.stories.filter((story) => story.analysisStatus === "complete").length, 13);
  const sliced = sliceStorySnapshot(manyTranslated, 1);
  assert.equal(sliced.stories.length, 1);
  assert.equal(manyTranslated.stories.length, 13);

  let repeatedAnalysisCalls = 0;
  const reusableRaw: RawStory[] = [{
    sourceId: "reuse-analysis-1",
    sourceName: "Reusable Source",
    sourceUrl: "https://example.com/reuse-analysis-1",
    title: "Reusable English stock market analysis item",
    description: "A listed company earnings event for cache verification.",
    publishedAt: "2026-08-24T10:00:00.000Z",
  }];
  const reusableFetch: typeof fetch = async (_input, init) => {
    repeatedAnalysisCalls += 1;
    const request = JSON.parse(String(init?.body));
    const content = String(request.messages[1].content);
    const start = content.indexOf("[{");
    const end = content.indexOf("]\n输出");
    const rows = JSON.parse(content.slice(start, end + 1));
    return Response.json({ choices: [{ message: { content: JSON.stringify({
      advice: "复用分析。",
      stories: rows.map((row: { id: string }) => ({ id: row.id, titleZh: "复用中文标题", summary: "复用中文摘要", topic: ["科技"], region: [], assets: ["美股"], direction: "neutral", horizon: "1-3d" })),
    }) } }] });
  };
  await buildStorySnapshot(reusableRaw, { apiKey: "cache-key", now: new Date("2026-08-24T11:00:00.000Z"), fetchImpl: reusableFetch });
  await buildStorySnapshot(reusableRaw, { apiKey: "cache-key", now: new Date("2026-08-24T11:01:00.000Z"), fetchImpl: reusableFetch });
  assert.equal(repeatedAnalysisCalls, 1, "same story id should reuse DeepSeek enrichment");

  const prefetchNow = new Date();
  const prefetchRss = `<rss><channel>${Array.from({ length: 50 }, (_, index) => {
    const suffix = String(index).padStart(3, "0");
    return `<item><title>Stock market earnings prefetch item ${suffix}</title><link>https://example.com/prefetch-${suffix}</link><description>Listed company stock earnings update ${suffix}</description><pubDate>${new Date(prefetchNow.getTime() - index * 60_000).toUTCString()}</pubDate></item>`;
  }).join("")}</channel></rss>`;
  let prefetchAnalysisRows = 0;
  const prefetchFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("api.deepseek.com")) {
      const request = JSON.parse(String(init?.body));
      const content = String(request.messages[1].content);
      const start = content.indexOf("[{");
      const end = content.indexOf("]\n输出");
      const rows = JSON.parse(content.slice(start, end + 1));
      prefetchAnalysisRows += rows.length;
      return Response.json({ choices: [{ message: { content: JSON.stringify({ advice: "预分析完成。", stories: rows.map((row: { id: string }, index: number) => ({ id: row.id, titleZh: `预分析${index}`, summary: `预分析摘要${index}`, topic: ["科技"], region: [], assets: ["美股"], direction: "neutral", horizon: "1-3d" })) }) } }] });
    }
    if (url.includes("aihot.virxact.com/api/v1/items")) return Response.json({ schemaVersion: 1, items: [] });
    if (url.includes("bloomberg.com/feeds/markets")) return new Response(prefetchRss, { status: 200 });
    if (url.includes("bloomberg.com/feeds/") || url.includes("news.google.com") || url.includes("cnbc.com") || url.includes("feeds.a.dj.com") || url.includes("federalreserve.gov") || url.includes("sec.gov") || url.includes("feeds.bbci.co.uk")) return new Response("<rss><channel></channel></rss>", { status: 200 });
    if (url.includes("gdeltproject")) return Response.json({ articles: [] });
    if (url.includes("reliefweb")) return Response.json({ data: [] });
    if (url.includes("cls.cn")) return Response.json({ data: { roll_data: [] } });
    if (url.includes("sina.com.cn")) return Response.json({ result: { data: [] } });
    if (url.includes("eastmoney.com")) return new Response("var ajaxResult={\"LivesList\":[]};", { status: 200 });
    return new Response(null, { status: 404 });
  };
  const prefetchedPage = await getStorySnapshot({ page: 1, pageSize: 20, apiKey: "prefetch-key", fetchImpl: prefetchFetch });
  assert.equal(prefetchedPage.stories.length, 20);
  assert.equal(prefetchedPage.pagination.pageSize, 20);
  assert.equal(prefetchAnalysisRows, 50, "first page should warm enrichment for the first 50 stories");

  const originalFetch = globalThis.fetch;
  const now = new Date();
  const rss = `<rss><channel><item><title>Market event alpha</title><link>https://example.com/a</link><description>A</description><pubDate>${now.toUTCString()}</pubDate></item><item><title>Market event beta</title><link>https://example.com/b</link><description>B</description><pubDate>${new Date(now.getTime() - 60_000).toUTCString()}</pubDate></item></channel></rss>`;
  const bloombergRss = `<rss><channel><item><title>Global chip stocks slide before earnings</title><link>https://www.bloomberg.com/news/articles/test</link><description>Investors cut technology stock exposure.</description><pubDate>${now.toUTCString()}</pubDate></item></channel></rss>`;
  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url.includes("bloomberg.com/feeds/markets")) return new Response(bloombergRss, { status: 200 });
    if (url.includes("feeds.bbci.co.uk")) return new Response(rss, { status: 200 });
    if (url.includes("news.google.com")) return new Response("<rss><channel></channel></rss>", { status: 200 });
    if (url.includes("gdeltproject")) return Response.json({ articles: [] });
    if (url.includes("reliefweb")) return Response.json({ data: [] });
    if (url.includes("cls.cn")) return Response.json({ data: { roll_data: [] } });
    if (url.includes("sina.com.cn")) return Response.json({ result: { data: [] } });
    if (url.includes("eastmoney.com")) return new Response("var ajaxResult={\"LivesList\":[]};", { status: 200 });
    return new Response(null, { status: 404 });
  }) as typeof fetch;
  try {
    const firstLimit = await getStorySnapshot({ limit: 1 });
    const laterLargerLimit = await getStorySnapshot({ limit: 20 });
    assert.equal(firstLimit.stories.length, 1);
    assert.equal(laterLargerLimit.stories.length, 3);
    assert.equal(laterLargerLimit.sources.find((item) => item.name === "Bloomberg Markets")?.ok, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
  const serviceSource = readFileSync(resolve("lib/osint/story-service.ts"), "utf8");
  const routeSource = readFileSync(resolve("app/api/osint/v1/stories/route.ts"), "utf8");
  const querySource = readFileSync(resolve("lib/osint/story-query.ts"), "utf8");
  assert.equal(serviceSource.includes("AbortSignal.timeout(10_000)"), true);
  assert.equal(serviceSource.includes("https://www.bloomberg.com/feeds/markets/news.rss"), true);
  for (const sourceName of ["AIHOT v1", "Bloomberg", "Reuters", "Wind公开资讯", "CNBC Markets", "WSJ Markets", "新浪财经", "东方财富"]) {
    assert.equal(serviceSource.includes(sourceName), true);
  }
  assert.equal(routeSource.includes("parseStoryRequest"), true);
  assert.equal(querySource.includes('searchParams.get("page")'), true);
  assert.equal(querySource.includes('searchParams.get("pageSize")'), true);
  assert.equal(querySource.includes('searchParams.get("topic")'), true);
  console.log("STORY_CONTRACT_OK");
}

void verifyStories();
