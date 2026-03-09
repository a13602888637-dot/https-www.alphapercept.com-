import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const GLOBAL_SYMBOLS: Record<string, { name: string; category: string; region: string }> = {
  "^DJI": { name: "道琼斯", category: "index", region: "us" },
  "^IXIC": { name: "纳斯达克", category: "index", region: "us" },
  "^GSPC": { name: "标普500", category: "index", region: "us" },
  "^HSI": { name: "恒生指数", category: "index", region: "hk" },
  "^N225": { name: "日经225", category: "index", region: "jp" },
  "GC=F": { name: "黄金", category: "commodity", region: "global" },
  "CL=F": { name: "原油", category: "commodity", region: "global" },
  "SI=F": { name: "白银", category: "commodity", region: "global" },
  "^VIX": { name: "VIX恐慌", category: "rate", region: "us" },
  "^TNX": { name: "美10Y国债", category: "rate", region: "us" },
  "USDCNY=X": { name: "美元/人民币", category: "fx", region: "global" },
};

const STATIC_FALLBACK: Record<string, { price: number; change: number; changePercent: number }> = {
  "^DJI": { price: 43200.00, change: 150.00, changePercent: 0.35 },
  "^IXIC": { price: 18500.00, change: 80.00, changePercent: 0.43 },
  "^GSPC": { price: 5850.00, change: 20.00, changePercent: 0.34 },
  "^HSI": { price: 22800.00, change: -120.00, changePercent: -0.52 },
  "^N225": { price: 38500.00, change: 200.00, changePercent: 0.52 },
  "GC=F": { price: 2950.00, change: 15.00, changePercent: 0.51 },
  "CL=F": { price: 72.50, change: -0.80, changePercent: -1.09 },
  "SI=F": { price: 33.20, change: 0.30, changePercent: 0.91 },
  "^VIX": { price: 15.80, change: -0.50, changePercent: -3.07 },
  "^TNX": { price: 4.25, change: 0.02, changePercent: 0.47 },
  "USDCNY=X": { price: 7.24, change: 0.01, changePercent: 0.14 },
};

let cache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000;

async function fetchYahooQuotes(symbols: string[]): Promise<Record<string, any>> {
  const results: Record<string, any> = {};

  const fetches = symbols.map(async (symbol) => {
    try {
      const apiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const result = data.chart?.result?.[0];
      if (!result) throw new Error('No data');

      const meta = result.meta;
      const price = meta.regularMarketPrice || 0;
      const prevClose = meta.chartPreviousClose || meta.previousClose || price;
      const change = price - prevClose;
      const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

      results[symbol] = {
        price: Number(price.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        source: 'yahoo',
      };
    } catch {
      const fallback = STATIC_FALLBACK[symbol];
      if (fallback) {
        results[symbol] = { ...fallback, source: 'fallback' };
      }
    }
  });

  await Promise.allSettled(fetches);
  return results;
}

export async function GET() {
  try {
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data, {
        headers: { 'Cache-Control': 'public, max-age=60' },
      });
    }

    const symbols = Object.keys(GLOBAL_SYMBOLS);
    const quotes = await fetchYahooQuotes(symbols);

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
      timestamp: new Date().toISOString(),
      fallback: true,
    });
  }
}
