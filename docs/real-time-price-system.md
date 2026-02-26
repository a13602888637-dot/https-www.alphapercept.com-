# 实时股票价格系统文档

## 概述

实时股票价格系统使用Server-Sent Events (SSE)技术实现股票价格的实时更新。系统包括后端SSE端点、前端React Hook和显示组件。

## 系统架构

### 1. 后端SSE端点
- **路径**: `/api/stock-prices/realtime`
- **方法**: GET (SSE流), POST (更新股票列表), PUT (获取统计信息)
- **数据源**: 新浪财经API (通过`data_crawler`服务)

### 2. 前端React Hook
- **文件**: `hooks/useRealTimeStockPrices.ts`
- **功能**: 管理SSE连接、状态更新、错误处理和自动重连

### 3. 显示组件
- **单个股票**: `components/live-feed/RealTimeStockPrice.tsx`
- **股票网格**: `components/live-feed/RealTimeStockPrice.tsx` (RealTimeStockPriceGrid)
- **自选股管理器**: `components/watchlist/WatchlistManagerWithRealtime.tsx`

## API端点

### GET /api/stock-prices/realtime
建立SSE连接，接收实时价格更新。

**查询参数**:
- `symbols`: 股票代码列表，用逗号分隔 (必需)
- `interval`: 更新间隔，毫秒 (可选，默认3000)
- `clientId`: 客户端ID (可选，自动生成)

**响应** (SSE事件流):
- `connected`: 连接建立确认
- `initial-prices`: 初始价格数据
- `price-update`: 定期价格更新
- `heartbeat`: 心跳消息
- `error`: 错误消息

### POST /api/stock-prices/realtime
更新已连接客户端的股票列表。

**请求体**:
```json
{
  "clientId": "连接ID",
  "symbols": ["000001", "600000"],
  "interval": 5000
}
```

### PUT /api/stock-prices/realtime
获取连接统计信息。

**请求体**:
```json
{
  "action": "stats"
}
```

## 前端使用示例

### 基本用法
```typescript
import { useRealTimeStockPrices } from '@/hooks/useRealTimeStockPrices';

function StockMonitor() {
  const {
    prices,
    connected,
    loading,
    error,
    connect,
    disconnect,
    updateSymbols
  } = useRealTimeStockPrices({
    symbols: ['000001', '600000'],
    updateInterval: 3000,
    autoConnect: true,
    onPriceUpdate: (update) => {
      console.log('价格更新:', update);
    }
  });

  // 获取特定股票价格
  const stockPrice = getPrice('000001');

  return (
    <div>
      {connected ? '已连接' : '已断开'}
      {stockPrice && (
        <div>价格: {stockPrice.price}</div>
      )}
    </div>
  );
}
```

### 使用显示组件
```typescript
import { RealTimeStockPrice } from '@/components/live-feed/RealTimeStockPrice';

function StockDisplay() {
  return (
    <RealTimeStockPrice
      symbol="000001"
      showName={true}
      showChange={true}
      showChangePercent={true}
      animateChanges={true}
      onPriceUpdate={(price) => {
        console.log('价格更新:', price);
      }}
    />
  );
}
```

### 使用自选股管理器
```typescript
import { WatchlistManagerWithRealtime } from '@/components/watchlist/WatchlistManagerWithRealtime';

function WatchlistPage() {
  return <WatchlistManagerWithRealtime />;
}
```

## 演示页面

系统包含一个完整的演示页面，展示所有功能：
- **路径**: `/realtime-prices`
- **功能**:
  - 实时价格网格显示
  - 单股详细视图
  - 控制面板（添加/删除股票，调整更新间隔）
  - 连接状态和统计信息

## 技术特性

### 1. 连接管理
- 自动连接和重连
- 心跳检测 (30秒)
- 最大重试次数限制
- 连接状态监控

### 2. 性能优化
- 价格变化检测和动画
- 批量更新 (每3秒)
- 缓存历史价格
- 自动清理旧数据

### 3. 错误处理
- 网络错误自动重试
- API失败时的回退数据
- 详细的错误信息
- 用户友好的错误显示

### 4. 用户体验
- 价格变化动画
- 连接状态指示
- 实时盈亏计算
- 响应式设计

## 配置选项

### Hook配置
```typescript
interface RealTimePriceOptions {
  symbols: string[];           // 监控的股票代码
  updateInterval?: number;     // 更新间隔 (毫秒)
  autoConnect?: boolean;       // 自动连接
  maxReconnectAttempts?: number; // 最大重连次数
  reconnectDelay?: number;     // 重连延迟 (毫秒)
  onPriceUpdate?: (update: PriceUpdate) => void; // 价格更新回调
  onConnectionChange?: (connected: boolean) => void; // 连接状态回调
  onError?: (error: Error) => void; // 错误回调
}
```

### 组件配置
```typescript
interface RealTimeStockPriceProps {
  symbol: string;              // 股票代码
  showName?: boolean;          // 显示股票名称
  showChange?: boolean;        // 显示价格变化
  showChangePercent?: boolean; // 显示涨跌幅
  showVolume?: boolean;        // 显示成交量
  showLastUpdate?: boolean;    // 显示更新时间
  showConnectionStatus?: boolean; // 显示连接状态
  animateChanges?: boolean;    // 价格变化动画
  className?: string;          // 自定义样式
  onPriceUpdate?: (price: StockPrice | null) => void; // 价格更新回调
}
```

## 部署注意事项

### 1. 服务器配置
- 确保SSE端点支持长连接
- 配置适当的超时设置
- 考虑负载均衡下的连接管理

### 2. 客户端配置
- 现代浏览器支持SSE
- 考虑移动端网络状况
- 实现离线处理

### 3. 数据源配置
- 新浪财经API可能需要代理
- 考虑API限制和频率
- 实现回退数据源

## 故障排除

### 常见问题

1. **连接失败**
   - 检查网络连接
   - 验证API端点可访问
   - 检查CORS配置

2. **价格不更新**
   - 检查股票代码格式
   - 验证数据源API状态
   - 检查更新间隔设置

3. **内存泄漏**
   - 确保组件卸载时断开连接
   - 定期清理缓存数据
   - 监控连接数量

### 调试信息
- 启用浏览器开发者工具查看SSE消息
- 检查控制台错误信息
- 使用演示页面测试连接

## 扩展功能

### 计划中的功能
1. **WebSocket支持**: 双向实时通信
2. **价格警报**: 自定义价格提醒
3. **历史数据**: 价格走势图表
4. **多数据源**: 支持多个数据提供商
5. **离线缓存**: 离线时使用缓存数据

## 相关文件

- `/app/api/stock-prices/realtime/route.ts` - SSE端点
- `/hooks/useRealTimeStockPrices.ts` - React Hook
- `/components/live-feed/RealTimeStockPrice.tsx` - 显示组件
- `/components/watchlist/WatchlistManagerWithRealtime.tsx` - 自选股管理器
- `/app/realtime-prices/page.tsx` - 演示页面
- `/test-realtime-prices.js` - 测试脚本