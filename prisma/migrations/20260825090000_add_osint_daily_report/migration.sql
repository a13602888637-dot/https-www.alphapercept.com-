-- CreateTable
CREATE TABLE "OsintDailyReport" (
    "id" TEXT NOT NULL,
    "reportDate" TEXT NOT NULL,
    "edition" TEXT NOT NULL DEFAULT 'close',
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "payload" JSONB NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OsintDailyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OsintDailyReport_reportDate_edition_version_key"
ON "OsintDailyReport"("reportDate", "edition", "version");

-- CreateIndex
CREATE INDEX "OsintDailyReport_reportDate_edition_status_idx"
ON "OsintDailyReport"("reportDate", "edition", "status");
