import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// ─── Symbol Configuration ────────────────────────────────────

interface SymbolConfig {
  name: string;
  category: string;
  region: string;
  finnhubSymbol?: string;   // Finnhub ETF proxy
  finnhubScale?: number;    // multiply ETF price to get index level
  yahooSymbol?: string;     // Yahoo Finance for non-US indices
}

const GLOBAL_SYMBOLS: Record<string, SymbolConfig> = {
  // US Indices: ETF proxies × scale factor ≈ index level
  "^DJI":     { name: "道琼斯", category: "index", region: "us", finnhubSymbol: "DIA", finnhubScale: 100 },
  "^IXIC":    { name: "纳斯达克", category: "index", region: "us", finnhubSymbol: "QQQ", finnhubScale: 40 },
  "^GSPC":    { name: "标普500", category: "index", region: "us", finnhubSymbol: "SPY", finnhubScale: 10 },
  // Non-US Indices: Yahoo Finance (works from Vercel US servers)
  "^HSI":     { name: "恒生指数", category: "index", region: "hk", yahooSymbol: "^HSI" },
  "^N225":    { name: "日经225", category: "index", region: "jp", yahooSymbol: "^N225" },
  "^FTSE":    { name: "富时100", category: "index", region: "uk", yahooSymbol: "^FTSE" },
  "^DAX":     { name: "德国DAX", category: "index", region: "eu", yahooSymbol: "^GDAXI" },
  // Commodities: Finnhub ETF proxies
  "GC=F":     { name: "黄金", category: "commodity", region: "global", finnhubSymbol: "GLD", finnhubScale: 10 },
  "CL=F":     { name: "原油WTI", category: "commodity", region: "global", yahooSymbol: "CL=F" },
  "SI=F":     { name: "白银", category: "commodity", region: "global", finnhubSymbol: "SLV", finnhubScale: 18 },
  "HG=F":     { name: "铜", category: "commodity", region: "global", yahooSymbol: "HG=F" },
  // FX: Yahoo Finance
  "USDCNY=X": { name: "美元/人民币", category: "fx", region: "global", yahooSymbol: "USDCNY=X" },
  "USDJPY=X": { name: "美元/日元", category: "fx", region: "global", yahooSymbol: "USDJPY=X" },
  // Rates: Yahoo Finance
  "^VIX":     { name: "VIX恐慌", category: "rate", region: "us", yahooSymbol: "^VIX" },
  "^TNX":     { name: "美10Y国债", category: "rate", region: "us", yahooSymbol: "^TNX" },
};

const STATIC_FALLBACK: Record<string, { price: number; change: number; changePercent: number }> = {
  "^DJI":     { price: 46247.29, change: 299.97, changePercent: 0.65 },
  "^IXIC":    { price: 22484.07, change: 99.37, changePercent: 0.44 },
  "^GSPC":    { price: 6643.70, change: 38.98, changePercent: 0.59 },
  "^HSI":     { price: 25465.60, change: -251.16, changePercent: -0.98 },
  "^N225":    { price: 44946.64, change: -408.35, changePercent: -0.90 },
  "^FTSE":    { price: 8400.00, change: 30.00, changePercent: 0.36 },
  "^DAX":     { price: 23000.00, change: 50.00, changePercent: 0.22 },
  "GC=F":     { price: 3020.00, change: 15.00, changePercent: 0.50 },
  "CL=F":     { price: 68.50, change: -0.80, changePercent: -1.16 },
  "SI=F":     { price: 33.50, change: 0.20, changePercent: 0.60 },
  "HG=F":     { price: 4.20, change: 0.03, changePercent: 0.72 },
  "USDCNY=X": { price: 7.25, change: 0.01, changePercent: 0.14 },
  "USDJPY=X": { price: 148.50, change: 0.20, changePercent: 0.13 },
  "^VIX":     { price: 16.50, change: -0.30, changePercent: -1.79 },
  "^TNX":     { price: 4.28, change: 0.01, changePercent: 0.23 },
};

let cache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000;

// ─── Finnhub (ETF proxies for US indices/commodities) ─────────

async function fetchFinnhub(symbols: string[]): Promise<Record<string, any>> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return {};

  const results: Record<string, any> = {};
  const targets = symbols.filter(s => GLOBAL_SYMBOLS[s]?.finnhubSymbol);

  await Promise.allSettled(targets.map(async (originalSymbol) => {
    const cfg = GLOBAL_SYMBOLS[originalSymbol];
    const scale = cfg.finnhubScale ?? 1;
    try {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(cfg.finnhubSymbol!)}&token=${apiKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return;
      const data = await res.json();
      if (data.c && data.c > 0) {
        const price = data.c * scale;
        const change = (data.d ?? 0) * scale;
        const changePercent = data.dp ?? 0;
        results[originalSymbol] = {
          price: Number(price.toFixed(2)),
          change: Number(change.toFixed(2)),
          changePercent: Number(changePercent.toFixed(2)),
          source: 'finnhub',
        };
      }
    } catch { /* silent */ }
  }));

  return results;
}

// ─── Yahoo Finance (non-US indices, commodities, FX, rates) ──

async function fetchYahoo(symbols: string[]): Promise<Record<string, any>> {
  const results: Record<string, any> = {};
  const targets = symbols.filter(s => GLOBAL_SYMBOLS[s]?.yahooSymbol);

  await Promise.allSettled(targets.map(async (originalSymbol) => {
    const yahooSym = GLOBAL_SYMBOLS[originalSymbol].yahooSymbol!;
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=1d&range=2d`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0 Safari/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return;
      const data = await res.json();
      const meta = data.chart?.result?.[0]?.meta;
      if (!meta?.regularMarketPrice) return;

      const price = meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose || meta.previousClose || price;
      const change = price - prevClose;
      const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

      results[originalSymbol] = {
        price: Number(price.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        source: 'yahoo',
      };
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

    // Run both sources in parallel
    const [finnhubQuotes, yahooQuotes] = await Promise.all([
      fetchFinnhub(symbols),
      fetchYahoo(symbols),
    ]);

    const quotes: Record<string, any> = { ...yahooQuotes, ...finnhubQuotes };

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

    const sourceSet = new Set(Object.values(quotes).map((q: any) => q.source));
    const primarySource = [...sourceSet].filter(s => !['fallback', 'unavailable'].includes(s)).join('+') || 'fallback';

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
      symbol,
      name: meta.name,
      category: meta.category,
      region: meta.region,
      ...(STATIC_FALLBACK[symbol] || { price: 0, change: 0, changePercent: 0 }),
      source: 'fallback',
    }));
    return NextResponse.json({
      success: true,
      markets,
      primarySource: 'fallback',
      liveCount: 0,
      totalCount: markets.length,
      timestamp: new Date().toISOString(),
      fallback: true,
    });
  }
}
