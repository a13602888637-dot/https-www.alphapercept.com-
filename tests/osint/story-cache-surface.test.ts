import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

function read(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

const schema = read("prisma/schema.prisma");
assert.match(schema, /model OsintStoryCache\s*\{/);
assert.match(schema, /id\s+String\s+@id/);
assert.match(schema, /payload\s+Json/);
assert.match(schema, /@@index\(\[publishedAt\]\)/);

const migrations = readdirSync(resolve("prisma/migrations"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => resolve("prisma/migrations", entry.name, "migration.sql"))
  .filter(existsSync)
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");
assert.match(migrations, /CREATE TABLE IF NOT EXISTS "OsintStoryCache"/);
assert.match(migrations, /CREATE INDEX IF NOT EXISTS "OsintStoryCache_publishedAt_idx"/);

const repository = read("lib/osint/story-cache.ts");
assert.equal(repository.includes("getCachedStories"), true);
assert.equal(repository.includes("saveCachedStories"), true);
assert.equal(repository.includes("ON CONFLICT"), true);

const service = read("lib/osint/story-service.ts");
assert.equal(service.includes("cachedStories"), true);
assert.equal(service.includes("getCachedStories"), true);
assert.equal(service.includes("saveCachedStories"), true);

console.log("STORY_CACHE_SURFACE_OK");
