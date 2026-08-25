import type { LhbSnapshot } from "../../lhb/contracts";
import type { MarketSnapshot, StorySnapshot } from "../contracts";
import type { OsintDailyReportSnapshot } from "./contracts";

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

function titleForDate(periodKey: string): string {
  const [year, month, day] = periodKey.split("-");
  return `${year}年${Number(month)}月${Number(day)}日 OSINT 每日复盘`;
}

export function composeDailyReportSnapshot(input: {
  markets: MarketSnapshot;
  stories: StorySnapshot;
  lhb: LhbSnapshot;
  now?: Date;
}): OsintDailyReportSnapshot {
  const now = input.now ?? new Date();
  const generatedAt = now.toISOString();
  const periodKey = shanghaiDateKey(now);
  const asOf = latestIso(
    [input.markets.generatedAt, input.stories.generatedAt, input.lhb.generatedAt],
    generatedAt
  );

  return {
    schemaVersion: "1.0",
    periodType: "daily",
    periodKey,
    title: titleForDate(periodKey),
    generatedAt,
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
