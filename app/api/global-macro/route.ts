import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// ─── Symbol Configuration ────────────────────────────────────

const GLOBAL_SYMBOLS: Record<string, {
  name: string;
  category: string;
  region: string;
  finnhubSymbol?: string;
  sinaSymbol?: string;
}> = {
  "^DJI":      { name: "道琼斯", category: "index", region: "us", finnhubSymbol: "^DJI", sinaSymbol: "int_dji" },
  "^IXIC":     { name: "纳斯达克", category: "index", region: "us", finnhubSymbol: "^IXIC", sinaSymbol: "int_nasdaq" },
  "^GSPC":     { name: "标普500", category: "index", region: "us", finnhubSymbol: "^GSPC", sinaSymbol: "int_sp500" },
  "^HSI":      { name: "恒生指数", category: "index", region: "hk", finnhubSymbol: "^HSI", sinaSymbol: "int_hangseng" },
  "^N225":     { name: "日经225", category: "index", region: "jp", finnhubSymbol: "^N225", sinaSymbol: "int_nikkei" },
  "^FTSE":     { name: "富时100", category: "index", region: "uk", sinaSymbol: "int_ftse" },
  "^DAX":      { name: "德国DAX", category: "index", region: "eu", sinaSymbol: "int_dax" },
  "GC=F":      { name: "黄金", category: "commodity", region: "global", sinaSymbol: "hf_GC" },
  "CL=F":      { name: "原油WTI", category: "commodity", region: "global", sinaSymbol: "hf_CL" },
  "SI=F":      { name: "白银", category: "commodity", region: "global", sinaSymbol: "hf_SI" },
  "HG=F":      { name: "铜", category: "commodity", region: "global", sinaSymbol: "hf_HG" },
  "^VIX":      { name: "VIX恐慌", category: "rate", region: "us", sinaSymbol: "int_vix" },
  "^TNX":      { name: "美10Y国债", category: "rate", region: "us", sinaSymbol: "gb_ustn10" },
  "USDCNY=X":  { name: "美元/人民币", category: "fx", region: "global", sinaSymbol: "fx_susdcny" },
  "USDJPY=X":  { name: "美元/日元", category: "fx", region: "global", sinaSymbol: "fx_susdjpy" },
};

// Last-resort static data (only if ALL real sources fail)
const STATIC_FALLBACK: Record<string, { price: number; change: number; changePercent: number }> = {
  "^DJI": { price: 43200.00, change: 150.00, changePercent: 0.35 },
  "^IXIC": { price: 18500.00, change: 80.00, changePercent: 0.43 },
  "^GSPC": { price: 5850.00, change: 20.00, changePercent: 0.34 },
  "^HSI": { price: 22800.00, change: -120.00, changePercent: -0.52 },
  "^N225": { price: 38500.00, change: 200.00, changePercent: 0.52 },
  "^FTSE": { price: 8200.00, change: 30.00, changePercent: 0.37 },
  "^DAX": { price: 18500.00, change: 50.00, changePercent: 0.27 },
  "GC=F": { price: 2950.00, change: 15.00, changePercent: 0.51 },
  "CL=F": { price: 72.50, change: -0.80, changePercent: -1.09 },
  "SI=F": { price: 33.20, change: 0.30, changePercent: 0.91 },
  "HG=F": { price: 4.15, change: 0.03, changePercent: 0.73 },
  "^VIX": { price: 15.80, change: -0.50, changePercent: -3.07 },
  "^TNX": { price: 4.25, change: 0.02, changePercent: 0.47 },
  "USDCNY=X": { price: 7.24, change: 0.01, changePercent: 0.14 },
  "USDJPY=X": { price: 149.50, change: 0.30, changePercent: 0.20 },
};

let cache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000;

// ─── Strategy 1: Finnhub API ─────────────────────────────────

async function fetchFinnhub(symbols: string[]): Promise<Record<string, any>> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return {};

  const results: Record<string, any> = {};

  // Finnhub /quote endpoint: one symbol per call, 60/min free tier
  const fetches = symbols.slice(0, 15).map(async (originalSymbol) => {
    const config = GLOBAL_SYMBOLS[originalSymbol];
    const finnhubSym = config?.finnhubSymbol;
    if (!finnhubSym) return;

    try {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(finnhubSym)}&token=${apiKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return;

      const data = await res.json();
      // Finnhub quote: c=current, d=change, dp=changePercent, pc=prevClose
      if (data.c && data.c > 0) {
        results[originalSymbol] = {
          price: Number(data.c.toFixed(2)),
          change: Number((data.d ?? 0).toFixed(2)),
          changePercent: Number((data.dp ?? 0).toFixed(2)),
          source: 'finnhub',
        };
      }
    } catch {
      // silent fail, will try next source
    }
  });

  await Promise.allSettled(fetches);
  return results;
}

// ─── Strategy 2: Sina Global Finance API ─────────────────────

async function fetchSinaGlobal(symbols: string[]): Promise<Record<string, any>> {
  const results: Record<string, any> = {};

  // Build sina symbol list
  const sinaSymbols: { original: string; sina: string }[] = [];
  for (const sym of symbols) {
    const config = GLOBAL_SYMBOLS[sym];
    if (config?.sinaSymbol) {
      sinaSymbols.push({ original: sym, sina: config.sinaSymbol });
    }
  }

  if (sinaSymbols.length === 0) return results;

  const sinaList = sinaSymbols.map(s => s.sina).join(",");
  const url = `https://hq.sinajs.cn/list=${sinaList}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://finance.sina.com.cn',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return results;

    const text = await res.text();
    const lines = text.split('\n').filter(l => l.trim());

    for (const line of lines) {
      try {
        // Format: var hq_str_int_dji="道琼斯,43200.00,150.00,0.35%,...";
        const match = line.match(/hq_str_(\w+)="(.+)"/);
        if (!match) continue;

        const sinaKey = match[1];
        const parts = match[2].split(',');

        // Find which original symbol this maps to
        const mapping = sinaSymbols.find(s => s.sina === sinaKey);
        if (!mapping) continue;

        let price = 0, change = 0, changePercent = 0;

        if (sinaKey.startsWith('int_')) {
          // International index: name, price, change, changePercent, ...
          price = parseFloat(parts[1]) || 0;
          change = parseFloat(parts[2]) || 0;
          changePercent = parseFloat(parts[3]) || 0;
        } else if (sinaKey.startsWith('hf_')) {
          // Commodities futures: price at [0], prev settle at [14]
          price = parseFloat(parts[0]) || 0;
          const prevSettle = parseFloat(parts[14]) || price;
          change = price - prevSettle;
          changePercent = prevSettle > 0 ? (change / prevSettle) * 100 : 0;
        } else if (sinaKey.startsWith('fx_')) {
          // FX: current at [1], prev close at [3]
          price = parseFloat(parts[1]) || 0;
          const prevClose = parseFloat(parts[3]) || price;
          change = price - prevClose;
          changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
        } else if (sinaKey.startsWith('gb_')) {
          // Government bonds: yield at [1], change at [2]
          price = parseFloat(parts[1]) || 0;
          change = parseFloat(parts[2]) || 0;
          changePercent = parseFloat(parts[5]) || 0;
        }

        if (price > 0) {
          results[mapping.original] = {
            price: Number(price.toFixed(2)),
            change: Number(change.toFixed(2)),
            changePercent: Number(changePercent.toFixed(2)),
            source: 'sina',
          };
        }
      } catch {
        continue;
      }
    }
  } catch (err) {
    console.warn('Sina global fetch failed:', err);
  }

  return results;
}

// ─── Main Handler ────────────────────────────────────────────

export async function GET() {
  try {
    // Cache check
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data, {
        headers: { 'Cache-Control': 'public, max-age=60' },
      });
    }

    const symbols = Object.keys(GLOBAL_SYMBOLS);
    let quotes: Record<string, any> = {};
    let primarySource = 'none';

    // Strategy 1: Finnhub (if API key configured)
    if (process.env.FINNHUB_API_KEY) {
      quotes = await fetchFinnhub(symbols);
      if (Object.keys(quotes).length > 0) {
        primarySource = 'finnhub';
      }
    }

    // Strategy 2: Fill gaps with Sina Global
    const missingSymbols = symbols.filter(s => !quotes[s]);
    if (missingSymbols.length > 0) {
      const sinaQuotes = await fetchSinaGlobal(missingSymbols);
      for (const [sym, data] of Object.entries(sinaQuotes)) {
        if (!quotes[sym]) {
          quotes[sym] = data;
          if (primarySource === 'none') primarySource = 'sina';
        }
      }
    }

    // Build response
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

    const liveCount = markets.filter(m => m.source !== 'fallback' && m.source !== 'unavailable').length;

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
