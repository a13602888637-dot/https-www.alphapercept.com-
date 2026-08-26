CREATE TABLE IF NOT EXISTS "OsintStoryCache" (
  "id" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OsintStoryCache_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OsintStoryCache_publishedAt_idx"
  ON "OsintStoryCache"("publishedAt");
