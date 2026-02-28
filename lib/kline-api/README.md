# K线数据服务模块

完整的K线数据获取服务，支持多数据源、缓存管理和降级策略。

## 目录结构

```
lib/kline-api/
├── index.ts                  # 统一导出
├── providers/
│   ├── types.ts             # 类型定义
│   ├── sina.ts              # 新浪财经API
│   └── eastmoney.ts         # 东方财富API（备用）
├── cache.ts                 # 缓存管理
├── transformer.ts           # 数据格式转换
├── fallback.ts              # 降级策略
├── test-example.ts          # 测试示例
└── README.md                # 本文件
```

## 快速开始

### 1. 在API路由中使用

```typescript
import { getKLineData } from '@/lib/kline-api';

export async function GET(request: NextRequest) {
  const result = await getKLineData({
    stockCode: '600519',
    timeFrame: 'daily',
    limit: 200
  });

  return NextResponse.json(result);
}
```

### 2. 在组件中调用API

```typescript
'use client';

import { useEffect, useState } from 'react';

function StockChart({ stockCode }: { stockCode: string }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`/api/kline?code=${stockCode}&timeframe=daily&limit=200`)
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setData(result.data);
          console.log('数据来源:', result.source);
        }
      });
  }, [stockCode]);

  // ... 渲染图表
}
```

## API参考

### 主要函数

#### `getKLineData(request: KLineRequest): Promise<KLineResponse>`

获取K线数据（带降级策略）

**参数：**
- `stockCode`: 股票代码（如 '600519', '000001'）
- `timeFrame`: 时间周期（'5m' | '15m' | '30m' | '60m' | 'daily' | 'weekly' | 'monthly'）
- `limit`: 数据点数量（默认200，最大1000）

**返回：**
```typescript
{
  success: boolean;
  data: KLineDataPoint[];
  source: 'sina' | 'eastmoney' | 'cache' | 'mock';
  cached: boolean;
  error?: string;
}
```

### 数据结构

#### `KLineDataPoint`

```typescript
{
  time: string;       // 时间戳 "2024-02-28"
  open: number;       // 开盘价
  high: number;       // 最高价
  low: number;        // 最低价
  close: number;      // 收盘价
  volume: number;     // 成交量
  amount?: number;    // 成交额（可选）
}
```

## 降级策略

数据获取优先级：

1. **缓存数据**（如果未过期）
2. **新浪财经API**
3. **东方财富API**（新浪失败时）
4. **Mock数据**（全部失败时）

## 缓存策略

不同时间周期使用不同的缓存TTL：

| 时间周期 | 缓存TTL | 说明 |
|---------|---------|------|
| 5分钟 | 1分钟 | 高频更新 |
| 15分钟 | 3分钟 | 中频更新 |
| 30分钟 | 5分钟 | 中频更新 |
| 60分钟 | 10分钟 | 低频更新 |
| 日K | 30分钟 | 低频更新 |
| 周K | 1小时 | 低频更新 |
| 月K | 1小时 | 低频更新 |

## HTTP API端点

### GET /api/kline

**查询参数：**
- `code`: 股票代码（必需）
- `timeframe`: 时间周期（默认 'daily'）
- `limit`: 数据数量（默认 200）

**示例请求：**
```
GET /api/kline?code=600519&timeframe=daily&limit=200
```

**示例响应：**
```json
{
  "success": true,
  "data": [
    {
      "time": "2024-02-28",
      "open": 1680.00,
      "high": 1698.50,
      "low": 1675.20,
      "close": 1690.30,
      "volume": 125000
    }
  ],
  "source": "sina",
  "cached": false
}
```

## 错误处理

所有错误都会被妥善处理：

1. **API调用失败**：自动降级到下一个数据源
2. **数据验证失败**：跳过无效数据点
3. **所有源失败**：返回Mock数据并在error字段说明

## 性能优化

- 内存缓存减少API调用
- 数据转换在服务端完成
- 仅获取必要数量的数据点
- 支持HTTP缓存头

## 测试

运行测试示例：

```typescript
import { testKLineAPI } from '@/lib/kline-api/test-example';

await testKLineAPI();
```

## 扩展

### 添加新的数据源

1. 在 `providers/` 目录创建新的provider文件
2. 实现 `KLineProvider` 接口
3. 在 `fallback.ts` 中添加到降级链

### 修改缓存策略

在 `cache.ts` 中修改 `CACHE_TTL_MAP` 常量。

## 注意事项

1. 新浪财经API为免费API，可能有访问限制
2. 缓存仅在服务端有效（内存缓存）
3. Mock数据仅用于演示，不应用于生产决策
4. 股票代码支持带/不带市场前缀（SH/SZ）

## 许可

MIT License
