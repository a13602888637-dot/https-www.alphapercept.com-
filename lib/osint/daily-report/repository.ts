import { prisma } from "../../db";
import type {
  OsintDailyReportRecord,
  OsintDailyReportSnapshot,
  OsintDailyReportSummary,
} from "./contracts";

interface DatabaseReportRow {
  id: string;
  periodType: string;
  periodKey: string;
  snapshot: unknown;
  asOf: Date;
  createdAt: Date;
  updatedAt: Date;
}

function toRecord(row: DatabaseReportRow): OsintDailyReportRecord {
  return {
    id: row.id,
    periodType: "daily",
    periodKey: row.periodKey,
    asOf: row.asOf.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    snapshot: row.snapshot as OsintDailyReportSnapshot,
  };
}

function statusFor(snapshot: OsintDailyReportSnapshot): OsintDailyReportSummary["status"] {
  if (
    snapshot.markets.coverage.available === 0 &&
    snapshot.stories.stories.length === 0 &&
    snapshot.lhb.status === "unavailable"
  ) {
    return "unavailable";
  }
  if (
    snapshot.markets.coverage.ratio < 0.7 ||
    snapshot.stories.stories.length === 0 ||
    snapshot.lhb.status !== "live"
  ) {
    return "degraded";
  }
  return "healthy";
}

export function summarizeDailyReport(
  report: OsintDailyReportRecord
): OsintDailyReportSummary {
  const snapshot = report.snapshot;
  return {
    id: report.id,
    periodType: "daily",
    periodKey: report.periodKey,
    title: snapshot.title,
    asOf: report.asOf,
    updatedAt: report.updatedAt,
    marketAvailable: snapshot.markets.coverage.available,
    marketTotal: snapshot.markets.coverage.total,
    storyCount: snapshot.stories.stories.length,
    lhbStockCount: snapshot.lhb.stockCount,
    status: statusFor(snapshot),
  };
}

export async function saveDailyReport(
  snapshot: OsintDailyReportSnapshot
): Promise<OsintDailyReportRecord> {
  const row = await prisma.osintDailyReport.upsert({
    where: {
      periodType_periodKey: {
        periodType: snapshot.periodType,
        periodKey: snapshot.periodKey,
      },
    },
    create: {
      periodType: snapshot.periodType,
      periodKey: snapshot.periodKey,
      snapshot: JSON.parse(JSON.stringify(snapshot)),
      asOf: new Date(snapshot.asOf),
    },
    update: {
      snapshot: JSON.parse(JSON.stringify(snapshot)),
      asOf: new Date(snapshot.asOf),
    },
  });
  return toRecord(row);
}

export async function listDailyReports(limit = 31): Promise<OsintDailyReportSummary[]> {
  const rows = await prisma.osintDailyReport.findMany({
    where: { periodType: "daily" },
    orderBy: [{ periodKey: "desc" }, { updatedAt: "desc" }],
    take: Math.min(100, Math.max(1, limit)),
  });
  return rows.map((row) => summarizeDailyReport(toRecord(row)));
}

export async function getDailyReport(
  id: string
): Promise<OsintDailyReportRecord | null> {
  const row = await prisma.osintDailyReport.findUnique({ where: { id } });
  return row ? toRecord(row) : null;
}
