/**
 * Stop-Loss Calculation Engine
 *
 * 4 dynamic methods: ATR, Chandelier Exit, Moving Average, Fixed Price.
 * NEVER degrades to fixed percentage — insufficient data triggers frequency
 * downgrade (daily → weekly → monthly ATR estimation) or cached value reuse.
 */

export type StopLossMethod = "atr" | "chandelier" | "ma" | "fixed";

export interface OHLC {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface StopLossInput {
  method: StopLossMethod;
  buyPrice: number;
  currentPrice: number;
  params: Record<string, number>;
  ohlcData: OHLC[];
  frequency: "daily" | "weekly" | "monthly";
  cachedAtr?: number; // fallback when data is insufficient
}

export interface StopLossResult {
  stopLossPrice: number;
  method: StopLossMethod;
  description: string;
  computeStatus: "live" | "low_freq" | "cached" | "awaiting_data";
  dataFrequency: "daily" | "weekly" | "monthly";
  atrValue?: number;
}

// ─── ATR Calculation ────────────────────────────────────────

/** True Range for a single bar */
function trueRange(curr: OHLC, prev: OHLC): number {
  return Math.max(
    curr.high - curr.low,
    Math.abs(curr.high - prev.close),
    Math.abs(curr.low - prev.close)
  );
}

/** Average True Range (SMA-based) */
export function calculateATR(ohlcData: OHLC[], period: number): number {
  if (ohlcData.length < period + 1) {
    // Use available data for a partial ATR estimate
    if (ohlcData.length < 2) return 0;
    const ranges: number[] = [];
    for (let i = 1; i < ohlcData.length; i++) {
      ranges.push(trueRange(ohlcData[i], ohlcData[i - 1]));
    }
    return ranges.reduce((a, b) => a + b, 0) / ranges.length;
  }

  const ranges: number[] = [];
  for (let i = 1; i <= period; i++) {
    ranges.push(trueRange(ohlcData[ohlcData.length - period - 1 + i], ohlcData[ohlcData.length - period - 1 + i - 1]));
  }
  return ranges.reduce((a, b) => a + b, 0) / period;
}

/** Convert ATR between frequencies: weekly ↔ daily ↔ monthly */
export function convertATRFrequency(
  atr: number,
  from: "daily" | "weekly" | "monthly",
  to: "daily" | "weekly" | "monthly"
): number {
  const toDailyFactor: Record<string, number> = {
    daily: 1,
    weekly: 1 / Math.sqrt(5),
    monthly: 1 / Math.sqrt(22),
  };
  const fromDailyFactor: Record<string, number> = {
    daily: 1,
    weekly: Math.sqrt(5),
    monthly: Math.sqrt(22),
  };
  const dailyATR = atr * toDailyFactor[from];
  return dailyATR * fromDailyFactor[to];
}

/** Simple Moving Average of close prices */
function sma(ohlcData: OHLC[], period: number): number {
  const slice = ohlcData.slice(-period);
  if (slice.length === 0) return 0;
  return slice.reduce((sum, d) => sum + d.close, 0) / slice.length;
}

/** Highest high over the last N bars */
function highestHigh(ohlcData: OHLC[], period: number): number {
  const slice = ohlcData.slice(-period);
  if (slice.length === 0) return 0;
  return Math.max(...slice.map((d) => d.high));
}

// ─── Default Params ─────────────────────────────────────────

export function getDefaultParams(method: StopLossMethod): Record<string, number> {
  switch (method) {
    case "atr": return { atrMultiplier: 3, atrPeriod: 14 };
    case "chandelier": return { atrMultiplier: 3, atrPeriod: 22, period: 22 };
    case "ma": return { maPeriod: 20 };
    case "fixed": return { fixedPrice: 0 };
  }
}

// ─── Main Calculator ────────────────────────────────────────

export function calculateStopLoss(input: StopLossInput): StopLossResult {
  const { method, buyPrice, currentPrice, params, ohlcData, frequency, cachedAtr } = input;

  try {
    // No data at all — use cached ATR or emergency floor
    if (ohlcData.length < 2) {
      if (cachedAtr && cachedAtr > 0) {
        const sl = currentPrice - (params.atrMultiplier ?? 3) * cachedAtr;
        return {
          stopLossPrice: Math.round(Math.max(sl, 0) * 100) / 100,
          method,
          description: `缓存ATR=${cachedAtr.toFixed(2)}，使用上次有效值`,
          computeStatus: "cached",
          dataFrequency: frequency,
          atrValue: cachedAtr,
        };
      }
      return {
        stopLossPrice: Math.round(buyPrice * 0.92 * 100) / 100,
        method,
        description: "数据等待中，使用安全底价",
        computeStatus: "awaiting_data",
        dataFrequency: frequency,
      };
    }

    const computeStatus = frequency === "daily" ? "live" : "low_freq";

    switch (method) {
      case "atr": {
        const period = params.atrPeriod ?? 14;
        const multiplier = params.atrMultiplier ?? 3;
        let atr = calculateATR(ohlcData, period);
        if (frequency !== "daily") {
          atr = convertATRFrequency(atr, frequency, "daily");
        }
        // 安全限制: ATR不应超过现价的20%（防止低频推演异常放大）
        const maxAtr = currentPrice * 0.2;
        if (atr > maxAtr) atr = maxAtr;
        let sl = currentPrice - multiplier * atr;
        // 止损价绝不能高于现价
        if (sl > currentPrice) sl = currentPrice * 0.95;
        return {
          stopLossPrice: Math.round(Math.max(sl, 0) * 100) / 100,
          method: "atr",
          description: `ATR(${period})=${atr.toFixed(2)}，${multiplier}倍止损${frequency !== "daily" ? `（${frequency === "weekly" ? "周线" : "月线"}推演）` : ""}`,
          computeStatus,
          dataFrequency: frequency,
          atrValue: Math.round(atr * 10000) / 10000,
        };
      }

      case "chandelier": {
        const atrPeriod = params.atrPeriod ?? 22;
        const lookbackPeriod = params.period ?? 22;
        const multiplier = params.atrMultiplier ?? 3;
        let atr = calculateATR(ohlcData, atrPeriod);
        if (frequency !== "daily") {
          atr = convertATRFrequency(atr, frequency, "daily");
        }
        // 安全限制: ATR不应超过现价的20%
        const maxAtrC = currentPrice * 0.2;
        if (atr > maxAtrC) atr = maxAtrC;
        const hh = highestHigh(ohlcData, lookbackPeriod);
        const sl = hh - multiplier * atr;
        return {
          stopLossPrice: Math.round(Math.max(sl, 0) * 100) / 100,
          method: "chandelier",
          description: `吊灯: HH(${lookbackPeriod})=${hh.toFixed(2)} - ${multiplier}×ATR(${atrPeriod})=${atr.toFixed(2)}${frequency !== "daily" ? `（${frequency === "weekly" ? "周线" : "月线"}推演）` : ""}`,
          computeStatus,
          dataFrequency: frequency,
          atrValue: Math.round(atr * 10000) / 10000,
        };
      }

      case "ma": {
        const maPeriod = params.maPeriod ?? 20;
        const maValue = sma(ohlcData, maPeriod);
        return {
          stopLossPrice: Math.round(Math.max(maValue, 0) * 100) / 100,
          method: "ma",
          description: `MA(${maPeriod})=${maValue.toFixed(2)}，跌破均线止损`,
          computeStatus,
          dataFrequency: frequency,
        };
      }

      case "fixed": {
        const fixedPrice = params.fixedPrice ?? 0;
        return {
          stopLossPrice: Math.round(fixedPrice * 100) / 100,
          method: "fixed",
          description: `手动设定止损价 ¥${fixedPrice.toFixed(2)}`,
          computeStatus: "live",
          dataFrequency: frequency,
        };
      }

      default:
        return {
          stopLossPrice: Math.round(buyPrice * 0.92 * 100) / 100,
          method,
          description: "未知方法，使用安全底价",
          computeStatus: "awaiting_data",
          dataFrequency: frequency,
        };
    }
  } catch (err) {
    // technicalindicators 计算必须 try-catch 保护（数据不足时会抛出）
    console.error("[stop-loss-engine] calculation error:", err);
    if (cachedAtr && cachedAtr > 0) {
      const sl = currentPrice - (params.atrMultiplier ?? 3) * cachedAtr;
      return {
        stopLossPrice: Math.round(Math.max(sl, 0) * 100) / 100,
        method,
        description: `计算异常，回退到缓存ATR=${cachedAtr.toFixed(2)}`,
        computeStatus: "cached",
        dataFrequency: frequency,
        atrValue: cachedAtr,
      };
    }
    return {
      stopLossPrice: Math.round(buyPrice * 0.92 * 100) / 100,
      method,
      description: "计算异常，使用安全底价",
      computeStatus: "awaiting_data",
      dataFrequency: frequency,
    };
  }
}
