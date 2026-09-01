import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { deepSeekUsageRecord, logDeepSeekUsage } from "../../lib/ai/deepseek-usage";

const payload = {
  model: "deepseek-v4-flash",
  usage: {
    prompt_tokens: 120,
    prompt_cache_hit_tokens: 80,
    prompt_cache_miss_tokens: 40,
    completion_tokens: 30,
    total_tokens: 150,
  },
  messages: [{ role: "user", content: "sensitive prompt" }],
  Authorization: "Bearer sk-secret-value",
};

const record = deepSeekUsageRecord("osint-story-batch", payload);
assert.deepEqual(record, {
  context: "osint-story-batch",
  model: "deepseek-v4-flash",
  requestCount: 1,
  promptTokens: 120,
  cacheHitTokens: 80,
  cacheMissTokens: 40,
  completionTokens: 30,
  totalTokens: 150,
});

const serialized = JSON.stringify(record);
assert.equal(serialized.includes("sensitive prompt"), false);
assert.equal(serialized.includes("sk-secret-value"), false);
assert.equal(serialized.includes("Authorization"), false);

const captured: unknown[][] = [];
logDeepSeekUsage("osint-story-batch", payload, (...args) => captured.push(args));
assert.equal(captured.length, 1);
assert.equal(captured[0][0], "[deepseek usage]");
assert.deepEqual(captured[0][1], record);
logDeepSeekUsage("missing-usage", {}, (...args) => captured.push(args));
assert.equal(captured.length, 1);

const usageIntegrations: Array<[string, string]> = [
  ["lib/osint/story-service.ts", 'logDeepSeekUsage("osint-story-batch", payload)'],
  ["app/api/ai/situation-analysis/route.ts", 'logDeepSeekUsage("osint-situation", deepseekData)'],
  ["app/api/strategy-recommendation/route.ts", 'logDeepSeekUsage("strategy-recommendation", aiData)'],
  ["app/api/ai/generate-strategy/route.ts", 'logDeepSeekUsage("generate-strategy", data)'],
  ["app/api/intelligence-feed/generate/route.ts", 'logDeepSeekUsage("intelligence-feed", data)'],
  ["skills/deepseek_agent.ts", 'logDeepSeekUsage("deepseek-agent", data)'],
  ["app/api/ai/stream/route.ts", 'logDeepSeekUsage("ai-stream", parsed)'],
];

for (const [file, expected] of usageIntegrations) {
  const source = readFileSync(resolve(file), "utf8");
  assert.equal(source.includes(expected), true, `${file} must log DeepSeek usage`);
}

const streamClient = readFileSync(resolve("lib/ai/deepseek-stream.ts"), "utf8");
assert.equal(streamClient.includes("stream_options: { include_usage: true }"), true);

console.log("DEEPSEEK_USAGE_OK");
