import assert from "node:assert/strict";

import { buildStorySnapshot, type RawStory } from "../../lib/osint/story-service";

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
];

async function verifyStories() {
  const snapshot = await buildStorySnapshot(rawStories, {
    apiKey: null,
    now: new Date("2026-08-24T11:00:00.000Z"),
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
  console.log("STORY_CONTRACT_OK");
}

void verifyStories();
