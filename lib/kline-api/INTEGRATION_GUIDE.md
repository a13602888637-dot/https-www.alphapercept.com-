# K线数据服务集成指南

## 当前状态

✅ **K线数据服务已完成**
✅ **API路由已更新**（`/api/kline`）
✅ **StockChart组件已在使用API**（`components/charts/StockChart.tsx` 第55行）

## 现有集成情况

### StockChart.tsx 当前实现

```typescript
// components/charts/StockChart.tsx (第51-66行)
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
```

## 建议的增强

### 1. 支持所有时间周期

目前StockChart只使用 `timeframe=daily`，建议扩展支持所有7种周期。

**修改前：**
```typescript
const response = await fetch(`/api/kline?code=${stockCode}&timeframe=daily&limit=${days}`);
```

**修改后：**
```typescript
// 映射UI时间周期到API时间周期
const apiTimeframeMap: Record<TimeFrame, string> = {
  '1D': '5m',      // 1天用5分钟K线
  '5D': '15m',     // 5天用15分钟K线
  '1M': 'daily',   // 1月用日K
  '3M': 'daily',   // 3月用日K
  '1Y': 'weekly',  // 1年用周K
  '5Y': 'monthly', // 5年用月K
};

const apiTimeframe = apiTimeframeMap[timeframe];
const response = await fetch(`/api/kline?code=${stockCode}&timeframe=${apiTimeframe}&limit=${days}`);
```

### 2. 显示数据来源标识

让用户知道数据来自哪里（真实API还是缓存）。

```typescript
const [dataSource, setDataSource] = useState<string>('');

// 在fetchKlineData中
if (result.success && result.data) {
  setKlineData(result.data);
  setDataSource(result.cached ? `${result.source} (缓存)` : result.source);
}

// 在UI中显示
<div className="text-xs text-gray-500">
  数据来源: {dataSource}
</div>
```

### 3. 添加错误处理和重试

```typescript
const [error, setError] = useState<string | null>(null);
const [retryCount, setRetryCount] = useState(0);

const fetchKlineData = useCallback(async () => {
  setLoading(true);
  setError(null);

  try {
    const apiTimeframe = apiTimeframeMap[timeframe];
    const response = await fetch(`/api/kline?code=${stockCode}&timeframe=${apiTimeframe}&limit=${days}`);
    const result = await response.json();

    if (result.success && result.data) {
      setKlineData(result.data);
      setDataSource(result.cached ? `${result.source} (缓存)` : result.source);
      setRetryCount(0); // 重置重试次数
    } else {
      setError(result.error || '获取数据失败');
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : '网络错误');
  } finally {
    setLoading(false);
  }
}, [stockCode, timeframe]);

// 重试按钮
{error && (
  <div className="text-sm text-red-500">
    {error}
    <button onClick={() => fetchKlineData()} className="ml-2 underline">
      重试
    </button>
  </div>
)}
```

### 4. 添加数据预加载

预加载相邻时间周期的数据，提升用户体验。

```typescript
useEffect(() => {
  // 加载当前时间周期
  fetchKlineData();

  // 预加载相邻时间周期（可选）
  const adjacentTimeframes = getAdjacentTimeframes(timeframe);
  adjacentTimeframes.forEach(tf => {
    const apiTimeframe = apiTimeframeMap[tf];
    fetch(`/api/kline?code=${stockCode}&timeframe=${apiTimeframe}&limit=100`)
      .then(res => res.json())
      .catch(err => console.log('预加载失败:', err));
  });
}, [fetchKlineData]);
```

### 5. 添加WebSocket实时更新（可选）

对于分时数据（5m, 15m），可以使用WebSocket获取实时更新。

```typescript
useEffect(() => {
  if (timeframe === '1D') {
    // 建立WebSocket连接获取实时数据
    const ws = new WebSocket('ws://localhost:3000/api/websocket');

    ws.onmessage = (event) => {
      const newPoint = JSON.parse(event.data);
      setKlineData(prev => [...prev.slice(-100), newPoint]);
    };

    return () => ws.close();
  }
}, [timeframe]);
```

## 完整示例代码

### 增强版 StockChart 组件

```typescript
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, type IChartApi } from 'lightweight-charts';
import { motion } from 'framer-motion';
import { Loader2, RefreshCw } from 'lucide-react';

type TimeFrame = '1D' | '5D' | '1M' | '3M' | '1Y' | '5Y';

interface StockChartEnhancedProps {
  stockCode: string;
  stockName: string;
  currentPrice?: number;
}

// 映射UI时间周期到API时间周期
const API_TIMEFRAME_MAP: Record<TimeFrame, string> = {
  '1D': '5m',
  '5D': '15m',
  '1M': 'daily',
  '3M': 'daily',
  '1Y': 'weekly',
  '5Y': 'monthly',
};

const LIMIT_MAP: Record<TimeFrame, number> = {
  '1D': 48,      // 5分钟 × 48 = 4小时
  '5D': 32,      // 15分钟 × 32 = 8小时 × 5天
  '1M': 30,      // 日K × 30
  '3M': 90,      // 日K × 90
  '1Y': 52,      // 周K × 52
  '5Y': 60,      // 月K × 60
};

export function StockChartEnhanced({
  stockCode,
  stockName,
  currentPrice = 0
}: StockChartEnhancedProps) {
  const [timeframe, setTimeframe] = useState<TimeFrame>('1M');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [klineData, setKlineData] = useState<any[]>([]);
  const [dataSource, setDataSource] = useState<string>('');

  const fetchKlineData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const apiTimeframe = API_TIMEFRAME_MAP[timeframe];
      const limit = LIMIT_MAP[timeframe];

      const response = await fetch(
        `/api/kline?code=${stockCode}&timeframe=${apiTimeframe}&limit=${limit}`
      );

      const result = await response.json();

      if (result.success && result.data) {
        setKlineData(result.data);

        // 设置数据来源标识
        let source = result.source;
        if (result.source === 'sina') source = '新浪财经';
        if (result.source === 'eastmoney') source = '东方财富';
        if (result.source === 'mock') source = 'Mock数据';
        if (result.cached) source += ' (缓存)';

        setDataSource(source);
      } else {
        setError(result.error || '获取数据失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误');
      console.error('获取K线数据失败:', err);
    } finally {
      setLoading(false);
    }
  }, [stockCode, timeframe]);

  useEffect(() => {
    fetchKlineData();
  }, [fetchKlineData]);

  return (
    <div className="space-y-4">
      {/* 数据来源和刷新按钮 */}
      <div className="flex justify-between items-center">
        <div className="text-xs text-gray-500">
          数据来源: {dataSource}
        </div>
        <button
          onClick={fetchKlineData}
          disabled={loading}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          title="刷新数据"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 时间周期选择器 */}
      <div className="flex gap-2">
        {(['1D', '5D', '1M', '3M', '1Y', '5Y'] as TimeFrame[]).map(tf => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-4 py-2 rounded-full transition-all ${
              timeframe === tf
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      )}

      {/* 错误状态 */}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">
          <p className="font-medium">数据加载失败</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchKlineData}
            className="mt-2 text-sm underline hover:no-underline"
          >
            重试
          </button>
        </div>
      )}

      {/* 图表容器 */}
      {!loading && !error && klineData.length > 0 && (
        <div className="chart-container">
          {/* 在这里渲染图表 */}
          <div className="text-sm text-gray-500">
            已加载 {klineData.length} 个数据点
          </div>
        </div>
      )}
    </div>
  );
}
```

## 测试清单

集成后请测试：

- [ ] 所有6种时间周期切换正常
- [ ] 数据来源标识正确显示
- [ ] 缓存功能正常（切换后再切换回来应该很快）
- [ ] 加载状态显示正常
- [ ] 错误处理正常（网络断开时）
- [ ] 刷新按钮正常工作
- [ ] 图表渲染正确
- [ ] 移动端和桌面端都正常

## 性能优化建议

### 1. 使用useSWR或React Query

```typescript
import useSWR from 'swr';

const { data, error, isLoading } = useSWR(
  `/api/kline?code=${stockCode}&timeframe=${apiTimeframe}&limit=${limit}`,
  fetcher,
  {
    revalidateOnFocus: false,
    dedupingInterval: 60000, // 60秒内不重复请求
  }
);
```

### 2. 数据压缩

在API路由中添加gzip压缩：

```typescript
// app/api/kline/route.ts
return NextResponse.json(result, {
  headers: {
    'Content-Encoding': 'gzip',
    'Cache-Control': 'public, s-maxage=60',
  },
});
```

### 3. 虚拟滚动

对于大量数据点，使用虚拟滚动减少DOM节点。

## 下一步

1. ✅ K线数据服务已完成
2. ⏳ 集成到StockChart组件（参考本文档）
3. ⏳ 测试所有时间周期
4. ⏳ 添加数据来源标识
5. ⏳ 优化加载和错误状态
6. ⏳ 部署到生产环境

---

**注意**: 现有StockChart组件已经可以正常工作，本文档提供的是增强建议。
