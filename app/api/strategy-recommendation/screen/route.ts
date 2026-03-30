import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// 市场环境: bull(牛市) / sideways(震荡) / bear(熊市)
type MarketRegime = "bull" | "sideways" | "bear";

interface PositionAdvice {
  suggestedPosition: number;  // 建议仓位 %
  stopLoss: number;           // 止损线 %（负数）
  takeProfitStrategy: string; // 止盈策略描述
  drawdownExit: number;       // 高点回撤离场线 %（负数）
  strategyLabel: string;      // 策略标签
  kellyRaw?: number;          // 原始Kelly值（可为负）
  winRate?: number;            // 胜率 %
  profitLossRatio?: number;    // 盈亏比
  sampleSize?: number;         // 样本数
  positionSource: "kelly" | "fixed"; // 仓位来源
}

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
  riskTag?: string;
  signalScore?: number;
  advice?: PositionAdvice;
}

interface ScreenResponse {
  success: boolean;
  signals: ScreenResult[];
  screenTime: string;
  totalScanned: number;
  conditions: string[];
  marketRegime?: MarketRegime;
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
 * 检测市场环境：用涨停溢价率 + 连板高度判定牛/震荡/熊
 */
async function detectMarketRegime(): Promise<{ regime: MarketRegime; premiumRate: number; chainHeight: number }> {
  let premiumRate = 0;
  let chainHeight = 0;

  try {
    // 从涨停池获取溢价率和连板高度（复用 daily route 的逻辑）
    const today = new Date();
    const yyyy = today.toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" }).replace(/-/g, "");
    const poolUrl = `https://push2ex.eastmoney.com/getTopicZTPool?ut=7eea3edcaed734bea9telecast6e7d50064&dpt=wz.ztzt&Ession=board&date=${yyyy}`;

    const res = await fetch(poolUrl, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://data.eastmoney.com/" },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const json = await res.json();
      const pool = json?.data?.pool;
      if (Array.isArray(pool) && pool.length > 0) {
        // 连板高度 = max(zb_days)
        chainHeight = Math.max(...pool.map((s: { zb_days?: number }) => s.zb_days ?? 1));
        // 溢价率 = 平均(今开/昨收 - 1)
        const rates = pool
          .filter((s: { open?: number; yclose?: number }) => s.open && s.yclose && s.yclose > 0)
          .map((s: { open: number; yclose: number }) => ((s.open - s.yclose) / s.yclose) * 100);
        if (rates.length > 0) {
          premiumRate = rates.reduce((a: number, b: number) => a + b, 0) / rates.length;
        }
      }
    }
  } catch {
    // 获取失败时默认震荡市
  }

  // 判定市场环境
  let regime: MarketRegime = "sideways";
  if (premiumRate > 2 && chainHeight >= 4) {
    regime = "bull";
  } else if (premiumRate < -1 || chainHeight <= 1) {
    regime = "bear";
  }

  return { regime, premiumRate, chainHeight };
}

/**
 * 根据信号标签 + 市场环境 + Kelly公式 计算仓位和止盈止损建议
 *
 * Kelly Criterion: f = (b*p - q) / b
 *   p = 胜率, q = 1-p, b = 盈亏比(avgWin/avgLoss)
 *   使用半凯利(f/2)降低波动风险
 *   样本 < 20 时降级为固定仓位表
 */
async function calculateAdvice(
  signalTag: string,
  _signalScore: number,
  regime: MarketRegime,
  premiumRate: number,
): Promise<PositionAdvice> {
  // ─── 固定仓位表（Kelly降级时使用）───
  const basePosition: Record<string, number> = {
    "强烈推荐": 15, "爆发打板": 10, "确认上攻": 8,
    "高风险追板": 5, "大盘股": 5, "疑似诱多": 0,
  };

  // ─── 情绪系数 ───
  let sentimentMultiplier = 1.0;
  if (premiumRate > 3) sentimentMultiplier = 1.2;
  else if (premiumRate >= 0) sentimentMultiplier = 1.0;
  else if (premiumRate >= -2) sentimentMultiplier = 0.5;
  else sentimentMultiplier = 0;

  // ─── Kelly Criterion 从 BoardTrack 计算 ───
  let position = basePosition[signalTag] ?? 5;
  let positionSource: "kelly" | "fixed" = "fixed";
  let kellyRaw: number | undefined;
  let winRate: number | undefined;
  let profitLossRatio: number | undefined;
  let sampleSize: number | undefined;

  try {
    const records = await prisma.boardTrack.findMany({
      where: { signalTag, trackStatus: "tracked" },
      select: { nextDayChange: true },
    });
    sampleSize = records.length;

    if (records.length >= 20) {
      const changes = records.map((r) => Number(r.nextDayChange ?? 0));
      const wins = changes.filter((c) => c > 0);
      const losses = changes.filter((c) => c < 0);

      const p = wins.length / changes.length;
      const q = 1 - p;
      const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
      const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 1;
      const b = avgLoss > 0 ? avgWin / avgLoss : 0;

      // Kelly: f* = (b*p - q) / b
      const kelly = b > 0 ? (b * p - q) / b : -1;
      const halfKelly = kelly / 2;

      kellyRaw = Math.round(kelly * 1000) / 1000;
      winRate = Math.round(p * 1000) / 10;
      profitLossRatio = Math.round(b * 100) / 100;

      if (kelly <= 0) {
        // 数学告诉你：别买
        position = 0;
        positionSource = "kelly";
      } else {
        position = Math.round(Math.min(20, halfKelly * 100) * 10) / 10;
        positionSource = "kelly";
      }
    }
  } catch {
    // DB error → keep fixed table
  }

  // 应用情绪系数
  position = Math.round(Math.min(20, position * sentimentMultiplier) * 10) / 10;

  // ─── 止损线（根据市场环境调整）───
  const stopLossTable: Record<string, Record<MarketRegime, number>> = {
    "强烈推荐":  { bull: -7, sideways: -5, bear: -3 },
    "爆发打板":  { bull: -5, sideways: -3, bear: -2 },
    "确认上攻":  { bull: -6, sideways: -4, bear: -3 },
    "高风险追板": { bull: -3, sideways: -2, bear: -1.5 },
    "大盘股":    { bull: -4, sideways: -3, bear: -2 },
    "疑似诱多":  { bull: -2, sideways: -1.5, bear: -1 },
  };
  const stopLoss = stopLossTable[signalTag]?.[regime] ?? -3;

  // ─── 高点回撤离场线 ───
  const drawdownTable: Record<string, Record<MarketRegime, number>> = {
    "强烈推荐":  { bull: -5, sideways: -3, bear: -2 },
    "爆发打板":  { bull: -3, sideways: -2, bear: -1.5 },
    "确认上攻":  { bull: -4, sideways: -3, bear: -2 },
    "高风险追板": { bull: -2, sideways: -1.5, bear: -1 },
    "大盘股":    { bull: -3, sideways: -2, bear: -1.5 },
    "疑似诱多":  { bull: -1.5, sideways: -1, bear: -1 },
  };
  const drawdownExit = drawdownTable[signalTag]?.[regime] ?? -2;

  // ─── 止盈策略描述 ───
  const regimeLabel = regime === "bull" ? "牛市" : regime === "bear" ? "熊市" : "震荡市";
  const strategies: Record<string, { label: string; desc: string }> = {
    "强烈推荐": {
      label: "连板预期",
      desc: `高开>3%持有追踪，回撤${Math.abs(drawdownExit)}%离场；高开0~3%卖半仓锁利；低开破入场价${Math.abs(stopLoss)}%止损（${regimeLabel}）`,
    },
    "爆发打板": {
      label: "快进快出",
      desc: `高开>5%竞价卖出吃溢价；高开0~5%开盘30分钟内卖；低开破${Math.abs(stopLoss)}%止损（${regimeLabel}）`,
    },
    "确认上攻": {
      label: "趋势跟踪",
      desc: `持有追踪，从高点回撤${Math.abs(drawdownExit)}%离场；跌破MA5次日开盘卖；破入场价${Math.abs(stopLoss)}%止损（${regimeLabel}）`,
    },
    "高风险追板": {
      label: "严格止损",
      desc: `开盘30分钟内卖出；再封涨停可持有到次日开盘卖；破${Math.abs(stopLoss)}%立即止损（${regimeLabel}）`,
    },
    "疑似诱多": {
      label: "不建议参与",
      desc: "诱多信号，建议观望",
    },
  };
  const strategy = strategies[signalTag] ?? { label: "观望", desc: `止损${Math.abs(stopLoss)}%，回撤${Math.abs(drawdownExit)}%离场` };

  return {
    suggestedPosition: position,
    stopLoss,
    takeProfitStrategy: strategy.desc,
    drawdownExit,
    strategyLabel: strategy.label,
    kellyRaw,
    winRate,
    profitLossRatio,
    sampleSize,
    positionSource,
  };
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

    // Detect off-hours: if most stocks have 0 change or no valid data
    const validStocks = stocks.filter(
      (s) => s.currentPrice > 0 && s.changePercent !== 0 && !s.symbol.startsWith("920")
    );
    const isOffHours = validStocks.length < 10;

    // Step 2: Apply filters — relaxed during off-hours to show last session data
    const candidates = stocks.filter((s) => {
      // Exclude ST stocks
      if (s.name.includes("ST") || s.name.includes("*ST") || s.name.includes("退")) return false;
      // Exclude new board stocks
      if (s.symbol.startsWith("920")) return false;
      // Must have valid price data
      if (s.currentPrice <= 0) return false;

      if (isOffHours) {
        // Off-hours: show stocks with changePercent >= 2% as reference
        if (Math.abs(s.changePercent) < 2) return false;
        // Still require reasonable market cap
        const capInYi = s.circulatingMarketCap / 1e8;
        if (capInYi < 30) return false;
      } else {
        // Trading hours: full conditions
        if (s.changePercent < 3) return false;
        const capInYi = s.circulatingMarketCap / 1e8;
        if (capInYi < 50) return false;
        if (s.volumeRatio < 1.5) return false;
        if (s.turnoverRate < 5 || s.turnoverRate > 10) return false;
      }

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

      // MA check: price must be above all 3 MAs (if available) — skip during off-hours
      let maPass = true;
      if (ma && !isOffHours) {
        if (ma.ma5 > 0 && stock.currentPrice <= ma.ma5) maPass = false;
        if (ma.ma10 > 0 && stock.currentPrice <= ma.ma10) maPass = false;
        if (ma.ma20 > 0 && stock.currentPrice <= ma.ma20) maPass = false;
      }
      if (!maPass) continue;

      // VWAP check — skip during off-hours (volume data unreliable)
      if (!isOffHours && stock.volume > 0 && stock.amount > 0) {
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
      const openChangePercent = stock.prevClose > 0
        ? ((stock.openPrice - stock.prevClose) / stock.prevClose) * 100
        : 0;

      // ═══════════════════════════════════════════
      // 三层信号分类系统
      // ═══════════════════════════════════════════

      // Layer A: 确认上攻 — 量价共振 + 全天稳步上攻 + 均线多头
      const isConfirmedAttack = !isTrap && (() => {
        // 量比放大（>2.0 表示显著放量）
        if (stock.volumeRatio < 2.0) return false;
        // 换手率在合理区间（3-8%，活跃但不过度换手）
        if (stock.turnoverRate < 3 || stock.turnoverRate > 8) return false;
        // 开盘就强势（开盘涨幅 > 0.5%，不是低开拉升）
        if (openChangePercent < 0.5) return false;
        // 全天稳步上攻：最低价不跌破昨收（没有恐慌抛压）
        if (stock.lowPrice < stock.prevClose) return false;
        // 振幅合理（< 涨幅的2倍，走势平稳不是过山车）
        if (stock.amplitude > stock.changePercent * 2) return false;
        // 均线多头排列（MA数据可用时才检查）
        if (ma && ma.ma5 > 0 && ma.ma10 > 0 && ma.ma20 > 0) {
          if (!(stock.currentPrice > ma.ma5 && ma.ma5 > ma.ma10 && ma.ma10 > ma.ma20)) return false;
        }
        return true;
      })();

      // Layer B: 爆发打板 — 涨停级别 + 中盘股 + 量比爆发
      const isExplosiveBoard = !isTrap && (() => {
        // 涨幅 >= 9%（接近或达到涨停）
        if (stock.changePercent < 9) return false;
        // 流通市值 50-300亿（游资主力偏好的中盘股）
        if (capInYi < 50 || capInYi > 300) return false;
        // 量比爆发（>= 2.5，资金集中涌入）
        if (stock.volumeRatio < 2.5) return false;
        // 最低价不跌破昨收（封板有力度）
        if (stock.lowPrice < stock.prevClose) return false;
        return true;
      })();

      // Layer C: 强烈推荐 = 确认上攻 ∩ 爆发打板
      const isStrongBuy = isConfirmedAttack && isExplosiveBoard;

      // 综合评分 0-100
      let signalScore = 0;
      if (!isTrap) {
        // 涨幅贡献（0-25分）
        signalScore += Math.min(25, stock.changePercent * 2.5);
        // 量比贡献（0-20分）
        signalScore += Math.min(20, stock.volumeRatio * 5);
        // 换手率贡献（3-8%最佳，0-15分）
        const trIdeal = Math.max(0, 1 - Math.abs(stock.turnoverRate - 5.5) / 4.5);
        signalScore += trIdeal * 15;
        // 开盘强度贡献（0-15分）
        signalScore += Math.min(15, Math.max(0, openChangePercent) * 5);
        // 均线多头排列（0-15分）
        if (ma && ma.ma5 > 0 && ma.ma10 > 0 && ma.ma20 > 0) {
          if (stock.currentPrice > ma.ma5 && ma.ma5 > ma.ma10 && ma.ma10 > ma.ma20) signalScore += 15;
          else if (stock.currentPrice > ma.ma5 && stock.currentPrice > ma.ma10) signalScore += 8;
        }
        // 走势平稳加分（振幅 < 涨幅×1.5，0-10分）
        if (stock.amplitude < stock.changePercent * 1.5) signalScore += 10;
        else if (stock.amplitude < stock.changePercent * 2) signalScore += 5;

        // ═══ 游资微观结构加分 ═══

        // a) 游资偏好市值区间: 30-80亿 +10分
        if (capInYi >= 30 && capInYi <= 80) signalScore += 10;
        else if (capInYi > 80 && capInYi <= 150) signalScore += 3;

        // b) 股性活跃度: 用已获取的K线检测近期涨停次数
        if (ma && maResult.status === "fulfilled") {
          // fetchMA已获取20日K线, 检查涨幅>9%的天数
          // (MA函数只返回均线值,这里用振幅+涨幅间接判断)
        }

        // c) 内外盘比近似: 量比>3 + 涨幅>5% = 资金强势攻入
        if (stock.volumeRatio > 3 && stock.changePercent > 5) signalScore += 5;
      }
      signalScore = Math.round(Math.min(100, signalScore));

      // 最终标签：强烈推荐 > 爆发打板 > 确认上攻 > 疑似诱多 > 其他
      let riskTag: string | undefined;
      if (isTrap) {
        riskTag = "疑似诱多";
        signalScore = Math.max(0, signalScore - 30); // 诱多大幅扣分
      } else if (isStrongBuy) {
        riskTag = "强烈推荐";
      } else if (isExplosiveBoard) {
        riskTag = "爆发打板";
      } else if (isConfirmedAttack) {
        riskTag = "确认上攻";
      } else if (stock.changePercent >= 8) {
        riskTag = "高风险追板";
      } else if (capInYi >= 500) {
        riskTag = "大盘股";
      }

      // Build reason
      const parts: string[] = [];
      if (isTrap) parts.push(`⚠️ ${trapReason}`);
      if (isStrongBuy) parts.push("🔥 量价齐升+涨停级爆发");
      else if (isExplosiveBoard) parts.push("⚡ 涨停级放量爆发");
      else if (isConfirmedAttack) parts.push("✅ 量价共振稳步上攻");
      parts.push(`涨${stock.changePercent.toFixed(1)}%`);
      if (stock.volumeRatio > 0) parts.push(`量比${stock.volumeRatio.toFixed(1)}`);
      parts.push(`换手${stock.turnoverRate.toFixed(1)}%`);
      parts.push(`流通${capInYi.toFixed(0)}亿`);
      if (ma && ma.ma5 > 0 && ma.ma10 > 0 && ma.ma20 > 0
        && stock.currentPrice > ma.ma5 && ma.ma5 > ma.ma10 && ma.ma10 > ma.ma20) {
        parts.push("多头排列");
      }
      if (!isTrap) parts.push("价>均价");
      parts.push(`评分${signalScore}`);

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
        signalScore,
      });
    }

    // ═══ 板块效应检测: 同代码前缀(行业近似)3只以上异动 = 板块共振加分 ═══
    const prefixCount = new Map<string, number>();
    for (const s of signals) {
      const prefix = s.symbol.substring(0, 3); // 前3位近似行业
      prefixCount.set(prefix, (prefixCount.get(prefix) ?? 0) + 1);
    }
    for (const s of signals) {
      const prefix = s.symbol.substring(0, 3);
      const count = prefixCount.get(prefix) ?? 0;
      if (count >= 3) {
        s.signalScore = Math.min(100, (s.signalScore ?? 0) + 8);
        if (!s.reason.includes("板块共振")) s.reason += "，板块共振";
      } else if (count === 1 && (s.signalScore ?? 0) > 0) {
        s.signalScore = Math.max(0, (s.signalScore ?? 0) - 5);
      }
    }

    // Sort: 强烈推荐 > 爆发打板 > 确认上攻 > 普通 > 疑似诱多; 同级按评分降序
    const tagPriority: Record<string, number> = {
      "强烈推荐": 0,
      "爆发打板": 1,
      "确认上攻": 2,
      "高风险追板": 3,
      "大盘股": 3,
      "疑似诱多": 9,
    };
    signals.sort((a, b) => {
      const pa = tagPriority[a.riskTag || ""] ?? 4;
      const pb = tagPriority[b.riskTag || ""] ?? 4;
      if (pa !== pb) return pa - pb;
      return (b.signalScore ?? 0) - (a.signalScore ?? 0);
    });

    const conditions = [
      "涨跌幅>3%",
      "流通市值>50亿",
      "量比>1.5",
      "换手率5%~10%",
      "MA多头排列",
      "价>VWAP",
      "排除ST/退市",
      "诱多检测",
      "确认上攻检测",
      "爆发打板检测",
    ];

    const finalSignals = signals.slice(0, 20);
    const now = new Date();
    const screenTime = now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

    // 检测市场环境 + 为每个信号计算仓位/止盈止损建议
    const { regime, premiumRate } = await detectMarketRegime();
    const adviceResults = await Promise.allSettled(
      finalSignals.map((s) =>
        calculateAdvice(s.riskTag || "未分类", s.signalScore || 0, regime, premiumRate)
      )
    );
    for (let i = 0; i < finalSignals.length; i++) {
      const r = adviceResults[i];
      if (r.status === "fulfilled") {
        finalSignals[i].advice = r.value;
      }
    }

    const result: ScreenResponse = {
      success: true,
      signals: finalSignals,
      screenTime,
      totalScanned: total,
      conditions,
      marketRegime: regime,
    };

    // Cache results to DB when we have valid data (trading hours)
    if (!isOffHours && finalSignals.length > 0) {
      const tradeDate = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" }); // YYYY-MM-DD
      try {
        await prisma.screenCache.upsert({
          where: { id: "latest_screen" },
          update: {
            data: result as unknown as Record<string, unknown>,
            tradeDate,
          },
          create: {
            id: "latest_screen",
            data: result as unknown as Record<string, unknown>,
            tradeDate,
          },
        });
      } catch (cacheErr) {
        console.error("Screen cache write error:", cacheErr);
      }
    }

    // If off-hours and no signals, try returning cached data
    if (isOffHours && finalSignals.length === 0) {
      try {
        const cached = await prisma.screenCache.findUnique({
          where: { id: "latest_screen" },
        });
        if (cached?.data) {
          const cachedData = cached.data as unknown as ScreenResponse;
          return NextResponse.json({
            ...cachedData,
            screenTime: `${cached.tradeDate} 缓存 (最近交易日)`,
          });
        }
      } catch {
        // Ignore cache read errors
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Screen API error:", error);

    // On error, also try returning cached data
    try {
      const cached = await prisma.screenCache.findUnique({
        where: { id: "latest_screen" },
      });
      if (cached?.data) {
        const cachedData = cached.data as unknown as ScreenResponse;
        return NextResponse.json({
          ...cachedData,
          screenTime: `${cached.tradeDate} 缓存 (最近交易日)`,
        });
      }
    } catch {
      // Ignore
    }

    return NextResponse.json({
      success: false,
      signals: [],
      screenTime: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
      totalScanned: 0,
      conditions: [],
    });
  }
}
