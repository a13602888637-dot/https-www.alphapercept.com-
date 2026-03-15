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
import { ArrowLeft, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PriceRecord {
  timestamp: string;
  price: number;
  high: number;
  low: number;
  volume: number | null;
  turnover: number | null;
  change: number;
  changePercent: number;
  dataPoints: number;
}

interface ApiResponse {
  success: boolean;
  stockCode: string;
  data: PriceRecord[];
  analysis?: {
    trend: string;
    priceAction?: { currentPrice: number };
  };
}

interface KlinePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

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
  let prevK = 50,
    prevD = 50;
  for (let i = 0; i < closes.length; i++) {
    const start = Math.max(0, i - 8);
    const highN = Math.max(...highs.slice(start, i + 1));
    const lowN = Math.min(...lows.slice(start, i + 1));
    const rsv =
      highN === lowN ? 50 : ((closes[i] - lowN) / (highN - lowN)) * 100;
    const curK = (2 / 3) * prevK + (1 / 3) * rsv;
    const curD = (2 / 3) * prevD + (1 / 3) * curK;
    const curJ = 3 * curK - 2 * curD;
    k.push(curK);
    d.push(curD);
    j.push(curJ);
    prevK = curK;
    prevD = curD;
  }
  return { k, d, j };
}

// ---------------------------------------------------------------------------
// Convert API data to OHLC-like K-line data
// ---------------------------------------------------------------------------
function toKlineData(records: PriceRecord[]): KlinePoint[] {
  return records.map((r, i) => {
    // The API provides avg price, high, low but no explicit open/close.
    // We derive open from the previous record's close (price) or current price.
    const prevPrice = i > 0 ? records[i - 1].price : r.price;
    return {
      date: r.timestamp.slice(0, 10), // YYYY-MM-DD
      open: prevPrice,
      high: r.high,
      low: r.low,
      close: r.price,
      volume: r.volume ?? 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Chart colors & config
// ---------------------------------------------------------------------------

const CHART_BG = "#0a0e17";
const GRID_COLOR = "#1a2035";
const TEXT_COLOR = "#666";
const UP_COLOR = "#22c55e";
const DOWN_COLOR = "#ef4444";

function getChartOptions(width: number, height: number) {
  return {
    width,
    height,
    layout: { background: { color: CHART_BG }, textColor: TEXT_COLOR },
    grid: {
      vertLines: { color: GRID_COLOR },
      horzLines: { color: GRID_COLOR },
    },
    crosshair: { mode: CrosshairMode.Normal },
    timeScale: { borderColor: GRID_COLOR },
    rightPriceScale: { borderColor: GRID_COLOR },
  };
}

// ---------------------------------------------------------------------------
// Helper to build LineData arrays from nullable values
// ---------------------------------------------------------------------------
function toLineData(
  values: (number | null)[],
  times: Time[]
): LineData[] {
  return values
    .map((v, i) => (v !== null ? ({ time: times[i], value: v } as LineData) : null))
    .filter(Boolean) as LineData[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StockDetailView({ symbol }: { symbol: string }) {
  const router = useRouter();

  const [klineData, setKlineData] = useState<KlinePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latestPrice, setLatestPrice] = useState<number | null>(null);
  const [latestChange, setLatestChange] = useState<number>(0);
  const [latestChangePercent, setLatestChangePercent] = useState<number>(0);
  const [stockName, setStockName] = useState<string>("");

  // Chart container refs
  const mainChartContainerRef = useRef<HTMLDivElement>(null);
  const volumeChartContainerRef = useRef<HTMLDivElement>(null);
  const macdChartContainerRef = useRef<HTMLDivElement>(null);
  const kdjChartContainerRef = useRef<HTMLDivElement>(null);

  // Chart instance refs
  const mainChartRef = useRef<IChartApi | null>(null);
  const volumeChartRef = useRef<IChartApi | null>(null);
  const macdChartRef = useRef<IChartApi | null>(null);
  const kdjChartRef = useRef<IChartApi | null>(null);

  // -------------------------------------------------------------------
  // Fetch K-line data
  // -------------------------------------------------------------------
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/stock-price-history?stockCode=${encodeURIComponent(symbol)}&interval=day&limit=120`
      );
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json: ApiResponse = await res.json();

      if (!json.success || !json.data || json.data.length === 0) {
        setError(`No data available for ${symbol}`);
        setKlineData([]);
        return;
      }

      const klines = toKlineData(json.data);
      setKlineData(klines);
      setError(null);

      // Set latest price info from last record
      const last = json.data[json.data.length - 1];
      setLatestPrice(last.price);
      setLatestChange(last.change);
      setLatestChangePercent(last.changePercent);
    } catch (err) {
      console.error("Failed to fetch stock data:", err);
      setError(`No data available for ${symbol}`);
    } finally {
      setIsLoading(false);
    }
  }, [symbol]);

  // Fetch stock name from stock-prices API (best-effort)
  useEffect(() => {
    async function fetchName() {
      try {
        const res = await fetch(
          `/api/stock-prices?symbols=${encodeURIComponent(symbol)}`
        );
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.prices?.[symbol]?.name) {
            setStockName(json.prices[symbol].name);
          }
          // Also update price from real-time data if available
          if (json.success && json.prices?.[symbol]?.price) {
            const pd = json.prices[symbol];
            setLatestPrice(pd.price);
            if (pd.change !== undefined) setLatestChange(pd.change);
            if (pd.changePercent !== undefined)
              setLatestChangePercent(pd.changePercent);
          }
        }
      } catch {
        // Name fetch is best-effort
      }
    }
    fetchName();
  }, [symbol]);

  // Initial fetch + polling every 60s
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // -------------------------------------------------------------------
  // Build charts whenever klineData changes
  // -------------------------------------------------------------------
  useEffect(() => {
    if (klineData.length === 0) return;

    // Clean up previous chart instances
    mainChartRef.current?.remove();
    volumeChartRef.current?.remove();
    macdChartRef.current?.remove();
    kdjChartRef.current?.remove();
    mainChartRef.current = null;
    volumeChartRef.current = null;
    macdChartRef.current = null;
    kdjChartRef.current = null;

    const mainEl = mainChartContainerRef.current;
    const volumeEl = volumeChartContainerRef.current;
    const macdEl = macdChartContainerRef.current;
    const kdjEl = kdjChartContainerRef.current;

    if (!mainEl || !volumeEl || !macdEl || !kdjEl) return;

    const width = mainEl.clientWidth;

    // Prepare data arrays
    const dates = klineData.map((d) => d.date as Time);
    const closes = klineData.map((d) => d.close);
    const highs = klineData.map((d) => d.high);
    const lows = klineData.map((d) => d.low);

    // ===============================================================
    // MAIN CHART: Candlestick + MA overlays
    // ===============================================================
    const mainChart = createChart(mainEl, getChartOptions(width, 400));
    mainChartRef.current = mainChart;

    const candleSeries = mainChart.addCandlestickSeries({
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      borderUpColor: UP_COLOR,
      borderDownColor: DOWN_COLOR,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
    });

    const candleData: CandlestickData[] = klineData.map((d) => ({
      time: d.date as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
    candleSeries.setData(candleData);

    // MA lines
    const ma5 = calcMA(closes, 5);
    const ma10 = calcMA(closes, 10);
    const ma20 = calcMA(closes, 20);

    const ma5Series = mainChart.addLineSeries({ color: "#f59e0b", lineWidth: 1 });
    ma5Series.setData(toLineData(ma5, dates));

    const ma10Series = mainChart.addLineSeries({ color: "#3b82f6", lineWidth: 1 });
    ma10Series.setData(toLineData(ma10, dates));

    const ma20Series = mainChart.addLineSeries({ color: "#a855f7", lineWidth: 1 });
    ma20Series.setData(toLineData(ma20, dates));

    mainChart.timeScale().fitContent();

    // ===============================================================
    // VOLUME CHART
    // ===============================================================
    const volumeChart = createChart(volumeEl, getChartOptions(width, 120));
    volumeChartRef.current = volumeChart;

    const volumeSeries = volumeChart.addHistogramSeries({ color: "#3b82f6" });

    const volumeData: HistogramData[] = klineData.map((d) => ({
      time: d.date as Time,
      value: d.volume,
      color: d.close >= d.open ? UP_COLOR : DOWN_COLOR,
    }));
    volumeSeries.setData(volumeData);
    volumeChart.timeScale().fitContent();

    // ===============================================================
    // MACD CHART
    // ===============================================================
    const macdChart = createChart(macdEl, getChartOptions(width, 120));
    macdChartRef.current = macdChart;

    const { dif, dea, histogram } = calcMACD(closes);

    const difSeries = macdChart.addLineSeries({ color: "#3b82f6", lineWidth: 1 });
    difSeries.setData(
      dif.map((v, i) => ({ time: dates[i], value: v })) as LineData[]
    );

    const deaSeries = macdChart.addLineSeries({ color: "#f59e0b", lineWidth: 1 });
    deaSeries.setData(
      dea.map((v, i) => ({ time: dates[i], value: v })) as LineData[]
    );

    const histSeries = macdChart.addHistogramSeries({ color: UP_COLOR });
    histSeries.setData(
      histogram.map((v, i) => ({
        time: dates[i],
        value: v,
        color: v >= 0 ? UP_COLOR : DOWN_COLOR,
      })) as HistogramData[]
    );

    macdChart.timeScale().fitContent();

    // ===============================================================
    // KDJ CHART
    // ===============================================================
    const kdjChart = createChart(kdjEl, getChartOptions(width, 120));
    kdjChartRef.current = kdjChart;

    const { k, d, j } = calcKDJ(highs, lows, closes);

    const kSeries = kdjChart.addLineSeries({ color: "#3b82f6", lineWidth: 1 });
    kSeries.setData(
      k.map((v, i) => ({ time: dates[i], value: v })) as LineData[]
    );

    const dSeries = kdjChart.addLineSeries({ color: "#f59e0b", lineWidth: 1 });
    dSeries.setData(
      d.map((v, i) => ({ time: dates[i], value: v })) as LineData[]
    );

    const jSeries = kdjChart.addLineSeries({ color: "#a855f7", lineWidth: 1 });
    jSeries.setData(
      j.map((v, i) => ({ time: dates[i], value: v })) as LineData[]
    );

    kdjChart.timeScale().fitContent();

    // ===============================================================
    // Sync time scales across all charts
    // ===============================================================
    const charts = [mainChart, volumeChart, macdChart, kdjChart];
    let isSyncing = false;

    charts.forEach((source, si) => {
      source.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (isSyncing || !range) return;
        isSyncing = true;
        charts.forEach((target, ti) => {
          if (si !== ti) {
            target.timeScale().setVisibleLogicalRange(range);
          }
        });
        isSyncing = false;
      });
    });

    // ===============================================================
    // ResizeObserver for responsive width
    // ===============================================================
    const observer = new ResizeObserver(() => {
      const w = mainEl.clientWidth;
      mainChart.applyOptions({ width: w });
      volumeChart.applyOptions({ width: w });
      macdChart.applyOptions({ width: w });
      kdjChart.applyOptions({ width: w });
    });
    observer.observe(mainEl);

    return () => {
      observer.disconnect();
      mainChart.remove();
      volumeChart.remove();
      macdChart.remove();
      kdjChart.remove();
      mainChartRef.current = null;
      volumeChartRef.current = null;
      macdChartRef.current = null;
      kdjChartRef.current = null;
    };
  }, [klineData]);

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  const isPositive = latestChangePercent > 0;
  const isNegative = latestChangePercent < 0;
  const priceColor = isPositive
    ? "text-green-400"
    : isNegative
      ? "text-red-400"
      : "text-gray-200";

  return (
    <div className="min-h-screen bg-[#0a0e17] text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0a0e17]/95 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left: Back button */}
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Watchlist</span>
          </button>

          {/* Center: Stock info */}
          <div className="text-center">
            <span className="font-bold text-white text-lg">{symbol}</span>
            {stockName && (
              <span className="text-gray-400 text-sm ml-2">{stockName}</span>
            )}
          </div>

          {/* Right: Price */}
          <div className="text-right">
            {latestPrice !== null && (
              <>
                <span className={`font-mono text-xl font-bold ${priceColor}`}>
                  ¥{latestPrice.toFixed(2)}
                </span>
                <span className={`font-mono text-xs ml-2 ${priceColor}`}>
                  {isPositive ? "+" : ""}
                  {latestChange.toFixed(2)} ({isPositive ? "+" : ""}
                  {latestChangePercent.toFixed(2)}%)
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-[600px]">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
              <p className="text-sm text-gray-500">Loading chart data...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-[600px]">
            <div className="text-center space-y-3">
              <p className="text-gray-400">{error}</p>
              <button
                onClick={() => router.push("/dashboard")}
                className="text-blue-400 hover:text-blue-300 text-sm underline underline-offset-2"
              >
                Back to Watchlist
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Main candlestick chart */}
            <div className="rounded-lg overflow-hidden border border-gray-800">
              <div className="flex items-center gap-4 px-3 py-1.5 border-b border-gray-800 text-[10px] font-mono">
                <span className="text-gray-500">K-Line</span>
                <span className="text-[#f59e0b]">MA5</span>
                <span className="text-[#3b82f6]">MA10</span>
                <span className="text-[#a855f7]">MA20</span>
              </div>
              <div ref={mainChartContainerRef} style={{ height: 400 }} />
            </div>

            {/* Volume chart */}
            <div className="rounded-lg overflow-hidden border border-gray-800">
              <div className="flex items-center gap-4 px-3 py-1.5 border-b border-gray-800 text-[10px] font-mono">
                <span className="text-gray-500">Volume</span>
              </div>
              <div ref={volumeChartContainerRef} style={{ height: 120 }} />
            </div>

            {/* MACD chart */}
            <div className="rounded-lg overflow-hidden border border-gray-800">
              <div className="flex items-center gap-4 px-3 py-1.5 border-b border-gray-800 text-[10px] font-mono">
                <span className="text-gray-500">MACD</span>
                <span className="text-[#3b82f6]">DIF</span>
                <span className="text-[#f59e0b]">DEA</span>
                <span className="text-gray-500">Histogram</span>
              </div>
              <div ref={macdChartContainerRef} style={{ height: 120 }} />
            </div>

            {/* KDJ chart */}
            <div className="rounded-lg overflow-hidden border border-gray-800">
              <div className="flex items-center gap-4 px-3 py-1.5 border-b border-gray-800 text-[10px] font-mono">
                <span className="text-gray-500">KDJ</span>
                <span className="text-[#3b82f6]">K</span>
                <span className="text-[#f59e0b]">D</span>
                <span className="text-[#a855f7]">J</span>
              </div>
              <div ref={kdjChartContainerRef} style={{ height: 120 }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
