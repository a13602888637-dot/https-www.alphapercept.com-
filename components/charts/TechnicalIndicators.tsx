"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, IChartApi, LineData, HistogramData } from "lightweight-charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp } from "lucide-react";

interface KLineData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface TechnicalIndicatorsProps {
  data: KLineData[];
  stockName: string;
}

// 计算MACD
const calculateMACD = (data: KLineData[]): { macd: LineData[], signal: LineData[], histogram: HistogramData[] } => {
  const ema12 = calculateEMA(data.map(d => d.close), 12);
  const ema26 = calculateEMA(data.map(d => d.close), 26);

  const macdLine = ema12.map((val, i) => val - ema26[i]);
  const signalLine = calculateEMA(macdLine, 9);

  const macd: LineData[] = [];
  const signal: LineData[] = [];
  const histogram: HistogramData[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i >= 25) {
      macd.push({ time: data[i].time, value: parseFloat(macdLine[i].toFixed(4)) });
      signal.push({ time: data[i].time, value: parseFloat(signalLine[i].toFixed(4)) });
      histogram.push({
        time: data[i].time,
        value: parseFloat((macdLine[i] - signalLine[i]).toFixed(4)),
        color: macdLine[i] >= signalLine[i] ? '#26a69a' : '#ef5350',
      });
    }
  }

  return { macd, signal, histogram };
};

// 计算EMA
const calculateEMA = (data: number[], period: number): number[] => {
  const multiplier = 2 / (period + 1);
  const ema: number[] = [];

  // 第一个EMA值使用SMA
  let sum = 0;
  for (let i = 0; i < period && i < data.length; i++) {
    sum += data[i];
  }
  ema[period - 1] = sum / period;

  // 后续使用EMA公式
  for (let i = period; i < data.length; i++) {
    ema[i] = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
  }

  // 填充前面的值
  for (let i = 0; i < period - 1; i++) {
    ema[i] = ema[period - 1];
  }

  return ema;
};

// 计算RSI
const calculateRSI = (data: KLineData[], period: number = 14): LineData[] => {
  const rsi: LineData[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  for (let i = period - 1; i < gains.length; i++) {
    let avgGain = 0;
    let avgLoss = 0;

    for (let j = 0; j < period; j++) {
      avgGain += gains[i - j];
      avgLoss += losses[i - j];
    }

    avgGain /= period;
    avgLoss /= period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsiValue = 100 - (100 / (1 + rs));

    rsi.push({
      time: data[i + 1].time,
      value: parseFloat(rsiValue.toFixed(2)),
    });
  }

  return rsi;
};

// 计算KDJ
const calculateKDJ = (data: KLineData[], period: number = 9): { k: LineData[], d: LineData[], j: LineData[] } => {
  const k: LineData[] = [];
  const d: LineData[] = [];
  const j: LineData[] = [];

  let prevK = 50;
  let prevD = 50;

  for (let i = period - 1; i < data.length; i++) {
    let lowest = Infinity;
    let highest = -Infinity;

    for (let j = 0; j < period; j++) {
      const idx = i - j;
      if (data[idx].low < lowest) lowest = data[idx].low;
      if (data[idx].high > highest) highest = data[idx].high;
    }

    const rsv = highest === lowest ? 0 : ((data[i].close - lowest) / (highest - lowest)) * 100;

    const kValue = (2 * prevK + rsv) / 3;
    const dValue = (2 * prevD + kValue) / 3;
    const jValue = 3 * kValue - 2 * dValue;

    k.push({ time: data[i].time, value: parseFloat(kValue.toFixed(2)) });
    d.push({ time: data[i].time, value: parseFloat(dValue.toFixed(2)) });
    j.push({ time: data[i].time, value: parseFloat(jValue.toFixed(2)) });

    prevK = kValue;
    prevD = dValue;
  }

  return { k, d, j };
};

export function TechnicalIndicators({ data, stockName }: TechnicalIndicatorsProps) {
  const macdChartRef = useRef<HTMLDivElement>(null);
  const rsiChartRef = useRef<HTMLDivElement>(null);
  const kdjChartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!macdChartRef.current || data.length === 0) return;

    const macdData = calculateMACD(data);

    const macdChart = createChart(macdChartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
      },
      width: macdChartRef.current.clientWidth,
      height: 200,
      timeScale: {
        borderColor: '#485c7b',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: '#485c7b',
      },
    });

    const histogramSeries = macdChart.addHistogramSeries({
      priceFormat: { type: 'price', precision: 4 },
    });
    histogramSeries.setData(macdData.histogram);

    const macdLineSeries = macdChart.addLineSeries({
      color: '#2196F3',
      lineWidth: 2,
      title: 'MACD',
    });
    macdLineSeries.setData(macdData.macd);

    const signalLineSeries = macdChart.addLineSeries({
      color: '#FF9800',
      lineWidth: 2,
      title: 'Signal',
    });
    signalLineSeries.setData(macdData.signal);

    macdChart.timeScale().fitContent();

    return () => {
      macdChart.remove();
    };
  }, [data]);

  useEffect(() => {
    if (!rsiChartRef.current || data.length === 0) return;

    const rsiData = calculateRSI(data);

    const rsiChart = createChart(rsiChartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
      },
      width: rsiChartRef.current.clientWidth,
      height: 200,
      timeScale: {
        borderColor: '#485c7b',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: '#485c7b',
      },
    });

    const rsiLineSeries = rsiChart.addLineSeries({
      color: '#9C27B0',
      lineWidth: 2,
      title: 'RSI(14)',
    });
    rsiLineSeries.setData(rsiData);

    // 添加超买超卖线
    const overboughtLine = rsiChart.addLineSeries({
      color: '#ef5350',
      lineWidth: 1,
      lineStyle: 2,
      title: 'Overbought(70)',
    });
    overboughtLine.setData(rsiData.map(d => ({ time: d.time, value: 70 })));

    const oversoldLine = rsiChart.addLineSeries({
      color: '#26a69a',
      lineWidth: 1,
      lineStyle: 2,
      title: 'Oversold(30)',
    });
    oversoldLine.setData(rsiData.map(d => ({ time: d.time, value: 30 })));

    rsiChart.timeScale().fitContent();

    return () => {
      rsiChart.remove();
    };
  }, [data]);

  useEffect(() => {
    if (!kdjChartRef.current || data.length === 0) return;

    const kdjData = calculateKDJ(data);

    const kdjChart = createChart(kdjChartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
      },
      width: kdjChartRef.current.clientWidth,
      height: 200,
      timeScale: {
        borderColor: '#485c7b',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: '#485c7b',
      },
    });

    const kLineSeries = kdjChart.addLineSeries({
      color: '#2196F3',
      lineWidth: 2,
      title: 'K',
    });
    kLineSeries.setData(kdjData.k);

    const dLineSeries = kdjChart.addLineSeries({
      color: '#FF9800',
      lineWidth: 2,
      title: 'D',
    });
    dLineSeries.setData(kdjData.d);

    const jLineSeries = kdjChart.addLineSeries({
      color: '#9C27B0',
      lineWidth: 2,
      title: 'J',
    });
    jLineSeries.setData(kdjData.j);

    kdjChart.timeScale().fitContent();

    return () => {
      kdjChart.remove();
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>技术指标</CardTitle>
          <CardDescription>暂无数据</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          技术指标分析
        </CardTitle>
        <CardDescription>{stockName} - MACD、RSI、KDJ</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="macd" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="macd">MACD</TabsTrigger>
            <TabsTrigger value="rsi">RSI</TabsTrigger>
            <TabsTrigger value="kdj">KDJ</TabsTrigger>
          </TabsList>

          <TabsContent value="macd" className="space-y-4">
            <div ref={macdChartRef} className="w-full" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>MACD (Moving Average Convergence Divergence)</strong></p>
              <p>• DIF(蓝线): 快速EMA(12) - 慢速EMA(26)</p>
              <p>• DEA(橙线): DIF的9日EMA</p>
              <p>• 柱状图: DIF - DEA，红色为正值，绿色为负值</p>
            </div>
          </TabsContent>

          <TabsContent value="rsi" className="space-y-4">
            <div ref={rsiChartRef} className="w-full" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>RSI (Relative Strength Index)</strong></p>
              <p>• RSI &gt; 70: 超买区域，可能回调</p>
              <p>• RSI &lt; 30: 超卖区域，可能反弹</p>
              <p>• RSI = 50: 中性区域</p>
            </div>
          </TabsContent>

          <TabsContent value="kdj" className="space-y-4">
            <div ref={kdjChartRef} className="w-full" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>KDJ 随机指标</strong></p>
              <p>• K值(蓝线): 快速线</p>
              <p>• D值(橙线): 慢速线</p>
              <p>• J值(紫线): 超前线，J &gt; K &gt; D 为买入信号</p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
