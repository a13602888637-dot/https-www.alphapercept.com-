"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, type IChartApi, type ISeriesApi, type CandlestickData, type LineData, CrosshairMode } from "lightweight-charts";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";

interface KLineData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface StockChartProps {
  stockCode: string;
  stockName: string;
  currentPrice?: number;
  changePercent?: number;
}

type ChartType = 'line' | 'candlestick';
type TimeFrame = '1D' | '5D' | '1M' | '3M' | '1Y' | '5Y';

const timeframeMap: Record<TimeFrame, { days: number; label: string }> = {
  '1D': { days: 1, label: '1天' },
  '5D': { days: 5, label: '5天' },
  '1M': { days: 30, label: '1月' },
  '3M': { days: 90, label: '3月' },
  '1Y': { days: 365, label: '1年' },
  '5Y': { days: 1825, label: '5年' },
};

export function StockChart({ stockCode, currentPrice = 0, changePercent = 0 }: StockChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);

  const [timeframe, setTimeframe] = useState<TimeFrame>('1M');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [loading, setLoading] = useState(true);
  const [klineData, setKlineData] = useState<KLineData[]>([]);
  const [hoveredPrice, setHoveredPrice] = useState<number | null>(null);
  const [hoveredTime, setHoveredTime] = useState<string | null>(null);
  const [hoveredChange, setHoveredChange] = useState<number | null>(null);

  // 从API获取K线数据
  const fetchKlineData = useCallback(async () => {
    setLoading(true);
    try {
      const days = timeframeMap[timeframe].days;
      const response = await fetch(`/api/kline?code=${stockCode}&timeframe=daily&limit=${days}`);
      const result = await response.json();

      if (result.success && result.data) {
        setKlineData(result.data);
      }
    } catch (error) {
      console.error('获取K线数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [stockCode, timeframe]);

  // 初始加载数据
  useEffect(() => {
    fetchKlineData();
  }, [fetchKlineData]);

  // 创建和更新图表
  useEffect(() => {
    if (!chartContainerRef.current || klineData.length === 0) return;

    const container = chartContainerRef.current;
    const isSmallScreen = window.innerWidth < 768;

    // 创建图表（Apple风格：无边框、极简）
    const chart = createChart(container, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#a0a0a0',
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: {
          color: 'rgba(255, 255, 255, 0.05)',
          style: 0,
        },
      },
      width: container.clientWidth,
      height: isSmallScreen ? 300 : 400,
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          width: 1,
          color: 'rgba(255, 255, 255, 0.2)',
          style: 2,
          labelVisible: false,
        },
        horzLine: {
          width: 1,
          color: 'rgba(255, 255, 255, 0.2)',
          style: 2,
          labelVisible: false,
        },
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: {
          time: true,
          price: true,
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
    });

    chartRef.current = chart;

    // 根据图表类型添加主系列
    if (chartType === 'candlestick') {
      const candlestickSeries = (chart as any).addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderUpColor: '#10b981',
        borderDownColor: '#ef4444',
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      });

      const candleData: CandlestickData[] = klineData.map(d => ({
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));

      candlestickSeries.setData(candleData);
      mainSeriesRef.current = candlestickSeries;
    } else {
      // 线形图（Robinhood风格：渐变填充）
      const areaSeries = (chart as any).addAreaSeries({
        topColor: changePercent >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
        bottomColor: 'rgba(16, 185, 129, 0)',
        lineColor: changePercent >= 0 ? '#10b981' : '#ef4444',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      const lineData: LineData[] = klineData.map(d => ({
        time: d.time,
        value: d.close,
      }));

      areaSeries.setData(lineData);
      mainSeriesRef.current = areaSeries;
    }

    // 添加成交量（渐变柱状图）
    const volumeSeries = (chart as any).addHistogramSeries({
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });

    const volumeData = klineData.map(d => ({
      time: d.time,
      value: d.volume || 0,
      color: d.close >= d.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
    }));

    volumeSeries.setData(volumeData);
    volumeSeriesRef.current = volumeSeries;

    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.85,
        bottom: 0,
      },
    });

    // 十字线交互（显示悬停价格）
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData || param.seriesData.size === 0) {
        setHoveredPrice(null);
        setHoveredTime(null);
        setHoveredChange(null);
        return;
      }

      const data = param.seriesData.get(mainSeriesRef.current as any);
      if (data) {
        const price = 'close' in data ? data.close : 'value' in data ? data.value : null;
        if (price && klineData.length > 0) {
          const firstClose = klineData[0].close;
          const change = ((price - firstClose) / firstClose) * 100;
          setHoveredPrice(price);
          setHoveredTime(param.time as string);
          setHoveredChange(change);
        }
      }
    });

    chart.timeScale().fitContent();

    // 响应式调整
    const handleResize = () => {
      if (chartContainerRef.current) {
        const isSmall = window.innerWidth < 768;
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: isSmall ? 300 : 400,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [klineData, chartType, changePercent]);

  // 计算显示价格和涨跌幅
  const displayPrice = hoveredPrice ?? currentPrice;
  const displayChange = hoveredChange ?? changePercent;
  const isPositive = displayChange >= 0;

  return (
    <div className="w-full space-y-4">
      {/* 顶部价格区域 - Apple风格 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-2"
      >
        <div className="flex items-baseline gap-3">
          <motion.div
            key={displayPrice}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.2 }}
            className="text-4xl md:text-5xl font-bold tracking-tight"
          >
            ¥{displayPrice.toFixed(2)}
          </motion.div>
          <div className={`flex items-center gap-1 text-lg ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            <span>{isPositive ? '+' : ''}{displayChange.toFixed(2)}%</span>
          </div>
        </div>

        {hoveredTime && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-muted-foreground"
          >
            {hoveredTime}
          </motion.div>
        )}
      </motion.div>

      {/* 时间周期选择器 - Robinhood风格圆角按钮 */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-full w-fit">
        {(Object.keys(timeframeMap) as TimeFrame[]).map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`
              px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200
              ${timeframe === tf
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
              }
            `}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* 图表容器 - 无边框、极简 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="relative"
      >
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10"
            >
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div ref={chartContainerRef} className="w-full rounded-xl overflow-hidden" />
      </motion.div>

      {/* 底部控制栏 */}
      <div className="flex items-center justify-between">
        {/* 图表类型切换 */}
        <div className="flex gap-2">
          <button
            onClick={() => setChartType('line')}
            className={`
              px-3 py-1.5 text-sm rounded-md transition-colors
              ${chartType === 'line'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }
            `}
          >
            线形图
          </button>
          <button
            onClick={() => setChartType('candlestick')}
            className={`
              px-3 py-1.5 text-sm rounded-md transition-colors
              ${chartType === 'candlestick'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }
            `}
          >
            K线图
          </button>
        </div>

        {/* 提示文字 */}
        <div className="text-xs text-muted-foreground hidden md:block">
          拖拽移动 · 捏合缩放 · 长按查看详情
        </div>
      </div>
    </div>
  );
}
