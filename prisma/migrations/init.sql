-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stockCode" TEXT NOT NULL,
    "stockName" TEXT NOT NULL,
    "buyPrice" DECIMAL(65,30),
    "stopLossPrice" DECIMAL(65,30),
    "targetPrice" DECIMAL(65,30),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceFeed" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "stockCode" TEXT NOT NULL,
    "stockName" TEXT NOT NULL,
    "eventSummary" TEXT NOT NULL,
    "industryTrend" TEXT NOT NULL,
    "trapProbability" INTEGER NOT NULL DEFAULT 0,
    "actionSignal" TEXT NOT NULL DEFAULT 'HOLD',
    "targetPrice" DECIMAL(65,30),
    "stopLoss" DECIMAL(65,30),
    "logicChain" JSONB,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntelligenceFeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

-- CreateIndex
CREATE INDEX "User_clerkUserId_idx" ON "User"("clerkUserId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Watchlist_userId_idx" ON "Watchlist"("userId");

-- CreateIndex
CREATE INDEX "Watchlist_stockCode_idx" ON "Watchlist"("stockCode");

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_userId_stockCode_key" ON "Watchlist"("userId", "stockCode");

-- CreateIndex
CREATE INDEX "IntelligenceFeed_userId_idx" ON "IntelligenceFeed"("userId");

-- CreateIndex
CREATE INDEX "IntelligenceFeed_stockCode_idx" ON "IntelligenceFeed"("stockCode");

-- CreateIndex
CREATE INDEX "IntelligenceFeed_actionSignal_idx" ON "IntelligenceFeed"("actionSignal");

-- CreateIndex
CREATE INDEX "IntelligenceFeed_createdAt_idx" ON "IntelligenceFeed"("createdAt");

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceFeed" ADD CONSTRAINT "IntelligenceFeed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

