import { prisma } from "../../db";
import type {
  DailyReportArchiveStatus,
  DailyReportEdition,
  OsintDailyReportRecord,
  OsintDailyReportSnapshot,
  OsintDailyReportSummary,
} from "./contracts";
import { rankReportStocks } from "./story-curation";

interface DatabaseReportRow {
  id: string;
  reportDate: string;
  edition: string;
  version: number;
  status: string;
  payload: unknown;
  asOf: Date;
  generatedAt: Date;
  finalizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function editionValue(value: string): DailyReportEdition {
  return value === "global" ? "global" : "close";
}

function archiveStatusValue(value: string): DailyReportArchiveStatus {
  return value === "final" ? "final" : "draft";
}

function toRecord(row: DatabaseReportRow): OsintDailyReportRecord {
  return {
    id: row.id,
    periodType: "daily",
    reportDate: row.reportDate,
    edition: editionValue(row.edition),
    version: row.version,
    archiveStatus: archiveStatusValue(row.status),
    asOf: row.asOf.toISOString(),
    generatedAt: row.generatedAt.toISOString(),
    finalizedAt: row.finalizedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    snapshot: row.payload as OsintDailyReportSnapshot,
  };
}

function healthStatus(snapshot: OsintDailyReportSnapshot): OsintDailyReportSummary["status"] {
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

export function summarizeDailyReport(report: OsintDailyReportRecord): OsintDailyReportSummary {
  const snapshot = report.snapshot;
  return {
    id: report.id,
    periodType: "daily",
    reportDate: report.reportDate,
    edition: report.edition,
    version: report.version,
    archiveStatus: report.archiveStatus,
    title: snapshot.title,
    asOf: report.asOf,
    updatedAt: report.updatedAt,
    marketAvailable: snapshot.markets.coverage.available,
    marketTotal: snapshot.markets.coverage.total,
    storyCount: snapshot.stories.stories.length,
    lhbStockCount: rankReportStocks(snapshot.lhb.stocks).length,
    lhbHotMoneyCount: snapshot.lhb.hotMoneyFlows.length,
    status: healthStatus(snapshot),
  };
}

export async function saveDailyReport(snapshot: OsintDailyReportSnapshot): Promise<OsintDailyReportRecord> {
  const latest = await prisma.osintDailyReport.findFirst({
    where: { reportDate: snapshot.reportDate, edition: snapshot.edition },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (latest?.version ?? 0) + 1;
  const payload: OsintDailyReportSnapshot = { ...snapshot, version };
  const generatedAt = new Date(payload.generatedAt);
  const finalizedAt = payload.status === "final"
    ? new Date(payload.finalizedAt ?? payload.generatedAt)
    : null;
  const row = await prisma.osintDailyReport.create({
    data: {
      reportDate: payload.reportDate,
      edition: payload.edition,
      version,
      status: payload.status,
      payload: JSON.parse(JSON.stringify(payload)),
      asOf: new Date(payload.asOf),
      generatedAt,
      finalizedAt,
    },
  });
  return toRecord(row);
}

export async function listDailyReports(limit = 31): Promise<OsintDailyReportSummary[]> {
  const safeLimit = Math.min(100, Math.max(1, limit));
  const rows = await prisma.osintDailyReport.findMany({
    orderBy: [{ reportDate: "desc" }, { edition: "asc" }, { version: "desc" }],
    take: Math.min(400, safeLimit * 4),
  });
  const latest: DatabaseReportRow[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.reportDate}|${row.edition}`;
    if (seen.has(key)) continue;
    seen.add(key);
    latest.push(row);
    if (latest.length >= safeLimit) break;
  }
  return latest.map((row) => summarizeDailyReport(toRecord(row)));
}

export async function getDailyReport(id: string): Promise<OsintDailyReportRecord | null> {
  const row = await prisma.osintDailyReport.findUnique({ where: { id } });
  return row ? toRecord(row) : null;
}
