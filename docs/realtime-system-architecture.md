# 实时数据推送系统架构文档

## 系统设计目标

### 核心需求
1. **实时性**: 数据延迟 < 1秒
2. **可靠性**: 99.9%可用性，自动故障恢复
3. **扩展性**: 支持1000+并发连接
4. **安全性**: 数据加密，访问控制
5. **兼容性**: 支持现代浏览器和移动设备

### 技术选型
- **前端框架**: Next.js 15 + React 19
- **实时通信**: SSE (主) + WebSocket (备)
- **数据抓取**: Node.js HTTP客户端 + iconv-lite
- **样式框架**: Tailwind CSS + Radix UI
- **部署平台**: Vercel / Docker

## 详细架构

### 1. 数据流架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   客户端浏览器   │    │   Next.js服务器  │    │   外部数据源     │
│                 │    │                 │    │                 │
│  • React组件    │◄──►│  • API路由      │◄──►│  • 新浪财经API  │
│  • SSE客户端    │    │  • SSE服务      │    │  • 腾讯财经API  │
│  • WebSocket    │    │  • WebSocket服务│    │                 │
│  • 状态管理     │    │  • 连接管理     │    └─────────────────┘
└─────────────────┘    │  • 数据缓存     │
                       │  • 错误处理     │
                       └─────────────────┘
```

### 2. 组件详细说明

#### 2.1 客户端组件 (`LiveMarketFeed.tsx`)
```typescript
// 核心功能
1. 连接管理: SSE/WebSocket连接建立、维护、关闭
2. 数据展示: 实时表格、图表、警告面板
3. 用户交互: 股票选择、连接控制、设置调整
4. 状态同步: 本地状态与服务器数据同步

// 关键技术
• EventSource API (SSE)
• WebSocket API
• React Hooks (useState, useEffect, useCallback)
• 自定义动画和过渡效果
```

#### 2.2 SSE服务器 (`app/api/sse/route.ts`)
```typescript
// 核心功能
1. 连接管理: 客户端连接跟踪、心跳检测
2. 数据推送: 定期市场数据更新
3. 警告生成: MA60/MD60规则检查
4. AI集成: DeepSeek API调用

// 关键技术
• Next.js Route Handlers
• ReadableStream API
• 连接池管理
• 错误恢复机制
```

#### 2.3 WebSocket服务器 (`app/api/websocket/route.ts`)
```typescript
// 核心功能
1. 双向通信: 客户端-服务器消息交换
2. 订阅管理: 频道订阅/取消订阅
3. 会话管理: 客户端状态维护
4. 广播功能: 向所有客户端推送消息

// 关键技术
• ws WebSocket库
• 消息协议设计
• 连接状态跟踪
• 心跳检测机制
```

#### 2.4 数据抓取引擎 (`skills/data_crawler.ts`)
```typescript
// 核心功能
1. API集成: 新浪/腾讯财经API封装
2. 数据解析: GBK/GB18030编码转换
3. 错误处理: 网络超时、API限流
4. 批量获取: 多股票并行获取

// 关键技术
• Node.js HTTP/HTTPS模块
• iconv-lite编码转换
• Promise并发控制
• 请求重试机制
```

### 3. 数据模型

#### 3.1 市场数据接口
```typescript
interface MarketData {
  symbol: string;           // 股票代码
  name: string;            // 股票名称
  currentPrice: number;    // 当前价格
  highPrice: number;       // 最高价
  lowPrice: number;        // 最低价
  lastUpdateTime: string;  // 最后更新时间
  change?: number;         // 涨跌额
  changePercent?: number;  // 涨跌幅
  volume?: number;         // 成交量
  turnover?: number;       // 成交额
}
```

#### 3.2 警告接口
```typescript
interface Warning {
  symbol: string;                     // 股票代码
  type: 'MA60' | 'MD60' | 'AI' | 'SYSTEM'; // 警告类型
  message: string;                    // 警告消息
  severity: 'low' | 'medium' | 'high' | 'critical'; // 严重程度
}
```

#### 3.3 AI推荐接口
```typescript
interface AIRecommendation {
  symbol: string;           // 股票代码
  action: 'buy' | 'sell' | 'hold'; // 操作建议
  confidence: number;       // 置信度 (0-100)
  reasoning: string;        // 推理过程
}
```

### 4. 通信协议

#### 4.1 SSE事件协议
```
事件格式:
event: <event-type>
data: <json-data>
\n\n

支持的事件类型:
1. connected - 连接建立
2. market-update - 市场数据更新
3. heartbeat - 心跳检测
4. error - 错误信息
```

#### 4.2 WebSocket消息协议
```typescript
// 客户端到服务器
type ClientMessage =
  | { type: 'SUBSCRIBE'; channels: string[] }
  | { type: 'UNSUBSCRIBE'; channels: string[] }
  | { type: 'UPDATE_SYMBOLS'; symbols: string[] }
  | { type: 'REQUEST_UPDATE' }
  | { type: 'PING'; timestamp: string }

// 服务器到客户端
type ServerMessage =
  | { type: 'CONNECTED'; clientId: string; timestamp: string }
  | { type: 'MARKET_DATA'; data: MarketData[]; timestamp: string }
  | { type: 'WARNINGS'; warnings: Warning[]; timestamp: string }
  | { type: 'AI_RECOMMENDATIONS'; recommendations: AIRecommendation[]; timestamp: string }
  | { type: 'PONG'; timestamp: string; originalTimestamp: string }
  | { type: 'ERROR'; message: string; error?: string }
```

### 5. 性能优化策略

#### 5.1 客户端优化
```typescript
// 1. 虚拟滚动 - 大量数据时
const VirtualizedTable = () => {
  // 只渲染可见区域的行
};

// 2. 数据缓存 - 减少重复请求
const useMarketDataCache = () => {
  // LRU缓存策略
};

// 3. 请求合并 - 批量获取
const batchFetchStocks = (symbols: string[]) => {
  // 合并多个请求
};

// 4. 懒加载 - 按需加载组件
const LazyChart = React.lazy(() => import('./Chart'));
```

#### 5.2 服务器优化
```typescript
// 1. 连接池 - 复用HTTP连接
const connectionPool = new Map();

// 2. 数据压缩 - Gzip压缩
res.setHeader('Content-Encoding', 'gzip');

// 3. 缓存策略 - Redis缓存
const redisCache = new Redis();

// 4. 负载均衡 - 多实例部署
const loadBalancer = new LoadBalancer();
```

#### 5.3 网络优化
```bash
# 1. HTTP/2 - 多路复用
server.listen(443, { http2: true });

# 2. CDN加速 - 静态资源分发
# 配置CDN域名

# 3. 连接复用 - WebSocket长连接
# 保持连接活跃
```

### 6. 安全设计

#### 6.1 认证授权
```typescript
// JWT令牌认证
const authenticate = (token: string) => {
  // 验证JWT令牌
};

// 角色权限控制
const checkPermission = (user: User, resource: string) => {
  // 检查访问权限
};
```

#### 6.2 数据安全
```typescript
// 1. 输入验证
const validateInput = (input: any) => {
  // 防止XSS、SQL注入
};

// 2. 输出编码
const encodeOutput = (data: any) => {
  // HTML/URL编码
};

// 3. HTTPS强制
if (process.env.NODE_ENV === 'production') {
  // 强制HTTPS
}
```

#### 6.3 访问控制
```typescript
// 1. 速率限制
const rateLimit = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100 // 每个IP最多100个请求
});

// 2. IP黑名单
const ipBlacklist = new Set();

// 3. 请求签名
const signRequest = (request: Request) => {
  // HMAC签名
};
```

### 7. 监控与日志

#### 7.1 监控指标
```typescript
// 关键性能指标
interface Metrics {
  connections: number;          // 活动连接数
  updateLatency: number;        // 数据更新延迟
  errorRate: number;            // 错误率
  memoryUsage: number;          // 内存使用
  cpuUsage: number;             // CPU使用率
}
```

#### 7.2 日志系统
```typescript
// 结构化日志
const logger = {
  info: (message: string, metadata?: any) => {
    console.log(JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      message,
      ...metadata
    }));
  },
  error: (message: string, error?: Error) => {
    console.error(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      message,
      error: error?.message,
      stack: error?.stack
    }));
  }
};
```

#### 7.3 告警规则
```yaml
# 告警配置
alerts:
  - name: "高延迟告警"
    condition: "updateLatency > 1000"  # 延迟超过1秒
    severity: "warning"

  - name: "高错误率告警"
    condition: "errorRate > 0.05"      # 错误率超过5%
    severity: "critical"

  - name: "连接数异常"
    condition: "connections > 1000"    # 连接数超过1000
    severity: "warning"
```

### 8. 部署架构

#### 8.1 开发环境
```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  nextjs:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

#### 8.2 生产环境
```yaml
# kubernetes部署
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alpha-quant-copilot
spec:
  replicas: 3
  selector:
    matchLabels:
      app: alpha-quant-copilot
  template:
    metadata:
      labels:
        app: alpha-quant-copilot
    spec:
      containers:
      - name: app
        image: alpha-quant-copilot:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

#### 8.3 CI/CD流水线
```yaml
# GitHub Actions
name: Deploy
on:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm run build
      - uses: docker/build-push-action@v2

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: kubectl apply -f k8s/
```

### 9. 扩展性设计

#### 9.1 水平扩展
```typescript
// 无状态设计
class StatelessServer {
  // 所有状态存储在Redis中
}

// 会话共享
const sharedSessionStore = new RedisStore();
```

#### 9.2 微服务拆分
```typescript
// 可能的微服务拆分
1. 数据抓取服务 - 专门负责数据获取
2. 实时推送服务 - 专门负责SSE/WebSocket
3. AI分析服务 - 专门负责AI推理
4. 用户服务 - 专门负责用户管理
```

#### 9.3 插件系统
```typescript
// 插件接口
interface Plugin {
  name: string;
  initialize: () => Promise<void>;
  processData: (data: MarketData) => Promise<any>;
}

// 插件管理器
class PluginManager {
  private plugins: Map<string, Plugin> = new Map();

  register(plugin: Plugin) {
    this.plugins.set(plugin.name, plugin);
  }

  async processAll(data: MarketData) {
    const results = [];
    for (const plugin of this.plugins.values()) {
      results.push(await plugin.processData(data));
    }
    return results;
  }
}
```

### 10. 故障恢复

#### 10.1 重试策略
```typescript
// 指数退避重试
const retryWithBackoff = async (
  fn: () => Promise<any>,
  maxRetries: number = 3
) => {
  let lastError: Error;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const delay = Math.pow(2, i) * 1000; // 指数退避
      await sleep(delay);
    }
  }
  throw lastError;
};
```

#### 10.2 断路器模式
```typescript
// 断路器实现
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private readonly threshold = 5;
  private readonly resetTimeout = 30000;

  async execute(fn: () => Promise<any>) {
    if (this.state === 'OPEN') {
      throw new Error('Circuit breaker is OPEN');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      setTimeout(() => {
        this.state = 'HALF_OPEN';
      }, this.resetTimeout);
    }
  }
}
```

#### 10.3 降级策略
```typescript
// 服务降级
const withFallback = async (
  primary: () => Promise<any>,
  fallback: () => Promise<any>
) => {
  try {
    return await primary();
  } catch (error) {
    console.warn('Primary service failed, using fallback:', error);
    return await fallback();
  }
};

// 使用示例
const getMarketData = () => withFallback(
  () => fetchSinaStockData(symbol),  // 主数据源
  () => fetchTencentStockData(symbol) // 备用数据源
);
```

## 总结

实时数据推送系统采用了现代化的技术栈和架构设计，具有以下特点：

1. **双协议支持**: SSE + WebSocket，兼顾简单性和功能性
2. **模块化设计**: 清晰的组件边界，易于维护和扩展
3. **高性能**: 多级优化策略，确保低延迟高并发
4. **高可用**: 完善的故障恢复和降级机制
5. **安全性**: 多层次的安全防护措施
6. **可观测性**: 全面的监控和日志系统

系统设计考虑了从开发到生产的全生命周期，提供了完整的解决方案。