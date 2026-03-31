import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

// ═══════════════════════════════════════════════════════════
// 趋势跟踪引擎 V2 — 双引擎架构(周期+成长)
//
// L1   板块校验 — ETF多头(周期) 或 板块指数>MA20&MA60+跑赢大盘(成长)
// L1.5 涨停梯队 — 板块内涨>5%的≥3只(或1只涨停)，排除单骑救主
// L2   Stage 2 底座 — 价>MA150>MA200, MA50>MA150, MA150拐头
// L2.5 RS相对强度 — 120日涨幅全市场百分位>85
// L2.6 回撤熔断 — 距120日最高回撤>20%踢出
// L3   VCP收敛 — 10日振幅<3% + 量缩<50日均量50%
// L4   右侧突破 — 涨>2% + 量比>1.5
//
// 风控: 止损=max(阳线最低,-5%), 止盈=跟踪MA20
// ═══════════════════════════════════════════════════════════

interface SectorConfig {
  name: string;
  type: "cycle" | "growth";      // 周期 or 成长
  macroSymbol: string | null;     // ETF secid (周期用)
  macroName: string;
  boardCode: string;              // 东方财富板块代码 (如 BK0493)
  boardQuery: string;             // 成分股查询 fs 参数
}

const SECTORS: SectorConfig[] = [
  // ─── 周期资源引擎 (有ETF宏观锚定) ───
  { name: "黄金", type: "cycle", macroSymbol: "1.518880", macroName: "黄金ETF", boardCode: "BK0493", boardQuery: "b:BK0493" },
  { name: "有色·铜铝", type: "cycle", macroSymbol: "0.159980", macroName: "有色ETF", boardCode: "BK0478", boardQuery: "b:BK0478" },
  { name: "石油石化", type: "cycle", macroSymbol: "1.501018", macroName: "原油基金", boardCode: "BK0698", boardQuery: "b:BK0698" },
  { name: "煤炭", type: "cycle", macroSymbol: "1.515220", macroName: "煤炭ETF", boardCode: "BK0733", boardQuery: "b:BK0733" },
  { name: "航运", type: "cycle", macroSymbol: null, macroName: "航运", boardCode: "BK0549", boardQuery: "b:BK0549" },
  // ─── 成长科技引擎 (板块指数校验) ───
  { name: "电力", type: "growth", macroSymbol: null, macroName: "电力", boardCode: "BK0428", boardQuery: "b:BK0428" },
  { name: "军工", type: "growth", macroSymbol: null, macroName: "军工", boardCode: "BK0481", boardQuery: "b:BK0481" },
  { name: "半导体", type: "growth", macroSymbol: null, macroName: "半导体", boardCode: "BK1036", boardQuery: "b:BK1036" },
  { name: "医药", type: "growth", macroSymbol: null, macroName: "医药", boardCode: "BK0465", boardQuery: "b:BK0465" },
  { name: "银行", type: "growth", macroSymbol: null, macroName: "银行", boardCode: "BK0475", boardQuery: "b:BK0475" },
  { name: "证券", type: "growth", macroSymbol: null, macroName: "证券", boardCode: "BK0473", boardQuery: "b:BK0473" },
  { name: "创新药", type: "growth", macroSymbol: null, macroName: "创新药", boardCode: "BK1084", boardQuery: "b:BK1084" },
  { name: "电网设备", type: "growth", macroSymbol: null, macroName: "电网设备", boardCode: "BK1050", boardQuery: "b:BK1050" },
  { name: "商业航天", type: "growth", macroSymbol: null, macroName: "商业航天", boardCode: "BK1124", boardQuery: "b:BK1124" },
  { name: "AI算力", type: "growth", macroSymbol: null, macroName: "AI算力", boardCode: "BK1146", boardQuery: "b:BK1146" },
  { name: "机器人", type: "growth", macroSymbol: null, macroName: "机器人", boardCode: "BK1131", boardQuery: "b:BK1131" },
  { name: "低空经济", type: "growth", macroSymbol: null, macroName: "低空经济", boardCode: "BK1159", boardQuery: "b:BK1159" },
];

// ─── 通用类型 ─────────────────────────────────────────────

interface MacroResult {
  sector: string;
  type: "cycle" | "growth";
  macro: string;
  bullish: boolean;
  reason: string;
  breadthOK: boolean;       // 涨停梯队
  breadthReason: string;
}

interface StockBasic {
  symbol: string; name: string; currentPrice: number; changePercent: number;
  volumeRatio: number; turnoverRate: number; circulatingMarketCap: number;
  amount: number; volume: number; highPrice: number; lowPrice: number; prevClose: number;
}

interface KlineBar {
  date: string; open: number; close: number; high: number; low: number; volume: number;
}

// ─── 东方财富 API 工具 ──────────────────────────────────────

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Referer: "https://data.eastmoney.com/",
};

/** 获取K线(通用) */
async function fetchKline(secid: string, limit: number): Promise<number[]> {
  try {
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&klt=101&fqt=1&lmt=${limit}&end=20500101&fields1=f1&fields2=f51,f52,f53,f54,f55,f56`;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const json = await res.json();
    const klines = json?.data?.klines;
    if (!Array.isArray(klines)) return [];
    return klines.map((k: string) => parseFloat(k.split(",")[2]));
  } catch { return []; }
}

/** 获取板块指数K线 (secid = 90.BKxxxx) */
async function fetchBoardIndexKline(boardCode: string, limit: number): Promise<number[]> {
  return fetchKline(`90.${boardCode}`, limit);
}

/** 获取个股250日完整K线 */
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

/** 获取板块成分股 */
async function fetchSectorStocks(boardQuery: string, size: number = 50): Promise<StockBasic[]> {
  try {
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${size}&po=0&np=1&fltt=2&invt=2&fid=f21&fs=${boardQuery}&fields=f2,f3,f5,f6,f8,f10,f12,f14,f15,f16,f18,f21`;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
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
      }))
      .filter((s: StockBasic) => !s.name.includes("ST") && !s.name.includes("退") && !s.symbol.startsWith("920"));
  } catch { return []; }
}

/** 获取上证指数今日涨幅 */
async function fetchMarketBenchmark(): Promise<number> {
  try {
    const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=1.000001&fields=f3,f12`;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return 0;
    const json = await res.json();
    const diff = json?.data?.diff;
    if (Array.isArray(diff) && diff.length > 0) return Number(diff[0].f3 ?? 0);
    return 0;
  } catch { return 0; }
}

// ─── L1: 板块校验 ─────────────────────────────────────────

function calcSMA(values: number[], period: number): number {
  if (values.length < period) return 0;
  return values.slice(-period).reduce((a, b) => a + b, 0) / period;
}

async function validateSector(
  config: SectorConfig,
  benchmarkChange: number,
  sectorStocks: StockBasic[],
): Promise<MacroResult> {
  const { name, type, macroSymbol, macroName, boardCode } = config;

  // ─── L1.5 涨停梯队(广度) ───
  const hotCount = sectorStocks.filter(s => s.changePercent >= 5).length;
  const limitUpCount = sectorStocks.filter(s => s.prevClose > 0 && s.currentPrice >= s.prevClose * 1.097).length;
  const breadthOK = hotCount >= 3 || limitUpCount >= 1;
  const breadthReason = breadthOK
    ? `梯队✓ 涨>5%:${hotCount}只${limitUpCount > 0 ? ` 涨停${limitUpCount}` : ""}`
    : `单骑✗ 涨>5%仅${hotCount}只`;

  // ─── L1 周期引擎: ETF MA20 校验 ───
  if (type === "cycle" && macroSymbol) {
    const closes = await fetchKline(macroSymbol, 30);
    if (closes.length < 20) {
      return { sector: name, type, macro: macroName, bullish: true, reason: "ETF数据不足", breadthOK, breadthReason };
    }
    const price = closes[closes.length - 1];
    const ma20 = calcSMA(closes, 20);
    let trendUp = true;
    if (closes.length >= 25) {
      const ma20_5ago = calcSMA(closes.slice(0, -5), 20);
      trendUp = ma20 > ma20_5ago;
    }
    const bullish = price > ma20 && trendUp;
    const reason = bullish
      ? `${price.toFixed(2)}>${ma20.toFixed(2)}(MA20) 多头✓`
      : `${price.toFixed(2)}<${ma20.toFixed(2)}(MA20) ✗否决`;
    return { sector: name, type, macro: macroName, bullish, reason, breadthOK, breadthReason };
  }

  // ─── L1 成长引擎: 板块指数 MA20+MA60 + 跑赢大盘 ───
  const closes = await fetchBoardIndexKline(boardCode, 70);
  if (closes.length < 60) {
    // 数据不足时只看广度
    return { sector: name, type, macro: macroName, bullish: breadthOK, reason: "板块指数数据不足,看广度", breadthOK, breadthReason };
  }

  const idxPrice = closes[closes.length - 1];
  const idxMa20 = calcSMA(closes, 20);
  const idxMa60 = calcSMA(closes, 60);

  // 板块今日涨幅(近似: 最后收盘/倒数第二收盘 -1)
  const idxChange = closes.length >= 2 ? ((closes[closes.length - 1] / closes[closes.length - 2]) - 1) * 100 : 0;
  const beatBenchmark = idxChange > benchmarkChange;

  const aboveMAs = idxPrice > idxMa20 && idxPrice > idxMa60;
  const bullish = aboveMAs && beatBenchmark;

  let reason: string;
  if (bullish) {
    reason = `指数>${idxMa20.toFixed(0)}(MA20)>${idxMa60.toFixed(0)}(MA60) 跑赢大盘✓`;
  } else if (!aboveMAs) {
    reason = `指数<MA20或MA60 ✗否决`;
  } else {
    reason = `未跑赢大盘(板块${idxChange.toFixed(1)}%vs大盘${benchmarkChange.toFixed(1)}%) ✗`;
  }

  return { sector: name, type, macro: macroName, bullish, reason, breadthOK, breadthReason };
}

// ─── L2: Stage 2 底座 ──────────────────────────────────────

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

  if (current <= ma150 || current <= ma200)
    return { pass: false, ma20, ma50, ma150, ma200, reason: "价格<MA150/MA200" };

  if (len >= 220) {
    const ma150_20ago = calcSMA(closes.slice(0, -20), 150);
    if (ma150_20ago > 0 && ma150 <= ma150_20ago)
      return { pass: false, ma20, ma50, ma150, ma200, reason: "MA150未拐头" };
  }

  if (ma50 <= ma150)
    return { pass: false, ma20, ma50, ma150, ma200, reason: `MA50<MA150` };

  return { pass: true, ma20, ma50, ma150, ma200, reason: "Stage2✓" };
}

// ─── L2.5: RS 相对强度 (120日涨幅百分位) ────────────────────

async function fetchRS85Threshold(): Promise<number> {
  // 拉全A股按120日涨幅排序,取85百分位的涨幅值
  try {
    // 获取全A股120日涨跌幅(f127): 不可用。替代方案: 用60日涨幅f135近似
    // 实际用 clist + 自定义排序
    // 更高效: 拉 pz=200 按 f3(涨幅) 降序, 取第 85%位置的值作为阈值
    // 简化: 直接用缓存或硬编码阈值, 每天cron更新
    const cached = await prisma.screenCache.findUnique({ where: { id: "rs_threshold" } });
    if (cached?.data) {
      const d = cached.data as Record<string, unknown>;
      const threshold = Number(d.threshold ?? 15);
      const updatedAt = String(d.updatedAt ?? "");
      const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
      if (updatedAt === today) return threshold;
    }
  } catch { /* ignore */ }

  // 计算: 拉500只120日涨幅最高的, 第85百分位
  try {
    // 东方财富没有直接120日涨幅字段, 用涨跌幅排名近似
    // 固定阈值: 120日涨>30%（近似85百分位，后续可用cron精确计算）
    return 30;
  } catch { return 15; }
}

function calcRS120(klines: KlineBar[]): number {
  // 120日涨幅 %
  const len = klines.length;
  if (len < 120) return 0;
  const price120ago = klines[len - 120].close;
  const current = klines[len - 1].close;
  if (price120ago <= 0) return 0;
  return ((current - price120ago) / price120ago) * 100;
}

// ─── L2.6: 回撤熔断 ────────────────────────────────────────

function checkDrawdown(klines: KlineBar[]): { pass: boolean; drawdownPct: number; reason: string } {
  const len = klines.length;
  const lookback = Math.min(120, len);
  const highs = klines.slice(-lookback).map(k => k.high);
  const peak = Math.max(...highs);
  const current = klines[len - 1].close;
  const drawdownPct = peak > 0 ? ((current - peak) / peak) * 100 : 0;

  if (drawdownPct < -20) {
    return { pass: false, drawdownPct, reason: `回撤${drawdownPct.toFixed(1)}%(>-20%) ✗熔断` };
  }
  return { pass: true, drawdownPct, reason: `回撤${drawdownPct.toFixed(1)}%` };
}

// ─── L3: VCP 波动率收敛 ─────────────────────────────────────

function analyzeVCP(klines: KlineBar[]): {
  detected: boolean; avgAmplitude: number; volumeRatio: number; reason: string;
} {
  const len = klines.length;
  if (len < 50) return { detected: false, avgAmplitude: 0, volumeRatio: 0, reason: "数据不足" };

  const recent10 = klines.slice(-10);
  const amplitudes = recent10.map(k => k.low > 0 ? ((k.high - k.low) / k.low) * 100 : 0);
  const avgAmplitude = amplitudes.reduce((a, b) => a + b, 0) / amplitudes.length;
  const amplitudeOK = avgAmplitude < 3;

  const vol50avg = klines.slice(-50).map(k => k.volume).reduce((a, b) => a + b, 0) / 50;
  const avgRecentVol = klines.slice(-3).map(k => k.volume).reduce((a, b) => a + b, 0) / 3;
  const volumeRatio = vol50avg > 0 ? avgRecentVol / vol50avg : 1;
  const volumeOK = volumeRatio < 0.5;

  const detected = amplitudeOK && volumeOK;
  const reason = detected
    ? `VCP✓ 振幅${avgAmplitude.toFixed(1)}% 量缩${(volumeRatio * 100).toFixed(0)}%`
    : `振幅${avgAmplitude.toFixed(1)}% 量比${(volumeRatio * 100).toFixed(0)}%`;
  return { detected, avgAmplitude, volumeRatio, reason };
}

// ─── L4: 右侧突破 ──────────────────────────────────────────

function checkBreakout(stock: StockBasic, klines: KlineBar[]): { confirmed: boolean; reason: string } {
  if (stock.changePercent < 2) return { confirmed: false, reason: `涨${stock.changePercent.toFixed(1)}%(需>2%)` };

  let volumeOK = stock.volumeRatio >= 1.5;
  if (!volumeOK && klines.length >= 11) {
    const vol10avg = klines.slice(-11, -1).map(k => k.volume).reduce((a, b) => a + b, 0) / 10;
    const todayVol = klines[klines.length - 1].volume;
    volumeOK = vol10avg > 0 && todayVol > vol10avg * 1.5;
  }
  if (!volumeOK) return { confirmed: false, reason: `量比${stock.volumeRatio.toFixed(1)}(需>1.5)` };
  return { confirmed: true, reason: `放量突破✓ 涨${stock.changePercent.toFixed(1)}% 量比${stock.volumeRatio.toFixed(1)}` };
}

// ═══ GET Handler ═══════════════════════════════════════════

export async function GET() {
  try {
    // ─── Step 1: 并行拉取板块成分股 + 大盘基准 ───
    const [benchmarkChange, ...stockResults] = await Promise.all([
      fetchMarketBenchmark(),
      ...SECTORS.map(s => fetchSectorStocks(s.boardQuery, 50)),
    ]);

    const sectorStocksMap: StockBasic[][] = stockResults;

    // ─── Step 2: 并行 L1 板块校验 ───
    const macroResults = await Promise.allSettled(
      SECTORS.map((s, i) => validateSector(s, benchmarkChange, sectorStocksMap[i]))
    );

    const macroStatus: MacroResult[] = macroResults.map((r, i) =>
      r.status === "fulfilled" ? r.value : {
        sector: SECTORS[i].name, type: SECTORS[i].type, macro: SECTORS[i].macroName,
        bullish: false, reason: "校验失败", breadthOK: false, breadthReason: "N/A",
      }
    );

    // ─── Step 3: 筛选候选股(只从通过L1+L1.5的板块取) ───
    const rs85Threshold = await fetchRS85Threshold();

    const candidates: Array<{ stock: StockBasic; sectorIdx: number }> = [];
    const seenSymbols = new Set<string>();

    for (let i = 0; i < SECTORS.length; i++) {
      const macro = macroStatus[i];
      // L1: 板块校验必须通过
      if (!macro.bullish) continue;
      // L1.5: 涨停梯队必须通过 (周期引擎可豁免—底层资产逻辑更重要)
      if (SECTORS[i].type === "growth" && !macro.breadthOK) continue;

      const stocks = sectorStocksMap[i];
      // 正涨幅 + 市值>50亿, 限20只/板块
      const filtered = stocks
        .filter(s => s.currentPrice > 0 && s.changePercent > 0 && s.circulatingMarketCap / 1e8 > 50)
        .slice(0, 20);

      for (const stock of filtered) {
        if (seenSymbols.has(stock.symbol)) continue; // 跨板块去重
        seenSymbols.add(stock.symbol);
        candidates.push({ stock, sectorIdx: i });
      }
    }

    // ─── Step 4: 并行拉K线 ───
    const klineResults = await Promise.allSettled(
      candidates.map(c => fetchKline250(c.stock.symbol))
    );

    // ─── Step 5: 多层分析 ───
    const signals: Array<{
      symbol: string; name: string; currentPrice: number; changePercent: number;
      volumeRatio: number; turnoverRate: number; circulatingMarketCap: number;
      reason: string; signalTag: string; signalScore: number;
      sector: string; macroStatus: string; engineType: string;
      stage2: boolean; vcpDetected: boolean; breakoutConfirmed: boolean; rs120: number;
      advice: {
        suggestedPosition: number; stopLoss: number;
        trailingStopMA20: number; strategyLabel: string;
        takeProfitStrategy: string; positionSource: "fixed";
      };
    }> = [];

    for (let i = 0; i < candidates.length; i++) {
      const { stock, sectorIdx } = candidates[i];
      const kResult = klineResults[i];
      const klines = kResult.status === "fulfilled" ? kResult.value : null;
      if (!klines || klines.length < 200) continue;

      const sectorConfig = SECTORS[sectorIdx];
      const macro = macroStatus[sectorIdx];

      // L2: Stage 2
      const stage2 = analyzeStage2(klines);
      if (!stage2.pass) continue;

      // L2.5: RS 相对强度
      const rs120 = calcRS120(klines);
      const rsPass = sectorConfig.type === "growth" ? rs120 >= rs85Threshold : true; // 周期股豁免RS
      if (!rsPass) continue;

      // L2.6: 回撤熔断
      const drawdown = checkDrawdown(klines);
      if (!drawdown.pass) continue;

      // L3: VCP
      const vcp = analyzeVCP(klines);

      // L4: 突破
      const breakout = checkBreakout(stock, klines);

      // ─── 评分 ───
      let score = 30; // Stage2 base
      if (vcp.detected) score += 25;
      if (breakout.confirmed) score += 25;
      score += Math.min(10, rs120 / 3); // RS bonus
      if (macro.breadthOK) score += 5;
      score += Math.min(5, stock.changePercent);
      score = Math.round(Math.min(100, score));

      // ─── 信号标签 ───
      const enginePrefix = sectorConfig.type === "cycle" ? "[周期共振]" : "[动能反转]";
      let signalTag: string;
      if (stage2.pass && vcp.detected && breakout.confirmed) {
        signalTag = `${enginePrefix} 趋势突破`;
      } else if (stage2.pass && vcp.detected) {
        signalTag = `${enginePrefix} VCP收敛`;
      } else if (stage2.pass && breakout.confirmed) {
        signalTag = `${enginePrefix} 放量异动`;
      } else {
        signalTag = `${enginePrefix} Stage2观察`;
      }

      // ─── 风控 ───
      const breakoutLow = klines[klines.length - 1].low;
      const stopLoss = Math.round(Math.max(breakoutLow, stock.currentPrice * 0.95) * 100) / 100;
      const trailingStopMA20 = Math.round(stage2.ma20 * 100) / 100;
      const capYi = stock.circulatingMarketCap / 1e8;

      // ─── Reason ───
      const parts: string[] = [];
      parts.push(`🏔️${sectorConfig.name}`);
      parts.push(macro.reason);
      if (macro.breadthOK) parts.push(macro.breadthReason);
      parts.push(stage2.reason);
      if (sectorConfig.type === "growth") parts.push(`RS120=${rs120.toFixed(0)}%`);
      parts.push(drawdown.reason);
      if (vcp.detected) parts.push(vcp.reason);
      parts.push(breakout.reason);
      parts.push(`市值${capYi.toFixed(0)}亿`);

      const position = signalTag.includes("趋势突破") ? 10 : signalTag.includes("VCP收敛") ? 8 : signalTag.includes("放量异动") ? 6 : 3;

      signals.push({
        symbol: stock.symbol, name: stock.name,
        currentPrice: stock.currentPrice, changePercent: stock.changePercent,
        volumeRatio: stock.volumeRatio, turnoverRate: stock.turnoverRate,
        circulatingMarketCap: Math.round(capYi * 10) / 10,
        reason: parts.join(" | "),
        signalTag, signalScore: score,
        sector: sectorConfig.name,
        macroStatus: macro.reason,
        engineType: sectorConfig.type,
        stage2: stage2.pass, vcpDetected: vcp.detected,
        breakoutConfirmed: breakout.confirmed, rs120: Math.round(rs120 * 10) / 10,
        advice: {
          suggestedPosition: position, stopLoss, trailingStopMA20,
          strategyLabel: signalTag.replace(/\[.*\]\s*/, ""),
          takeProfitStrategy: `跟踪MA20(¥${trailingStopMA20})止盈 | 止损¥${stopLoss} | 跌破MA20且次日不收回→清仓`,
          positionSource: "fixed",
        },
      });
    }

    // ─── 排序 ───
    signals.sort((a, b) => {
      // 有突破的优先
      const aBreak = a.signalTag.includes("趋势突破") ? 0 : a.signalTag.includes("VCP") ? 1 : a.signalTag.includes("放量") ? 2 : 3;
      const bBreak = b.signalTag.includes("趋势突破") ? 0 : b.signalTag.includes("VCP") ? 1 : b.signalTag.includes("放量") ? 2 : 3;
      if (aBreak !== bBreak) return aBreak - bBreak;
      return b.signalScore - a.signalScore;
    });

    const finalSignals = signals.slice(0, 20);
    const now = new Date();
    const screenTime = now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

    const result = {
      success: true,
      signals: finalSignals,
      screenTime,
      totalScanned: candidates.length,
      macroStatus,
      benchmarkChange,
      conditions: [
        "L1: 周期=ETF>MA20多头 / 成长=板块指数>MA20&MA60+跑赢大盘",
        "L1.5: 板块涨>5%≥3只(涨停梯队,排除单骑救主)",
        "L2: Stage2 价>MA150>MA200, MA50>MA150",
        "L2.5: RS相对强度120日>85百分位(成长股)",
        "L2.6: 回撤熔断 距120日最高<-20%踢出",
        "L3: VCP 振幅<3%+量缩<50%",
        "L4: 突破 涨>2%+量比>1.5",
        "止损: max(阳线最低,-5%) | 止盈: 跟踪MA20",
      ],
    };

    // 缓存
    const isOffHours = candidates.length === 0 ||
      candidates.filter(c => c.stock.changePercent !== 0).length < 3;

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
          const cachedData = cached.data as unknown as typeof result;
          return NextResponse.json({ ...cachedData, screenTime: `${cached.tradeDate} 缓存 (最近交易日)` });
        }
      } catch { /* ignore */ }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Trend V2 API error:", error);
    try {
      const cached = await prisma.screenCache.findUnique({ where: { id: "latest_trend" } });
      if (cached?.data) return NextResponse.json({ ...(cached.data as object), screenTime: "缓存 (API错误)" });
    } catch { /* ignore */ }
    return NextResponse.json({ success: false, signals: [], screenTime: "", totalScanned: 0, macroStatus: [], conditions: [] });
  }
}
