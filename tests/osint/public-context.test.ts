import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { composePublicContext } from "../../lib/osint/context";
import type { MarketSnapshot, StorySnapshot } from "../../lib/osint/contracts";

const marketSnapshot: MarketSnapshot = {
  schemaVersion: "1.0",
  generatedAt: "2026-08-24T11:00:00.000Z",
  coverage: { available: 1, total: 1, ratio: 1, stale: 0 },
  markets: [],
};

const storySnapshot: StorySnapshot = {
  schemaVersion: "1.0",
  generatedAt: "2026-08-24T11:00:00.000Z",
  stories: [],
  advice: { text: "暂无明确跨市场共振信号。", confidence: "low", generatedAt: null },
  sources: [],
};

const context = composePublicContext(marketSnapshot, storySnapshot);
const serialized = JSON.stringify(context).toLowerCase();

for (const forbidden of ["userid", "clerk", "watchlist", "portfolio", "personalnote"]) {
  assert.equal(serialized.includes(forbidden), false);
}
assert.equal(context.schemaVersion, "1.0");
assert.ok(Array.isArray(context.markets));
assert.ok(Array.isArray(context.stories));
assert.equal(typeof context.advice.text, "string");
assert.ok(Array.isArray(context.sourceHealth.markets));
assert.ok(Array.isArray(context.sourceHealth.stories));

const storiesRoute = readFileSync(resolve("app/api/osint/v1/stories/route.ts"), "utf8");
const contextRoute = readFileSync(resolve("app/api/osint/v1/context/route.ts"), "utf8");
assert.equal(storiesRoute.includes("getStorySnapshot"), true);
assert.equal(contextRoute.includes("composePublicContext"), true);
assert.equal(/watchlist|portfolio|clerk/i.test(contextRoute), false);
console.log("PUBLIC_CONTEXT_OK");
