import type { LhbSnapshot } from "../../lhb/contracts";
import type { MarketSnapshot, StorySnapshot } from "../contracts";
import type { DailyReportArchiveStatus, DailyReportEdition, OsintDailyReportSnapshot } from "./contracts";

function shanghaiDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function latestIso(values: Array<string | null | undefined>, fallback: string): string {
  const timestamps = values
    .map((value) => ({ value, timestamp: value ? Date.parse(value) : Number.NaN }))
    .filter(
      (entry): entry is { value: string; timestamp: number } =>
        Boolean(entry.value) && Number.isFinite(entry.timestamp)
    )
    .sort((left, right) => right.timestamp - left.timestamp);
  return timestamps[0]?.value ?? fallback;
}

function titleForDate(reportDate: string, edition: DailyReportEdition): string {
  const [year, month, day] = reportDate.split("-");
  return `${year}年${Number(month)}月${Number(day)}日 OSINT 每日复盘 · ${edition === "global" ? "全球终版" : "收盘版"}`;
}

export function composeDailyReportSnapshot(input: {
  markets: MarketSnapshot;
  stories: StorySnapshot;
  lhb: LhbSnapshot;
  now?: Date;
  reportDate?: string;
  edition?: DailyReportEdition;
  version?: number;
  status?: DailyReportArchiveStatus;
}): OsintDailyReportSnapshot {
  const now = input.now ?? new Date();
  const generatedAt = now.toISOString();
  const reportDate = input.reportDate ?? shanghaiDateKey(now);
  const edition = input.edition ?? "close";
  const version = Math.max(1, Math.floor(input.version ?? 1));
  const status = input.status ?? "final";
  const asOf = latestIso(
    [input.markets.generatedAt, input.stories.generatedAt, input.lhb.generatedAt],
    generatedAt
  );

  return {
    schemaVersion: "1.0",
    periodType: "daily",
    reportDate,
    edition,
    version,
    status,
    title: titleForDate(reportDate, edition),
    generatedAt,
    finalizedAt: status === "final" ? generatedAt : null,
    asOf,
    markets: input.markets,
    stories: input.stories,
    lhb: input.lhb,
    sourceHealth: {
      markets: input.markets.coverage,
      stories: input.stories.sources,
      lhb: {
        status: input.lhb.status,
        source: input.lhb.source,
        checks: input.lhb.sourceHealth,
        errors: input.lhb.errors,
      },
    },
  };
}
