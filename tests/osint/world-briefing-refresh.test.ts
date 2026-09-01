import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const storiesRoute = readFileSync(resolve("app/api/osint/v1/stories/route.ts"), "utf8");
const storyService = readFileSync(resolve("lib/osint/story-service.ts"), "utf8");
const worldBriefing = readFileSync(resolve("components/osint-v2/WorldBriefing.tsx"), "utf8");

assert.equal(storiesRoute.includes('searchParams.get("refresh") === "1"'), true);
assert.equal(storiesRoute.includes("forceRefresh"), true);
assert.equal(storyService.includes("!options.forceRefresh && cachedPage"), true);
assert.equal(storyService.includes("!options.forceRefresh && sourceCache"), true);
assert.equal(worldBriefing.includes("requestIdRef"), true);
assert.equal(worldBriefing.includes("manualRefreshAbortRef"), true);
assert.equal(worldBriefing.includes("refresh=1"), true);
assert.equal(worldBriefing.includes('cache: forceRefresh ? "no-store"'), true);
assert.equal(worldBriefing.includes("disabled={loading}"), true);
assert.equal(worldBriefing.includes("loadStories(controller.signal, true)"), true);
assert.equal(worldBriefing.includes("setInterval(() => void loadStories(), 300_000)"), false);
assert.equal(storiesRoute.includes('"private, no-store"'), true);
assert.equal(storiesRoute.includes('"private, max-age=0, must-revalidate"'), true);
assert.equal(storyService.includes("createRefreshCoordinator"), true);

console.log("WORLD_BRIEFING_REFRESH_OK");
