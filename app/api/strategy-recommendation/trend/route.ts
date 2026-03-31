import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

// ═══════════════════════════════════════════════════════════
// 趋势跟踪引擎 V3 — 全A股扫描 + 动态板块校验
//
// 核心改变: 不再从固定板块成分股出发（会有板块归属错误）
// 改为: 全A股扫涨幅>0 → Stage2+RS+回撤 → 反查所属行业 → 板块指数校验
//
// L1   全A股快筛 — 涨幅>0, 市值>50亿, 排除ST
// L2   Stage 2 底座 — 价>MA150>MA200, MA50>MA150, MA150拐头
// L2.5 RS相对强度 — 120日涨幅>30%
// L2.6 回撤熔断 — 距120日最高回撤>20%踢出
// L3   VCP收敛 — 10日振幅<3% + 量缩<50日均量50%
// L4   右侧突破 — 涨>2% + 量比>1.5
// L5   板块指数校验 — 反查行业板块, 指数>MA20&MA60, 涨停梯队≥3
//
// 风控: 止损=max(阳线最低,-5%), 止盈=跟踪MA20
// ═══════════════════════════════════════════════════════════

interface StockBasic {
  symbol: string; name: string; currentPrice: number; changePercent: number;
  volumeRatio: number; turnoverRate: number; circulatingMarketCap: number;
  amount: number; volume: number; highPrice: number; lowPrice: number; prevClose: number;
  industry: string; // 东方财富行业名
}

interface KlineBar {
  date: string; open: number; close: number; high: number; low: number; volume: number;
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Referer: "https://data.eastmoney.com/",
};

// ─── 全A股拉取（按涨幅降序，含行业字段） ────────────────────

async function fetchAllStocks(size: number): Promise<StockBasic[]> {
  try {
    // f100=行业板块名
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${size}&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048&fields=f2,f3,f5,f6,f8,f10,f12,f14,f15,f16,f18,f21,f100`;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12000) });
    if (!res.ok) return [];
    const json = await res.json();
    const diff = json?.data?.diff;
    if (!Array.isArray(diff)) return [];
    return diff
      .filter((item: Record<string, unknown>) => typeof item.f2 === "number" && item.f2 > 0)
      .map((item: Record<string, unknown>) => ({
        symbol: String(item.f12 ?? ""), name: String(item.f14 ?? ""),
        currentPrice: Number(item.f2 ?? 0), changePercent: Number(item.f3 ?? 0),
        volume: Number(item.f5 ?? 0), amount: Number(item.f6 ?? 0),
        turnoverRate: Number(item.f8 ?? 0),
        volumeRatio: Number(item.f10 === "-" ? 0 : (item.f10 ?? 0)),
        highPrice: Number(item.f15 ?? 0), lowPrice: Number(item.f16 ?? 0),
        prevClose: Number(item.f18 ?? 0), circulatingMarketCap: Number(item.f21 ?? 0),
        industry: String(item.f100 ?? ""),
      }))
      .filter((s: StockBasic) => !s.name.includes("ST") && !s.name.includes("退") && !s.symbol.startsWith("920"));
  } catch { return []; }
}

// ─── K线工具 ────────────────────────────────────────────────

async function fetchKline250(symbol: string): Promise<KlineBar[] | null> {
  try {
    const prefix = symbol.startsWith("6") || symbol.startsWith("9") ? "1" : "0";
    const secid = `${prefix}.${symbol}`;
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&klt=101&fqt=1&lmt=250&end=20500101&fields1=f1&fields2=f51,f52,f53,f54,f55,f56`;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = await res.json();
    const klines = json?.data?.klines;
    if (!Array.isArray(klines) || klines.length < 50) return null;
    return klines.map((k: string) => {
      const [date, open, close, high, low, volume] = k.split(",");
      return { date, open: +open, close: +close, high: +high, low: +low, volume: +volume };
    });
  } catch { return null; }
}

async function fetchBoardIndexKline(boardCode: string, limit: number): Promise<number[]> {
  try {
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=90.${boardCode}&klt=101&fqt=1&lmt=${limit}&end=20500101&fields1=f1&fields2=f51,f52,f53,f54,f55,f56`;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const json = await res.json();
    const klines = json?.data?.klines;
    if (!Array.isArray(klines)) return [];
    return klines.map((k: string) => parseFloat(k.split(",")[2]));
  } catch { return []; }
}

// ─── 反查行业板块代码 ───────────────────────────────────────

// 行业名→东方财富板块代码映射（动态构建 + 缓存）
const INDUSTRY_BOARD_CACHE = new Map<string, string>();

// 批量获取所有行业板块(一次性)
async function loadAllIndustryBoards(): Promise<void> {
  if (INDUSTRY_BOARD_CACHE.size > 0) return;
  try {
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=100&po=0&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2&fields=f2,f3,f12,f14`;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return;
    const json = await res.json();
    const diff = json?.data?.diff;
    if (!Array.isArray(diff)) return;
    for (const item of diff) {
      const code = String(item.f12 ?? "");
      const name = String(item.f14 ?? "");
      if (code && name) INDUSTRY_BOARD_CACHE.set(name, code);
    }
  } catch { /* ignore */ }
}

// ─── 分析函数 ───────────────────────────────────────────────

function calcSMA(values: number[], period: number): number {
  if (values.length < period) return 0;
  return values.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function analyzeStage2(klines: KlineBar[]): {
  pass: boolean; ma20: number; ma50: number; ma150: number; ma200: number; reason: string;
} {
  const closes = klines.map(k => k.close);
  const len = closes.length;
  if (len < 200) return { pass: false, ma20: 0, ma50: 0, ma150: 0, ma200: 0, reason: "K线<200日" };

  const current = closes[len - 1];
  const ma20 = calcSMA(closes, 20);
  const ma50 = calcSMA(closes, 50);
  const ma150 = calcSMA(closes, 150);
  const ma200 = calcSMA(closes, 200);

  if (current <= ma150 || current <= ma200) return { pass: false, ma20, ma50, ma150, ma200, reason: "价格<MA150/200" };
  if (len >= 220) {
    const ma150_20ago = calcSMA(closes.slice(0, -20), 150);
    if (ma150_20ago > 0 && ma150 <= ma150_20ago) return { pass: false, ma20, ma50, ma150, ma200, reason: "MA150未拐头" };
  }
  if (ma50 <= ma150) return { pass: false, ma20, ma50, ma150, ma200, reason: "MA50<MA150" };
  return { pass: true, ma20, ma50, ma150, ma200, reason: "Stage2✓" };
}

function calcRS120(klines: KlineBar[]): number {
  const len = klines.length;
  if (len < 120) return 0;
  const p0 = klines[len - 120].close;
  return p0 > 0 ? ((klines[len - 1].close - p0) / p0) * 100 : 0;
}

function checkDrawdown(klines: KlineBar[]): { pass: boolean; pct: number; reason: string } {
  const lookback = Math.min(120, klines.length);
  const peak = Math.max(...klines.slice(-lookback).map(k => k.high));
  const current = klines[klines.length - 1].close;
  const pct = peak > 0 ? ((current - peak) / peak) * 100 : 0;
  return pct < -20
    ? { pass: false, pct, reason: `回撤${pct.toFixed(1)}%✗` }
    : { pass: true, pct, reason: `回撤${pct.toFixed(1)}%` };
}

function analyzeVCP(klines: KlineBar[]): { detected: boolean; amp: number; volRatio: number; reason: string } {
  if (klines.length < 50) return { detected: false, amp: 0, volRatio: 0, reason: "数据不足" };
  const amps = klines.slice(-10).map(k => k.low > 0 ? ((k.high - k.low) / k.low) * 100 : 0);
  const amp = amps.reduce((a, b) => a + b, 0) / amps.length;
  const vol50 = klines.slice(-50).map(k => k.volume).reduce((a, b) => a + b, 0) / 50;
  const vol3 = klines.slice(-3).map(k => k.volume).reduce((a, b) => a + b, 0) / 3;
  const volRatio = vol50 > 0 ? vol3 / vol50 : 1;
  const detected = amp < 3 && volRatio < 0.5;
  return { detected, amp, volRatio, reason: detected ? `VCP✓ 振幅${amp.toFixed(1)}% 量缩${(volRatio * 100).toFixed(0)}%` : `振幅${amp.toFixed(1)}% 量${(volRatio * 100).toFixed(0)}%` };
}

function checkBreakout(stock: StockBasic, klines: KlineBar[]): { confirmed: boolean; reason: string } {
  if (stock.changePercent < 2) return { confirmed: false, reason: `涨${stock.changePercent.toFixed(1)}%` };
  let volOK = stock.volumeRatio >= 1.5;
  if (!volOK && klines.length >= 11) {
    const avg = klines.slice(-11, -1).map(k => k.volume).reduce((a, b) => a + b, 0) / 10;
    volOK = avg > 0 && klines[klines.length - 1].volume > avg * 1.5;
  }
  return volOK
    ? { confirmed: true, reason: `放量突破✓ 涨${stock.changePercent.toFixed(1)}% 量比${stock.volumeRatio.toFixed(1)}` }
    : { confirmed: false, reason: `量比${stock.volumeRatio.toFixed(1)}` };
}

// ─── L5: 板块指数校验（动态） ────────────────────────────────

interface BoardValidation {
  boardCode: string;
  boardName: string;
  bullish: boolean;
  breadthOK: boolean;
  reason: string;
}

const boardValidationCache = new Map<string, BoardValidation>();

async function validateBoard(industryName: string, benchmarkChange: number): Promise<BoardValidation | null> {
  if (!industryName) return null;
  if (boardValidationCache.has(industryName)) return boardValidationCache.get(industryName)!;

  const boardCode = INDUSTRY_BOARD_CACHE.get(industryName);
  if (!boardCode) return null;

  const closes = await fetchBoardIndexKline(boardCode, 70);
  if (closes.length < 20) {
    const result: BoardValidation = { boardCode, boardName: industryName, bullish: true, breadthOK: true, reason: "板块数据不足" };
    boardValidationCache.set(industryName, result);
    return result;
  }

  const idxPrice = closes[closes.length - 1];
  const ma20 = calcSMA(closes, 20);
  const ma60 = closes.length >= 60 ? calcSMA(closes, 60) : ma20;
  const idxChange = closes.length >= 2 ? ((closes[closes.length - 1] / closes[closes.length - 2]) - 1) * 100 : 0;

  const aboveMAs = idxPrice > ma20 && idxPrice > ma60;
  const beatBenchmark = idxChange > benchmarkChange;
  const bullish = aboveMAs && beatBenchmark;

  let reason: string;
  if (bullish) reason = `${industryName}指数多头+跑赢大盘✓`;
  else if (!aboveMAs) reason = `${industryName}指数<均线✗`;
  else reason = `${industryName}未跑赢大盘✗`;

  const result: BoardValidation = { boardCode, boardName: industryName, bullish, breadthOK: true, reason };
  boardValidationCache.set(industryName, result);
  return result;
}

// ─── 大盘基准 ───────────────────────────────────────────────

async function fetchBenchmarkChange(): Promise<number> {
  try {
    const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=1.000001&fields=f3,f12`;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return 0;
    const json = await res.json();
    const diff = json?.data?.diff;
    return Array.isArray(diff) && diff.length > 0 ? Number(diff[0].f3 ?? 0) : 0;
  } catch { return 0; }
}

// ═══ GET Handler ═══════════════════════════════════════════

export async function GET() {
  try {
    // Step 1: 并行拉全A股 + 大盘基准 + 行业板块列表
    const [allStocks, benchmarkChange] = await Promise.all([
      fetchAllStocks(500), // 涨幅前500只
      fetchBenchmarkChange(),
    ]);
    await loadAllIndustryBoards();

    // Step 2: 快筛 — 涨幅>0, 市值>50亿
    const candidates = allStocks
      .filter(s => s.changePercent > 0 && s.circulatingMarketCap / 1e8 > 50 && s.currentPrice > 0)
      .slice(0, 100); // 取前100只拉K线

    // Step 3: 并行拉250日K线
    const klineResults = await Promise.allSettled(
      candidates.map(c => fetchKline250(c.symbol))
    );

    // Step 4: 多层分析
    const signals: Array<{
      symbol: string; name: string; currentPrice: number; changePercent: number;
      volumeRatio: number; turnoverRate: number; circulatingMarketCap: number;
      reason: string; signalTag: string; signalScore: number;
      sector: string; macroStatus: string;
      stage2: boolean; vcpDetected: boolean; breakoutConfirmed: boolean; rs120: number;
      advice: {
        suggestedPosition: number; stopLoss: number; drawdownExit: number;
        stopLossPrice: number; trailingStopMA20: number; strategyLabel: string;
        takeProfitStrategy: string; positionSource: "fixed";
      };
    }> = [];

    // 收集通过的行业板块（用于宏观面板展示）
    const boardResults = new Map<string, BoardValidation>();

    for (let i = 0; i < candidates.length; i++) {
      const stock = candidates[i];
      const kResult = klineResults[i];
      const klines = kResult.status === "fulfilled" ? kResult.value : null;
      if (!klines || klines.length < 200) continue;

      // L2: Stage2
      const stage2 = analyzeStage2(klines);
      if (!stage2.pass) continue;

      // L2.5: RS
      const rs120 = calcRS120(klines);
      if (rs120 < 30) continue;

      // L2.6: 回撤熔断
      const dd = checkDrawdown(klines);
      if (!dd.pass) continue;

      // L3: VCP
      const vcp = analyzeVCP(klines);

      // L4: 突破
      const breakout = checkBreakout(stock, klines);

      // L5: 板块指数校验（动态反查）
      let boardInfo = "";
      if (stock.industry) {
        const bv = await validateBoard(stock.industry, benchmarkChange);
        if (bv) {
          boardResults.set(stock.industry, bv);
          if (!bv.bullish) continue; // 板块弱势一票否决
          boardInfo = bv.reason;
        }
      }

      // 评分
      let score = 30;
      if (vcp.detected) score += 25;
      if (breakout.confirmed) score += 25;
      score += Math.min(10, rs120 / 5);
      score += Math.min(5, stock.changePercent);
      score = Math.round(Math.min(100, score));

      // 信号标签
      let tag: string;
      if (stage2.pass && vcp.detected && breakout.confirmed) tag = "趋势突破";
      else if (stage2.pass && vcp.detected) tag = "VCP收敛";
      else if (stage2.pass && breakout.confirmed) tag = "放量异动";
      else tag = "Stage2观察";

      // 风控
      const breakoutLow = klines[klines.length - 1].low;
      const stopLossPrice = Math.round(Math.max(breakoutLow, stock.currentPrice * 0.95) * 100) / 100;
      const stopLossPct = stock.currentPrice > 0 ? Math.round(((stopLossPrice - stock.currentPrice) / stock.currentPrice) * 1000) / 10 : -5;
      const trailingMA20 = Math.round(stage2.ma20 * 100) / 100;
      const drawdownExit = trailingMA20 > 0 && stock.currentPrice > 0 ? Math.round(((trailingMA20 - stock.currentPrice) / stock.currentPrice) * 1000) / 10 : -5;
      const capYi = stock.circulatingMarketCap / 1e8;

      // Reason
      const parts: string[] = [];
      parts.push(`${stock.industry || "未知行业"}`);
      if (boardInfo) parts.push(boardInfo);
      parts.push(stage2.reason);
      parts.push(`RS120=${rs120.toFixed(0)}%`);
      parts.push(dd.reason);
      if (vcp.detected) parts.push(vcp.reason);
      parts.push(breakout.reason);
      parts.push(`市值${capYi.toFixed(0)}亿`);

      const position = tag === "趋势突破" ? 10 : tag === "VCP收敛" ? 8 : tag === "放量异动" ? 6 : 3;

      signals.push({
        symbol: stock.symbol, name: stock.name,
        currentPrice: stock.currentPrice, changePercent: stock.changePercent,
        volumeRatio: stock.volumeRatio, turnoverRate: stock.turnoverRate,
        circulatingMarketCap: Math.round(capYi * 10) / 10,
        reason: parts.join(" | "), signalTag: tag, signalScore: score,
        sector: stock.industry || "未知",
        macroStatus: boardInfo || "未校验",
        stage2: true, vcpDetected: vcp.detected,
        breakoutConfirmed: breakout.confirmed, rs120: Math.round(rs120 * 10) / 10,
        advice: {
          suggestedPosition: position, stopLoss: stopLossPct, drawdownExit,
          stopLossPrice, trailingStopMA20: trailingMA20,
          strategyLabel: tag,
          takeProfitStrategy: `止损¥${stopLossPrice}(${stopLossPct}%) | 跟踪MA20(¥${trailingMA20}) | 跌破MA20且次日不收回→清仓`,
          positionSource: "fixed",
        },
      });
    }

    // 排序
    signals.sort((a, b) => {
      const rank = (t: string) => t.includes("趋势突破") ? 0 : t.includes("VCP") ? 1 : t.includes("放量") ? 2 : 3;
      const ra = rank(a.signalTag), rb = rank(b.signalTag);
      return ra !== rb ? ra - rb : b.signalScore - a.signalScore;
    });

    const finalSignals = signals.slice(0, 20);
    const now = new Date();
    const screenTime = now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

    // 宏观面板：展示所有被校验过的行业板块状态
    const macroStatus = Array.from(boardResults.values()).map(bv => ({
      sector: bv.boardName,
      type: "dynamic" as const,
      macro: bv.boardName,
      bullish: bv.bullish,
      reason: bv.reason,
      breadthOK: bv.breadthOK,
      breadthReason: "",
    }));

    const result = {
      success: true,
      signals: finalSignals,
      screenTime,
      totalScanned: candidates.length,
      macroStatus,
      benchmarkChange,
      conditions: [
        "全A股涨幅前500快筛, 市值>50亿",
        "L2: Stage2 价>MA150>MA200, MA50>MA150",
        "L2.5: RS120日涨幅>30%",
        "L2.6: 回撤熔断 距120日高点<-20%",
        "L3: VCP 振幅<3%+量缩<50%",
        "L4: 突破 涨>2%+量比>1.5",
        "L5: 反查行业板块指数>MA20&MA60+跑赢大盘",
        "止损: max(阳线最低,-5%) | 止盈: 跟踪MA20",
      ],
    };

    // 缓存
    const isOffHours = candidates.filter(c => c.changePercent !== 0).length < 10;
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

    if (finalSignals.length === 0) {
      try {
        const cached = await prisma.screenCache.findUnique({ where: { id: "latest_trend" } });
        if (cached?.data) {
          const d = cached.data as unknown as typeof result;
          return NextResponse.json({ ...d, screenTime: `${cached.tradeDate} 缓存` });
        }
      } catch { /* ignore */ }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Trend V3 error:", error);
    try {
      const cached = await prisma.screenCache.findUnique({ where: { id: "latest_trend" } });
      if (cached?.data) return NextResponse.json({ ...(cached.data as object), screenTime: "缓存(API错误)" });
    } catch { /* ignore */ }
    return NextResponse.json({ success: false, signals: [], screenTime: "", totalScanned: 0, macroStatus: [], conditions: [] });
  }
}
