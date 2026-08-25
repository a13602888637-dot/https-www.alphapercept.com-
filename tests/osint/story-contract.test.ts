import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildStorySnapshot, getStorySnapshot, isGlobalMarketHeadline, parsePublishedAt, sliceStorySnapshot, type RawStory } from "../../lib/osint/story-service";
import { parseStoryRequest } from "../../app/api/osint/v1/stories/route";

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
  assert.equal(parsePublishedAt("not-a-date"), null);
  assert.equal(parsePublishedAt("20260825T091500Z"), "2026-08-25T09:15:00.000Z");

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
  assert.equal(serviceSource.includes("AbortSignal.timeout(10_000)"), true);
  assert.equal(serviceSource.includes("https://www.bloomberg.com/feeds/markets/news.rss"), true);
  for (const sourceName of ["Bloomberg", "Reuters", "Wind公开资讯", "CNBC Markets", "WSJ Markets", "新浪财经", "东方财富"]) {
    assert.equal(serviceSource.includes(sourceName), true);
  }
  assert.equal(routeSource.includes('searchParams.get("page")'), true);
  assert.equal(routeSource.includes('searchParams.get("pageSize")'), true);
  assert.equal(routeSource.includes('searchParams.get("topic")'), true);
  console.log("STORY_CONTRACT_OK");
}

void verifyStories();
