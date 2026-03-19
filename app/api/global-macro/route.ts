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
  // Commodities: Finnhub primary, stooq fallback
  "GC=F":     { name: "黄金", category: "commodity", region: "global", finnhubSymbol: "OANDA:XAU_USD", stooqSymbol: "gc.f" },
  "CL=F":     { name: "原油WTI", category: "commodity", region: "global", finnhubSymbol: "OANDA:BCO_USD", stooqSymbol: "cl.f" },
  "SI=F":     { name: "白银", category: "commodity", region: "global", stooqSymbol: "si.f" },
  "HG=F":     { name: "铜", category: "commodity", region: "global", stooqSymbol: "hg.f" },
  // FX: Finnhub primary, stooq fallback
  "USDCNY=X": { name: "美元/人民币", category: "fx", region: "global", finnhubSymbol: "OANDA:USD_CNH", stooqSymbol: "usdcny" },
  "USDJPY=X": { name: "美元/日元", category: "fx", region: "global", finnhubSymbol: "OANDA:USD_JPY", stooqSymbol: "usdjpy" },
  // Rates: stooq only (no reliable Finnhub symbols for VIX/bonds)
  "^VIX":     { name: "VIX恐慌", category: "rate", region: "us", stooqSymbol: "vix.us" },
  "^TNX":     { name: "美10Y国债", category: "rate", region: "us", stooqSymbol: "tnx.us" },
};

const UNAVAILABLE_QUOTE = { price: null, change: null, changePercent: null, source: 'unavailable' as const };

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
      if (!res.ok) {
        console.warn(`[global-macro] Finnhub HTTP ${res.status} for ${sym} (${cfg.finnhubSymbol})`);
        return;
      }
      const data = await res.json();
      if (data.c && data.c > 0) {
        results[sym] = {
          price: Number((data.c * scale).toFixed(2)),
          change: Number(((data.d ?? 0) * scale).toFixed(2)),
          changePercent: Number((data.dp ?? 0).toFixed(2)),
          source: 'finnhub',
        };
      }
    } catch (err) {
        console.warn(`[global-macro] Finnhub failed for ${sym} (${cfg.finnhubSymbol}):`, err instanceof Error ? err.message : err);
      }
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
      const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSym)}&f=sd2t2ohlcpvn&e=json`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; StockAnalysis/1.0)',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        console.warn(`[global-macro] Stooq HTTP ${res.status} for ${sym} (${stooqSym})`);
        return;
      }
      const data = await res.json();
      const item = data?.symbols?.[0];
      if (!item?.close) {
        console.warn(`[global-macro] Stooq no close data for ${sym} (${stooqSym}):`, JSON.stringify(item).slice(0, 200));
        return;
      }

      const close = parseFloat(item.close);
      const prevClose = parseFloat(item.previous_close) || parseFloat(item.open) || close;
      const change = Number((close - prevClose).toFixed(4));
      const changePercent = prevClose > 0 ? Number(((change / prevClose) * 100).toFixed(2)) : 0;

      if (close > 0) {
        results[sym] = {
          price: close,
          change,
          changePercent,
          source: 'stooq',
        };
      }
    } catch (err) {
        console.warn(`[global-macro] Stooq failed for ${sym} (${stooqSym}):`, err instanceof Error ? err.message : err);
      }
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

    console.log(`[global-macro] Finnhub: ${Object.keys(finnhubQuotes).length} hits, Stooq: ${Object.keys(stooqQuotes).length} hits`);

    // Finnhub takes priority (more reliable from Vercel US), stooq fills the rest
    const quotes: Record<string, any> = { ...stooqQuotes, ...finnhubQuotes };

    const liveCount = Object.values(quotes).filter((q: any) =>
      q.source && !['fallback', 'unavailable'].includes(q.source)
    ).length;

    const markets = Object.entries(GLOBAL_SYMBOLS).map(([symbol, meta]) => {
      const quote = quotes[symbol] || UNAVAILABLE_QUOTE;
      return {
        symbol,
        name: meta.name,
        category: meta.category,
        region: meta.region,
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        source: quote.source || 'unavailable',
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
      price: null, change: null, changePercent: null,
      source: 'unavailable',
    }));
    return NextResponse.json({
      success: false, markets, primarySource: 'unavailable',
      liveCount: 0, totalCount: markets.length,
      timestamp: new Date().toISOString(),
    });
  }
}
