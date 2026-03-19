/**
 * Take-Profit Calculation Engine
 *
 * 3 methods: Trailing (dynamic), ATR Multiple, Fixed Price.
 * Trailing mode tracks high-water-mark and dynamically adjusts.
 * ATR mode uses same frequency conversion as stop-loss engine.
 */

import { type OHLC, calculateATR, convertATRFrequency } from "./stop-loss-engine";

export type TakeProfitMethod = "trailing" | "atr_multiple" | "fixed";

export interface TakeProfitInput {
  method: TakeProfitMethod;
  buyPrice: number;
  currentPrice: number;
  highWaterMark: number;
  params: Record<string, number>;
  ohlcData?: OHLC[];
  frequency?: "daily" | "weekly" | "monthly";
  cachedAtr?: number;
}

export interface TakeProfitResult {
  takeProfitPrice: number;
  method: TakeProfitMethod;
  newHighWaterMark: number;
  description: string;
  computeStatus: "live" | "low_freq" | "cached" | "awaiting_data";
}

// ─── Default Params ─────────────────────────────────────────

export function getDefaultParams(method: TakeProfitMethod): Record<string, number> {
  switch (method) {
    case "trailing": return { trailPercent: 5 };
    case "atr_multiple": return { atrMultiple: 3, atrPeriod: 14 };
    case "fixed": return { fixedPrice: 0 };
  }
}

// ─── Main Calculator ────────────────────────────────────────

export function calculateTakeProfit(input: TakeProfitInput): TakeProfitResult {
  const {
    method, buyPrice, currentPrice, highWaterMark,
    params, ohlcData, frequency = "daily", cachedAtr,
  } = input;

  try {
    // Update high water mark
    const newHWM = Math.max(highWaterMark, currentPrice, buyPrice);

    switch (method) {
      case "trailing": {
        const trailPercent = params.trailPercent ?? 5;
        const tp = newHWM * (1 - trailPercent / 100);
        return {
          takeProfitPrice: Math.round(Math.max(tp, 0) * 100) / 100,
          method: "trailing",
          newHighWaterMark: Math.round(newHWM * 100) / 100,
          description: `最高价 ¥${newHWM.toFixed(2)} 回撤${trailPercent}%止盈`,
          computeStatus: "live",
        };
      }

      case "atr_multiple": {
        const atrMultiple = params.atrMultiple ?? 3;
        const atrPeriod = params.atrPeriod ?? 14;

        if (!ohlcData || ohlcData.length < 2) {
          if (cachedAtr && cachedAtr > 0) {
            const tp = buyPrice + atrMultiple * cachedAtr;
            return {
              takeProfitPrice: Math.round(tp * 100) / 100,
              method: "atr_multiple",
              newHighWaterMark: Math.round(newHWM * 100) / 100,
              description: `缓存ATR=${cachedAtr.toFixed(2)}，${atrMultiple}倍目标`,
              computeStatus: "cached",
            };
          }
          return {
            takeProfitPrice: Math.round(buyPrice * 1.15 * 100) / 100,
            method: "atr_multiple",
            newHighWaterMark: Math.round(newHWM * 100) / 100,
            description: "数据等待中，使用安全目标价",
            computeStatus: "awaiting_data",
          };
        }

        let atr = calculateATR(ohlcData, atrPeriod);
        if (frequency !== "daily") {
          atr = convertATRFrequency(atr, frequency, "daily");
        }

        const tp = buyPrice + atrMultiple * atr;
        const computeStatus = frequency === "daily" ? "live" : "low_freq";

        return {
          takeProfitPrice: Math.round(tp * 100) / 100,
          method: "atr_multiple",
          newHighWaterMark: Math.round(newHWM * 100) / 100,
          description: `买入价 + ${atrMultiple}×ATR(${atrPeriod})=${atr.toFixed(2)}${frequency !== "daily" ? `（${frequency === "weekly" ? "周线" : "月线"}推演）` : ""}`,
          computeStatus,
        };
      }

      case "fixed": {
        const fixedPrice = params.fixedPrice ?? 0;
        return {
          takeProfitPrice: Math.round(fixedPrice * 100) / 100,
          method: "fixed",
          newHighWaterMark: Math.round(newHWM * 100) / 100,
          description: `手动设定目标价 ¥${fixedPrice.toFixed(2)}`,
          computeStatus: "live",
        };
      }

      default:
        return {
          takeProfitPrice: Math.round(buyPrice * 1.15 * 100) / 100,
          method,
          newHighWaterMark: Math.round(newHWM * 100) / 100,
          description: "未知方法，使用安全目标价",
          computeStatus: "awaiting_data",
        };
    }
  } catch (err) {
    console.error("[take-profit-engine] calculation error:", err);
    return {
      takeProfitPrice: Math.round(buyPrice * 1.15 * 100) / 100,
      method,
      newHighWaterMark: Math.max(highWaterMark, currentPrice, buyPrice),
      description: "计算异常，使用安全目标价",
      computeStatus: "awaiting_data",
    };
  }
}
