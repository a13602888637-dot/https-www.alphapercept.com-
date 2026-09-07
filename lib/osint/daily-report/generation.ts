import type { DailyReportEdition, OsintDailyReportRecord } from "./contracts";

export interface DailyReportGenerationOptions {
  reportDate: string;
  edition: DailyReportEdition;
}

interface DailyReportGenerationDependencies {
  findExisting: (input: {
    reportDate: string;
    edition: DailyReportEdition;
  }) => Promise<OsintDailyReportRecord | null>;
  isReusable: (report: OsintDailyReportRecord) => boolean;
  generate: () => Promise<OsintDailyReportRecord>;
}

export type DailyReportGenerationErrorCode =
  | "CLOSE_DATA_NOT_READY"
  | "GENERATION_FAILED";

export function classifyDailyReportGenerationError(
  error: unknown
): DailyReportGenerationErrorCode {
  const message = error instanceof Error ? error.message : "";
  return message.startsWith("INCOMPLETE_CLOSE_DATA:") ||
    message.startsWith("STALE_CLOSE_DATA:")
    ? "CLOSE_DATA_NOT_READY"
    : "GENERATION_FAILED";
}

export function isReusableDailyReport(
  report: OsintDailyReportRecord,
  exportReady: boolean
): boolean {
  const snapshot = report.snapshot;
  return Boolean(
    exportReady &&
      report.archiveStatus === "final" &&
      snapshot.reportDate === report.reportDate &&
      snapshot.edition === report.edition &&
      snapshot.markets.coverage.available > 0 &&
      snapshot.markets.coverage.ratio >= 0.7 &&
      snapshot.stories.stories.length > 0 &&
      snapshot.lhb.status === "live" &&
      (snapshot.edition === "global" || snapshot.lhb.tradeDate === report.reportDate)
  );
}

export async function ensureDailyReportGenerated(
  options: DailyReportGenerationOptions,
  dependencies: DailyReportGenerationDependencies
): Promise<{ report: OsintDailyReportRecord; created: boolean }> {
  const lookup = () => dependencies.findExisting({
    reportDate: options.reportDate,
    edition: options.edition,
  });
  const existing = await lookup();
  if (existing && dependencies.isReusable(existing)) {
    return { report: existing, created: false };
  }

  try {
    return {
      report: await dependencies.generate(),
      created: true,
    };
  } catch (error) {
    const concurrentWinner = await lookup();
    if (concurrentWinner && dependencies.isReusable(concurrentWinner)) {
      return { report: concurrentWinner, created: false };
    }
    throw error;
  }
}
