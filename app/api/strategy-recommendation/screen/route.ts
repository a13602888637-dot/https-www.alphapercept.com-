import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface ScreenResult {
  symbol: string;
  name: string;
  currentPrice: number;
  changePercent: number;
  volumeRatio: number;
  turnoverRate: number;
  circulatingMarketCap: number; // 亿元
  openPrice: number;
  prevClose: number;
  highPrice: number;
  lowPrice: number;
  amount: number; // 成交额
  reason: string;
  riskTag?: string; // "高风险追板" | "大盘股" | null
}

interface ScreenResponse {
  success: boolean;
  signals: ScreenResult[];
  screenTime: string;
  totalScanned: number;
  conditions: string[];
}

/**
 * East Money stock list API - fetch A-share stocks sorted by changePercent desc.
 * Returns up to `size` stocks with: price, change%, volume ratio, turnover rate, market cap, etc.
 */
async function fetchEastMoneyStockList(page: number, size: number): Promise<{
  total: number;
  stocks: Array<{
    symbol: string;
    name: string;
    currentPrice: number;
    changePercent: number;
    volumeRatio: number;
    turnoverRate: number;
    amplitude: number;
    pe: number;
    openPrice: number;
    prevClose: number;
    highPrice: number;
    lowPrice: number;
    totalMarketCap: number;
    circulatingMarketCap: number;
    amount: number;
    volume: number;
  }>;
}> {
  // fs= market filters: m:0+t:6 (深圳主板), m:0+t:80 (创业板), m:1+t:2 (上海主板), m:1+t:23 (科创板), m:0+t:81+s:2048 (深圳中小板)
  const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=${page}&pz=${size}&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048&fields=f2,f3,f5,f6,f7,f8,f9,f10,f12,f14,f15,f16,f17,f18,f20,f21`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Referer: "https://data.eastmoney.com/",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return { total: 0, stocks: [] };

  const json = await res.json();
  const diff = json?.data?.diff;
  const total = json?.data?.total ?? 0;

  if (!Array.isArray(diff)) return { total: 0, stocks: [] };

  const stocks = diff
    .filter((item: Record<string, unknown>) => item.f2 !== "-" && typeof item.f2 === "number")
    .map((item: Record<string, unknown>) => ({
      symbol: String(item.f12 ?? ""),
      name: String(item.f14 ?? ""),
      currentPrice: Number(item.f2 ?? 0),
      changePercent: Number(item.f3 ?? 0),
      volume: Number(item.f5 ?? 0),
      amount: Number(item.f6 ?? 0),
      amplitude: Number(item.f7 ?? 0),
      turnoverRate: Number(item.f8 ?? 0),
      pe: Number(item.f9 ?? 0),
      volumeRatio: Number(item.f10 === "-" ? 0 : (item.f10 ?? 0)),
      openPrice: Number(item.f17 ?? 0),
      prevClose: Number(item.f18 ?? 0),
      highPrice: Number(item.f15 ?? 0),
      lowPrice: Number(item.f16 ?? 0),
      totalMarketCap: Number(item.f20 ?? 0),
      circulatingMarketCap: Number(item.f21 ?? 0),
    }));

  return { total, stocks };
}

/**
 * Fetch K-line data from East Money to calculate MA5/MA10/MA20
 */
async function fetchMA(symbol: string): Promise<{ ma5: number; ma10: number; ma20: number } | null> {
  try {
    // Determine secid: 1.6xxxxx for Shanghai, 0.0xxxxx/0.3xxxxx for Shenzhen
    const prefix = symbol.startsWith("6") || symbol.startsWith("9") ? "1" : "0";
    const secid = `${prefix}.${symbol}`;

    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&klt=101&fqt=1&lmt=20&end=20500101&fields1=f1&fields2=f51,f52,f53,f54,f55,f56`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://quote.eastmoney.com/",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const json = await res.json();
    const klines = json?.data?.klines;
    if (!Array.isArray(klines) || klines.length < 5) return null;

    // kline format: "date,open,close,high,low,volume"
    const closes = klines.map((k: string) => {
      const parts = k.split(",");
      return Number(parts[2] ?? 0);
    });

    const len = closes.length;
    const ma5 = len >= 5 ? closes.slice(len - 5).reduce((a: number, b: number) => a + b, 0) / 5 : 0;
    const ma10 = len >= 10 ? closes.slice(len - 10).reduce((a: number, b: number) => a + b, 0) / 10 : 0;
    const ma20 = len >= 20 ? closes.slice(len - 20).reduce((a: number, b: number) => a + b, 0) / 20 : 0;

    return { ma5, ma10, ma20 };
  } catch {
    return null;
  }
}

/**
 * Screen stocks based on the THS-style conditions:
 * 1. changePercent > 3%
 * 2. circulatingMarketCap > 50亿
 * 3. price > MA5, MA10, MA20 (多头排列)
 * 4. price > VWAP (estimated from amount/volume)
 * 5. volumeRatio > 1.5
 * 6. turnoverRate > 5% and < 10%
 * 7. Exclude ST stocks
 */
export async function GET() {
  try {
    // Step 1: Fetch top gainers from East Money (sorted by changePercent desc)
    // Get first 200 stocks with positive change to have a good candidate pool
    const { stocks, total } = await fetchEastMoneyStockList(1, 200);

    // Step 2: Apply basic filters (server-side)
    const candidates = stocks.filter((s) => {
      // Exclude ST stocks
      if (s.name.includes("ST") || s.name.includes("*ST") || s.name.includes("退")) return false;
      // Exclude new stocks (code starting with 920 etc.)
      if (s.symbol.startsWith("920")) return false;
      // changePercent > 3%
      if (s.changePercent < 3) return false;
      // circulatingMarketCap > 50亿 (API returns in yuan)
      const capInYi = s.circulatingMarketCap / 1e8;
      if (capInYi < 50) return false;
      // volumeRatio > 1.5
      if (s.volumeRatio < 1.5) return false;
      // turnoverRate > 5% and < 10%
      if (s.turnoverRate < 5 || s.turnoverRate > 10) return false;

      return true;
    });

    // Step 3: Check MA conditions for remaining candidates (batch, max 30)
    const toCheck = candidates.slice(0, 30);
    const maResults = await Promise.allSettled(
      toCheck.map((s) => fetchMA(s.symbol))
    );

    const signals: ScreenResult[] = [];

    for (let i = 0; i < toCheck.length; i++) {
      const stock = toCheck[i];
      const maResult = maResults[i];
      const ma = maResult.status === "fulfilled" ? maResult.value : null;

      // MA check: price must be above all 3 MAs (if available)
      if (ma) {
        if (ma.ma5 > 0 && stock.currentPrice <= ma.ma5) continue;
        if (ma.ma10 > 0 && stock.currentPrice <= ma.ma10) continue;
        if (ma.ma20 > 0 && stock.currentPrice <= ma.ma20) continue;
      }

      // VWAP check: estimate VWAP = amount / volume / 100 (volume in lots of 100)
      if (stock.volume > 0 && stock.amount > 0) {
        const vwap = stock.amount / (stock.volume * 100);
        if (stock.currentPrice <= vwap) continue;
      }

      // Anti-trap: 尾盘诱多检测
      // 特征1: 开盘弱势但收盘强势 — (收盘涨幅 - 开盘涨幅) > 整体涨幅的60%
      // 特征2: 最高价接近现价(尾盘拉升) + 最低价远低于开盘(盘中杀跌)
      // 特征3: 振幅过大(>涨幅的2倍) — 盘中大幅震荡后尾盘拉起
      let isTrap = false;
      let trapReason = "";
      if (stock.prevClose > 0 && stock.openPrice > 0) {
        const openChangePercent = ((stock.openPrice - stock.prevClose) / stock.prevClose) * 100;
        const lateGain = stock.changePercent - openChangePercent;
        // 尾盘拉升贡献超过涨幅的60%，且开盘涨幅不到1%
        if (lateGain > stock.changePercent * 0.6 && openChangePercent < 1) {
          isTrap = true;
          trapReason = `开盘仅涨${openChangePercent.toFixed(1)}%，尾盘贡献${lateGain.toFixed(1)}%`;
        }
        // 振幅超过涨幅的2.5倍 — 盘中剧烈震荡
        if (stock.amplitude > stock.changePercent * 2.5 && stock.amplitude > 5) {
          isTrap = true;
          trapReason = `振幅${stock.amplitude.toFixed(1)}%异常(涨幅仅${stock.changePercent.toFixed(1)}%)`;
        }
        // 最低价跌破昨收 — 盘中一度为负
        if (stock.lowPrice < stock.prevClose && stock.changePercent > 3) {
          isTrap = true;
          trapReason = `盘中跌破昨收${stock.prevClose.toFixed(2)}，尾盘强拉`;
        }
      }

      // Skip trapped stocks or mark them
      if (isTrap) {
        // Don't skip — show with warning so user is informed
      }

      const capInYi = stock.circulatingMarketCap / 1e8;

      // Risk tagging
      let riskTag: string | undefined;
      if (isTrap) riskTag = "疑似诱多";
      else if (stock.changePercent >= 8) riskTag = "高风险追板";
      else if (capInYi >= 500) riskTag = "大盘股";

      // Build reason
      const parts: string[] = [];
      if (isTrap) parts.push(`⚠️ ${trapReason}`);
      parts.push(`涨${stock.changePercent.toFixed(1)}%`);
      if (stock.volumeRatio > 0) parts.push(`量比${stock.volumeRatio.toFixed(1)}`);
      parts.push(`换手${stock.turnoverRate.toFixed(1)}%`);
      parts.push(`流通${capInYi.toFixed(0)}亿`);
      if (ma) parts.push("多头排列");
      if (!isTrap) parts.push("价>均价");

      signals.push({
        symbol: stock.symbol,
        name: stock.name,
        currentPrice: stock.currentPrice,
        changePercent: Math.round(stock.changePercent * 100) / 100,
        volumeRatio: Math.round(stock.volumeRatio * 100) / 100,
        turnoverRate: Math.round(stock.turnoverRate * 100) / 100,
        circulatingMarketCap: Math.round(capInYi * 10) / 10,
        openPrice: stock.openPrice,
        prevClose: stock.prevClose,
        highPrice: stock.highPrice,
        lowPrice: stock.lowPrice,
        amount: stock.amount,
        reason: parts.join("，"),
        riskTag,
      });
    }

    // Sort: non-trap first, then by changePercent descending; trap stocks at the end
    signals.sort((a, b) => {
      const aTrap = a.riskTag === "疑似诱多" ? 1 : 0;
      const bTrap = b.riskTag === "疑似诱多" ? 1 : 0;
      if (aTrap !== bTrap) return aTrap - bTrap;
      return b.changePercent - a.changePercent;
    });

    const conditions = [
      "涨跌幅>3%",
      "流通市值>50亿",
      "量比>1.5",
      "换手率5%~10%",
      "收盘价>MA5/MA10/MA20",
      "收盘价>均价(VWAP)",
      "排除ST/退市",
      "尾盘诱多检测",
    ];

    return NextResponse.json({
      success: true,
      signals: signals.slice(0, 20),
      screenTime: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
      totalScanned: total,
      conditions,
    } satisfies ScreenResponse);
  } catch (error) {
    console.error("Screen API error:", error);
    return NextResponse.json({
      success: false,
      signals: [],
      screenTime: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
      totalScanned: 0,
      conditions: [],
    });
  }
}
