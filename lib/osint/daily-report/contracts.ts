import type { LhbSnapshot } from "../../lhb/contracts";
import type { MarketSnapshot, StorySnapshot } from "../contracts";

export type DailyReportPeriod = "daily";
export type DailyReportEdition = "close" | "global";
export type DailyReportArchiveStatus = "draft" | "final";
export type DailyReportExportSection =
  | "full"
  | "markets"
  | "stories"
  | "lhb";

export interface DailyReportSourceHealth {
  markets: MarketSnapshot["coverage"];
  stories: StorySnapshot["sources"];
  lhb: {
    status: LhbSnapshot["status"];
    source: LhbSnapshot["source"];
    checks: LhbSnapshot["sourceHealth"];
    errors: string[];
  };
}

export interface OsintDailyReportSnapshot {
  schemaVersion: "1.0";
  periodType: DailyReportPeriod;
  reportDate: string;
  edition: DailyReportEdition;
  version: number;
  status: DailyReportArchiveStatus;
  title: string;
  generatedAt: string;
  finalizedAt: string | null;
  asOf: string;
  markets: MarketSnapshot;
  stories: StorySnapshot;
  lhb: LhbSnapshot;
  sourceHealth: DailyReportSourceHealth;
}

export interface OsintDailyReportRecord {
  id: string;
  periodType: DailyReportPeriod;
  reportDate: string;
  edition: DailyReportEdition;
  version: number;
  archiveStatus: DailyReportArchiveStatus;
  asOf: string;
  generatedAt: string;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  snapshot: OsintDailyReportSnapshot;
}

export interface OsintDailyReportSummary {
  id: string;
  periodType: DailyReportPeriod;
  reportDate: string;
  edition: DailyReportEdition;
  version: number;
  archiveStatus: DailyReportArchiveStatus;
  title: string;
  asOf: string;
  updatedAt: string;
  marketAvailable: number;
  marketTotal: number;
  storyCount: number;
  lhbStockCount: number;
  status: "healthy" | "degraded" | "unavailable";
}
