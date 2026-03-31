import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

// ═══════════════════════════════════════════════════════════
// 趋势跟踪引擎 (Trend-Following Engine)
//
// 四层过滤:
// 1. 宏观 Beta 校验 — 底层资产价格站在 MA20 上方且趋势向上
// 2. Stage 2 底座 — 价>MA150>MA200, MA50>MA150, MA150 拐头
// 3. VCP 收敛 — 10日振幅收窄 + 量能枯竭(<50日均量50%)
// 4. 右侧突破 — 涨幅>2% + 放量确认(量比>1.5)
//
// 风控: 止损=max(突破阳线最低, -5%), 止盈=跟踪MA20
// ═══════════════════════════════════════════════════════════

interface SectorConfig {
  name: string;
  macroSymbol: string | null; // stooq.com symbol
  macroName: string;
  boardQuery: string; // East Money board fs parameter
}

// 板块→宏观映射
const MACRO_SECTORS: SectorConfig[] = [
  { name: "黄金", macroSymbol: "gc.f", macroName: "COMEX黄金", boardQuery: "b:BK0493" },
  { name: "有色·铜", macroSymbol: "hg.f", macroName: "COMEX铜", boardQuery: "b:BK0478" },
  { name: "石油石化", macroSymbol: "cl.f", macroName: "WTI原油", boardQuery: "b:BK0698" },
  { name: "航运", macroSymbol: null, macroName: "BDI指数", boardQuery: "b:BK0549" },
  { name: "煤炭", macroSymbol: null, macroName: "动力煤", boardQuery: "b:BK0733" },
];

interface MacroResult {
  sector: string;
  macro: string;
  price: number | null;
  ma20: number | null;
  bullish: boolean;
  reason: string;
}

// ═══ 1. 宏观 Beta 校验 (stooq.com 历史数据) ═══

async function fetchMacroTrend(config: SectorConfig): Promise<MacroResult> {
  const { name, macroSymbol, macroName } = config;

  if (!macroSymbol) {
    return { sector: name, macro: macroName, price: null, ma20: null, bullish: true, reason: "无数据源,跳过校验" };
  }

  try {
    const now = new Date();
    const d2 = now.toISOString().slice(0, 10).replace(/-/g, "");
    const d1Date = new Date(now.getTime() - 60 * 86400000);
    const d1 = d1Date.toISOString().slice(0, 10).replace(/-/g, "");

    const url = `https://stooq.com/q/d/l/?s=${macroSymbol}&d1=${d1}&d2=${d2}&i=d`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return { sector: name, macro: macroName, price: null, ma20: null, bullish: true, reason: "API失败,跳过" };
    }

    const csv = await res.text();
    const lines = csv.trim().split("\n").filter(l => l.trim() && !l.startsWith("Date"));
    if (lines.length < 20) {
      return { sector: name, macro: macroName, price: null, ma20: null, bullish: true, reason: "数据不足" };
    }

    const closes: number[] = [];
    for (const line of lines) {
      const parts = line.split(",");
      if (parts.length >= 5) {
        const close = parseFloat(parts[4]);
        if (!isNaN(close) && close > 0) closes.push(close);
      }
    }

    if (closes.length < 20) {
      return { sector: name, macro: macroName, price: null, ma20: null, bullish: true, reason: "数据不足" };
    }

    const currentPrice = closes[closes.length - 1];
    const ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;

    // MA20 趋势判断: 当前MA20 vs 5天前的MA20
    let trendUp = true;
    if (closes.length >= 25) {
      const prev20 = closes.slice(-25, -5);
      if (prev20.length >= 20) {
        const ma20_5ago = prev20.slice(-20).reduce((a, b) => a + b, 0) / 20;
        trendUp = ma20 > ma20_5ago;
      }
    }

    const bullish = currentPrice > ma20 && trendUp;
    const reason = bullish
      ? `${currentPrice.toFixed(1)}>${ma20.toFixed(1)}(MA20) 多头✓`
      : currentPrice <= ma20
        ? `${currentPrice.toFixed(1)}<${ma20.toFixed(1)}(MA20) ✗否决`
        : `MA20趋势向下 ✗否决`;

    return { sector: name, macro: macroName, price: currentPrice, ma20, bullish, reason };
  } catch {
    return { sector: name, macro: macroName, price: null, ma20: null, bullish: true, reason: "获取异常,跳过" };
  }
}

// ═══ 获取板块成分股 (East Money) ═══

interface StockBasic {
  symbol: string;
  name: string;
  currentPrice: number;
  changePercent: number;
  volumeRatio: number;
  turnoverRate: number;
  circulatingMarketCap: number;
  amount: number;
  volume: number;
  highPrice: number;
  lowPrice: number;
  prevClose: number;
}

async function fetchSectorStocks(boardQuery: string, size: number = 50): Promise<StockBasic[]> {
  try {
    // 按流通市值降序,取机构级标的
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${size}&po=0&np=1&fltt=2&invt=2&fid=f21&fs=${boardQuery}&fields=f2,f3,f5,f6,f8,f10,f12,f14,f15,f16,f18,f21`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", Referer: "https://data.eastmoney.com/" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const diff = json?.data?.diff;
    if (!Array.isArray(diff)) return [];

    return diff
      .filter((item: Record<string, unknown>) => typeof item.f2 === "number" && item.f2 > 0)
      .map((item: Record<string, unknown>) => ({
        symbol: String(item.f12 ?? ""),
        name: String(item.f14 ?? ""),
        currentPrice: Number(item.f2 ?? 0),
        changePercent: Number(item.f3 ?? 0),
        volume: Number(item.f5 ?? 0),
        amount: Number(item.f6 ?? 0),
        turnoverRate: Number(item.f8 ?? 0),
        volumeRatio: Number(item.f10 === "-" ? 0 : (item.f10 ?? 0)),
        highPrice: Number(item.f15 ?? 0),
        lowPrice: Number(item.f16 ?? 0),
        prevClose: Number(item.f18 ?? 0),
        circulatingMarketCap: Number(item.f21 ?? 0),
      }))
      .filter((s: StockBasic) => {
        if (s.name.includes("ST") || s.name.includes("*ST") || s.name.includes("退")) return false;
        if (s.symbol.startsWith("920")) return false;
        return true;
      });
  } catch {
    return [];
  }
}

// ═══ K线数据 (250日) ═══

interface KlineBar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

async function fetchKline250(symbol: string): Promise<KlineBar[] | null> {
  try {
    const prefix = symbol.startsWith("6") || symbol.startsWith("9") ? "1" : "0";
    const secid = `${prefix}.${symbol}`;
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&klt=101&fqt=1&lmt=250&end=20500101&fields1=f1&fields2=f51,f52,f53,f54,f55,f56`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://quote.eastmoney.com/" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const klines = json?.data?.klines;
    if (!Array.isArray(klines) || klines.length < 50) return null;

    return klines.map((k: string) => {
      const [date, open, close, high, low, volume] = k.split(",");
      return { date, open: +open, close: +close, high: +high, low: +low, volume: +volume };
    });
  } catch {
    return null;
  }
}

// ═══ 2. Stage 2 底座判定 ═══

function calcSMA(values: number[], period: number): number {
  if (values.length < period) return 0;
  return values.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function analyzeStage2(klines: KlineBar[]): {
  pass: boolean;
  ma50: number;
  ma150: number;
  ma200: number;
  ma20: number;
  reason: string;
} {
  const closes = klines.map(k => k.close);
  const len = closes.length;

  if (len < 200) {
    return { pass: false, ma50: 0, ma150: 0, ma200: 0, ma20: 0, reason: "K线不足200日" };
  }

  const current = closes[len - 1];
  const ma20 = calcSMA(closes, 20);
  const ma50 = calcSMA(closes, 50);
  const ma150 = calcSMA(closes, 150);
  const ma200 = calcSMA(closes, 200);

  // 条件1: 价格 > MA150 且 价格 > MA200
  if (current <= ma150 || current <= ma200) {
    return { pass: false, ma50, ma150, ma200, ma20, reason: `价格未站上MA150/MA200` };
  }

  // 条件2: MA150 趋势向上(对比20日前)
  if (len >= 220) {
    const ma150_20ago = calcSMA(closes.slice(0, -20), 150);
    if (ma150_20ago > 0 && ma150 <= ma150_20ago) {
      return { pass: false, ma50, ma150, ma200, ma20, reason: "MA150未拐头向上" };
    }
  }

  // 条件3: MA50 > MA150
  if (ma50 <= ma150) {
    return { pass: false, ma50, ma150, ma200, ma20, reason: `MA50(${ma50.toFixed(2)})<MA150(${ma150.toFixed(2)})` };
  }

  return { pass: true, ma50, ma150, ma200, ma20, reason: "Stage2确认✓" };
}

// ═══ 3. VCP 波动率收敛 ═══

function analyzeVCP(klines: KlineBar[]): {
  detected: boolean;
  amplitudeContraction: boolean;
  volumeDryUp: boolean;
  avgAmplitude10d: number;
  volumeRatio50d: number;
  reason: string;
} {
  const len = klines.length;
  if (len < 50) {
    return { detected: false, amplitudeContraction: false, volumeDryUp: false, avgAmplitude10d: 0, volumeRatio50d: 0, reason: "数据不足" };
  }

  // 振幅收敛: 近10日平均日振幅 < 3%
  const recent10 = klines.slice(-10);
  const amplitudes = recent10.map(k => k.low > 0 ? ((k.high - k.low) / k.low) * 100 : 0);
  const avgAmplitude = amplitudes.reduce((a, b) => a + b, 0) / amplitudes.length;
  const amplitudeContraction = avgAmplitude < 3;

  // 量能枯竭: 近3日均量 < 50日均量 × 50%
  const volumes = klines.slice(-50).map(k => k.volume);
  const vol50avg = volumes.reduce((a, b) => a + b, 0) / 50;
  const recentVol = klines.slice(-3).map(k => k.volume);
  const avgRecentVol = recentVol.reduce((a, b) => a + b, 0) / recentVol.length;
  const volumeRatio = vol50avg > 0 ? avgRecentVol / vol50avg : 1;
  const volumeDryUp = volumeRatio < 0.5;

  const detected = amplitudeContraction && volumeDryUp;

  let reason: string;
  if (detected) {
    reason = `VCP✓ 振幅${avgAmplitude.toFixed(1)}%(<3%) 量缩${(volumeRatio * 100).toFixed(0)}%(<50%)`;
  } else {
    const parts: string[] = [];
    if (!amplitudeContraction) parts.push(`振幅${avgAmplitude.toFixed(1)}%`);
    if (!volumeDryUp) parts.push(`量比${(volumeRatio * 100).toFixed(0)}%`);
    reason = parts.join(" ");
  }

  return { detected, amplitudeContraction, volumeDryUp, avgAmplitude10d: avgAmplitude, volumeRatio50d: volumeRatio, reason };
}

// ═══ 4. 右侧突破确认 ═══

function checkBreakout(stock: StockBasic, klines: KlineBar[]): {
  confirmed: boolean;
  reason: string;
} {
  // 涨幅 > 2%
  if (stock.changePercent < 2) {
    return { confirmed: false, reason: `涨${stock.changePercent.toFixed(1)}%(需>2%)` };
  }

  // 放量确认: 量比>1.5 或 成交量>10日均量×150%
  let volumeOK = stock.volumeRatio >= 1.5;
  if (!volumeOK && klines.length >= 10) {
    const vol10avg = klines.slice(-11, -1).map(k => k.volume).reduce((a, b) => a + b, 0) / 10;
    const todayVol = klines[klines.length - 1].volume;
    volumeOK = vol10avg > 0 && todayVol > vol10avg * 1.5;
  }

  if (!volumeOK) {
    return { confirmed: false, reason: `量比${stock.volumeRatio.toFixed(1)}(需>1.5)` };
  }

  return { confirmed: true, reason: `放量突破 涨${stock.changePercent.toFixed(1)}% 量比${stock.volumeRatio.toFixed(1)}✓` };
}

// ═══ GET Handler ═══

export async function GET() {
  try {
    // Step 1: 宏观 Beta 校验 (并行)
    const macroResults = await Promise.allSettled(
      MACRO_SECTORS.map(s => fetchMacroTrend(s))
    );

    const macroStatus: MacroResult[] = macroResults.map((r, i) =>
      r.status === "fulfilled" ? r.value : {
        sector: MACRO_SECTORS[i].name,
        macro: MACRO_SECTORS[i].macroName,
        price: null, ma20: null, bullish: true,
        reason: "获取失败",
      }
    );

    // Step 2: 仅对宏观多头的板块拉股票 (并行)
    const bullishSectors = MACRO_SECTORS.filter((_, i) => macroStatus[i].bullish);

    const sectorStocksResults = await Promise.allSettled(
      bullishSectors.map(s => fetchSectorStocks(s.boardQuery, 30))
    );

    // Step 3: 快筛候选 (正涨幅, 准备拉K线)
    const candidates: Array<{ stock: StockBasic; sectorName: string; macroInfo: string }> = [];

    for (let i = 0; i < bullishSectors.length; i++) {
      const result = sectorStocksResults[i];
      const stocks = result.status === "fulfilled" ? result.value : [];
      const sectorIdx = MACRO_SECTORS.indexOf(bullishSectors[i]);
      const macroInfo = macroStatus[sectorIdx].reason;

      // 正涨幅 + 市值>50亿, 限15只/板块
      const filtered = stocks
        .filter((s: StockBasic) => s.currentPrice > 0 && s.changePercent > 0 && s.circulatingMarketCap / 1e8 > 50)
        .slice(0, 15);

      for (const stock of filtered) {
        candidates.push({ stock, sectorName: bullishSectors[i].name, macroInfo });
      }
    }

    // Step 4: 拉250日K线 + 四层分析 (并行)
    const klineResults = await Promise.allSettled(
      candidates.map(c => fetchKline250(c.stock.symbol))
    );

    // Step 5: 组装信号
    const signals: Array<{
      symbol: string; name: string; currentPrice: number; changePercent: number;
      volumeRatio: number; turnoverRate: number; circulatingMarketCap: number;
      reason: string; signalTag: string; signalScore: number;
      sector: string; macroStatus: string;
      stage2: boolean; vcpDetected: boolean; breakoutConfirmed: boolean;
      advice: {
        suggestedPosition: number; stopLoss: number;
        trailingStopMA20: number; strategyLabel: string;
        takeProfitStrategy: string; positionSource: "fixed";
      };
    }> = [];

    for (let i = 0; i < candidates.length; i++) {
      const { stock, sectorName, macroInfo } = candidates[i];
      const kResult = klineResults[i];
      const klines = kResult.status === "fulfilled" ? kResult.value : null;

      if (!klines || klines.length < 200) continue;

      // Stage 2
      const stage2 = analyzeStage2(klines);
      if (!stage2.pass) continue;

      // VCP
      const vcp = analyzeVCP(klines);

      // 突破确认
      const breakout = checkBreakout(stock, klines);

      // 评分
      let score = 30; // Stage 2 base
      if (vcp.detected) score += 30;
      if (breakout.confirmed) score += 25;
      score += Math.min(15, stock.changePercent * 3);
      score = Math.round(Math.min(100, score));

      // 信号标签
      let signalTag: string;
      if (stage2.pass && vcp.detected && breakout.confirmed) {
        signalTag = "趋势突破";
      } else if (stage2.pass && vcp.detected) {
        signalTag = "VCP收敛";
      } else if (stage2.pass && breakout.confirmed) {
        signalTag = "放量异动";
      } else {
        signalTag = "Stage2观察";
      }

      // 风控
      const breakoutLow = klines[klines.length - 1].low;
      const fivePercentStop = stock.currentPrice * 0.95;
      const stopLoss = Math.round(Math.max(breakoutLow, fivePercentStop) * 100) / 100;
      const trailingStopMA20 = Math.round(stage2.ma20 * 100) / 100;

      const capYi = stock.circulatingMarketCap / 1e8;

      // 组装 reason
      const parts: string[] = [];
      parts.push(`🏔️${sectorName}`);
      parts.push(macroInfo);
      parts.push(stage2.reason);
      if (vcp.detected) parts.push(vcp.reason);
      if (breakout.confirmed) parts.push(breakout.reason);
      else parts.push(breakout.reason);
      parts.push(`市值${capYi.toFixed(0)}亿`);

      const position = signalTag === "趋势突破" ? 10 : signalTag === "VCP收敛" ? 8 : signalTag === "放量异动" ? 6 : 3;

      signals.push({
        symbol: stock.symbol,
        name: stock.name,
        currentPrice: stock.currentPrice,
        changePercent: stock.changePercent,
        volumeRatio: stock.volumeRatio,
        turnoverRate: stock.turnoverRate,
        circulatingMarketCap: Math.round(capYi * 10) / 10,
        reason: parts.join(" | "),
        signalTag,
        signalScore: score,
        sector: sectorName,
        macroStatus: macroInfo,
        stage2: stage2.pass,
        vcpDetected: vcp.detected,
        breakoutConfirmed: breakout.confirmed,
        advice: {
          suggestedPosition: position,
          stopLoss,
          trailingStopMA20,
          strategyLabel: signalTag,
          takeProfitStrategy: `跟踪MA20(¥${trailingStopMA20})止盈 | 止损¥${stopLoss} | 收盘跌破MA20且次日不收回→清仓`,
          positionSource: "fixed",
        },
      });
    }

    // 排序
    const tagPriority: Record<string, number> = {
      "趋势突破": 0, "VCP收敛": 1, "放量异动": 2, "Stage2观察": 3,
    };
    signals.sort((a, b) => {
      const pa = tagPriority[a.signalTag] ?? 4;
      const pb = tagPriority[b.signalTag] ?? 4;
      if (pa !== pb) return pa - pb;
      return b.signalScore - a.signalScore;
    });

    const finalSignals = signals.slice(0, 20);
    const now = new Date();
    const screenTime = now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

    const isOffHours = candidates.length > 0 &&
      candidates.filter(c => c.stock.changePercent !== 0).length < 3;

    const result = {
      success: true,
      signals: finalSignals,
      screenTime,
      totalScanned: candidates.length,
      macroStatus,
      sectorStats: bullishSectors.map((s, i) => ({
        name: s.name,
        stocksFound: sectorStocksResults[i].status === "fulfilled" ? sectorStocksResults[i].value.length : 0,
      })),
      conditions: [
        "宏观Beta: 商品价>MA20且趋势向上",
        "Stage2: 价>MA150>MA200, MA50>MA150, MA150拐头",
        "VCP: 10日振幅<3% + 量缩<50日均量50%",
        "突破: 涨>2% + 量比>1.5",
        "止损: max(阳线最低, -5%)",
        "止盈: 跟踪MA20,跌破→清仓",
      ],
    };

    // 缓存
    if (!isOffHours && finalSignals.length > 0) {
      const tradeDate = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
      try {
        await prisma.screenCache.upsert({
          where: { id: "latest_trend" },
          update: { data: result as unknown as Record<string, unknown>, tradeDate },
          create: { id: "latest_trend", data: result as unknown as Record<string, unknown>, tradeDate },
        });
      } catch { /* ignore */ }
    }

    // 无信号时读缓存
    if (finalSignals.length === 0) {
      try {
        const cached = await prisma.screenCache.findUnique({ where: { id: "latest_trend" } });
        if (cached?.data) {
          const cachedData = cached.data as unknown as typeof result;
          return NextResponse.json({ ...cachedData, screenTime: `${cached.tradeDate} 缓存 (最近交易日)` });
        }
      } catch { /* ignore */ }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Trend API error:", error);

    try {
      const cached = await prisma.screenCache.findUnique({ where: { id: "latest_trend" } });
      if (cached?.data) {
        return NextResponse.json({ ...(cached.data as object), screenTime: "缓存 (API错误)" });
      }
    } catch { /* ignore */ }

    return NextResponse.json({
      success: false, signals: [], screenTime: "", totalScanned: 0,
      macroStatus: [], conditions: [], sectorStats: [],
    });
  }
}
