import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { fetchAihotItemsV1, mapAihotV1Item, type AihotV1Item } from "../../lib/osint/aihot-v1";

const item: AihotV1Item = {
  id: "aihot-1",
  title: "NVIDIA 发布新一代 AI 芯片",
  originalTitle: "NVIDIA launches a new AI chip",
  summary: "新芯片提升推理效率，并影响上市公司资本开支预期。",
  source: { name: "NVIDIA Blog" },
  links: {
    original: "https://example.com/nvidia-original",
    aihot: "https://aihot.virxact.com/items/aihot-1",
  },
  publishedAt: "2026-08-25T03:00:00.000Z",
  discoveredAt: "2026-08-25T03:05:00.000Z",
  category: "ai-products",
  score: 72,
  selected: true,
};

const mapped = mapAihotV1Item(item);
assert.equal(mapped.sourceUrl, item.links.original);
assert.equal(mapped.additionalSources[0].url, item.links.aihot);
assert.equal(mapped.additionalSources[0].name, "AIHOT");
assert.equal(mapped.originalTitle, item.originalTitle);
assert.equal(mapped.sourceName, item.source.name);
assert.equal(mapped.preAnalyzed, true);
assert.deepEqual(mapped.topicHints, ["科技"]);
assert.equal(mapped.importanceHint, 7.2);

async function verifyAihotV1() {
  let requestedUrl = "";
  let requestedHeaders: HeadersInit | undefined;
  const recent = await fetchAihotItemsV1({
    now: new Date("2026-08-25T12:00:00.000Z"),
    fetchImpl: async (input, init) => {
      requestedUrl = String(input);
      requestedHeaders = init?.headers;
      return Response.json({
        schemaVersion: 1,
        query: { mode: "selected", category: null, window: "7d", q: null, by: "published", ordering: "publishedAtDesc" },
        items: [
          item,
          { ...item, id: "tip-1", category: "tip" },
          { ...item, id: "old-1", publishedAt: "2026-08-20T03:00:00.000Z" },
          { ...item, id: "unselected-1", selected: false },
        ],
        page: { count: 4, hasMore: false, nextCursor: null },
      });
    },
  });

  const url = new URL(requestedUrl);
  assert.equal(url.pathname, "/api/v1/items");
  assert.equal(url.searchParams.get("mode"), "selected");
  assert.equal(url.searchParams.get("window"), "7d");
  assert.equal(url.searchParams.get("by"), "published");
  assert.equal(url.searchParams.get("limit"), "100");
  assert.equal(url.searchParams.has("cursor"), false);
  assert.equal(new Headers(requestedHeaders).has("If-None-Match"), false);
  assert.deepEqual(recent.map((story) => story.sourceId), ["aihot-aihot-1"]);

  const source = readFileSync(resolve("lib/osint/aihot-v1.ts"), "utf8");
  assert.equal(source.includes("/api/public/"), false);
  assert.equal(source.includes("/api/v1/items"), true);
  console.log("AIHOT_V1_OK");
}

void verifyAihotV1();
