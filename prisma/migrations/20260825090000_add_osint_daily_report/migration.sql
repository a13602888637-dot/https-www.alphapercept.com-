-- CreateTable
CREATE TABLE "OsintDailyReport" (
    "id" TEXT NOT NULL,
    "periodType" TEXT NOT NULL DEFAULT 'daily',
    "periodKey" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OsintDailyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OsintDailyReport_periodType_periodKey_key"
ON "OsintDailyReport"("periodType", "periodKey");

-- CreateIndex
CREATE INDEX "OsintDailyReport_periodType_asOf_idx"
ON "OsintDailyReport"("periodType", "asOf");
