import manifestJson from "@/public/uzi-assets/manifest.json";

export interface UziSchoolScore {
  id: string;
  label: string;
  consensus: number | null;
  verdict: string;
  bullish: number;
  neutral: number;
  bearish: number;
  skip: number;
}

export interface UziReport {
  id: string;
  ticker: string;
  stockCode: string;
  market: string;
  name: string;
  reportDate: string;
  reportGeneratedAt: string | null;
  price: number | null;
  priceAsOf: string | null;
  priceSource: string;
  overallScore: number | null;
  verdict: string;
  verdictDetail: string;
  conclusion: string;
  fundamentalScore: number | null;
  panelConsensus: number | null;
  agentReviewed: boolean;
  reviewStatus: "agent-reviewed" | "mechanical";
  quality: {
    status: "pass" | "warning" | "fail" | "unknown";
    selfReview: {
      passed: boolean;
      criticalCount: number;
      warningCount: number;
      infoCount: number;
      checksRun: number;
    } | null;
    dimensions: {
      total: number;
      full: number;
      partial: number;
      missingMarker: number;
      dataGapCount: number;
    };
    consistencyWarnings: string[];
  };
  trend: string;
  battlePlan: {
    entry: string;
    stop: string;
    target: string;
    position: string;
  };
  signals: {
    bullish: number;
    neutral: number;
    bearish: number;
    skip: number;
  };
  votes: {
    stronglyBuy: number;
    buy: number;
    watch: number;
    wait: number;
    avoid: number;
    skip: number;
  };
  schools: UziSchoolScore[];
  panelSize: number;
  reportPath: string;
  sourceSha256: string;
  deployedSha256: string;
  fileSize: number;
  validation: {
    seats: number;
    chatMessages: number;
    sections: {
      jury: boolean;
      chat: boolean;
      schoolScores: boolean;
    };
    sourceFileSize: number;
    sandboxStorageShim: boolean;
  };
}

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

export function getUziReportViewerPath(
  report: UziReport,
  section?: "jury" | "chat"
): string {
  const basePath = `/uzi-reports/${encodeURIComponent(report.id)}`;
  return section ? `${basePath}?section=${section}` : basePath;
}
