"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type HistogramData,
  type Time,
  CrosshairMode,
  type LogicalRange,
  type MouseEventParams,
} from "lightweight-charts";
import { MACD, Stochastic } from "technicalindicators";
import { ArrowLeft, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KlineRecord {
  timestamp: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  amplitude: number;
  changePercent: number;
  change: number;
  turnoverRate: number;
}

interface KlineApiResponse {
  success: boolean;
  stockCode: string;
  stockName?: string;
  interval: string;
  data: KlineRecord[];
  count: number;
  error?: string;
}

interface RealtimePrice {
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  volume: number;
  turnover: number;
  name: string;
  turnoverRate?: number;
  amplitude?: number;
  peRatio?: number;
  pbRatio?: number;
  marketCap?: number;
  circulatingMarketCap?: number;
  limitUp?: number;
  limitDown?: number;
  bidRatio?: number;
  volumeRatio?: number;
  outerVolume?: number;
  innerVolume?: number;
}

interface HoverData {
  date: string;
  o: number;
  h: number;
  l: number;
  c: number;
  vol: number;
  dif: number | null;
  dea: number | null;
  macd: number | null;
  k: number | null;
  d: number | null;
  j: number | null;
}

type Period = "1W" | "1M" | "3M" | "6M" | "1Y";

interface PeriodConfig {
  limit: number;
  label: string;
}

const PERIOD_CONFIG: Record<Period, PeriodConfig> = {
  "1W": { limit: 5, label: "1周" },
  "1M": { limit: 22, label: "1月" },
  "3M": { limit: 66, label: "3月" },
  "6M": { limit: 132, label: "6月" },
  "1Y": { limit: 252, label: "1年" },
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_BG = "#060a12";
const GRID_COLOR = "rgba(255,255,255,0.03)";
const BORDER_COLOR = "rgba(255,255,255,0.06)";
const TEXT_COLOR = "#64748b";
const UP_COLOR = "#ef4444";
const DOWN_COLOR = "#22c55e";

const MAIN_HEIGHT = 360;
const VOL_HEIGHT = 80;
const MACD_HEIGHT = 80;
const KDJ_HEIGHT = 80;

// ---------------------------------------------------------------------------
// Asset type detection
// ---------------------------------------------------------------------------

function isGlobalAsset(symbol: string): boolean {
  return (
    symbol.startsWith("^") ||
    symbol.includes("=") ||
    symbol.includes(".") ||
    /^[A-Za-z]/.test(symbol)
  );
}

// ---------------------------------------------------------------------------
// Technical indicator calculations
// ---------------------------------------------------------------------------

function calcMA(data: number[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j];
    return sum / period;
  });
}

function calcMACDIndicator(closes: number[]) {
  if (closes.length < 26) return { dif: [] as number[], dea: [] as number[], histogram: [] as number[] };

  const result = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  // MACD.calculate returns results starting at index (slowPeriod - 1) = 25
  // Pad front with zeros so arrays align with close prices
  const offset = closes.length - result.length;
  const dif: number[] = new Array(offset).fill(0);
  const dea: number[] = new Array(offset).fill(0);
  const histogram: number[] = new Array(offset).fill(0);

  for (const r of result) {
    dif.push(r.MACD ?? 0);
    dea.push(r.signal ?? 0);
    histogram.push(r.histogram != null ? r.histogram : 0);
  }

  return { dif, dea, histogram };
}

function calcKDJIndicator(
  highs: number[],
  lows: number[],
  closes: number[]
): { k: number[]; d: number[]; j: number[] } {
  if (closes.length < 9) return { k: [], d: [], j: [] };

  const result = Stochastic.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 9,
    signalPeriod: 3,
  });

  // Pad front
  const offset = closes.length - result.length;
  const k: number[] = new Array(offset).fill(50);
  const d: number[] = new Array(offset).fill(50);
  const j: number[] = new Array(offset).fill(50);

  for (const r of result) {
    const kVal = r.k ?? 50;
    const dVal = r.d ?? 50;
    k.push(kVal);
    d.push(dVal);
    j.push(3 * kVal - 2 * dVal);
  }

  return { k, d, j };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toLineData(values: (number | null)[], times: Time[]): LineData[] {
  const out: LineData[] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] !== null) {
      out.push({ time: times[i], value: values[i] as number });
    }
  }
  return out;
}

function fmtNum(n: number | undefined | null, decimals = 2): string {
  if (n == null || isNaN(n)) return "--";
  return n.toFixed(decimals);
}

function fmtVol(v: number | undefined | null): string {
  if (v == null || isNaN(v)) return "--";
  if (v >= 1e8) return (v / 1e8).toFixed(2) + "亿";
  if (v >= 1e4) return (v / 1e4).toFixed(2) + "万";
  return v.toFixed(0);
}

function fmtMktCap(v: number | undefined | null): string {
  if (v == null || isNaN(v) || v === 0) return "--";
  if (v >= 1e4) return (v / 1e4).toFixed(2) + "万亿";
  return v.toFixed(2) + "亿";
}

// Build a lookup map: time -> value for a series data array
function buildLookup(data: LineData[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of data) m.set(String(d.time), d.value);
  return m;
}

// ---------------------------------------------------------------------------
// Chart factory
// ---------------------------------------------------------------------------

function makeChartOptions(
  width: number,
  height: number,
  showTimeAxis: boolean
) {
  return {
    width,
    height,
    layout: {
      background: { color: "transparent" },
      textColor: TEXT_COLOR,
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: 10,
    },
    grid: {
      vertLines: { color: GRID_COLOR },
      horzLines: { color: GRID_COLOR },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: "rgba(255,255,255,0.15)", width: 1 as const, style: 2 },
      horzLine: { color: "rgba(255,255,255,0.15)", width: 1 as const, style: 2 },
    },
    timeScale: {
      visible: showTimeAxis,
      borderColor: BORDER_COLOR,
      timeVisible: false,
    },
    rightPriceScale: {
      borderColor: BORDER_COLOR,
      scaleMargins: { top: 0.05, bottom: 0.05 },
    },
    handleScroll: { mouseWheel: true, pressedMouseMove: true },
    handleScale: { mouseWheel: true, pinch: true },
  };
}

// ---------------------------------------------------------------------------
// TechDataStrip — always rendered, shows skeleton when data is loading
// ---------------------------------------------------------------------------

interface TechDataStripProps {
  symbol: string;
  stockName: string;
  rtPrice: RealtimePrice | null;
  lastKline: KlineRecord | null;
  onBack: () => void;
}

function TechDataStrip({ symbol, stockName, rtPrice, lastKline, onBack }: TechDataStripProps) {
  const isUp = (rtPrice?.changePercent ?? lastKline?.changePercent ?? 0) > 0;
  const isFlat = (rtPrice?.changePercent ?? lastKline?.changePercent ?? 0) === 0;
  const priceColor = isUp ? "text-[#ef4444]" : isFlat ? "text-gray-200" : "text-[#22c55e]";
  const sign = isUp ? "+" : "";

  const displayPrice = rtPrice?.price ?? lastKline?.close ?? null;
  const displayChange = rtPrice?.change ?? lastKline?.change ?? 0;
  const displayChangePct = rtPrice?.changePercent ?? lastKline?.changePercent ?? 0;

  function cell(label: string, value: string | null | undefined, colorClass?: string) {
    return (
      <div className="flex flex-col items-start min-w-0">
        <span className="text-[9px] text-white/30 leading-none tracking-wider uppercase">{label}</span>
        {value == null ? (
          <span className="mt-0.5 h-3 w-10 rounded bg-white/5 animate-pulse" />
        ) : (
          <span className={`text-[10px] font-mono tabular-nums leading-tight mt-0.5 ${colorClass ?? "text-gray-200"}`}>
            {value}
          </span>
        )}
      </div>
    );
  }

  const changeColor = isUp ? "text-[#ef4444]" : isFlat ? "text-gray-200" : "text-[#22c55e]";

  return (
    <header
      className="sticky top-0 z-30 backdrop-blur-md border-b"
      style={{ background: "rgba(6,10,18,0.95)", borderColor: "rgba(255,255,255,0.06)" }}
    >
      <div className="max-w-screen-2xl mx-auto px-3 py-2">
        {/* Row 1: Back / Identity / Price */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-300 transition-colors shrink-0"
          >
            <ArrowLeft className="h-3 w-3" />
            <span className="font-mono">返回</span>
          </button>

          <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
            <span className="text-white text-xs font-bold font-mono tracking-wide shrink-0">{symbol}</span>
            {stockName && <span className="text-gray-500 text-[11px] truncate">{stockName}</span>}
          </div>

          {/* C-position: current price */}
          <div className="text-right shrink-0">
            {displayPrice != null ? (
              <>
                <div className={`font-mono text-2xl font-bold leading-none tabular-nums ${priceColor}`}>
                  {fmtNum(displayPrice)}
                </div>
                <div className={`font-mono text-[10px] tabular-nums mt-0.5 ${changeColor}`}>
                  {sign}{fmtNum(displayChange)}&nbsp;{sign}{fmtNum(displayChangePct)}%
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <div className="h-6 w-20 rounded bg-white/5 animate-pulse" />
                <div className="h-3 w-16 rounded bg-white/5 animate-pulse ml-auto" />
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Data grid */}
        <div className="mt-2 grid grid-cols-7 gap-x-3 gap-y-1.5 border-t border-white/[0.04] pt-2">
          {cell("今开", rtPrice?.open != null ? fmtNum(rtPrice.open) : lastKline?.open != null ? fmtNum(lastKline.open) : null)}
          {cell("昨收", rtPrice?.prevClose != null ? fmtNum(rtPrice.prevClose) : null)}
          {cell("最高", rtPrice?.high != null ? fmtNum(rtPrice.high) : lastKline?.high != null ? fmtNum(lastKline.high) : null, "text-[#ef4444]")}
          {cell("最低", rtPrice?.low != null ? fmtNum(rtPrice.low) : lastKline?.low != null ? fmtNum(lastKline.low) : null, "text-[#22c55e]")}
          {cell("成交量", rtPrice?.volume != null ? fmtVol(rtPrice.volume) : lastKline?.volume != null ? fmtVol(lastKline.volume) : null)}
          {cell("成交额", rtPrice?.turnover != null ? fmtVol(rtPrice.turnover) : lastKline?.amount != null ? fmtVol(lastKline.amount) : null)}
          {cell("换手率",
            rtPrice?.turnoverRate != null ? fmtNum(rtPrice.turnoverRate) + "%" :
            lastKline?.turnoverRate != null ? fmtNum(lastKline.turnoverRate) + "%" : null
          )}
          {cell("量比", rtPrice?.volumeRatio != null ? fmtNum(rtPrice.volumeRatio) : null)}
          {cell("委比", rtPrice?.bidRatio != null ? fmtNum(rtPrice.bidRatio) + "%" : null)}
          {cell("PE", rtPrice?.peRatio != null ? fmtNum(rtPrice.peRatio) : null)}
          {cell("PB", rtPrice?.pbRatio != null ? fmtNum(rtPrice.pbRatio) : null)}
          {cell("总市值", rtPrice?.marketCap != null ? fmtMktCap(rtPrice.marketCap) : null)}
          {cell("流通市值", rtPrice?.circulatingMarketCap != null ? fmtMktCap(rtPrice.circulatingMarketCap) : null)}
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AssetDetailView({ symbol }: { symbol: string }) {
  const router = useRouter();
  const global = useMemo(() => isGlobalAsset(symbol), [symbol]);

  // State
  const [period, setPeriod] = useState<Period>("3M");
  const [klineData, setKlineData] = useState<KlineRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stockName, setStockName] = useState("");
  const [rtPrice, setRtPrice] = useState<RealtimePrice | null>(null);
  const [hoverData, setHoverData] = useState<HoverData | null>(null);

  // Container refs
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const volContainerRef = useRef<HTMLDivElement>(null);
  const macdContainerRef = useRef<HTMLDivElement>(null);
  const kdjContainerRef = useRef<HTMLDivElement>(null);

  // Chart refs
  const chartsRef = useRef<{
    main: IChartApi | null;
    vol: IChartApi | null;
    macd: IChartApi | null;
    kdj: IChartApi | null;
  }>({ main: null, vol: null, macd: null, kdj: null });

  // Series refs for crosshair sync
  const seriesRef = useRef<{
    candle: ISeriesApi<"Candlestick"> | null;
    volHist: ISeriesApi<"Histogram"> | null;
    macdDif: ISeriesApi<"Line"> | null;
    kdjK: ISeriesApi<"Line"> | null;
  }>({ candle: null, volHist: null, macdDif: null, kdjK: null });

  // Computed indicator data for hover overlay lookups
  const indicatorDataRef = useRef<{
    candleLookup: Map<string, KlineRecord>;
    volLookup: Map<string, number>;
    difLookup: Map<string, number>;
    deaLookup: Map<string, number>;
    macdLookup: Map<string, number>;
    kLookup: Map<string, number>;
    dLookup: Map<string, number>;
    jLookup: Map<string, number>;
  }>({
    candleLookup: new Map(),
    volLookup: new Map(),
    difLookup: new Map(),
    deaLookup: new Map(),
    macdLookup: new Map(),
    kLookup: new Map(),
    dLookup: new Map(),
    jLookup: new Map(),
  });

  // -------------------------------------------------------------------
  // Fetch K-line (A-shares only)
  // -------------------------------------------------------------------
  const fetchKline = useCallback(
    async (p: Period) => {
      if (global) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const cfg = PERIOD_CONFIG[p];
        const res = await fetch(
          `/api/stock-price-history?stockCode=${encodeURIComponent(symbol)}&interval=day&limit=${cfg.limit}`
        );
        if (!res.ok) throw new Error(`API ${res.status}`);
        const json: KlineApiResponse = await res.json();
        if (!json.success || !json.data || json.data.length === 0) {
          setError(json.error || `无 K 线数据: ${symbol}`);
          setKlineData([]);
          return;
        }
        setKlineData(json.data);
        if (json.stockName) setStockName(json.stockName);
      } catch (err) {
        console.error("[AssetDetailView] kline fetch:", err);
        setError(`加载失败: ${symbol}`);
        setKlineData([]);
      } finally {
        setIsLoading(false);
      }
    },
    [symbol, global]
  );

  // -------------------------------------------------------------------
  // Fetch real-time price
  // -------------------------------------------------------------------
  const fetchRealtime = useCallback(async () => {
    try {
      if (global) {
        // Fetch from global-macro endpoint
        const res = await fetch("/api/global-macro");
        if (!res.ok) return;
        const json = await res.json();
        const d = Array.isArray(json.markets)
          ? json.markets.find((m: any) => m.symbol === symbol)
          : null;
        if (d) {
          setRtPrice({
            price: d.price ?? 0,
            change: d.change ?? 0,
            changePercent: d.changePercent ?? 0,
            high: 0,
            low: 0,
            open: 0,
            prevClose: 0,
            volume: 0,
            turnover: 0,
            name: d.name ?? symbol,
          });
          if (d.name) setStockName(d.name);
        }
      } else {
        const res = await fetch(
          `/api/stock-prices?symbols=${encodeURIComponent(symbol)}`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.prices?.[symbol]) {
          const pd = json.prices[symbol] as RealtimePrice;
          setRtPrice(pd);
          if (pd.name) setStockName(pd.name);
        }
      }
    } catch {
      // best-effort
    }
  }, [symbol, global]);

  // Initial loads
  useEffect(() => {
    fetchKline(period);
  }, [period, fetchKline]);

  useEffect(() => {
    fetchRealtime();
    const id = setInterval(fetchRealtime, 15_000);
    return () => clearInterval(id);
  }, [fetchRealtime]);

  // -------------------------------------------------------------------
  // Build charts
  // -------------------------------------------------------------------
  useEffect(() => {
    if (klineData.length === 0) return;

    // Cleanup
    chartsRef.current.main?.remove();
    chartsRef.current.vol?.remove();
    chartsRef.current.macd?.remove();
    chartsRef.current.kdj?.remove();
    chartsRef.current = { main: null, vol: null, macd: null, kdj: null };
    seriesRef.current = { candle: null, volHist: null, macdDif: null, kdjK: null };

    const mainEl = mainContainerRef.current;
    const volEl = volContainerRef.current;
    const macdEl = macdContainerRef.current;
    const kdjEl = kdjContainerRef.current;
    if (!mainEl || !volEl || !macdEl || !kdjEl) return;

    const width = mainEl.clientWidth || 800;

    // Derived arrays
    const times = klineData.map((d) => d.timestamp as Time);
    const closes = klineData.map((d) => d.close);
    const highs = klineData.map((d) => d.high);
    const lows = klineData.map((d) => d.low);

    // ================================================================
    // MAIN CHART: Candlestick + MA5/10/20/60
    // ================================================================
    const mainChart = createChart(mainEl, makeChartOptions(width, MAIN_HEIGHT, false));
    chartsRef.current.main = mainChart;

    const candleSeries = mainChart.addCandlestickSeries({
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      borderUpColor: UP_COLOR,
      borderDownColor: DOWN_COLOR,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
    });
    const candleData: CandlestickData[] = klineData.map((d) => ({
      time: d.timestamp as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
    candleSeries.setData(candleData);
    seriesRef.current.candle = candleSeries;

    // MAs
    const ma5 = calcMA(closes, 5);
    const ma10 = calcMA(closes, 10);
    const ma20 = calcMA(closes, 20);
    const ma60 = calcMA(closes, 60);

    const ma5s = mainChart.addLineSeries({ color: "#f59e0b", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
    const ma10s = mainChart.addLineSeries({ color: "#3b82f6", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
    const ma20s = mainChart.addLineSeries({ color: "#a855f7", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
    const ma60s = mainChart.addLineSeries({ color: "#6b7280", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });

    ma5s.setData(toLineData(ma5, times));
    ma10s.setData(toLineData(ma10, times));
    ma20s.setData(toLineData(ma20, times));
    ma60s.setData(toLineData(ma60, times));

    mainChart.timeScale().fitContent();

    // ================================================================
    // VOLUME CHART
    // ================================================================
    const volChart = createChart(volEl, makeChartOptions(width, VOL_HEIGHT, false));
    chartsRef.current.vol = volChart;

    const volSeries = volChart.addHistogramSeries({
      color: UP_COLOR,
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    const volData: HistogramData[] = klineData.map((d) => ({
      time: d.timestamp as Time,
      value: d.volume,
      color: d.close >= d.open ? UP_COLOR : DOWN_COLOR,
    }));
    volSeries.setData(volData);
    volChart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.1, bottom: 0 } });
    volChart.timeScale().fitContent();
    seriesRef.current.volHist = volSeries;

    // ================================================================
    // MACD CHART
    // ================================================================
    const macdChart = createChart(macdEl, makeChartOptions(width, MACD_HEIGHT, false));
    chartsRef.current.macd = macdChart;

    let macdResult = { dif: [] as number[], dea: [] as number[], histogram: [] as number[] };
    let kdjResult = { k: [] as number[], d: [] as number[], j: [] as number[] };
    try {
      macdResult = calcMACDIndicator(closes);
      kdjResult = calcKDJIndicator(highs, lows, closes);
    } catch (e) {
      console.error("[AssetDetailView] indicator calc error:", e);
    }
    const { dif, dea, histogram } = macdResult;

    const difSeries = macdChart.addLineSeries({ color: "#3b82f6", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
    const deaSeries = macdChart.addLineSeries({ color: "#f59e0b", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
    const macdHistSeries = macdChart.addHistogramSeries({ color: UP_COLOR, lastValueVisible: false, priceLineVisible: false });

    const difLineData = dif.map((v, i) => ({ time: times[i], value: v })) as LineData[];
    const deaLineData = dea.map((v, i) => ({ time: times[i], value: v })) as LineData[];
    const macdBarData = histogram.map((v, i) => ({
      time: times[i],
      value: v,
      color: v >= 0 ? UP_COLOR : DOWN_COLOR,
    })) as HistogramData[];

    difSeries.setData(difLineData);
    deaSeries.setData(deaLineData);
    macdHistSeries.setData(macdBarData);
    macdChart.timeScale().fitContent();
    seriesRef.current.macdDif = difSeries;

    // ================================================================
    // KDJ CHART (bottom — visible time axis)
    // ================================================================
    const kdjChart = createChart(kdjEl, makeChartOptions(width, KDJ_HEIGHT, true));
    chartsRef.current.kdj = kdjChart;

    const { k, d, j } = kdjResult;

    const kSeries = kdjChart.addLineSeries({ color: "#3b82f6", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
    const dSeries = kdjChart.addLineSeries({ color: "#f59e0b", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
    const jSeries = kdjChart.addLineSeries({ color: "#a855f7", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });

    const kLineData = k.map((v, i) => ({ time: times[i], value: v })) as LineData[];
    const dLineData = d.map((v, i) => ({ time: times[i], value: v })) as LineData[];
    const jLineData = j.map((v, i) => ({ time: times[i], value: v })) as LineData[];

    kSeries.setData(kLineData);
    dSeries.setData(dLineData);
    jSeries.setData(jLineData);
    kdjChart.timeScale().fitContent();
    seriesRef.current.kdjK = kSeries;

    // ================================================================
    // Build indicator lookups for hover overlay
    // ================================================================
    const candleLookup = new Map<string, KlineRecord>();
    for (const d of klineData) candleLookup.set(d.timestamp, d);

    indicatorDataRef.current = {
      candleLookup,
      volLookup: buildLookup(volData.map((d) => ({ time: d.time, value: d.value }))),
      difLookup: buildLookup(difLineData),
      deaLookup: buildLookup(deaLineData),
      macdLookup: buildLookup(macdBarData.map((d) => ({ time: d.time, value: d.value }))),
      kLookup: buildLookup(kLineData),
      dLookup: buildLookup(dLineData),
      jLookup: buildLookup(jLineData),
    };

    // ================================================================
    // Crosshair sync (bi-directional) + hover data overlay
    // ================================================================
    let isSyncing = false;

    type ChartEntry = {
      chart: IChartApi;
      series: ISeriesApi<"Candlestick"> | ISeriesApi<"Histogram"> | ISeriesApi<"Line">;
      dataMap: Map<string, number>;
    };

    // Build lookup maps for candlestick (use close as the value for setCrosshairPosition)
    const candleValMap = new Map<string, number>();
    for (const d of candleData) candleValMap.set(String(d.time), d.close);

    const volValMap = new Map<string, number>();
    for (const d of volData) volValMap.set(String(d.time), d.value);

    const difValMap = new Map<string, number>();
    for (const d of difLineData) difValMap.set(String(d.time), d.value);

    const kValMap = new Map<string, number>();
    for (const d of kLineData) kValMap.set(String(d.time), d.value);

    const entries: ChartEntry[] = [
      { chart: mainChart, series: candleSeries, dataMap: candleValMap },
      { chart: volChart, series: volSeries, dataMap: volValMap },
      { chart: macdChart, series: difSeries, dataMap: difValMap },
      { chart: kdjChart, series: kSeries, dataMap: kValMap },
    ];

    const handleCrosshairMove = (srcIdx: number) => (param: MouseEventParams) => {
      if (isSyncing) return;
      isSyncing = true;

      if (param.time) {
        const timeKey = String(param.time);

        // Update hover data
        const rec = indicatorDataRef.current.candleLookup.get(timeKey);
        if (rec) {
          setHoverData({
            date: rec.timestamp,
            o: rec.open,
            h: rec.high,
            l: rec.low,
            c: rec.close,
            vol: rec.volume,
            dif: indicatorDataRef.current.difLookup.get(timeKey) ?? null,
            dea: indicatorDataRef.current.deaLookup.get(timeKey) ?? null,
            macd: indicatorDataRef.current.macdLookup.get(timeKey) ?? null,
            k: indicatorDataRef.current.kLookup.get(timeKey) ?? null,
            d: indicatorDataRef.current.dLookup.get(timeKey) ?? null,
            j: indicatorDataRef.current.jLookup.get(timeKey) ?? null,
          });
        }

        // Sync crosshair to other charts
        entries.forEach((entry, idx) => {
          if (idx === srcIdx) return;
          const val = entry.dataMap.get(timeKey);
          if (val !== undefined) {
            entry.chart.setCrosshairPosition(val, param.time!, entry.series);
          }
        });
      } else {
        setHoverData(null);
        entries.forEach((entry, idx) => {
          if (idx === srcIdx) return;
          entry.chart.clearCrosshairPosition();
        });
      }

      isSyncing = false;
    };

    // Subscribe crosshair move on each chart
    mainChart.subscribeCrosshairMove(handleCrosshairMove(0));
    volChart.subscribeCrosshairMove(handleCrosshairMove(1));
    macdChart.subscribeCrosshairMove(handleCrosshairMove(2));
    kdjChart.subscribeCrosshairMove(handleCrosshairMove(3));

    // ================================================================
    // Time scale zoom/pan sync
    // ================================================================
    const allCharts = [mainChart, volChart, macdChart, kdjChart];

    allCharts.forEach((src, si) => {
      src.timeScale().subscribeVisibleLogicalRangeChange((range: LogicalRange | null) => {
        if (isSyncing || !range) return;
        isSyncing = true;
        allCharts.forEach((tgt, ti) => {
          if (si !== ti) tgt.timeScale().setVisibleLogicalRange(range);
        });
        isSyncing = false;
      });
    });

    // ================================================================
    // ResizeObserver
    // ================================================================
    const observer = new ResizeObserver(() => {
      const w = mainEl.clientWidth;
      if (!w) return;
      mainChart.applyOptions({ width: w });
      volChart.applyOptions({ width: w });
      macdChart.applyOptions({ width: w });
      kdjChart.applyOptions({ width: w });
    });
    observer.observe(mainEl);

    // ================================================================
    // Cleanup
    // ================================================================
    return () => {
      observer.disconnect();
      mainChart.remove();
      volChart.remove();
      macdChart.remove();
      kdjChart.remove();
      chartsRef.current = { main: null, vol: null, macd: null, kdj: null };
      seriesRef.current = { candle: null, volHist: null, macdDif: null, kdjK: null };
    };
  }, [klineData]);

  // -------------------------------------------------------------------
  // Derived display values
  // -------------------------------------------------------------------
  const lastKline = klineData[klineData.length - 1] ?? null;
  const displayPrice = rtPrice?.price ?? lastKline?.close ?? null;
  const displayChange = rtPrice?.change ?? lastKline?.change ?? 0;
  const displayChangePct = rtPrice?.changePercent ?? lastKline?.changePercent ?? 0;
  const isUp = displayChangePct > 0;
  const isFlat = displayChangePct === 0;
  const priceColor = isUp ? "text-red-400" : isFlat ? "text-gray-200" : "text-green-400";
  const sign = isUp ? "+" : "";

  // -------------------------------------------------------------------
  // Info grid items
  // -------------------------------------------------------------------
  const infoItems = [
    { label: "今开", value: fmtNum(rtPrice?.open ?? lastKline?.open) },
    { label: "昨收", value: fmtNum(rtPrice?.prevClose) },
    { label: "最高", value: fmtNum(rtPrice?.high ?? lastKline?.high) },
    { label: "最低", value: fmtNum(rtPrice?.low ?? lastKline?.low) },
    { label: "成交量", value: fmtVol(rtPrice?.volume ?? lastKline?.volume) },
    { label: "成交额", value: fmtVol(rtPrice?.turnover ?? lastKline?.amount) },
    {
      label: "换手率",
      value:
        rtPrice?.turnoverRate != null
          ? fmtNum(rtPrice.turnoverRate) + "%"
          : lastKline?.turnoverRate != null
          ? fmtNum(lastKline.turnoverRate) + "%"
          : "--",
    },
    { label: "量比", value: rtPrice?.volumeRatio != null ? fmtNum(rtPrice.volumeRatio) : "--" },
    { label: "委比", value: rtPrice?.bidRatio != null ? fmtNum(rtPrice.bidRatio) + "%" : "--" },
    { label: "PE", value: rtPrice?.peRatio != null ? fmtNum(rtPrice.peRatio) : "--" },
    { label: "PB", value: rtPrice?.pbRatio != null ? fmtNum(rtPrice.pbRatio) : "--" },
    { label: "总市值", value: fmtMktCap(rtPrice?.marketCap) },
    { label: "流通市值", value: fmtMktCap(rtPrice?.circulatingMarketCap) },
  ];

  // -------------------------------------------------------------------
  // Back navigation
  // -------------------------------------------------------------------
  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/osint");
    }
  };

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div
      className="min-h-screen overflow-y-auto"
      style={{ background: PAGE_BG, fontFamily: "'JetBrains Mono', 'SF Mono', monospace" }}
    >
      <TechDataStrip
        symbol={symbol}
        stockName={stockName}
        rtPrice={rtPrice}
        lastKline={lastKline}
        onBack={handleBack}
      />

      {/* ── Content ────────────────────────────────────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-2 sm:px-3 pb-6" ref={wrapperRef}>
        {/* Period selector */}
        <div className="flex gap-1 pt-3 pb-2">
          {(Object.keys(PERIOD_CONFIG) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded text-[10px] font-mono font-medium transition-colors ${
                period === p
                  ? "bg-blue-600/80 text-white"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Global asset placeholder */}
        {global ? (
          <div className="flex items-center justify-center h-[600px]">
            <div className="text-center space-y-2">
              <p className="text-gray-500 text-sm font-mono">
                全球资产K线数据开发中
              </p>
              <p className="text-gray-600 text-[10px]">
                实时报价已显示于顶部数据条
              </p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-[600px]">
            <div className="text-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500 mx-auto" />
              <p className="text-[10px] text-gray-600 font-mono">加载 K 线...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-[600px]">
            <div className="text-center space-y-2">
              <p className="text-gray-400 text-xs">{error}</p>
              <button
                onClick={() => fetchKline(period)}
                className="text-blue-400 hover:text-blue-300 text-[10px] underline underline-offset-2"
              >
                重新加载
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-px relative">
            {/* ── Crosshair data overlay (top-right of main chart) ── */}
            {hoverData && (
              <div
                className="absolute top-1 right-1 z-20 rounded px-2 py-1.5 pointer-events-none"
                style={{
                  background: "rgba(6,10,18,0.88)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[9px] font-mono">
                  <span className="text-gray-500">日期</span>
                  <span className="text-gray-300">{hoverData.date}</span>
                  <span className="text-gray-500">开</span>
                  <span className="text-gray-300">{fmtNum(hoverData.o)}</span>
                  <span className="text-gray-500">高</span>
                  <span className="text-gray-300">{fmtNum(hoverData.h)}</span>
                  <span className="text-gray-500">低</span>
                  <span className="text-gray-300">{fmtNum(hoverData.l)}</span>
                  <span className="text-gray-500">收</span>
                  <span className={hoverData.c >= hoverData.o ? "text-red-400" : "text-green-400"}>
                    {fmtNum(hoverData.c)}
                  </span>
                  <span className="text-gray-500">量</span>
                  <span className="text-gray-300">{fmtVol(hoverData.vol)}</span>

                  {/* Divider */}
                  <div className="col-span-2 border-t border-white/5 my-0.5" />

                  <span className="text-gray-500">DIF</span>
                  <span className="text-[#3b82f6]">{hoverData.dif != null ? fmtNum(hoverData.dif, 3) : "--"}</span>
                  <span className="text-gray-500">DEA</span>
                  <span className="text-[#f59e0b]">{hoverData.dea != null ? fmtNum(hoverData.dea, 3) : "--"}</span>
                  <span className="text-gray-500">MACD</span>
                  <span className={hoverData.macd != null ? (hoverData.macd >= 0 ? "text-red-400" : "text-green-400") : "text-gray-500"}>
                    {hoverData.macd != null ? fmtNum(hoverData.macd, 3) : "--"}
                  </span>

                  <div className="col-span-2 border-t border-white/5 my-0.5" />

                  <span className="text-gray-500">K</span>
                  <span className="text-[#3b82f6]">{hoverData.k != null ? fmtNum(hoverData.k, 1) : "--"}</span>
                  <span className="text-gray-500">D</span>
                  <span className="text-[#f59e0b]">{hoverData.d != null ? fmtNum(hoverData.d, 1) : "--"}</span>
                  <span className="text-gray-500">J</span>
                  <span className="text-[#a855f7]">{hoverData.j != null ? fmtNum(hoverData.j, 1) : "--"}</span>
                </div>
              </div>
            )}

            {/* ── Main candlestick chart ────────────────────────── */}
            <div
              className="rounded-t overflow-hidden"
              style={{ border: `1px solid ${BORDER_COLOR}` }}
            >
              <div
                className="flex items-center gap-3 px-3 py-1 text-[9px] font-mono"
                style={{
                  borderBottom: `1px solid ${BORDER_COLOR}`,
                  background: "rgba(255,255,255,0.01)",
                }}
              >
                <span className="text-gray-600">K线</span>
                <span className="text-[#f59e0b]">- MA5</span>
                <span className="text-[#3b82f6]">- MA10</span>
                <span className="text-[#a855f7]">- MA20</span>
                <span className="text-[#6b7280]">- MA60</span>
              </div>
              <div ref={mainContainerRef} style={{ height: MAIN_HEIGHT, background: "transparent" }} />
            </div>

            {/* ── Volume chart ──────────────────────────────────── */}
            <div
              className="overflow-hidden"
              style={{
                borderLeft: `1px solid ${BORDER_COLOR}`,
                borderRight: `1px solid ${BORDER_COLOR}`,
                borderBottom: `1px solid ${BORDER_COLOR}`,
              }}
            >
              <div
                className="flex items-center gap-3 px-3 py-0.5 text-[9px] font-mono"
                style={{
                  borderBottom: `1px solid ${BORDER_COLOR}`,
                  background: "rgba(255,255,255,0.01)",
                }}
              >
                <span className="text-gray-600">VOL</span>
                <span className="text-red-400/70">阳</span>
                <span className="text-green-400/70">阴</span>
              </div>
              <div ref={volContainerRef} style={{ height: VOL_HEIGHT, background: "transparent" }} />
            </div>

            {/* ── MACD chart ────────────────────────────────────── */}
            <div
              className="overflow-hidden"
              style={{
                borderLeft: `1px solid ${BORDER_COLOR}`,
                borderRight: `1px solid ${BORDER_COLOR}`,
                borderBottom: `1px solid ${BORDER_COLOR}`,
              }}
            >
              <div
                className="flex items-center gap-3 px-3 py-0.5 text-[9px] font-mono"
                style={{
                  borderBottom: `1px solid ${BORDER_COLOR}`,
                  background: "rgba(255,255,255,0.01)",
                }}
              >
                <span className="text-gray-600">MACD(12,26,9)</span>
                <span className="text-[#3b82f6]">DIF</span>
                <span className="text-[#f59e0b]">DEA</span>
                <span className="text-gray-500">MACD</span>
              </div>
              <div ref={macdContainerRef} style={{ height: MACD_HEIGHT, background: "transparent" }} />
            </div>

            {/* ── KDJ chart (bottom — has visible time axis) ──── */}
            <div
              className="rounded-b overflow-hidden"
              style={{
                borderLeft: `1px solid ${BORDER_COLOR}`,
                borderRight: `1px solid ${BORDER_COLOR}`,
                borderBottom: `1px solid ${BORDER_COLOR}`,
              }}
            >
              <div
                className="flex items-center gap-3 px-3 py-0.5 text-[9px] font-mono"
                style={{
                  borderBottom: `1px solid ${BORDER_COLOR}`,
                  background: "rgba(255,255,255,0.01)",
                }}
              >
                <span className="text-gray-600">KDJ(9,3,3)</span>
                <span className="text-[#3b82f6]">K</span>
                <span className="text-[#f59e0b]">D</span>
                <span className="text-[#a855f7]">J</span>
              </div>
              <div ref={kdjContainerRef} style={{ height: KDJ_HEIGHT, background: "transparent" }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
