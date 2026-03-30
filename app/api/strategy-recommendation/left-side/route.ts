import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { RSI, MACD } from "technicalindicators";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface LeftSideSignal {
  symbol: string;
  name: string;
  currentPrice: number;
  changePercent: number;
  pe: number;
  pb: number;
  circulatingMarketCap: number; // 亿
  volumeRatio: number;
  turnoverRate: number;
  reason: string;
  signalTag: string;  // "反转萌芽" | "价值洼地" | "观察等待"
  signalScore: number;
  layer1Pass: boolean;
  layer2Pass: boolean;
  layer3Pass: boolean;
  indicators: {
    rsi14?: number;
    macdHistogram?: number;
    bias250?: number;
    volumeDryUp?: boolean;
    volumeRecovery?: boolean;
    rsiTurning?: boolean;
    aboveMa5?: boolean;
  };
  advice: {
    suggestedPosition: number;
    stopLoss: number;
    drawdownExit: number;
    strategyLabel: string;
    takeProfitStrategy: string;
    positionSource: "fixed";
  };
}

/**
 * 东方财富批量API: 按PE升序(低估值优先)获取A股
 * 新增 f23(PB) 字段
 */
async function fetchLowPEStocks(size: number): Promise<Array<{
  symbol: string; name: string; currentPrice: number; changePercent: number;
  pe: number; pb: number; volumeRatio: number; turnoverRate: number;
  amplitude: number; openPrice: number; prevClose: number;
  highPrice: number; lowPrice: number; circulatingMarketCap: number;
  volume: number; amount: number;
}>> {
  // 按PE升序排列(fid=f9), 只取PE>0的(排除亏损)
  const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${size}&po=0&np=1&fltt=2&invt=2&fid=f9&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048&fields=f2,f3,f5,f6,f7,f8,f9,f10,f12,f14,f15,f16,f17,f18,f20,f21,f23`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://data.eastmoney.com/",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];
    const json = await res.json();
    const diff = json?.data?.diff;
    if (!Array.isArray(diff)) return [];

    return diff
      .filter((item: Record<string, unknown>) =>
        typeof item.f2 === "number" && item.f2 > 0 &&
        typeof item.f9 === "number" && item.f9 > 0
      )
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
        circulatingMarketCap: Number(item.f21 ?? 0),
        pb: Number(item.f23 === "-" ? 999 : (item.f23 ?? 999)),
      }));
  } catch {
    return [];
  }
}

/**
 * 获取K线数据用于技术指标计算
 */
async function fetchKlineData(symbol: string, limit: number): Promise<Array<{
  date: string; open: number; close: number; high: number; low: number; volume: number;
}> | null> {
  try {
    const prefix = symbol.startsWith("6") || symbol.startsWith("9") ? "1" : "0";
    const secid = `${prefix}.${symbol}`;
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&klt=101&fqt=1&lmt=${limit}&end=20500101&fields1=f1&fields2=f51,f52,f53,f54,f55,f56`;

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://quote.eastmoney.com/" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const json = await res.json();
    const klines = json?.data?.klines;
    if (!Array.isArray(klines) || klines.length < 20) return null;

    return klines.map((k: string) => {
      const [date, open, close, high, low, volume] = k.split(",");
      return {
        date, open: Number(open), close: Number(close),
        high: Number(high), low: Number(low), volume: Number(volume),
      };
    });
  } catch {
    return null;
  }
}

/**
 * Layer 2+3: 技术面超卖检测 + 反转触发
 */
function analyzeLeftSide(klines: Array<{
  date: string; open: number; close: number; high: number; low: number; volume: number;
}>): {
  layer2Pass: boolean;
  layer3Pass: boolean;
  score: number;
  indicators: LeftSideSignal["indicators"];
} {
  const closes = klines.map((k) => k.close);
  const volumes = klines.map((k) => k.volume);
  const len = closes.length;

  const indicators: LeftSideSignal["indicators"] = {};
  let layer2Score = 0;
  let layer3Score = 0;

  // ─── Layer 2a: 地量检测 ───
  // 20日均量 < 120日均量 × 40%
  if (len >= 120) {
    const vol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const vol120 = volumes.slice(-120).reduce((a, b) => a + b, 0) / 120;
    indicators.volumeDryUp = vol120 > 0 && vol20 < vol120 * 0.4;
    if (indicators.volumeDryUp) layer2Score += 25;
  } else if (len >= 20) {
    const vol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const volAll = volumes.reduce((a, b) => a + b, 0) / len;
    indicators.volumeDryUp = volAll > 0 && vol20 < volAll * 0.4;
    if (indicators.volumeDryUp) layer2Score += 20;
  }

  // ─── Layer 2b: RSI超卖 ───
  try {
    const rsiValues = RSI.calculate({ values: closes, period: 14 });
    if (rsiValues.length > 0) {
      indicators.rsi14 = Math.round(rsiValues[rsiValues.length - 1] * 10) / 10;
      if (indicators.rsi14 < 30) layer2Score += 30;
      else if (indicators.rsi14 < 40) layer2Score += 15;

      // Layer 3a: RSI拐头（连续2日上升且从<30区域）
      if (rsiValues.length >= 3) {
        const r1 = rsiValues[rsiValues.length - 3];
        const r2 = rsiValues[rsiValues.length - 2];
        const r3 = rsiValues[rsiValues.length - 1];
        indicators.rsiTurning = r1 < 35 && r2 > r1 && r3 > r2;
        if (indicators.rsiTurning) layer3Score += 35;
      }
    }
  } catch {
    // technicalindicators may throw on insufficient data
  }

  // ─── Layer 2c: 均线乖离率(BIAS) ───
  // 价格偏离250日均线 > -20%
  if (len >= 200) {
    const ma250Count = Math.min(250, len);
    const ma250 = closes.slice(-ma250Count).reduce((a, b) => a + b, 0) / ma250Count;
    if (ma250 > 0) {
      const bias = ((closes[len - 1] - ma250) / ma250) * 100;
      indicators.bias250 = Math.round(bias * 10) / 10;
      if (bias < -20) layer2Score += 25;
      else if (bias < -10) layer2Score += 10;
    }
  }

  // ─── Layer 2d: MACD底背离 ───
  try {
    const macdResult = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    if (macdResult.length >= 5) {
      const recent = macdResult.slice(-5);
      const hist = recent.map((m) => m.histogram ?? 0);
      indicators.macdHistogram = Math.round((hist[hist.length - 1]) * 1000) / 1000;

      // 底背离: 价格走低但MACD柱状体在收窄
      const priceDown = closes[len - 1] < closes[len - 5];
      const macdNarrowing = hist[hist.length - 1] > hist[0] && hist[0] < 0;
      if (priceDown && macdNarrowing) layer2Score += 20;
    }
  } catch {
    // MACD calculation may fail
  }

  // ─── Layer 3b: 成交量回暖 ───
  if (len >= 10) {
    const vol5 = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const vol10 = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
    indicators.volumeRecovery = vol10 > 0 && vol5 > vol10 * 1.0;
    if (indicators.volumeRecovery && indicators.volumeDryUp) layer3Score += 30; // 从地量回暖才有意义
  }

  // ─── Layer 3c: 站上5日均线 ───
  if (len >= 5) {
    const ma5 = closes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    indicators.aboveMa5 = closes[len - 1] > ma5;
    if (indicators.aboveMa5) layer3Score += 35;
  }

  const layer2Pass = layer2Score >= 50; // 至少2项超卖指标确认
  const layer3Pass = layer3Score >= 60; // 至少2项反转信号确认

  return {
    layer2Pass,
    layer3Pass,
    score: layer2Score + layer3Score,
    indicators,
  };
}

/**
 * GET: 左侧交易信号扫描
 */
export async function GET() {
  try {
    // Layer 1: 价值底座 — 批量获取低PE股票（500只确保覆盖PE 5~25区间）
    const allStocks = await fetchLowPEStocks(500);

    const isOffHours = allStocks.filter((s) => s.currentPrice > 0 && s.changePercent !== 0).length < 10;

    // 基础排除（ST/920/无价格）
    const baseFiltered = allStocks.filter((s) => {
      if (s.name.includes("ST") || s.name.includes("*ST") || s.name.includes("退")) return false;
      if (s.symbol.startsWith("920")) return false;
      if (s.currentPrice <= 0) return false;
      return true;
    });

    // 严格过滤
    let layer1Candidates = baseFiltered.filter((s) => {
      if (s.pe < 5 || s.pe > 25) return false;
      if (s.pb >= 3.0 || s.pb <= 0) return false;
      const capYi = s.circulatingMarketCap / 1e8;
      if (capYi < 100) return false;
      return true;
    });

    // 如果严格过滤后为空（非交易时段数据不完整或PE分布偏移），降级到宽松条件
    let relaxed = false;
    if (layer1Candidates.length === 0) {
      relaxed = true;
      layer1Candidates = baseFiltered.filter((s) => {
        if (s.pe < 3 || s.pe > 40) return false;
        // PB=999 说明数据缺失("-")，允许通过
        if (s.pb !== 999 && (s.pb >= 5.0 || s.pb <= 0)) return false;
        const capYi = s.circulatingMarketCap / 1e8;
        if (capYi < 50) return false;
        return true;
      });
    }

    // 按PE升序取前20只做深度分析
    const toAnalyze = layer1Candidates.slice(0, 20);

    // Layer 2+3: 并发获取K线 + 技术分析
    const klineResults = await Promise.allSettled(
      toAnalyze.map((s) => fetchKlineData(s.symbol, 250))
    );

    const signals: LeftSideSignal[] = [];

    for (let i = 0; i < toAnalyze.length; i++) {
      const stock = toAnalyze[i];
      const klineResult = klineResults[i];
      const klines = klineResult.status === "fulfilled" ? klineResult.value : null;

      let layer2Pass = false;
      let layer3Pass = false;
      let techScore = 0;
      let indicators: LeftSideSignal["indicators"] = {};

      if (klines && klines.length >= 20) {
        const analysis = analyzeLeftSide(klines);
        layer2Pass = analysis.layer2Pass;
        layer3Pass = analysis.layer3Pass;
        techScore = analysis.score;
        indicators = analysis.indicators;
      }

      // 信号标签
      let signalTag: string;
      if (layer2Pass && layer3Pass) {
        signalTag = "反转萌芽";
      } else if (layer2Pass) {
        signalTag = "价值洼地";
      } else {
        signalTag = "观察等待";
      }

      // 综合评分 (0-100)
      const capYi = stock.circulatingMarketCap / 1e8;
      let totalScore = 0;
      // 价值分 (0-30): PE越低越好
      totalScore += Math.max(0, 30 - (stock.pe - 5));
      // PB分 (0-20): PB越低越好
      totalScore += Math.max(0, (3 - stock.pb) * 7);
      // 技术分 (0-50)
      totalScore += Math.min(50, techScore / 2);
      totalScore = Math.round(Math.min(100, totalScore));

      // 仓位建议
      const positionMap: Record<string, number> = {
        "反转萌芽": 8, "价值洼地": 5, "观察等待": 0,
      };

      const parts: string[] = [];
      if (signalTag === "反转萌芽") parts.push("🌱 超卖反转信号已触发");
      else if (signalTag === "价值洼地") parts.push("💎 深度超卖但尚未反转");
      else parts.push("👁 估值合理待技术面确认");
      parts.push(`PE${stock.pe.toFixed(1)}`);
      parts.push(`PB${stock.pb.toFixed(2)}`);
      parts.push(`市值${capYi.toFixed(0)}亿`);
      if (indicators.rsi14 != null) parts.push(`RSI${indicators.rsi14}`);
      if (indicators.bias250 != null) parts.push(`乖离${indicators.bias250}%`);
      if (indicators.volumeDryUp) parts.push("地量");
      if (indicators.rsiTurning) parts.push("RSI拐头");
      if (indicators.volumeRecovery) parts.push("量能回暖");
      parts.push(`评分${totalScore}`);

      signals.push({
        symbol: stock.symbol,
        name: stock.name,
        currentPrice: stock.currentPrice,
        changePercent: stock.changePercent,
        pe: Math.round(stock.pe * 10) / 10,
        pb: Math.round(stock.pb * 100) / 100,
        circulatingMarketCap: Math.round(capYi * 10) / 10,
        volumeRatio: stock.volumeRatio,
        turnoverRate: stock.turnoverRate,
        reason: parts.join("，"),
        signalTag,
        signalScore: totalScore,
        layer1Pass: true,
        layer2Pass,
        layer3Pass,
        indicators,
        advice: {
          suggestedPosition: positionMap[signalTag] ?? 0,
          stopLoss: -12,
          drawdownExit: -8,
          strategyLabel: signalTag === "反转萌芽" ? "左侧反转" : signalTag === "价值洼地" ? "等待触发" : "观望",
          takeProfitStrategy: signalTag === "观察等待"
            ? "仅观察，不建议操作"
            : `目标+30%或回到年线上方；止损-12%；回撤-8%离场；每跌5%可DCA加仓(累计≤15%)`,
          positionSource: "fixed",
        },
      });
    }

    // 排序: 反转萌芽 > 价值洼地 > 观察等待，同级按评分降序
    const tagPriority: Record<string, number> = {
      "反转萌芽": 0, "价值洼地": 1, "观察等待": 2,
    };
    signals.sort((a, b) => {
      const pa = tagPriority[a.signalTag] ?? 3;
      const pb = tagPriority[b.signalTag] ?? 3;
      if (pa !== pb) return pa - pb;
      return b.signalScore - a.signalScore;
    });

    // 只返回非"观察等待"的信号（观察等待太多噪音）
    const finalSignals = signals.filter((s) => s.signalTag !== "观察等待").slice(0, 15);

    const now = new Date();
    const screenTime = now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

    const result = {
      success: true,
      signals: finalSignals,
      screenTime,
      totalScanned: allStocks.length,
      layer1Count: layer1Candidates.length,
      conditions: relaxed
        ? [
            "PE 3~40 (自动放宽)",
            "PB < 5.0 (自动放宽)",
            "流通市值>50亿 (自动放宽)",
            "排除ST/退市",
            "RSI(14)超卖检测",
            "地量检测",
            "MACD底背离",
            "反转触发检测",
          ]
        : [
            "PE 5~25",
            "PB < 3.0",
            "流通市值>100亿",
            "排除ST/退市",
            "RSI(14)超卖检测",
            "地量(20日<120日×40%)",
            "250日乖离率",
            "MACD底背离",
            "反转触发检测",
          ],
    };

    // 交易时段有信号时写入缓存
    if (!isOffHours && finalSignals.length > 0) {
      const tradeDate = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
      try {
        await prisma.screenCache.upsert({
          where: { id: "latest_left_side" },
          update: { data: result as unknown as Record<string, unknown>, tradeDate },
          create: { id: "latest_left_side", data: result as unknown as Record<string, unknown>, tradeDate },
        });
      } catch { /* ignore cache errors */ }
    }

    // 无信号时读缓存兜底（非交易时段 或 交易时段也可能因数据问题无信号）
    if (finalSignals.length === 0) {
      try {
        const cached = await prisma.screenCache.findUnique({ where: { id: "latest_left_side" } });
        if (cached?.data) {
          const cachedData = cached.data as unknown as typeof result;
          return NextResponse.json({
            ...cachedData,
            screenTime: `${cached.tradeDate} 缓存 (最近交易日)`,
          });
        }
      } catch { /* ignore */ }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Left-side API error:", error);

    // 错误时尝试缓存
    try {
      const cached = await prisma.screenCache.findUnique({ where: { id: "latest_left_side" } });
      if (cached?.data) {
        const cachedData = cached.data as unknown as Record<string, unknown>;
        return NextResponse.json({
          ...cachedData,
          screenTime: `缓存 (API错误)`,
        });
      }
    } catch { /* ignore */ }

    return NextResponse.json({
      success: false, signals: [], screenTime: "", totalScanned: 0, conditions: [],
    });
  }
}
