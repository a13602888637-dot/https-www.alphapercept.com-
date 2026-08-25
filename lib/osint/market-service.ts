import { calculateCoverage, type MarketManifestEntry, type MarketSnapshot, type OsintDataStatus, type OsintMarket } from "./contracts";
import { MARKET_MANIFEST } from "./market-manifest";

type LastGoodEntry = { market: OsintMarket; cachedAt: number };

const lastGood = new Map<string, LastGoodEntry>();
const YAHOO_TIMEOUT_MS = 8_000;
const EASTMONEY_TIMEOUT_MS = 8_000;
const TREASURY_TIMEOUT_MS = 10_000;
const CACHE_STATUS_MS = 30 * 60 * 1_000;

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number | null, digits = 4): number | null {
  return value === null ? null : Number(value.toFixed(digits));
}

function quoteStatus(asOf: string | null, liveWindowMs: number): OsintDataStatus {
  if (!asOf) return "cached";
  const age = Date.now() - new Date(asOf).getTime();
  if (!Number.isFinite(age)) return "cached";
  if (age <= liveWindowMs) return "live";
  if (age <= 72 * 60 * 60 * 1_000) return "cached";
  return "stale";
}

function unavailable(entry: MarketManifestEntry): OsintMarket {
  return {
    symbol: entry.symbol,
    name: entry.name,
    category: entry.category,
    instrumentType: entry.instrumentType,
    region: entry.region,
    value: null,
    change: null,
    changePercent: null,
    source: "unavailable",
    asOf: null,
    status: "unavailable",
    confidence: "unavailable",
  };
}

function withEntry(entry: MarketManifestEntry, quote: Omit<OsintMarket, keyof MarketManifestEntry | "symbol">): OsintMarket {
  return {
    symbol: entry.symbol,
    name: entry.name,
    category: entry.category,
    instrumentType: entry.instrumentType,
    region: entry.region,
    ...quote,
  };
}

async function inBatches<T, R>(items: T[], size: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const output: R[] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(...(await Promise.all(items.slice(index, index + size).map(worker))));
  }
  return output;
}

async function fetchYahooMarkets(entries: MarketManifestEntry[], fetchImpl: typeof fetch): Promise<Map<string, OsintMarket>> {
  const pairs = await inBatches(entries, 6, async (entry): Promise<[string, OsintMarket | null]> => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(entry.providerSymbol)}?range=5d&interval=1d`;
      const response = await fetchImpl(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; AlphaQuant/1.0)" },
        signal: AbortSignal.timeout(YAHOO_TIMEOUT_MS),
      });
      if (!response.ok) return [entry.symbol, null];
      const payload = await response.json();
      const meta = payload?.chart?.result?.[0]?.meta;
      const value = finiteNumber(meta?.regularMarketPrice);
      if (value === null || value <= 0) return [entry.symbol, null];
      const previous = finiteNumber(meta?.chartPreviousClose ?? meta?.previousClose);
      const change = previous !== null ? value - previous : null;
      const asOf = finiteNumber(meta?.regularMarketTime)
        ? new Date(Number(meta.regularMarketTime) * 1_000).toISOString()
        : null;
      return [
        entry.symbol,
        withEntry(entry, {
          value: round(value),
          change: round(change),
          changePercent: previous && change !== null ? round((change / previous) * 100, 2) : null,
          source: "yahoo",
          asOf,
          status: quoteStatus(asOf, 15 * 60 * 1_000),
          confidence: "single-source",
        }),
      ];
    } catch {
      return [entry.symbol, null];
    }
  });

  return new Map(pairs.filter((pair): pair is [string, OsintMarket] => pair[1] !== null));
}

async function fetchEastMoneyMarkets(entries: MarketManifestEntry[], fetchImpl: typeof fetch): Promise<Map<string, OsintMarket>> {
  if (entries.length === 0) return new Map();
  try {
    const secids = entries.map((entry) => entry.providerSymbol).join(",");
    const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&secids=${encodeURIComponent(secids)}&fields=f2,f3,f4,f12,f14,f18,f124`;
    const response = await fetchImpl(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AlphaQuant/1.0)" },
      signal: AbortSignal.timeout(EASTMONEY_TIMEOUT_MS),
    });
    if (!response.ok) return new Map();
    const payload = await response.json();
    const rows: Array<Record<string, unknown>> = payload?.data?.diff ?? [];
    const byCode = new Map(rows.map((row) => [String(row.f12 ?? ""), row]));
    const result = new Map<string, OsintMarket>();

    for (const entry of entries) {
      const providerCode = entry.providerSymbol.split(".").slice(1).join(".");
      const row = byCode.get(providerCode);
      const value = finiteNumber(row?.f2);
      if (!row || value === null || value <= 0) continue;
      const previous = finiteNumber(row.f18);
      const rawChange = finiteNumber(row.f4);
      const rawChangePercent = finiteNumber(row.f3);
      const timestamp = finiteNumber(row.f124);
      const asOf = timestamp ? new Date(timestamp * 1_000).toISOString() : null;
      result.set(entry.symbol, withEntry(entry, {
        value: round(value),
        change: round(rawChange ?? (previous !== null ? value - previous : null)),
        changePercent: round(rawChangePercent, 2),
        source: "eastmoney",
        asOf,
        status: quoteStatus(asOf, 15 * 60 * 1_000),
        confidence: "single-source",
      }));
    }
    return result;
  } catch {
    return new Map();
  }
}

function xmlValue(block: string, field: string): string | null {
  const match = block.match(new RegExp(`<d:${field}[^>]*>([^<]+)</d:${field}>`, "i"));
  return match?.[1]?.trim() ?? null;
}

export async function getTreasuryMarkets(fetchImpl: typeof fetch = fetch): Promise<OsintMarket[]> {
  const entries = Object.values(MARKET_MANIFEST).filter((entry) => entry.provider === "us-treasury");
  try {
    const now = new Date();
    const month = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value_month=${month}`;
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(TREASURY_TIMEOUT_MS) });
    if (!response.ok) return [];
    const xml = await response.text();
    const records = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)]
      .map((match) => match[0])
      .map((block) => ({
        block,
        date: xmlValue(block, "NEW_DATE") ?? xmlValue(block, "RecordDate") ?? "",
      }))
      .filter((record) => record.date)
      .sort((left, right) => right.date.localeCompare(left.date));
    if (records.length === 0) return [];

    return entries.flatMap((entry) => {
      const current = finiteNumber(xmlValue(records[0].block, entry.providerSymbol));
      if (current === null) return [];
      const previous = records[1] ? finiteNumber(xmlValue(records[1].block, entry.providerSymbol)) : null;
      const change = previous !== null ? current - previous : null;
      const asOf = new Date(records[0].date).toISOString();
      return [withEntry(entry, {
        value: round(current),
        change: round(change),
        changePercent: previous && change !== null ? round((change / previous) * 100, 2) : null,
        source: "us-treasury",
        asOf,
        status: quoteStatus(asOf, 96 * 60 * 60 * 1_000),
        confidence: "official",
      })];
    });
  } catch {
    return [];
  }
}

function resolveMarket(entry: MarketManifestEntry, fresh: Map<string, OsintMarket>): OsintMarket {
  const current = fresh.get(entry.symbol);
  if (current) {
    lastGood.set(entry.symbol, { market: current, cachedAt: Date.now() });
    return current;
  }
  const previous = lastGood.get(entry.symbol);
  if (!previous) return unavailable(entry);
  const status: OsintDataStatus = Date.now() - previous.cachedAt <= CACHE_STATUS_MS ? "cached" : "stale";
  return { ...previous.market, status };
}

export async function getMarketSnapshot(fetchImpl: typeof fetch = fetch): Promise<MarketSnapshot> {
  const entries = Object.values(MARKET_MANIFEST);
  const [yahoo, eastmoney, treasury] = await Promise.all([
    fetchYahooMarkets(entries.filter((entry) => entry.provider === "yahoo"), fetchImpl),
    fetchEastMoneyMarkets(entries.filter((entry) => entry.provider === "eastmoney"), fetchImpl),
    getTreasuryMarkets(fetchImpl),
  ]);
  const fresh = new Map<string, OsintMarket>([
    ...yahoo.entries(),
    ...eastmoney.entries(),
    ...treasury.map((market): [string, OsintMarket] => [market.symbol, market]),
  ]);
  const markets = entries.map((entry) => resolveMarket(entry, fresh));
  return {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    coverage: calculateCoverage(markets),
    markets,
  };
}
