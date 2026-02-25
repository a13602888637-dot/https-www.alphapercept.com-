# BMAD 双向多智能体数据并发协议

## 概述

BMAD（Bidirectional Multi-Agent Data）是一个本地优先的持久化层与数据同步管理器，专为股票分析应用设计。它实现了以下核心功能：

1. **本地优先持久化**：使用IndexedDB/localStorage实现本地存储
2. **WebSocket/SSE管理器**：统一管理实时数据流
3. **数据流多路复用**：支持同时订阅多个股票的价格更新
4. **降噪与防抖**：使用requestAnimationFrame节流高频更新
5. **离线队列同步**：记录离线时的操作，网络恢复后自动同步
6. **错误处理和重试机制**

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    React Components                         │
├─────────────────────────────────────────────────────────────┤
│              useBMADSubscription Hook                       │
├───────────────┬───────────────┬─────────────────────────────┤
│ DataSyncManager │ OfflineQueue │ ThrottleManager           │
├───────────────┴───────────────┴─────────────────────────────┤
│                    WebSocketManager                         │
├─────────────────────────────────────────────────────────────┤
│          IndexedDB / localStorage / Server API              │
└─────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. WebSocketManager (`websocket-manager.ts`)
- 管理WebSocket连接和重连
- 支持多路复用订阅
- 心跳检测和错误处理

### 2. DataSyncManager (`data-sync-manager.ts`)
- 本地优先数据同步
- 冲突解决策略
- 网络状态监测
- 与watchlist store集成

### 3. OfflineQueue (`offline-queue.ts`)
- 离线操作队列
- 操作去重和重试
- 持久化存储

### 4. ThrottleManager (`throttle-manager.ts`)
- requestAnimationFrame节流
- 防抖和节流策略
- 避免React组件掉帧

### 5. useBMADSubscription Hook (`hooks/useBMADSubscription.ts`)
- React Hook接口
- 自动生命周期管理
- 与Zustand store集成

## 快速开始

### 1. 初始化BMAD系统

```typescript
import { setupBMADIntegration } from './lib/bmad/integration-example';

// 在应用启动时调用
await setupBMADIntegration();
```

### 2. 在React组件中使用

```typescript
import { useWatchlistSubscription } from './lib/hooks/useBMADSubscription';

function WatchlistComponent() {
  const {
    isConnected,
    isSyncing,
    stockData,
    watchlistItems,
    refreshData,
  } = useWatchlistSubscription({
    throttleMode: 'raf',
    updateLocalStore: true,
    onDataUpdate: (symbol, data) => {
      console.log(`${symbol} updated:`, data);
    },
  });

  return (
    <div>
      <div>Connection: {isConnected ? 'Online' : 'Offline'}</div>
      <div>Syncing: {isSyncing ? 'Yes' : 'No'}</div>
      <button onClick={refreshData}>Refresh</button>

      {watchlistItems.map(item => (
        <div key={item.stockCode}>
          <div>{item.stockName} ({item.stockCode})</div>
          <div>Price: {stockData[item.stockCode]?.price || 'Loading...'}</div>
        </div>
      ))}
    </div>
  );
}
```

### 3. 集成watchlist store操作

```typescript
import { createBMADIntegratedWatchlistStore } from './lib/bmad/integration-example';

function addStockToWatchlist() {
  const integratedStore = createBMADIntegratedWatchlistStore();

  // 添加股票（自动同步到服务器）
  const transactionId = await integratedStore.addStockWithBMAD(
    'AAPL',
    'Apple Inc.',
    { notes: 'Tech giant' }
  );

  console.log('Transaction started:', transactionId);
}

function updateStockPrice() {
  const integratedStore = createBMADIntegratedWatchlistStore();

  // 更新股票信息
  await integratedStore.updateStockWithBMAD('AAPL', {
    targetPrice: 200,
    notes: 'Updated target price',
  });
}
```

## 配置

### 默认配置

```typescript
import { DEFAULT_BMAD_CONFIG } from './lib/bmad/types';

const customConfig = {
  ...DEFAULT_BMAD_CONFIG,
  sync: {
    ...DEFAULT_BMAD_CONFIG.sync,
    syncInterval: 60000, // 改为60秒同步一次
    conflictResolution: 'client_wins',
  },
  websocket: {
    ...DEFAULT_BMAD_CONFIG.websocket,
    url: 'wss://api.example.com/websocket',
  },
};
```

### 配置选项

#### WebSocket配置
- `url`: WebSocket服务器地址
- `reconnectInterval`: 重连间隔（毫秒）
- `maxReconnectAttempts`: 最大重试次数
- `heartbeatInterval`: 心跳间隔

#### 同步配置
- `storageType`: 存储类型（'indexeddb' 或 'localstorage'）
- `syncInterval`: 同步间隔
- `conflictResolution`: 冲突解决策略
- `maxRetries`: 最大重试次数

#### 节流配置
- `mode`: 节流模式（'raf', 'throttle', 'debounce'）
- `delay`: 延迟时间（毫秒）
- `leading`: 是否立即执行首次调用
- `trailing`: 是否执行最后一次调用

## 高级用法

### 自定义冲突解决

```typescript
import { getDataSyncManager } from './lib/bmad/data-sync-manager';

const dataSyncManager = getDataSyncManager();

dataSyncManager.on('conflictDetected', (conflict) => {
  console.log('Conflict detected:', conflict);

  // 自定义冲突解决逻辑
  if (conflict.localData.timestamp > conflict.serverData.timestamp) {
    conflict.resolution = 'local';
  } else {
    conflict.resolution = 'server';
  }
});
```

### 监控离线队列

```typescript
import { getOfflineQueue } from './lib/bmad/offline-queue';

const offlineQueue = getOfflineQueue();

// 获取队列统计
const stats = offlineQueue.getQueueStats();
console.log('Pending operations:', stats.pending);

// 监听队列事件
offlineQueue.on('operationAdded', (operation) => {
  console.log('Operation queued:', operation.type, operation.id);
});
```

### 自定义节流策略

```typescript
import { createRafThrottle, createDebounce } from './lib/bmad/throttle-manager';

// RAF节流（适合动画和UI更新）
const throttledUpdate = createRafThrottle((data) => {
  updateUI(data);
});

// 防抖（适合搜索输入）
const debouncedSearch = createDebounce((query) => {
  searchAPI(query);
}, 300);
```

## 与现有代码集成

### 替换现有的watchlist操作

```typescript
// 之前
import { useWatchlistStore } from './lib/store/watchlist-store';

function OldComponent() {
  const store = useWatchlistStore();

  const addStock = () => {
    store.addItemOptimistic('AAPL', 'Apple Inc.');
  };
}

// 之后
import { BMADIntegrationExample } from './lib/bmad/integration-example';

function NewComponent() {
  const { addStock } = BMADIntegrationExample();

  const addStockWithSync = async () => {
    await addStock('AAPL', 'Apple Inc.');
  };
}
```

### 渐进式迁移

1. **阶段1**: 在新组件中使用BMAD，旧组件保持不变
2. **阶段2**: 逐步将旧组件迁移到BMAD
3. **阶段3**: 完全移除旧的数据同步逻辑

## 错误处理

BMAD系统提供完整的错误处理机制：

```typescript
import { useBMADSubscription } from './lib/hooks/useBMADSubscription';

function ComponentWithErrorHandling() {
  const subscription = useBMADSubscription({
    symbols: ['AAPL', 'GOOGL'],
    onError: (error) => {
      // 处理错误
      console.error('BMAD error:', error);
      showErrorToast(error.message);
    },
  });

  // 手动处理错误
  try {
    await subscription.refresh();
  } catch (error) {
    // 处理刷新错误
  }
}
```

## 性能优化

### 1. 节流高频更新
- 使用`requestAnimationFrame`节流UI更新
- 避免不必要的重渲染

### 2. 批量操作
- 离线队列支持批量处理
- 减少网络请求次数

### 3. 智能重试
- 指数退避重试策略
- 网络恢复后自动同步

### 4. 内存管理
- 自动清理过期数据
- 限制队列大小

## 测试

### 单元测试
```typescript
// 测试离线队列
test('offline queue should persist operations', async () => {
  const queue = new OfflineQueue();
  await queue.initialize();

  const opId = await queue.addOperation({
    id: 'test-1',
    type: 'create',
    data: { test: 'data' },
    timestamp: Date.now(),
  });

  expect(queue.getPendingOperations()).toHaveLength(1);
});
```

### 集成测试
```typescript
// 测试完整的数据流
test('data should sync from server to client', async () => {
  const dataSyncManager = getDataSyncManager();
  await dataSyncManager.initialize();

  await dataSyncManager.sync();

  const status = dataSyncManager.getStatus();
  expect(status.lastSyncTime).not.toBeNull();
});
```

## 故障排除

### 常见问题

1. **WebSocket连接失败**
   - 检查服务器地址
   - 验证CORS配置
   - 检查防火墙设置

2. **同步冲突**
   - 检查冲突解决策略
   - 验证时间戳同步
   - 检查数据版本

3. **内存泄漏**
   - 确保调用`cleanup()`方法
   - 检查事件监听器清理
   - 监控队列大小

### 调试模式

```typescript
// 启用详细日志
localStorage.setItem('bmad-debug', 'true');

// 监控所有事件
import { getDataSyncManager } from './lib/bmad/data-sync-manager';

const dataSyncManager = getDataSyncManager();
dataSyncManager.on('*', (event, ...args) => {
  console.log(`[BMAD] ${event}:`, ...args);
});
```

## 贡献指南

1. 遵循TypeScript编码规范
2. 添加单元测试
3. 更新类型定义
4. 更新文档

## 许可证

MIT License