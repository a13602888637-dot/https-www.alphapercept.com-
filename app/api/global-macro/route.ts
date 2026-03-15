import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// ─── Symbol Configuration ────────────────────────────────────

interface SymbolConfig {
  name: string;
  category: string;
  region: string;
  finnhubSymbol?: string; // ETF proxy (Finnhub free tier)
  finnhubScale?: number;  // multiply ETF price → index level
  stooqSymbol?: string;   // stooq.com direct symbol
}

const GLOBAL_SYMBOLS: Record<string, SymbolConfig> = {
  // US Indices: Finnhub ETF proxies (most accurate for US)
  "^DJI":     { name: "道琼斯", category: "index", region: "us", finnhubSymbol: "DIA", finnhubScale: 100 },
  "^IXIC":    { name: "纳斯达克", category: "index", region: "us", finnhubSymbol: "QQQ", finnhubScale: 40 },
  "^GSPC":    { name: "标普500", category: "index", region: "us", finnhubSymbol: "SPY", finnhubScale: 10 },
  // Non-US Indices: stooq.com (free, no key, works from Vercel)
  "^HSI":     { name: "恒生指数", category: "index", region: "hk", stooqSymbol: "^hsi" },
  "^N225":    { name: "日经225", category: "index", region: "jp", stooqSymbol: "^nkx" },
  "^FTSE":    { name: "富时100", category: "index", region: "uk", stooqSymbol: "^ftx" },
  "^DAX":     { name: "德国DAX", category: "index", region: "eu", stooqSymbol: "^dax" },
  // Commodities: stooq.com futures
  "GC=F":     { name: "黄金", category: "commodity", region: "global", stooqSymbol: "gc.f" },
  "CL=F":     { name: "原油WTI", category: "commodity", region: "global", stooqSymbol: "cl.f" },
  "SI=F":     { name: "白银", category: "commodity", region: "global", stooqSymbol: "si.f" },
  "HG=F":     { name: "铜", category: "commodity", region: "global", stooqSymbol: "hg.f" },
  // FX: stooq.com
  "USDCNY=X": { name: "美元/人民币", category: "fx", region: "global", stooqSymbol: "usdcny" },
  "USDJPY=X": { name: "美元/日元", category: "fx", region: "global", stooqSymbol: "usdjpy" },
  // Rates: stooq.com
  "^VIX":     { name: "VIX恐慌", category: "rate", region: "us", stooqSymbol: "vix.us" },
  "^TNX":     { name: "美10Y国债", category: "rate", region: "us", stooqSymbol: "tnx.us" },
};

const STATIC_FALLBACK: Record<string, { price: number; change: number; changePercent: number }> = {
  "^DJI":     { price: 46641.00, change: -108.00, changePercent: -0.23 },
  "^IXIC":    { price: 23748.00, change: -140.00, changePercent: -0.59 },
  "^GSPC":    { price: 6622.90, change: -37.80, changePercent: -0.57 },
  "^HSI":     { price: 25465.60, change: -251.16, changePercent: -0.98 },
  "^N225":    { price: 44946.64, change: -408.35, changePercent: -0.90 },
  "^FTSE":    { price: 8400.00, change: 30.00, changePercent: 0.36 },
  "^DAX":     { price: 23000.00, change: 50.00, changePercent: 0.22 },
  "GC=F":     { price: 5061.70, change: -22.30, changePercent: -0.44 },
  "CL=F":     { price: 97.21, change: -0.80, changePercent: -0.82 },
  "SI=F":     { price: 33.50, change: 0.20, changePercent: 0.60 },
  "HG=F":     { price: 4.20, change: 0.03, changePercent: 0.72 },
  "USDCNY=X": { price: 6.899, change: 0.01, changePercent: 0.14 },
  "USDJPY=X": { price: 148.50, change: 0.20, changePercent: 0.13 },
  "^VIX":     { price: 16.50, change: -0.30, changePercent: -1.79 },
  "^TNX":     { price: 4.28, change: 0.01, changePercent: 0.23 },
};

let cache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000;

// ─── Source 1: Finnhub (US ETF proxies) ─────────────────────

async function fetchFinnhub(symbols: string[]): Promise<Record<string, any>> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return {};

  const results: Record<string, any> = {};
  const targets = symbols.filter(s => GLOBAL_SYMBOLS[s]?.finnhubSymbol);

  await Promise.allSettled(targets.map(async (sym) => {
    const cfg = GLOBAL_SYMBOLS[sym];
    const scale = cfg.finnhubScale ?? 1;
    try {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(cfg.finnhubSymbol!)}&token=${apiKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return;
      const data = await res.json();
      if (data.c && data.c > 0) {
        results[sym] = {
          price: Number((data.c * scale).toFixed(2)),
          change: Number(((data.d ?? 0) * scale).toFixed(2)),
          changePercent: Number((data.dp ?? 0).toFixed(2)),
          source: 'finnhub',
        };
      }
    } catch { /* silent */ }
  }));

  return results;
}

// ─── Source 2: stooq.com (global indices, commodities, FX) ──

async function fetchStooq(symbols: string[]): Promise<Record<string, any>> {
  const results: Record<string, any> = {};
  const targets = symbols.filter(s => GLOBAL_SYMBOLS[s]?.stooqSymbol);

  // Stooq doesn't support batch, fetch individually but in parallel
  await Promise.allSettled(targets.map(async (sym) => {
    const stooqSym = GLOBAL_SYMBOLS[sym].stooqSymbol!;
    try {
      const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSym)}&f=sd2t2ohlcvn&e=json`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; StockAnalysis/1.0)',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return;
      const data = await res.json();
      const item = data?.symbols?.[0];
      if (!item?.close) return;

      const close = parseFloat(item.close);
      const open = parseFloat(item.open) || close;
      const change = Number((close - open).toFixed(4));
      const changePercent = open > 0 ? Number(((change / open) * 100).toFixed(2)) : 0;

      if (close > 0) {
        results[sym] = {
          price: close,
          change,
          changePercent,
          source: 'stooq',
        };
      }
    } catch { /* silent */ }
  }));

  return results;
}

// ─── Main Handler ─────────────────────────────────────────────

export async function GET() {
  try {
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data, {
        headers: { 'Cache-Control': 'public, max-age=60' },
      });
    }

    const symbols = Object.keys(GLOBAL_SYMBOLS);

    // Both sources run in parallel
    const [finnhubQuotes, stooqQuotes] = await Promise.all([
      fetchFinnhub(symbols),
      fetchStooq(symbols),
    ]);

    // Finnhub takes priority for US, stooq fills the rest
    const quotes: Record<string, any> = { ...stooqQuotes, ...finnhubQuotes };

    const liveCount = Object.values(quotes).filter((q: any) =>
      q.source && !['fallback', 'unavailable'].includes(q.source)
    ).length;

    const markets = Object.entries(GLOBAL_SYMBOLS).map(([symbol, meta]) => {
      const quote = quotes[symbol] || STATIC_FALLBACK[symbol] || { price: 0, change: 0, changePercent: 0, source: 'unavailable' };
      return {
        symbol,
        name: meta.name,
        category: meta.category,
        region: meta.region,
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        source: quote.source || 'fallback',
      };
    });

    const sourceSet = [...new Set(Object.values(quotes).map((q: any) => q.source))]
      .filter(s => !['fallback', 'unavailable'].includes(s));
    const primarySource = sourceSet.length > 0 ? sourceSet.join('+') : 'fallback';

    const responseData = {
      success: true,
      markets,
      primarySource,
      liveCount,
      totalCount: markets.length,
      timestamp: new Date().toISOString(),
    };

    cache = { data: responseData, timestamp: Date.now() };

    return NextResponse.json(responseData, {
      headers: { 'Cache-Control': 'public, max-age=60' },
    });
  } catch (error) {
    console.error("Error in global-macro API:", error);
    const markets = Object.entries(GLOBAL_SYMBOLS).map(([symbol, meta]) => ({
      symbol, name: meta.name, category: meta.category, region: meta.region,
      ...(STATIC_FALLBACK[symbol] || { price: 0, change: 0, changePercent: 0 }),
      source: 'fallback',
    }));
    return NextResponse.json({
      success: true, markets, primarySource: 'fallback',
      liveCount: 0, totalCount: markets.length,
      timestamp: new Date().toISOString(), fallback: true,
    });
  }
}
