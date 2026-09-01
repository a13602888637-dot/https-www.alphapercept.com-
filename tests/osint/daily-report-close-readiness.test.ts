import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const readinessPath = resolve("lib/osint/daily-report/close-readiness.ts");
  assert.equal(existsSync(readinessPath), true, "close report readiness gate must exist");

  const { assertCloseReportReady } = await import("../../lib/osint/daily-report/close-readiness.ts");

  const readyCloseReport = {
    edition: "close" as const,
    reportDate: "2026-09-01",
    lhb: {
      status: "live" as const,
      tradeDate: "2026-09-01",
    },
  };

  assert.doesNotThrow(() => assertCloseReportReady(readyCloseReport));

  assert.throws(
    () => assertCloseReportReady({
      ...readyCloseReport,
      lhb: { ...readyCloseReport.lhb, tradeDate: "2026-08-31" },
    }),
    /STALE_CLOSE_DATA:2026-08-31:龙虎榜交易日 2026-08-31 与报告日期 2026-09-01 不一致/
  );

  assert.throws(
    () => assertCloseReportReady({
      ...readyCloseReport,
      lhb: { ...readyCloseReport.lhb, status: "degraded" },
    }),
    /INCOMPLETE_CLOSE_DATA:degraded:龙虎榜数据状态 degraded，尚未达到出图条件/
  );

  assert.doesNotThrow(() => assertCloseReportReady({
    ...readyCloseReport,
    edition: "global",
    lhb: { ...readyCloseReport.lhb, tradeDate: "2026-08-31" },
  }));

  console.log("DAILY_REPORT_CLOSE_READINESS_OK");
}

void main().catch((error) => {
  throw error;
});
