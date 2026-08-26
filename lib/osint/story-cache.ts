import { prisma } from "../db";
import type { OsintStory } from "./contracts";

function parsedStory(value: unknown): OsintStory | null {
  if (!value || typeof value !== "object") return null;
  const story = value as Partial<OsintStory>;
  if (
    typeof story.id !== "string" ||
    typeof story.title !== "string" ||
    typeof story.publishedAt !== "string" ||
    story.analysisStatus !== "complete" ||
    !story.tags ||
    !Array.isArray(story.sources)
  ) {
    return null;
  }
  return story as OsintStory;
}

export async function getCachedStories(since: Date): Promise<Map<string, OsintStory>> {
  const rows = await prisma.$queryRaw<Array<{ payload: unknown }>>`
    SELECT "payload"
    FROM "OsintStoryCache"
    WHERE "publishedAt" >= ${since}
    ORDER BY "publishedAt" DESC
    LIMIT 1000
  `;
  const stories = new Map<string, OsintStory>();
  for (const row of rows) {
    const story = parsedStory(row.payload);
    if (story) stories.set(story.id, story);
  }
  return stories;
}

export async function saveCachedStories(stories: OsintStory[]): Promise<void> {
  const complete = [...new Map(stories
    .filter((story) => story.analysisStatus === "complete")
    .map((story) => [story.id, story])).values()];
  if (complete.length === 0) return;
  const rows = complete.map((story) => ({
    id: story.id,
    publishedAt: story.publishedAt,
    payload: story,
  }));
  await prisma.$executeRaw`
    INSERT INTO "OsintStoryCache" ("id", "publishedAt", "payload", "createdAt", "updatedAt")
    SELECT
      item->>'id',
      ((item->>'publishedAt')::timestamptz AT TIME ZONE 'UTC'),
      item->'payload',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM jsonb_array_elements(${JSON.stringify(rows)}::jsonb) AS item
    ON CONFLICT ("id") DO UPDATE SET
      "publishedAt" = EXCLUDED."publishedAt",
      "payload" = EXCLUDED."payload",
      "updatedAt" = CURRENT_TIMESTAMP
  `;
}
