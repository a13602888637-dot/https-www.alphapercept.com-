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
  await prisma.$transaction(complete.map((story) => prisma.$executeRaw`
    INSERT INTO "OsintStoryCache" ("id", "publishedAt", "payload", "createdAt", "updatedAt")
    VALUES (${story.id}, ${new Date(story.publishedAt)}, ${JSON.stringify(story)}::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO UPDATE SET
      "publishedAt" = EXCLUDED."publishedAt",
      "payload" = EXCLUDED."payload",
      "updatedAt" = CURRENT_TIMESTAMP
  `));
}
