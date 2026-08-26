export type OsintDataStatus =
  | "live"
  | "cached"
  | "stale"
  | "unavailable";

export type OsintInstrumentType =
  | "index"
  | "future"
  | "commodity"
  | "fx"
  | "yield";

export interface OsintMarket {
  symbol: string;
  name: string;
  category: "index" | "future" | "commodity" | "fx" | "risk" | "yield";
  instrumentType: OsintInstrumentType;
  region: string;
  value: number | null;
  change: number | null;
  changePercent: number | null;
  source: string;
  asOf: string | null;
  status: OsintDataStatus;
  confidence: "official" | "multi-source" | "single-source" | "unavailable";
}

export interface StoryTags {
  topic: string[];
  region: string[];
  assets: string[];
  direction: "risk-on" | "risk-off" | "mixed" | "neutral";
  horizon: "intraday" | "1-3d" | "1-3w" | "medium";
  verification: "official" | "multi-source" | "single-source";
}

export interface OsintStory {
  id: string;
  publishedAt: string;
  title: string;
  originalTitle: string;
  language: "zh" | "en" | "other";
  translationStatus: "native" | "translated" | "fallback";
  summary: string;
  importance: number;
  sources: Array<{ name: string; url: string }>;
  tags: StoryTags;
  analysisStatus: "complete" | "fallback";
  eventType?: "news" | "upcoming";
  scheduledFor?: string | null;
}

export interface Coverage {
  available: number;
  total: number;
  ratio: number;
  stale: number;
}

export interface OsintContext {
  schemaVersion: "1.0";
  generatedAt: string;
  coverage: Coverage;
  markets: OsintMarket[];
  stories: OsintStory[];
  advice: {
    text: string;
    confidence: "high" | "medium" | "low";
    generatedAt: string | null;
  };
  sourceHealth: {
    markets: Array<{ name: string; available: number; stale: number }>;
    stories: Array<{ name: string; ok: boolean; count: number }>;
  };
}

export interface MarketSnapshot {
  schemaVersion: "1.0";
  generatedAt: string;
  coverage: Coverage;
  markets: OsintMarket[];
}

export interface StorySnapshot {
  schemaVersion: "1.0";
  generatedAt: string;
  windowHours: number;
  stories: OsintStory[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  advice: {
    text: string;
    confidence: "high" | "medium" | "low";
    generatedAt: string | null;
  };
  sources: Array<{ name: string; ok: boolean; count: number; error?: string | null }>;
}

export interface MarketManifestEntry {
  symbol: string;
  name: string;
  category: OsintMarket["category"];
  instrumentType: OsintInstrumentType;
  region: string;
  provider: "yahoo" | "eastmoney" | "us-treasury";
  providerSymbol: string;
}

export function calculateCoverage(
  items: Array<{ status: OsintDataStatus }>
): Coverage {
  const available = items.filter(
    (item) => item.status !== "unavailable"
  ).length;
  const stale = items.filter((item) => item.status === "stale").length;
  const total = items.length;

  return {
    available,
    total,
    stale,
    ratio: total === 0 ? 0 : Number((available / total).toFixed(2)),
  };
}
