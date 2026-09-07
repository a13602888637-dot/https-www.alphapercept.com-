import assert from "node:assert/strict";

import type { OsintDailyReportRecord } from "../../lib/osint/daily-report/contracts.ts";
import {
  classifyDailyReportGenerationError,
  ensureDailyReportGenerated,
  isReusableDailyReport,
} from "../../lib/osint/daily-report/generation.ts";

function report(id: string, options: {
  healthy?: boolean;
  edition?: "close" | "global";
  tradeDate?: string;
} = {}): OsintDailyReportRecord {
  const healthy = options.healthy ?? true;
  const edition = options.edition ?? "close";
  return {
    id,
    periodType: "daily",
    reportDate: "2026-09-04",
    edition,
    version: 1,
    archiveStatus: "final",
    asOf: "2026-09-04T09:00:00.000Z",
    generatedAt: "2026-09-04T09:00:00.000Z",
    finalizedAt: "2026-09-04T09:00:00.000Z",
    createdAt: "2026-09-04T09:00:01.000Z",
    updatedAt: "2026-09-04T09:00:01.000Z",
    snapshot: {
      reportDate: "2026-09-04",
      edition,
      markets: {
        coverage: { available: healthy ? 32 : 0, total: 33, ratio: healthy ? 0.97 : 0, stale: 0 },
      },
      stories: { stories: healthy ? [{}] : [] },
      lhb: {
        status: "live",
        tradeDate: options.tradeDate ?? "2026-09-04",
      },
    } as OsintDailyReportRecord["snapshot"],
  };
}

async function main() {
  const existing = report("existing");
  let generateCalls = 0;
  const isReusable = (candidate: OsintDailyReportRecord) =>
    isReusableDailyReport(candidate, true);

  const reused = await ensureDailyReportGenerated(
    { reportDate: "2026-09-04", edition: "close" },
    {
      findExisting: async () => existing,
      isReusable,
      generate: async () => {
        generateCalls += 1;
        return report("generated");
      },
    }
  );

  assert.equal(reused.created, false);
  assert.equal(reused.report.id, "existing");
  assert.equal(generateCalls, 0, "scheduled retries must not create another version");

  const created = await ensureDailyReportGenerated(
    { reportDate: "2026-09-04", edition: "close" },
    {
      findExisting: async () => null,
      isReusable,
      generate: async () => {
        generateCalls += 1;
        return report("generated");
      },
    }
  );

  assert.equal(created.created, true);
  assert.equal(created.report.id, "generated");
  assert.equal(generateCalls, 1);

  const regenerated = await ensureDailyReportGenerated(
    { reportDate: "2026-09-04", edition: "close" },
    {
      findExisting: async () => report("degraded", { healthy: false }),
      isReusable,
      generate: async () => {
        generateCalls += 1;
        return report("regenerated");
      },
    }
  );

  assert.equal(regenerated.created, true);
  assert.equal(regenerated.report.id, "regenerated");
  assert.equal(generateCalls, 2);

  let persisted: OsintDailyReportRecord | null = null;
  let concurrentGenerateCalls = 0;
  const concurrentDependencies = {
    findExisting: async () => persisted,
    isReusable,
    generate: async () => {
      concurrentGenerateCalls += 1;
      await Promise.resolve();
      if (!persisted) {
        persisted = report("winner");
        return persisted;
      }
      throw new Error("P2002 unique constraint");
    },
  };
  const concurrent = await Promise.all([
    ensureDailyReportGenerated(
      { reportDate: "2026-09-04", edition: "close" },
      concurrentDependencies
    ),
    ensureDailyReportGenerated(
      { reportDate: "2026-09-04", edition: "close" },
      concurrentDependencies
    ),
  ]);

  assert.equal(concurrentGenerateCalls, 2);
  assert.deepEqual(concurrent.map((result) => result.report.id), ["winner", "winner"]);
  assert.deepEqual(concurrent.map((result) => result.created).sort(), [false, true]);

  assert.equal(isReusableDailyReport(existing, false), false, "export readiness is required");
  assert.equal(
    isReusableDailyReport(
      report("global", { edition: "global", tradeDate: "2026-09-03" }),
      true
    ),
    true,
    "morning reports may legitimately contain the previous trading day's LHB snapshot"
  );
  assert.equal(
    classifyDailyReportGenerationError(new Error("INCOMPLETE_CLOSE_DATA:degraded:details")),
    "CLOSE_DATA_NOT_READY"
  );
  assert.equal(
    classifyDailyReportGenerationError(new Error("STALE_CLOSE_DATA:2026-09-03:details")),
    "CLOSE_DATA_NOT_READY"
  );
  assert.equal(classifyDailyReportGenerationError(new Error("DATABASE_URL leaked")), "GENERATION_FAILED");

  console.log("DAILY_REPORT_GENERATION_IDEMPOTENCY_OK");
}

void main().catch((error) => {
  throw error;
});
