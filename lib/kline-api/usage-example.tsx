/**
 * K线数据服务使用示例
 * 这个文件展示如何在React组件中使用K线数据API
 */

'use client';

import { useEffect, useState } from 'react';
import type { KLineDataPoint, TimeFrame } from './providers/types';

interface KLineAPIResponse {
  success: boolean;
  data: KLineDataPoint[];
  source: 'sina' | 'eastmoney' | 'cache' | 'mock';
  cached: boolean;
  error?: string;
}

export function KLineDataExample({ stockCode }: { stockCode: string }) {
  const [data, setData] = useState<KLineDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>('');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('daily');

  // 获取K线数据
  const fetchKLineData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/kline?code=${stockCode}&timeframe=${timeFrame}&limit=200`
      );

      const result: KLineAPIResponse = await response.json();

      if (result.success) {
        setData(result.data);
        setSource(`${result.source}${result.cached ? ' (cached)' : ''}`);
      } else {
        setError(result.error || 'Failed to fetch data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载和周期切换时重新获取
  useEffect(() => {
    fetchKLineData();
  }, [stockCode, timeFrame]);

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-xl font-bold">K线数据示例</h2>
        <p className="text-sm text-gray-500">股票代码: {stockCode}</p>
      </div>

      {/* 时间周期选择器 */}
      <div className="flex gap-2">
        {(['5m', '15m', '30m', '60m', 'daily', 'weekly', 'monthly'] as TimeFrame[]).map(tf => (
          <button
            key={tf}
            onClick={() => setTimeFrame(tf)}
            className={`px-3 py-1 rounded ${
              timeFrame === tf
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* 加载状态 */}
      {loading && <p className="text-gray-500">加载中...</p>}

      {/* 错误信息 */}
      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded">
          错误: {error}
        </div>
      )}

      {/* 数据信息 */}
      {!loading && !error && data.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm">
            <span className="font-medium">数据来源:</span>{' '}
            <span className="text-green-600">{source}</span>
          </div>
          <div className="text-sm">
            <span className="font-medium">数据点数:</span>{' '}
            {data.length}
          </div>
          <div className="text-sm">
            <span className="font-medium">最新数据:</span>{' '}
            {data[data.length - 1]?.time} 收盘价 {data[data.length - 1]?.close.toFixed(2)}
          </div>

          {/* 数据预览 */}
          <div className="mt-4">
            <h3 className="font-medium mb-2">最近10条数据:</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-2 text-left">日期</th>
                    <th className="px-3 py-2 text-right">开盘</th>
                    <th className="px-3 py-2 text-right">最高</th>
                    <th className="px-3 py-2 text-right">最低</th>
                    <th className="px-3 py-2 text-right">收盘</th>
                    <th className="px-3 py-2 text-right">成交量</th>
                  </tr>
                </thead>
                <tbody>
                  {data.slice(-10).reverse().map((point, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="px-3 py-2">{point.time}</td>
                      <td className="px-3 py-2 text-right">{point.open.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{point.high.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{point.low.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{point.close.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{point.volume.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 刷新按钮 */}
      <button
        onClick={fetchKLineData}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
      >
        刷新数据
      </button>
    </div>
  );
}

/**
 * 使用方法：
 *
 * import { KLineDataExample } from '@/lib/kline-api/usage-example';
 *
 * function MyPage() {
 *   return <KLineDataExample stockCode="600519" />;
 * }
 */
