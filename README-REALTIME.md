# Alpha-Quant-Copilot 实时数据推送系统

## 系统概述

实时数据推送系统是Alpha-Quant-Copilot的核心组件之一，提供基于Server-Sent Events (SSE)和WebSocket的实时市场数据推送服务。系统集成了新浪财经API数据抓取、MA60/MD60纪律检查、AI交易推荐等功能。

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                   客户端 (React/Next.js)                     │
├─────────────────────────────────────────────────────────────┤
│  • LiveMarketFeed组件 (SSE/WebSocket客户端)                  │
│  • 实时数据显示表格                                          │
│  • MA60破位警告系统                                         │
│  • AI交易推荐面板                                           │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                  Next.js API路由层                           │
├─────────────────────────────────────────────────────────────┤
│  • /api/sse     - SSE服务器端推送                           │
│  • /api/websocket - WebSocket双向通信                       │
│  • 连接管理、心跳检测、错误处理                              │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                   数据抓取与处理层                           │
├─────────────────────────────────────────────────────────────┤
│  • skills/data_crawler.ts - 新浪/腾讯财经API集成            │
│  • MA60/MD60计算引擎                                        │
│  • 风险控制规则执行                                          │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    外部数据源                                │
├─────────────────────────────────────────────────────────────┤
│  • 新浪财经API (http://hq.sinajs.cn)                        │
│  • 腾讯财经API (https://qt.gtimg.cn)                        │
└─────────────────────────────────────────────────────────────┘
```

## 核心功能

### 1. 实时数据推送
- **SSE (Server-Sent Events)**: 单向服务器推送，自动重连，低延迟
- **WebSocket**: 双向实时通信，支持订阅/取消订阅
- **数据更新频率**: 5秒/次 (可配置)
- **支持多股票同时监控**: 最多20只股票

### 2. MA60纪律执行
- **实时MA60破位检测**: 基于60日移动平均线
- **警告级别**:
  - 临界警告 (critical): 价格低于MA60
  - 高度警告 (high): 价格接近MA60 (3%以内)
  - 中度警告 (medium): 价格在MA60上方5-10%
- **自动止损建议**: 根据claude.md规则生成

### 3. MD60动量跟踪
- **60日动量方向计算**: MD60 = (当前价 - 60日前价) / 60日前价 × 100%
- **趋势分类**:
  - 强势上涨 (MD60 > 15%)
  - 温和上涨 (5% < MD60 ≤ 15%)
  - 震荡整理 (-5% ≤ MD60 ≤ 5%)
  - 温和下跌 (-15% ≤ MD60 < -5%)
  - 强势下跌 (MD60 < -15%)

### 4. AI交易推荐
- **集成DeepSeek AI推理引擎**
- **基于五大投资流派策略**:
  1. 桥水宏观对冲原则
  2. 巴菲特价值投资原则
  3. 索罗斯反身性原则
  4. 佩洛西政策前瞻原则
  5. 中国顶级游资情绪接力原则
- **输出格式**: 买入/卖出/持有建议 + 置信度 + 详细推理

### 5. 连接管理
- **自动重连机制**: 连接断开后自动重试
- **心跳检测**: 30秒/次，检测连接健康状态
- **错误处理**: 网络错误、API错误、数据解析错误
- **连接统计**: 实时监控活动连接状态

## API接口

### SSE API (`/api/sse`)

#### GET请求
```
GET /api/sse?symbols=000001,600000&clientId=unique_client_id
```

**查询参数**:
- `symbols`: 股票代码，逗号分隔 (默认: 000001,600000,000002,600036)
- `clientId`: 客户端ID (可选，自动生成)

**响应头**:
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**事件类型**:
1. `connected`: 连接建立确认
2. `market-update`: 市场数据更新 (每5秒)
3. `heartbeat`: 心跳检测 (每30秒)
4. `error`: 错误信息

**数据格式**:
```json
{
  "timestamp": "2026-02-22T12:00:00.000Z",
  "marketData": [
    {
      "symbol": "000001",
      "name": "平安银行",
      "currentPrice": 10.96,
      "highPrice": 10.91,
      "lowPrice": 10.99,
      "lastUpdateTime": "2026-02-22 15:00:00",
      "change": 0.46,
      "changePercent": 4.38,
      "volume": 70040700,
      "turnover": 696614490
    }
  ],
  "warnings": [
    {
      "symbol": "000001",
      "type": "MA60",
      "message": "MA60破位警告！当前价格10.96低于MA60(11.20)",
      "severity": "critical"
    }
  ],
  "aiRecommendations": [
    {
      "symbol": "000001",
      "action": "hold",
      "confidence": 65,
      "reasoning": "价格在MA60附近震荡，建议观望"
    }
  ]
}
```

#### POST请求 (管理接口)
```
POST /api/sse
Content-Type: application/json

{
  "action": "stats"
}
```

**响应**:
```json
{
  "totalConnections": 5,
  "activeConnections": [
    {
      "clientId": "client_123456789",
      "symbols": ["000001", "600000"],
      "lastUpdate": "2026-02-22T12:00:00.000Z",
      "age": 5000
    }
  ]
}
```

### WebSocket API (`/api/websocket`)

#### 连接URL
```
ws://localhost:3000/api/websocket?symbols=000001,600000
```

#### 客户端消息格式
1. **订阅频道**:
```json
{
  "type": "SUBSCRIBE",
  "channels": ["market-data", "warnings", "ai-recommendations"]
}
```

2. **取消订阅**:
```json
{
  "type": "UNSUBSCRIBE",
  "channels": ["warnings"]
}
```

3. **更新股票列表**:
```json
{
  "type": "UPDATE_SYMBOLS",
  "symbols": ["000001", "600036", "000002"]
}
```

4. **请求更新**:
```json
{
  "type": "REQUEST_UPDATE"
}
```

5. **心跳检测**:
```json
{
  "type": "PING",
  "timestamp": "2026-02-22T12:00:00.000Z"
}
```

#### 服务器消息格式
1. **连接确认**:
```json
{
  "type": "CONNECTED",
  "clientId": "ws_123456789",
  "timestamp": "2026-02-22T12:00:00.000Z",
  "symbols": ["000001", "600000"],
  "availableChannels": ["market-data", "warnings", "ai-recommendations"]
}
```

2. **市场数据**:
```json
{
  "type": "MARKET_DATA",
  "data": [...],
  "timestamp": "2026-02-22T12:00:00.000Z"
}
```

3. **警告信息**:
```json
{
  "type": "WARNINGS",
  "warnings": [...],
  "timestamp": "2026-02-22T12:00:00.000Z"
}
```

4. **AI推荐**:
```json
{
  "type": "AI_RECOMMENDATIONS",
  "recommendations": [...],
  "timestamp": "2026-02-22T12:00:00.000Z"
}
```

5. **心跳响应**:
```json
{
  "type": "PONG",
  "timestamp": "2026-02-22T12:00:00.000Z",
  "originalTimestamp": "2026-02-22T12:00:00.000Z"
}
```

## 安装与运行

### 环境要求
- Node.js >= 18.0.0
- npm 或 yarn

### 安装步骤
1. 克隆项目并安装依赖:
```bash
cd stock-analysis
npm install
```

2. 配置环境变量 (可选):
```bash
cp .env.local.example .env.local
# 编辑.env.local文件，配置DeepSeek API密钥等
```

3. 启动开发服务器:
```bash
# 启动Next.js开发服务器
npm run next:dev

# 或者同时启动数据抓取测试
npm run dev
```

4. 访问实时数据推送页面:
```
http://localhost:3000/live-feed
```

### 构建生产版本
```bash
# 构建生产版本
npm run next:build

# 启动生产服务器
npm run next:start
```

## 组件说明

### LiveMarketFeed组件
位置: `/components/live-feed/LiveMarketFeed.tsx`

**功能**:
- SSE/WebSocket客户端实现
- 实时数据显示表格
- 连接状态管理
- 警告和AI推荐显示
- 用户交互控制

**主要状态**:
- `connectionStatus`: 连接状态 (connected/type/lastUpdate/error)
- `marketData`: 实时市场数据数组
- `warnings`: MA60/MD60警告数组
- `aiRecommendations`: AI交易推荐数组
- `symbols`: 监控的股票代码列表

**交互功能**:
1. 连接/断开连接切换
2. SSE/WebSocket连接类型选择
3. 股票代码列表更新
4. 手动请求数据更新

## 配置选项

### 环境变量
```env
# .env.local
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEFAULT_SYMBOLS=000001,600000,000002,600036
UPDATE_INTERVAL=5000
HEARTBEAT_INTERVAL=30000
MAX_SYMBOLS=20
```

### Next.js配置 (`next.config.js`)
```javascript
module.exports = {
  env: {
    APP_NAME: 'Alpha-Quant-Copilot',
    DEFAULT_SYMBOLS: '000001,600000,000002,600036',
    UPDATE_INTERVAL: '5000', // 5秒
  },
  // ... 其他配置
};
```

## 故障排除

### 常见问题

1. **SSE连接失败**
   - 检查网络连接
   - 确认服务器正在运行
   - 检查浏览器控制台错误

2. **数据更新延迟**
   - 检查新浪财经API状态
   - 调整UPDATE_INTERVAL配置
   - 检查网络延迟

3. **MA60警告不准确**
   - 确认历史价格数据源
   - 检查MA60计算逻辑
   - 验证价格数据质量

4. **AI推荐不可用**
   - 检查DeepSeek API密钥配置
   - 确认API调用配额
   - 查看服务器日志

### 日志查看
```bash
# 查看Next.js服务器日志
npm run next:dev 2>&1 | grep -E "(SSE|WebSocket|ERROR|WARN)"

# 查看数据抓取日志
npm run dev 2>&1 | grep -E "(Sina|Tencent|API|ERROR)"
```

## 性能优化

### 客户端优化
- **虚拟滚动**: 大量数据时使用虚拟滚动
- **数据缓存**: 本地缓存历史数据
- **请求合并**: 批量请求股票数据
- **懒加载**: 按需加载组件

### 服务器优化
- **连接池管理**: 复用HTTP连接
- **数据压缩**: Gzip压缩响应数据
- **缓存策略**: Redis缓存API响应
- **负载均衡**: 多实例部署

### 网络优化
- **CDN加速**: 静态资源CDN分发
- **HTTP/2**: 启用HTTP/2协议
- **WebSocket复用**: 连接复用减少握手

## 安全考虑

### 数据安全
- **API密钥保护**: 环境变量存储敏感信息
- **请求限流**: 防止API滥用
- **数据验证**: 输入输出数据验证
- **HTTPS加密**: 生产环境强制HTTPS

### 连接安全
- **WebSocket认证**: JWT token认证
- **连接限制**: IP地址连接限制
- **心跳检测**: 防止僵尸连接
- **错误处理**: 优雅的错误恢复

## 扩展开发

### 添加新数据源
1. 在`skills/data_crawler.ts`中添加新的API函数
2. 实现数据解析逻辑
3. 在SSE/WebSocket路由中集成

### 添加新分析指标
1. 在`app/api/sse/route.ts`中添加计算函数
2. 更新数据更新生成逻辑
3. 在客户端组件中显示

### 自定义警告规则
1. 修改`calculateMA60Warning`函数
2. 添加新的警告类型
3. 更新客户端警告显示逻辑

## 许可证

MIT License - 详见LICENSE文件

## 技术支持

如有问题或建议，请提交GitHub Issue或联系开发团队。