/**
 * FinanceAdapter: Unified financial data adapter
 *
 * Data flow:
 *   A-Share indices/stocks -> Sina API -> Tencent API (fallback)
 *   Global indices/commodities/FX -> Finnhub API -> Sina Global (fallback)
 *
 * All outputs normalized to FinancialEntity[]
 */

import {
  EntityType,
  type DataAdapter,
  type FinancialEntity,
  type Coordinates,
} from "../types";

// ─── Financial center coordinates for map plotting ───────────

const MARKET_COORDS: Record<string, Coordinates> = {
  "us":        { lat: 40.71,  lng: -74.01  },
  "hk":        { lat: 22.32,  lng: 114.17  },
  "jp":        { lat: 35.68,  lng: 139.69  },
  "uk":        { lat: 51.51,  lng: -0.13   },
  "eu":        { lat: 50.11,  lng: 8.68    },
  "global":    { lat: 0,      lng: 0       },
  "cn":        { lat: 31.23,  lng: 121.47  },
  // Semantic overrides for non-geographic entity types
  "commodity": { lat: 25.0,   lng: 55.0   }, // Persian Gulf / commodity hub
  "fx":        { lat: 51.5,   lng: -0.1   }, // London / FX hub
  "fed":       { lat: 38.9,   lng: -77.0  }, // Washington DC / Fed
};

// Spread out co-located entities using deterministic per-index offsets
function jitter(base: Coordinates, index: number): Coordinates {
  const offsets = [
    [0,    0   ],
    [0.4,  0.4 ],
    [-0.4, 0.4 ],
    [0.4,  -0.4],
    [-0.4, -0.4],
    [0.6,  0   ],
    [-0.6, 0   ],
    [0,    0.6 ],
    [0,    -0.6],
    [0.5,  0.5 ],
  ] as const;
  const [dlat, dlng] = offsets[index % offsets.length];
  return { lat: base.lat + dlat, lng: base.lng + dlng };
}

// ─── Global symbols config ──────────────────────────────────

interface SymbolConfig {
  name: string;
  subtype: "index" | "commodity" | "fx" | "rate";
  region: string;
  finnhubSymbol?: string; // Finnhub symbol format
  sinaSymbol?: string;    // Sina global symbol format
}

const GLOBAL_SYMBOLS: Record<string, SymbolConfig> = {
  "^DJI":      { name: "道琼斯", subtype: "index", region: "us", finnhubSymbol: "DJI", sinaSymbol: "int_dji" },
  "^IXIC":     { name: "纳斯达克", subtype: "index", region: "us", finnhubSymbol: "IXIC", sinaSymbol: "int_nasdaq" },
  "^GSPC":     { name: "标普500", subtype: "index", region: "us", finnhubSymbol: "SPX", sinaSymbol: "int_sp500" },
  "^HSI":      { name: "恒生指数", subtype: "index", region: "hk", finnhubSymbol: "HSI", sinaSymbol: "int_hangseng" },
  "^N225":     { name: "日经225", subtype: "index", region: "jp", finnhubSymbol: "N225", sinaSymbol: "int_nikkei" },
  "^FTSE":     { name: "富时100", subtype: "index", region: "uk", finnhubSymbol: "UKX", sinaSymbol: "int_ftse" },
  "^DAX":      { name: "德国DAX", subtype: "index", region: "eu", finnhubSymbol: "DAX", sinaSymbol: "int_dax" },
  "GC=F":      { name: "黄金", subtype: "commodity", region: "global", finnhubSymbol: "OANDA:XAU_USD", sinaSymbol: "hf_GC" },
  "CL=F":      { name: "原油WTI", subtype: "commodity", region: "global", finnhubSymbol: "OANDA:BCO_USD", sinaSymbol: "hf_CL" },
  "SI=F":      { name: "白银", subtype: "commodity", region: "global", finnhubSymbol: "OANDA:XAG_USD", sinaSymbol: "hf_SI" },
  "HG=F":      { name: "铜", subtype: "commodity", region: "global", sinaSymbol: "hf_HG" },
  "USDCNY=X":  { name: "美元/人民币", subtype: "fx", region: "global", finnhubSymbol: "OANDA:USD_CNH", sinaSymbol: "fx_susdcny" },
  "USDJPY=X":  { name: "美元/日元", subtype: "fx", region: "global", finnhubSymbol: "OANDA:USD_JPY", sinaSymbol: "fx_susdjpy" },
  "^TNX":      { name: "美10Y国债", subtype: "rate", region: "us", sinaSymbol: "gb_ustn10" },
  "^VIX":      { name: "VIX恐慌指数", subtype: "rate", region: "us", sinaSymbol: "int_vix" },
};

// ─── A-Share index config ────────────────────────────────────

const A_SHARE_INDICES: Record<string, string> = {
  "000001": "上证指数",
  "399001": "深证成指",
  "399006": "创业板指",
  "000300": "沪深300",
  "000905": "中证500",
};

// ─── Adapter Implementation ─────────────────────────────────

export class FinanceAdapter implements DataAdapter<FinancialEntity> {
  readonly name = "finance";
  readonly type = EntityType.FINANCIAL;
  readonly refreshIntervalMs = 30_000; // 30s for financial data

  async fetch(): Promise<FinancialEntity[]> {
    const [aShare, global] = await Promise.allSettled([
      this.fetchAShareIndices(),
      this.fetchGlobalMarkets(),
    ]);

    const results: FinancialEntity[] = [];

    if (aShare.status === "fulfilled") results.push(...aShare.value);
    if (global.status === "fulfilled") results.push(...global.value);

    return results;
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch("/api/stock-prices?symbols=000001", {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ─── A-Share via existing stock-prices API ─────────────────

  private async fetchAShareIndices(): Promise<FinancialEntity[]> {
    const symbols = Object.keys(A_SHARE_INDICES).join(",");
    const res = await fetch(`/api/stock-prices?symbols=${symbols}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.success || !data.prices) return [];

    const now = Date.now();
    return Object.entries(A_SHARE_INDICES).map(([code, name], index) => {
      const p = data.prices[code];
      return {
        id: `fin-ashare-${code}`,
        type: EntityType.FINANCIAL,
        subtype: "index" as const,
        label: name,
        coordinates: jitter(MARKET_COORDS["cn"], index),
        value: p?.price ?? null,
        delta: p?.change ?? null,
        deltaPercent: p?.changePercent ?? null,
        status: (p?.changePercent ?? 0) >= 0 ? "up" : "down",
        metadata: {
          symbol: code,
          region: "cn",
          sparkline: [],
        },
        source: "sina",
        timestamp: now,
      };
    });
  }

  // ─── Global markets via /api/global-macro (refactored) ─────

  private async fetchGlobalMarkets(): Promise<FinancialEntity[]> {
    const res = await fetch("/api/global-macro", {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.success || !data.markets) return [];

    const now = Date.now();

    // Build per-region counters so jitter index is per-region, not global
    const regionCounters: Record<string, number> = {};

    // Resolve the geographic base coordinate for a market entry,
    // mapping "global" subtypes to their semantic hub locations.
    function resolveCoords(symbol: string, region: string, subtype: string): Coordinates {
      if (region !== "global") {
        const base = MARKET_COORDS[region];
        if (!base) return MARKET_COORDS["us"]; // safe fallback
        const idx = regionCounters[region] ?? 0;
        regionCounters[region] = idx + 1;
        return jitter(base, idx);
      }
      // "global" region — route to semantic hub based on subtype
      let hubKey: string;
      if (subtype === "commodity") {
        hubKey = "commodity";
      } else if (subtype === "fx") {
        hubKey = "fx";
      } else {
        // rate or unknown global — Washington DC / Fed
        hubKey = "fed";
      }
      const base = MARKET_COORDS[hubKey];
      const idx = regionCounters[hubKey] ?? 0;
      regionCounters[hubKey] = idx + 1;
      return jitter(base, idx);
    }

    return data.markets.map((m: any) => {
      const config = GLOBAL_SYMBOLS[m.symbol];
      const region = config?.region ?? m.region ?? "global";
      const subtype = (config?.subtype ?? "index") as FinancialEntity["subtype"];
      return {
        id: `fin-global-${m.symbol}`,
        type: EntityType.FINANCIAL,
        subtype,
        label: m.name,
        coordinates: resolveCoords(m.symbol, region, subtype),
        value: m.price ?? null,
        delta: m.change ?? null,
        deltaPercent: m.changePercent ?? null,
        status: (m.changePercent ?? 0) >= 0 ? "up" : (m.changePercent ?? 0) < 0 ? "down" : "neutral",
        metadata: {
          symbol: m.symbol,
          region,
          sparkline: [],
        },
        source: m.source ?? "finnhub",
        timestamp: now,
      };
    });
  }
}

export const GLOBAL_SYMBOLS_CONFIG = GLOBAL_SYMBOLS;
