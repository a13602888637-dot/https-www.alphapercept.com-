CREATE TABLE IF NOT EXISTS "UziResearchJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stockCode" TEXT NOT NULL,
    "stockName" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "stage" TEXT NOT NULL DEFAULT 'QUEUED',
    "stageMessage" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 2,
    "workerId" TEXT,
    "claimToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "inputContext" JSONB,
    "privateBrief" JSONB,
    "publicReportId" TEXT,
    "publicReportPath" TEXT,
    "publicManifest" JSONB,
    "commitSha" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UziResearchJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UziResearchWorker" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "version" TEXT,
    "currentJobId" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UziResearchWorker_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PortfolioRadarEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stockCode" TEXT NOT NULL,
    "stockName" TEXT NOT NULL,
    "triggerKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "firstTriggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PortfolioRadarEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UziResearchJob_idempotencyKey_key" ON "UziResearchJob"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "UziResearchJob_userId_createdAt_idx" ON "UziResearchJob"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "UziResearchJob_status_createdAt_idx" ON "UziResearchJob"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "UziResearchJob_stockCode_createdAt_idx" ON "UziResearchJob"("stockCode", "createdAt");
CREATE INDEX IF NOT EXISTS "UziResearchWorker_lastSeenAt_idx" ON "UziResearchWorker"("lastSeenAt");
CREATE UNIQUE INDEX IF NOT EXISTS "PortfolioRadarEvent_userId_triggerKey_key" ON "PortfolioRadarEvent"("userId", "triggerKey");
CREATE INDEX IF NOT EXISTS "PortfolioRadarEvent_userId_status_lastSeenAt_idx" ON "PortfolioRadarEvent"("userId", "status", "lastSeenAt");
CREATE INDEX IF NOT EXISTS "PortfolioRadarEvent_stockCode_status_idx" ON "PortfolioRadarEvent"("stockCode", "status");

DO $$ BEGIN
  ALTER TABLE "UziResearchJob" ADD CONSTRAINT "UziResearchJob_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PortfolioRadarEvent" ADD CONSTRAINT "PortfolioRadarEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
