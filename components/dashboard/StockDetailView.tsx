"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  createChart,
  type IChartApi,
  type CandlestickData,
  type LineData,
  type HistogramData,
  type Time,
  CrosshairMode,
} from "lightweight-charts";
import { ArrowLeft, Loader2, ChevronDown, ChevronUp } from "lucide-react";

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
  outerVolume?: number;
  innerVolume?: number;
}

type Period = "1W" | "1M" | "3M" | "6M" | "1Y";

interface PeriodConfig {
  klt: number;
  limit: number;
  label: string;
}

const PERIOD_CONFIG: Record<Period, PeriodConfig> = {
  "1W": { klt: 101, limit: 5,   label: "1周" },
  "1M": { klt: 101, limit: 22,  label: "1月" },
  "3M": { klt: 101, limit: 66,  label: "3月" },
  "6M": { klt: 101, limit: 132, label: "6月" },
  "1Y": { klt: 101, limit: 252, label: "1年" },
};

// ---------------------------------------------------------------------------
// Chart constants — Chinese convention: RED = up, GREEN = down
// ---------------------------------------------------------------------------
const CHART_BG    = "#0a0e17";
const GRID_COLOR  = "#1a2035";
const TEXT_COLOR  = "#64748b";
const UP_COLOR    = "#ef4444"; // red = price up (Chinese convention)
const DOWN_COLOR  = "#22c55e"; // green = price down (Chinese convention)

// ---------------------------------------------------------------------------
// Technical indicator calculations
// ---------------------------------------------------------------------------

function calcMA(data: number[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const slice = data.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

function calcEMA(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

function calcMACD(closes: number[]) {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const dif = ema12.map((e, i) => e - ema26[i]);
  const dea = calcEMA(dif, 9);
  const histogram = dif.map((d, i) => 2 * (d - dea[i]));
  return { dif, dea, histogram };
}

function calcKDJ(highs: number[], lows: number[], closes: number[]) {
  const k: number[] = [];
  const d: number[] = [];
  const j: number[] = [];
  let prevK = 50, prevD = 50;
  for (let i = 0; i < closes.length; i++) {
    const start = Math.max(0, i - 8);
    const highN = Math.max(...highs.slice(start, i + 1));
    const lowN  = Math.min(...lows.slice(start, i + 1));
    const rsv   = highN === lowN ? 50 : ((closes[i] - lowN) / (highN - lowN)) * 100;
    const curK  = (2 / 3) * prevK + (1 / 3) * rsv;
    const curD  = (2 / 3) * prevD + (1 / 3) * curK;
    const curJ  = 3 * curK - 2 * curD;
    k.push(curK);
    d.push(curD);
    j.push(curJ);
    prevK = curK;
    prevD = curD;
  }
  return { k, d, j };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toLineData(values: (number | null)[], times: Time[]): LineData[] {
  return values
    .map((v, i) => (v !== null ? ({ time: times[i], value: v } as LineData) : null))
    .filter(Boolean) as LineData[];
}

function fmtNum(n: number | undefined | null, decimals = 2): string {
  if (n == null || isNaN(n)) return "--";
  return n.toFixed(decimals);
}

function fmtVolume(v: number | undefined | null): string {
  if (v == null || isNaN(v)) return "--";
  if (v >= 1e8) return (v / 1e8).toFixed(2) + "亿";
  if (v >= 1e4) return (v / 1e4).toFixed(2) + "万";
  return v.toFixed(0);
}

function fmtMarketCap(v: number | undefined | null): string {
  if (v == null || isNaN(v) || v === 0) return "--";
  // Tencent API returns market cap in 亿元
  if (v >= 1e4) return (v / 1e4).toFixed(2) + "万亿";
  return v.toFixed(2) + "亿";
}

function getChartOptions(width: number, height: number) {
  return {
    width,
    height,
    layout: {
      background: { color: CHART_BG },
      textColor: TEXT_COLOR,
    },
    grid: {
      vertLines: { color: GRID_COLOR },
      horzLines: { color: GRID_COLOR },
    },
    crosshair: { mode: CrosshairMode.Normal },
    timeScale: {
      borderColor: GRID_COLOR,
      timeVisible: false,
    },
    rightPriceScale: { borderColor: GRID_COLOR },
    handleScroll: { mouseWheel: true, pressedMouseMove: true },
    handleScale: { mouseWheel: true, pinch: true },
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StockDetailView({ symbol }: { symbol: string }) {
  const router = useRouter();

  const [period, setPeriod]         = useState<Period>("3M");
  const [klineData, setKlineData]   = useState<KlineRecord[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [stockName, setStockName]   = useState<string>("");
  const [rtPrice, setRtPrice]       = useState<RealtimePrice | null>(null);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [aiText, setAiText]         = useState<string>("");
  const [aiLoading, setAiLoading]   = useState(false);

  // Chart container refs
  const mainContainerRef   = useRef<HTMLDivElement>(null);
  const volContainerRef    = useRef<HTMLDivElement>(null);
  const macdContainerRef   = useRef<HTMLDivElement>(null);
  const kdjContainerRef    = useRef<HTMLDivElement>(null);

  // Chart instance refs
  const mainChartRef = useRef<IChartApi | null>(null);
  const volChartRef  = useRef<IChartApi | null>(null);
  const macdChartRef = useRef<IChartApi | null>(null);
  const kdjChartRef  = useRef<IChartApi | null>(null);

  // -------------------------------------------------------------------
  // Fetch K-line data from East Money via our API
  // -------------------------------------------------------------------
  const fetchKline = useCallback(async (p: Period) => {
    setIsLoading(true);
    setError(null);
    try {
      const cfg = PERIOD_CONFIG[p];
      const res = await fetch(
        `/api/stock-price-history?stockCode=${encodeURIComponent(symbol)}&interval=day&limit=${cfg.limit}`
      );
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json: KlineApiResponse = await res.json();

      if (!json.success || !json.data || json.data.length === 0) {
        setError(json.error || `No K-line data available for ${symbol}`);
        setKlineData([]);
        return;
      }

      setKlineData(json.data);
      if (json.stockName) setStockName(json.stockName);
      setError(null);
    } catch (err) {
      console.error("[StockDetailView] kline fetch error:", err);
      setError(`Failed to load chart data for ${symbol}`);
      setKlineData([]);
    } finally {
      setIsLoading(false);
    }
  }, [symbol]);

  // -------------------------------------------------------------------
  // Fetch real-time price every 15s
  // -------------------------------------------------------------------
  const fetchRealtime = useCallback(async () => {
    try {
      const res = await fetch(`/api/stock-prices?symbols=${encodeURIComponent(symbol)}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.prices?.[symbol]) {
        const pd = json.prices[symbol] as RealtimePrice;
        setRtPrice(pd);
        if (pd.name) setStockName(pd.name);
      }
    } catch {
      // Best-effort, ignore errors
    }
  }, [symbol]);

  // Initial loads
  useEffect(() => { fetchKline(period); }, [period, fetchKline]);
  useEffect(() => {
    fetchRealtime();
    const id = setInterval(fetchRealtime, 15_000);
    return () => clearInterval(id);
  }, [fetchRealtime]);

  // -------------------------------------------------------------------
  // Build / rebuild all charts when klineData changes
  // -------------------------------------------------------------------
  useEffect(() => {
    if (klineData.length === 0) return;

    // Cleanup previous instances
    mainChartRef.current?.remove();
    volChartRef.current?.remove();
    macdChartRef.current?.remove();
    kdjChartRef.current?.remove();
    mainChartRef.current = null;
    volChartRef.current  = null;
    macdChartRef.current = null;
    kdjChartRef.current  = null;

    const mainEl = mainContainerRef.current;
    const volEl  = volContainerRef.current;
    const macdEl = macdContainerRef.current;
    const kdjEl  = kdjContainerRef.current;
    if (!mainEl || !volEl || !macdEl || !kdjEl) return;

    const width = mainEl.clientWidth || 800;

    // Derived arrays
    const times  = klineData.map((d) => d.timestamp as Time);
    const closes = klineData.map((d) => d.close);
    const highs  = klineData.map((d) => d.high);
    const lows   = klineData.map((d) => d.low);

    // ================================================================
    // MAIN CHART: Candlestick + MA5 + MA10 + MA20 + MA60
    // ================================================================
    const mainChart = createChart(mainEl, getChartOptions(width, 380));
    mainChartRef.current = mainChart;

    const candleSeries = mainChart.addCandlestickSeries({
      upColor:        UP_COLOR,
      downColor:      DOWN_COLOR,
      borderUpColor:  UP_COLOR,
      borderDownColor: DOWN_COLOR,
      wickUpColor:    UP_COLOR,
      wickDownColor:  DOWN_COLOR,
    });
    const candleData: CandlestickData[] = klineData.map((d) => ({
      time:  d.timestamp as Time,
      open:  d.open,
      high:  d.high,
      low:   d.low,
      close: d.close,
    }));
    candleSeries.setData(candleData);

    // Moving averages
    const ma5  = calcMA(closes, 5);
    const ma10 = calcMA(closes, 10);
    const ma20 = calcMA(closes, 20);
    const ma60 = calcMA(closes, 60);

    const ma5Series  = mainChart.addLineSeries({ color: "#f59e0b", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
    const ma10Series = mainChart.addLineSeries({ color: "#3b82f6", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
    const ma20Series = mainChart.addLineSeries({ color: "#a855f7", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
    const ma60Series = mainChart.addLineSeries({ color: "#6b7280", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });

    ma5Series.setData(toLineData(ma5, times));
    ma10Series.setData(toLineData(ma10, times));
    ma20Series.setData(toLineData(ma20, times));
    ma60Series.setData(toLineData(ma60, times));

    mainChart.timeScale().fitContent();

    // ================================================================
    // VOLUME CHART
    // ================================================================
    const volChart = createChart(volEl, getChartOptions(width, 100));
    volChartRef.current = volChart;

    const volSeries = volChart.addHistogramSeries({
      color: UP_COLOR,
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    const volData: HistogramData[] = klineData.map((d) => ({
      time:  d.timestamp as Time,
      value: d.volume,
      color: d.close >= d.open ? UP_COLOR : DOWN_COLOR,
    }));
    volSeries.setData(volData);
    volChart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.1, bottom: 0 } });
    volChart.timeScale().fitContent();

    // ================================================================
    // MACD CHART
    // ================================================================
    const macdChart = createChart(macdEl, getChartOptions(width, 100));
    macdChartRef.current = macdChart;

    const { dif, dea, histogram } = calcMACD(closes);

    const difSeries  = macdChart.addLineSeries({ color: "#3b82f6", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
    const deaSeries  = macdChart.addLineSeries({ color: "#f59e0b", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
    const histSeries = macdChart.addHistogramSeries({ color: UP_COLOR, lastValueVisible: false, priceLineVisible: false });

    difSeries.setData(dif.map((v, i) => ({ time: times[i], value: v })) as LineData[]);
    deaSeries.setData(dea.map((v, i) => ({ time: times[i], value: v })) as LineData[]);
    histSeries.setData(
      histogram.map((v, i) => ({
        time:  times[i],
        value: v,
        color: v >= 0 ? UP_COLOR : DOWN_COLOR,
      })) as HistogramData[]
    );

    macdChart.timeScale().fitContent();

    // ================================================================
    // KDJ CHART
    // ================================================================
    const kdjChart = createChart(kdjEl, getChartOptions(width, 100));
    kdjChartRef.current = kdjChart;

    const { k, d, j } = calcKDJ(highs, lows, closes);

    const kSeries = kdjChart.addLineSeries({ color: "#3b82f6", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
    const dSeries = kdjChart.addLineSeries({ color: "#f59e0b", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
    const jSeries = kdjChart.addLineSeries({ color: "#a855f7", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });

    kSeries.setData(k.map((v, i) => ({ time: times[i], value: v })) as LineData[]);
    dSeries.setData(d.map((v, i) => ({ time: times[i], value: v })) as LineData[]);
    jSeries.setData(j.map((v, i) => ({ time: times[i], value: v })) as LineData[]);

    kdjChart.timeScale().fitContent();

    // ================================================================
    // Sync timescales across all charts
    // ================================================================
    const allCharts = [mainChart, volChart, macdChart, kdjChart];
    let syncing = false;

    allCharts.forEach((src, si) => {
      src.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (syncing || !range) return;
        syncing = true;
        allCharts.forEach((tgt, ti) => {
          if (si !== ti) tgt.timeScale().setVisibleLogicalRange(range);
        });
        syncing = false;
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

    return () => {
      observer.disconnect();
      mainChart.remove();
      volChart.remove();
      macdChart.remove();
      kdjChart.remove();
      mainChartRef.current = null;
      volChartRef.current  = null;
      macdChartRef.current = null;
      kdjChartRef.current  = null;
    };
  }, [klineData]);

  // -------------------------------------------------------------------
  // AI analysis
  // -------------------------------------------------------------------
  const handleAiExpand = async () => {
    const next = !aiExpanded;
    setAiExpanded(next);
    if (next && !aiText && !aiLoading) {
      setAiLoading(true);
      try {
        const res = await fetch("/api/analyze-watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stockCode:     symbol,
            stockName:     stockName || symbol,
            currentPrice:  rtPrice?.price,
            changePercent: rtPrice?.changePercent,
            peRatio:       rtPrice?.peRatio,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          setAiText(
            json.analysis ||
            json.message  ||
            json.content  ||
            JSON.stringify(json, null, 2)
          );
        } else {
          setAiText("AI 分析服务暂时不可用，请稍后再试。");
        }
      } catch {
        setAiText("AI 分析服务暂时不可用，请稍后再试。");
      } finally {
        setAiLoading(false);
      }
    }
  };

  // -------------------------------------------------------------------
  // Derived display values
  // -------------------------------------------------------------------
  const displayPrice       = rtPrice?.price         ?? klineData[klineData.length - 1]?.close ?? null;
  const displayChange      = rtPrice?.change        ?? klineData[klineData.length - 1]?.change ?? 0;
  const displayChangePct   = rtPrice?.changePercent ?? klineData[klineData.length - 1]?.changePercent ?? 0;
  const isUp               = displayChangePct > 0;
  const isFlat             = displayChangePct === 0;
  // Chinese convention: red = up, green = down
  const priceColorClass    = isUp ? "text-red-400" : isFlat ? "text-gray-200" : "text-green-400";
  const changePrefixSign   = isUp ? "+" : "";

  const lastKline = klineData[klineData.length - 1];

  // -------------------------------------------------------------------
  // Info panel fields
  // -------------------------------------------------------------------
  const infoRows = [
    [
      { label: "今开",   value: rtPrice?.open         != null ? fmtNum(rtPrice.open)         : fmtNum(lastKline?.open) },
      { label: "最高",   value: rtPrice?.high         != null ? fmtNum(rtPrice.high)         : fmtNum(lastKline?.high) },
      { label: "最低",   value: rtPrice?.low          != null ? fmtNum(rtPrice.low)          : fmtNum(lastKline?.low) },
      { label: "昨收",   value: rtPrice?.prevClose    != null ? fmtNum(rtPrice.prevClose)    : "--" },
      { label: "成交量", value: rtPrice?.volume       != null ? fmtVolume(rtPrice.volume)   : fmtVolume(lastKline?.volume) },
    ],
    [
      { label: "成交额",   value: rtPrice?.turnover       != null ? fmtVolume(rtPrice.turnover)       : fmtVolume(lastKline?.amount) },
      { label: "换手率",   value: rtPrice?.turnoverRate   != null ? fmtNum(rtPrice.turnoverRate) + "%" : fmtNum(lastKline?.turnoverRate) + "%" },
      { label: "振幅",     value: rtPrice?.amplitude      != null ? fmtNum(rtPrice.amplitude)  + "%" : fmtNum(lastKline?.amplitude) + "%" },
      { label: "委比",     value: rtPrice?.bidRatio       != null ? fmtNum(rtPrice.bidRatio)   + "%" : "--" },
      { label: "量比",     value: "--" },
    ],
    [
      { label: "市盈率(PE)", value: rtPrice?.peRatio            != null ? fmtNum(rtPrice.peRatio)            : "--" },
      { label: "市净率(PB)", value: rtPrice?.pbRatio            != null ? fmtNum(rtPrice.pbRatio)            : "--" },
      { label: "总市值",     value: rtPrice?.marketCap          != null ? fmtMarketCap(rtPrice.marketCap)          : "--" },
      { label: "流通市值",   value: rtPrice?.circulatingMarketCap != null ? fmtMarketCap(rtPrice.circulatingMarketCap) : "--" },
      { label: "涨停",       value: rtPrice?.limitUp            != null ? fmtNum(rtPrice.limitUp)            : "--" },
    ],
  ];

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#0a0e17] text-gray-100 overflow-y-auto">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-[#0a0e17]/95 backdrop-blur border-b border-[#1a2035] px-4 py-3">
        <div className="flex items-start justify-between gap-4 max-w-screen-2xl mx-auto">
          {/* Back */}
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors shrink-0 mt-0.5"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>自选股</span>
          </button>

          {/* Stock identity */}
          <div className="flex flex-col items-center min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-white text-lg leading-none">{symbol}</span>
              {stockName && (
                <span className="text-gray-300 text-sm font-medium">{stockName}</span>
              )}
            </div>
          </div>

          {/* Price */}
          <div className="text-right shrink-0">
            {displayPrice !== null ? (
              <>
                <div className={`font-mono text-2xl font-bold leading-none ${priceColorClass}`}>
                  {fmtNum(displayPrice)}
                </div>
                <div className={`font-mono text-xs mt-0.5 ${priceColorClass}`}>
                  {changePrefixSign}{fmtNum(displayChange)} ({changePrefixSign}{fmtNum(displayChangePct)}%)
                </div>
              </>
            ) : (
              <div className="text-gray-500 text-sm">--</div>
            )}
          </div>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-2 sm:px-4 pb-8">
        {/* Period selector */}
        <div className="flex gap-1 pt-3 pb-2">
          {(Object.keys(PERIOD_CONFIG) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                period === p
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-gray-200 hover:bg-[#1a2035]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-[680px]">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
              <p className="text-sm text-gray-500">加载 K 线数据...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-[680px]">
            <div className="text-center space-y-3">
              <p className="text-gray-400">{error}</p>
              <button
                onClick={() => fetchKline(period)}
                className="text-blue-400 hover:text-blue-300 text-sm underline underline-offset-2"
              >
                重新加载
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {/* ── Main candlestick chart ──────────────────────────── */}
            <div className="rounded-t-lg overflow-hidden border border-[#1a2035]">
              <div className="flex items-center gap-3 px-3 py-1.5 border-b border-[#1a2035] text-[10px] font-mono bg-[#0d1220]">
                <span className="text-gray-500">K线</span>
                <span className="text-[#f59e0b]">■ MA5</span>
                <span className="text-[#3b82f6]">■ MA10</span>
                <span className="text-[#a855f7]">■ MA20</span>
                <span className="text-[#6b7280]">■ MA60</span>
              </div>
              <div ref={mainContainerRef} style={{ height: 380 }} />
            </div>

            {/* ── Volume chart ───────────────────────────────────── */}
            <div className="overflow-hidden border-x border-b border-[#1a2035]">
              <div className="flex items-center gap-3 px-3 py-1 border-b border-[#1a2035] text-[10px] font-mono bg-[#0d1220]">
                <span className="text-gray-500">成交量 VOL</span>
                <span className="text-red-400">■ 阳</span>
                <span className="text-green-400">■ 阴</span>
              </div>
              <div ref={volContainerRef} style={{ height: 100 }} />
            </div>

            {/* ── MACD chart ─────────────────────────────────────── */}
            <div className="overflow-hidden border-x border-b border-[#1a2035]">
              <div className="flex items-center gap-3 px-3 py-1 border-b border-[#1a2035] text-[10px] font-mono bg-[#0d1220]">
                <span className="text-gray-500">MACD(12,26,9)</span>
                <span className="text-[#3b82f6]">■ DIF</span>
                <span className="text-[#f59e0b]">■ DEA</span>
                <span className="text-gray-400">■ MACD</span>
              </div>
              <div ref={macdContainerRef} style={{ height: 100 }} />
            </div>

            {/* ── KDJ chart ──────────────────────────────────────── */}
            <div className="rounded-b-lg overflow-hidden border-x border-b border-[#1a2035]">
              <div className="flex items-center gap-3 px-3 py-1 border-b border-[#1a2035] text-[10px] font-mono bg-[#0d1220]">
                <span className="text-gray-500">KDJ(9,3,3)</span>
                <span className="text-[#3b82f6]">■ K</span>
                <span className="text-[#f59e0b]">■ D</span>
                <span className="text-[#a855f7]">■ J</span>
              </div>
              <div ref={kdjContainerRef} style={{ height: 100 }} />
            </div>

            {/* ── Info panels ────────────────────────────────────── */}
            <div className="mt-3 rounded-lg border border-[#1a2035] bg-[#0d1220] divide-y divide-[#1a2035]">
              {infoRows.map((row, ri) => (
                <div key={ri} className="grid grid-cols-5 divide-x divide-[#1a2035]">
                  {row.map(({ label, value }) => (
                    <div key={label} className="flex flex-col items-center py-2 px-1">
                      <span className="text-[10px] text-gray-500 mb-0.5">{label}</span>
                      <span className="text-xs font-mono text-gray-200">{value}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* ── AI Analysis panel ──────────────────────────────── */}
            <div className="mt-3 rounded-lg border border-[#1a2035] bg-[#0d1220] overflow-hidden">
              <button
                onClick={handleAiExpand}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-200 hover:bg-[#1a2035]/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 text-xs font-bold tracking-wider uppercase">AI</span>
                  <span>AI 智能分析</span>
                </div>
                {aiExpanded ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </button>

              {aiExpanded && (
                <div className="px-4 pb-4 border-t border-[#1a2035]">
                  {aiLoading ? (
                    <div className="flex items-center gap-2 pt-3 text-sm text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>分析中...</span>
                    </div>
                  ) : aiText ? (
                    <pre className="pt-3 text-xs text-gray-300 whitespace-pre-wrap leading-relaxed font-sans">
                      {aiText}
                    </pre>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
