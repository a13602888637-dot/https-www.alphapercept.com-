import { NextRequest, NextResponse } from "next/server";
import { fetchMultipleStocks, MarketData } from "@/skills/data_crawler";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface AlphaSignal {
  symbol: string;
  name: string;
  currentPrice: number;
  changePercent: number;
  volumeRatio: number;
  reason: string;
}

interface AlphaFeedResponse {
  success: boolean;
  signals: AlphaSignal[];
  sentiment: {
    premiumRate: number;
    chainHeight: number;
    lockdown: boolean;
  };
}

const SCAN_STOCKS = [
  "600519", "000858", "600036", "601318", "300750",
  "002594", "300059", "600900", "601012", "000333",
  "002415", "600276", "601888", "601899", "000002",
  "600030", "002475", "300760", "688981", "601166",
  "000001", "600000", "601398", "600887", "000725",
  "002352", "300122", "300014", "002230", "600309",
];

/**
 * Fetch East Money limit-up board pool for a given date (YYYYMMDD).
 * Returns array of { symbol, name, limitUpDays, prevClose }.
 */
async function fetchZTPool(dateStr: string): Promise<
  Array<{ symbol: string; name: string; limitUpDays: number; prevClose: number }>
> {
  try {
    const url = `https://push2ex.eastmoney.com/getTopicZTPool?ut=7eea3edcaed734bea9cb99f94d71b093&dpt=wz.ztzt&Ession=&date=${dateStr}&_=${Date.now()}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Referer: "https://quote.eastmoney.com/",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];

    const json = await res.json();
    const pool = json?.data?.pool;
    if (!Array.isArray(pool) || pool.length === 0) return [];

    return pool.map((item: Record<string, unknown>) => ({
      symbol: String(item.c ?? ""),
      name: String(item.n ?? ""),
      limitUpDays: Number(item.days ?? 1),
      prevClose: Number(item.zbc ?? 0) / 1000, // East Money returns price * 1000
    }));
  } catch {
    return [];
  }
}

/**
 * Calculate sentiment from yesterday's limit-up stocks.
 */
async function calculateSentiment(): Promise<{
  premiumRate: number;
  chainHeight: number;
  lockdown: boolean;
}> {
  const defaults = { premiumRate: 0, chainHeight: 0, lockdown: false };

  try {
    // Get yesterday's date (trade date approximation — skip weekends)
    const now = new Date();
    const day = now.getDay();
    const daysBack = day === 1 ? 3 : day === 0 ? 2 : 1;
    const yesterday = new Date(now.getTime() - daysBack * 86400000);
    const dateStr = yesterday.toISOString().slice(0, 10).replace(/-/g, "");

    const ztStocks = await fetchZTPool(dateStr);
    if (ztStocks.length === 0) return defaults;

    // Calculate max chain height
    const chainHeight = Math.max(...ztStocks.map((s) => s.limitUpDays), 0);

    // Batch query today's open prices for these stocks
    const symbols = ztStocks.map((s) => s.symbol).slice(0, 30); // cap to 30
    const marketDataArr = await fetchMultipleStocks(symbols);

    const marketMap = new Map<string, MarketData>();
    for (const md of marketDataArr) {
      if (md) marketMap.set(md.symbol, md);
    }

    // Calculate premium rate
    const premiums: number[] = [];
    for (const zt of ztStocks) {
      const md = marketMap.get(zt.symbol);
      const openPrice = md?.openPrice;
      const prevClose = md?.prevClose ?? zt.prevClose;
      if (openPrice && prevClose && prevClose > 0) {
        premiums.push(((openPrice - prevClose) / prevClose) * 100);
      }
    }

    const premiumRate =
      premiums.length > 0
        ? Math.round((premiums.reduce((a, b) => a + b, 0) / premiums.length) * 100) / 100
        : 0;

    return {
      premiumRate,
      chainHeight,
      lockdown: premiumRate < 0,
    };
  } catch {
    return defaults;
  }
}

/**
 * Scan stocks and filter for alpha signals.
 */
async function scanSignals(): Promise<AlphaSignal[]> {
  try {
    const marketDataArr = await fetchMultipleStocks(SCAN_STOCKS);
    const signals: AlphaSignal[] = [];

    for (const md of marketDataArr) {
      if (!md || !md.currentPrice) continue;

      const changePercent = md.changePercent ?? 0;
      const volumeRatio = md.volumeRatio ?? 0;

      // Filter: changePercent >= 3% (candidates for board trading)
      if (changePercent < 3) continue;

      // Filter: not locked at limit-up (skip if already at 涨停)
      if (md.prevClose && md.prevClose > 0) {
        const limitUp = Math.round(md.prevClose * 1.1 * 100) / 100;
        if (md.currentPrice >= limitUp) continue;
      }

      // Classify signal strength
      const isHot = changePercent >= 8.5;
      const isWarm = changePercent >= 5;
      const tag = isHot ? "强势冲板" : isWarm ? "加速上攻" : "异动关注";
      const vrText = volumeRatio > 0 ? `量比${volumeRatio.toFixed(1)}，` : "";

      signals.push({
        symbol: md.symbol,
        name: md.name,
        currentPrice: md.currentPrice,
        changePercent: Math.round(changePercent * 100) / 100,
        volumeRatio: Math.round(volumeRatio * 100) / 100,
        reason: `${tag} — ${vrText}涨幅${changePercent.toFixed(1)}%`,
      });
    }

    // Sort by changePercent descending
    signals.sort((a, b) => b.changePercent - a.changePercent);

    return signals;
  } catch {
    return [];
  }
}

async function handleRequest(): Promise<NextResponse<AlphaFeedResponse>> {
  try {
    const [sentiment, signals] = await Promise.all([
      calculateSentiment(),
      scanSignals(),
    ]);

    const finalSignals = sentiment.lockdown ? [] : signals;

    return NextResponse.json({
      success: true,
      signals: finalSignals,
      sentiment,
    });
  } catch {
    return NextResponse.json({
      success: false,
      signals: [],
      sentiment: { premiumRate: 0, chainHeight: 0, lockdown: false },
    });
  }
}

export async function GET(req: NextRequest) {
  // CRON_SECRET auth: allow if not set (dev) or matches
  const { searchParams } = new URL(req.url);
  const cronSecret = searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && cronSecret !== expectedSecret) {
    // Also allow unauthenticated access (public market data)
    // Only block if CRON_SECRET is set AND a wrong secret is provided
    if (cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return handleRequest();
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cronSecret = searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && cronSecret !== expectedSecret) {
    if (cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return handleRequest();
}
