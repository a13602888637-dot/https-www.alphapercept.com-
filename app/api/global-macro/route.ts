import { NextResponse } from "next/server";
import * as iconv from "iconv-lite";

export const dynamic = 'force-dynamic';

// ─── Symbol Configuration ────────────────────────────────────

const GLOBAL_SYMBOLS: Record<string, {
  name: string;
  category: string;
  region: string;
  finnhubSymbol?: string; // ETF proxy or US stock (free tier)
  sinaSymbol?: string;
}> = {
  // US Indices — use ETF proxies on Finnhub (free tier supports stocks/ETFs)
  "^DJI":      { name: "道琼斯", category: "index", region: "us", finnhubSymbol: "DIA", sinaSymbol: "int_dji" },
  "^IXIC":     { name: "纳斯达克", category: "index", region: "us", finnhubSymbol: "QQQ", sinaSymbol: "int_nasdaq" },
  "^GSPC":     { name: "标普500", category: "index", region: "us", finnhubSymbol: "SPY", sinaSymbol: "int_sp500" },
  // HK / JP / EU — Sina only
  "^HSI":      { name: "恒生指数", category: "index", region: "hk", sinaSymbol: "int_hangseng" },
  "^N225":     { name: "日经225", category: "index", region: "jp", sinaSymbol: "int_nikkei" },
  "^FTSE":     { name: "富时100", category: "index", region: "uk", sinaSymbol: "int_ftse" },
  "^DAX":      { name: "德国DAX", category: "index", region: "eu", sinaSymbol: "int_dax" },
  // Commodities — Sina futures
  "GC=F":      { name: "黄金", category: "commodity", region: "global", sinaSymbol: "hf_GC" },
  "CL=F":      { name: "原油WTI", category: "commodity", region: "global", sinaSymbol: "hf_CL" },
  "SI=F":      { name: "白银", category: "commodity", region: "global", sinaSymbol: "hf_SI" },
  "HG=F":      { name: "铜", category: "commodity", region: "global", sinaSymbol: "hf_HG" },
  // FX — Sina forex
  "USDCNY=X":  { name: "美元/人民币", category: "fx", region: "global", sinaSymbol: "fx_susdcny" },
  "USDJPY=X":  { name: "美元/日元", category: "fx", region: "global", sinaSymbol: "fx_susdjpy" },
  // Rates — Sina
  "^VIX":      { name: "VIX恐慌", category: "rate", region: "us", sinaSymbol: "int_vix" },
  "^TNX":      { name: "美10Y国债", category: "rate", region: "us", sinaSymbol: "gb_ustn10" },
};

// Commodity scaling factors (Sina hf_ quotes are in cents or different units)
const COMMODITY_SCALE: Record<string, number> = {
  "hf_GC": 0.1,  // gold in 0.1 USD/oz → USD/oz
  "hf_CL": 0.1,  // crude in 0.1 USD/bbl → USD/bbl
  "hf_SI": 0.01, // silver in cents → USD
  "hf_HG": 0.01, // copper in cents → USD
};

// Last-resort static data (only when ALL real sources fail)
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
  "^VIX":     { price: 16.50, change: -0.30, changePercent: -1.79 },
  "^TNX":     { price: 4.28, change: 0.01, changePercent: 0.23 },
  "USDCNY=X": { price: 7.25, change: 0.01, changePercent: 0.14 },
  "USDJPY=X": { price: 148.50, change: 0.20, changePercent: 0.13 },
};

let cache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000;

// ─── Strategy 1: Finnhub (ETF proxies for US indices) ────────

async function fetchFinnhub(symbols: string[]): Promise<Record<string, any>> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return {};

  const results: Record<string, any> = {};
  const symbolsWithFinnhub = symbols.filter(s => GLOBAL_SYMBOLS[s]?.finnhubSymbol);

  const fetches = symbolsWithFinnhub.map(async (originalSymbol) => {
    const finnhubSym = GLOBAL_SYMBOLS[originalSymbol].finnhubSymbol!;
    try {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(finnhubSym)}&token=${apiKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return;
      const data = await res.json();
      if (data.c && data.c > 0) {
        results[originalSymbol] = {
          price: Number(data.c.toFixed(2)),
          change: Number((data.d ?? 0).toFixed(2)),
          changePercent: Number((data.dp ?? 0).toFixed(2)),
          source: 'finnhub',
        };
      }
    } catch { /* silent */ }
  });

  await Promise.allSettled(fetches);
  return results;
}

// ─── Strategy 2: Sina Global Finance API ─────────────────────

async function fetchSinaGlobal(symbols: string[]): Promise<Record<string, any>> {
  const results: Record<string, any> = {};

  const mappings: { original: string; sina: string }[] = [];
  for (const sym of symbols) {
    const sinaKey = GLOBAL_SYMBOLS[sym]?.sinaSymbol;
    if (sinaKey) mappings.push({ original: sym, sina: sinaKey });
  }
  if (mappings.length === 0) return results;

  const sinaList = mappings.map(m => m.sina).join(",");
  const url = `https://hq.sinajs.cn/list=${sinaList}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://finance.sina.com.cn',
        'Accept-Charset': 'GBK',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return results;

    // Sina returns GBK-encoded text; decode via iconv
    const buf = Buffer.from(await res.arrayBuffer());
    const text = iconv.decode(buf, 'gbk');
    const lines = text.split('\n').filter(l => l.includes('='));

    for (const line of lines) {
      const match = line.match(/hq_str_(\w+)="(.+)"/);
      if (!match) continue;

      const sinaKey = match[1];
      const parts = match[2].split(',');
      const mapping = mappings.find(m => m.sina === sinaKey);
      if (!mapping) continue;

      let price = 0, change = 0, changePercent = 0;
      const scale = COMMODITY_SCALE[sinaKey] ?? 1;

      try {
        if (sinaKey.startsWith('int_')) {
          // "道琼斯,46247.29,299.97,0.65"
          price = parseFloat(parts[1]) || 0;
          change = parseFloat(parts[2]) || 0;
          changePercent = parseFloat(parts[3]) || 0;
        } else if (sinaKey.startsWith('hf_')) {
          // Futures: current price at [0], settle at [7], prev settle at [8]
          const raw = parseFloat(parts[0]) || 0;
          const prevSettle = parseFloat(parts[7]) || 0;
          price = raw * scale;
          const prevScaled = prevSettle * scale;
          change = prevScaled > 0 ? price - prevScaled : 0;
          changePercent = prevScaled > 0 ? (change / prevScaled) * 100 : 0;
        } else if (sinaKey.startsWith('fx_')) {
          // "time,current,bid,ask,..."
          price = parseFloat(parts[1]) || 0;
          const prevClose = parseFloat(parts[3]) || price;
          change = price - prevClose;
          changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
        } else if (sinaKey.startsWith('gb_')) {
          // Bond yields
          price = parseFloat(parts[1]) || 0;
          change = parseFloat(parts[2]) || 0;
          const prev = price - change;
          changePercent = prev > 0 ? (change / prev) * 100 : 0;
        }
      } catch { continue; }

      if (price > 0) {
        results[mapping.original] = {
          price: Number(price.toFixed(4)),
          change: Number(change.toFixed(4)),
          changePercent: Number(changePercent.toFixed(2)),
          source: 'sina',
        };
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
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data, {
        headers: { 'Cache-Control': 'public, max-age=60' },
      });
    }

    const symbols = Object.keys(GLOBAL_SYMBOLS);
    let quotes: Record<string, any> = {};

    // Strategy 1: Finnhub for US ETF proxies
    const finnhubQuotes = await fetchFinnhub(symbols);
    Object.assign(quotes, finnhubQuotes);

    // Strategy 2: Sina for everything else (or all if Finnhub unavailable)
    const missingSymbols = symbols.filter(s => !quotes[s]);
    const sinaQuotes = await fetchSinaGlobal(missingSymbols);
    Object.assign(quotes, sinaQuotes);

    const liveCount = Object.values(quotes).filter((q: any) =>
      q.source && q.source !== 'fallback' && q.source !== 'unavailable'
    ).length;

    const finnhubCount = Object.values(quotes).filter((q: any) => q.source === 'finnhub').length;
    const sinaCount = Object.values(quotes).filter((q: any) => q.source === 'sina').length;
    const primarySource = finnhubCount > 0 ? 'finnhub+sina' : sinaCount > 0 ? 'sina' : 'fallback';

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
