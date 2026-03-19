/**
 * EconomicAdapter: Macro-economic indicators & energy data
 *
 * Data flow:
 *   FRED indicators -> /api/fred
 *   EIA energy data -> /api/eia
 *
 * All outputs normalized to EconomicEntity[]
 */

import {
  EntityType,
  type DataAdapter,
  type EconomicEntity,
} from "../types";

// ─── Trading signal logic per series ────────────────────────

function deriveTradingSignal(
  seriesId: string,
  delta: number,
): "bullish" | "bearish" | "neutral" {
  const upperSeries = seriesId.toUpperCase();

  // VIX up = bearish, down = bullish
  if (upperSeries.includes("VIX") || upperSeries === "VIXCLS") {
    return delta > 0 ? "bearish" : delta < 0 ? "bullish" : "neutral";
  }

  // Unemployment up = bearish
  if (upperSeries.includes("UNRATE") || upperSeries.includes("UNEMPLOYMENT")) {
    return delta > 0 ? "bearish" : delta < 0 ? "bullish" : "neutral";
  }

  // GDP up = bullish
  if (upperSeries.includes("GDP")) {
    return delta > 0 ? "bullish" : delta < 0 ? "bearish" : "neutral";
  }

  // Yields: up = bearish for equities (higher rates)
  if (upperSeries.includes("DGS") || upperSeries.includes("YIELD") || upperSeries.includes("T10Y")) {
    return delta > 0 ? "bearish" : delta < 0 ? "bullish" : "neutral";
  }

  // Energy prices up = bearish (input costs)
  if (upperSeries.includes("WTI") || upperSeries.includes("CRUDE") || upperSeries.includes("BRENT")) {
    return delta > 0 ? "bearish" : delta < 0 ? "bullish" : "neutral";
  }

  // CPI / inflation up = bearish
  if (upperSeries.includes("CPI") || upperSeries.includes("INFLATION")) {
    return delta > 0 ? "bearish" : delta < 0 ? "bullish" : "neutral";
  }

  return "neutral";
}

// ─── Adapter Implementation ─────────────────────────────────

export class EconomicAdapter implements DataAdapter<EconomicEntity> {
  readonly name = "economic";
  readonly type = EntityType.ECONOMIC;
  readonly refreshIntervalMs = 3_600_000; // 1 hour

  async fetch(): Promise<EconomicEntity[]> {
    const [fredResult, eiaResult] = await Promise.allSettled([
      this.fetchFred(),
      this.fetchEia(),
    ]);

    const results: EconomicEntity[] = [];

    if (fredResult.status === "fulfilled") results.push(...fredResult.value);
    if (eiaResult.status === "fulfilled") results.push(...eiaResult.value);

    return results;
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }

  // ─── FRED indicators ─────────────────────────────────────

  private async fetchFred(): Promise<EconomicEntity[]> {
    try {
      const res = await fetch("/api/fred", {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return [];

      const data = await res.json();
      if (!data.success || !Array.isArray(data.indicators)) return [];

      const now = Date.now();

      return data.indicators.map((ind: any): EconomicEntity => {
        const value = ind.value ?? 0;
        const previousValue = ind.previousValue ?? value;
        const delta = value - previousValue;
        const deltaPercent = previousValue !== 0
          ? (delta / previousValue) * 100
          : 0;

        const subtype = ind.seriesId?.includes("DGS") || ind.seriesId?.includes("T10Y")
          ? "yield" as const
          : "indicator" as const;

        return {
          id: `econ-${ind.seriesId}`,
          type: EntityType.ECONOMIC,
          subtype,
          label: ind.name || ind.seriesId,
          coordinates: null,
          value,
          delta,
          deltaPercent,
          status: delta >= 0 ? "up" : "down",
          metadata: {
            seriesId: ind.seriesId,
            name: ind.name || ind.seriesId,
            unit: ind.unit || "",
            value,
            previousValue,
            frequency: ind.frequency || "daily",
            tradingSignal: deriveTradingSignal(ind.seriesId || "", delta),
          },
          source: "fred",
          timestamp: now,
        };
      });
    } catch (err) {
      console.warn("EconomicAdapter: FRED fetch failed:", err);
      return [];
    }
  }

  // ─── EIA energy data ──────────────────────────────────────

  private async fetchEia(): Promise<EconomicEntity[]> {
    try {
      const res = await fetch("/api/eia", {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return [];

      const data = await res.json();
      if (!data.success || !Array.isArray(data.series)) return [];

      const now = Date.now();

      return data.series.map((s: any): EconomicEntity => {
        const value = s.value ?? 0;
        const previousValue = s.previousValue ?? value;
        const delta = value - previousValue;
        const deltaPercent = previousValue !== 0
          ? (delta / previousValue) * 100
          : 0;

        return {
          id: `econ-${s.seriesId}`,
          type: EntityType.ECONOMIC,
          subtype: "energy",
          label: s.name || s.seriesId,
          coordinates: null,
          value,
          delta,
          deltaPercent,
          status: delta >= 0 ? "up" : "down",
          metadata: {
            seriesId: s.seriesId,
            name: s.name || s.seriesId,
            unit: s.unit || "barrel",
            value,
            previousValue,
            frequency: s.frequency || "weekly",
            tradingSignal: deriveTradingSignal(s.seriesId || "", delta),
          },
          source: "eia",
          timestamp: now,
        };
      });
    } catch (err) {
      console.warn("EconomicAdapter: EIA fetch failed:", err);
      return [];
    }
  }
}
