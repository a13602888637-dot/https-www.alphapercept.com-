import type { LhbSnapshot } from "../../lhb/contracts";
import type { MarketSnapshot, StorySnapshot } from "../contracts";

export type DailyReportPeriod = "daily";
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
  periodKey: string;
  title: string;
  generatedAt: string;
  asOf: string;
  markets: MarketSnapshot;
  stories: StorySnapshot;
  lhb: LhbSnapshot;
  sourceHealth: DailyReportSourceHealth;
}

export interface OsintDailyReportRecord {
  id: string;
  periodType: DailyReportPeriod;
  periodKey: string;
  asOf: string;
  createdAt: string;
  updatedAt: string;
  snapshot: OsintDailyReportSnapshot;
}

export interface OsintDailyReportSummary {
  id: string;
  periodType: DailyReportPeriod;
  periodKey: string;
  title: string;
  asOf: string;
  updatedAt: string;
  marketAvailable: number;
  marketTotal: number;
  storyCount: number;
  lhbStockCount: number;
  status: "healthy" | "degraded" | "unavailable";
}
