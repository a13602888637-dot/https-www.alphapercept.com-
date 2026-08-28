import "server-only";
import manifestJson from "@/public/uzi-assets/manifest.json";
import type { UziReport } from "@/lib/uzi/report-types";

export type { UziReport, UziSchoolScore } from "@/lib/uzi/report-types";
export { getUziReportViewerPath } from "@/lib/uzi/report-types";

interface UziReportManifest {
  schemaVersion: "uzi-report-manifest/v1";
  syncedAt: string;
  reportCount: number;
  reports: UziReport[];
}

export const uziReportManifest = manifestJson as UziReportManifest;
export const uziReports = uziReportManifest.reports;

export function normalizeStockCode(symbol: string): string {
  return decodeURIComponent(symbol)
    .trim()
    .toUpperCase()
    .replace(/^(SH|SZ|BJ)(?=\d)/, "")
    .split(".")[0];
}

export function findLatestUziReport(symbol: string): UziReport | null {
  const stockCode = normalizeStockCode(symbol);
  return (
    uziReports.find(
      (report) =>
        report.stockCode === stockCode || report.ticker === symbol.toUpperCase()
    ) ?? null
  );
}

export function getUziReportById(reportId: string): UziReport | null {
  return uziReports.find((report) => report.id === reportId) ?? null;
}
