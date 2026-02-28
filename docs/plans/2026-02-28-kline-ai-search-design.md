# K线图、AI对话、全局搜索功能设计文档

**项目**: Alpha-Quant-Copilot
**日期**: 2026-02-28
**设计方案**: 混合优化（核心功能新架构 + 非核心功能增强现有代码）

---

## 一、需求概述

### 1.1 功能目标

本次迭代将实现以下四大核心功能：

1. **K线图真实数据接入**
   - 使用第三方免费API（新浪财经、东方财富）
   - 支持全周期：日K、周K、月K、5分、15分、30分、60分
   - Apple Stocks + Robinhood风格的UI设计
   - 流畅手势交互和动画效果

2. **DeepSeek AI实时对话**
   - 使用真实DeepSeek API（已配置密钥）
   - SSE流式响应，逐字展示
   - 交互式对话界面，支持自定义提问
   - 预设提问模板

3. **全局搜索功能**
   - 全局搜索栏（顶部导航）+ 自选股页面内搜索
   - 完整信息展示：价格、涨跌、行业、成交量等
   - 搜索历史记录和热门推荐
   - 快速添加到自选股

4. **个人资料管理**
   - 保持现状（使用现有settings页面）

### 1.2 技术约束

- Next.js 15 + React 19
- 已配置DeepSeek API密钥（本地 + Vercel）
- 已有search-proxy服务
- 使用lightweight-charts库
- 部署到Vercel

---

## 二、整体架构设计

### 2.1 新增目录结构

```
/Users/guangyu/stock-analysis/
├── lib/
│   ├── kline-api/                    # 📊 K线数据服务（新建）
│   │   ├── index.ts                  # 统一导出
│   │   ├── providers/                # 数据源提供者
│   │   │   ├── sina.ts              # 新浪财经API
│   │   │   ├── eastmoney.ts         # 东方财富API
│   │   │   └── types.ts             # 类型定义
│   │   ├── cache.ts                 # 缓存管理
│   │   ├── transformer.ts           # 数据格式转换
│   │   └── fallback.ts              # 降级策略
│   │
│   └── ai/                           # 🤖 AI服务（新建）
│       ├── deepseek-stream.ts       # DeepSeek流式API
│       ├── chat-history.ts          # 对话历史管理
│       └── prompts.ts               # 提示词模板
│
├── components/
│   ├── ai-chat/                      # 💬 AI对话组件（新建）
│   │   ├── ChatInterface.tsx        # 主聊天界面
│   │   ├── MessageList.tsx          # 消息列表
│   │   ├── StreamingMessage.tsx     # 流式消息展示
│   │   └── ChatInput.tsx            # 输入框
│   │
│   ├── global-search/                # 🔍 全局搜索（新建）
│   │   ├── GlobalSearchBar.tsx      # 顶部搜索栏
│   │   ├── SearchResults.tsx        # 搜索结果
│   │   ├── SearchDefault.tsx        # 默认界面
│   │   └── SearchResultItem.tsx     # 搜索结果项
│   │
│   └── charts/                       # 📈 图表组件（增强现有）
│       ├── StockChart.tsx           # K线图（接入真实数据）
│       └── TechnicalIndicators.tsx  # 技术指标
│
├── app/
│   ├── api/
│   │   ├── kline/                   # K线数据API（新建）
│   │   │   └── route.ts
│   │   └── ai/                      # AI对话API（新建）
│   │       ├── chat/route.ts        # 对话接口
│   │       └── stream/route.ts      # SSE流式接口
│   │
│   └── layout.tsx                   # 添加全局搜索栏
```

### 2.2 核心技术选型

| 功能模块 | 技术方案 | 备选方案 |
|---------|---------|---------|
| K线数据 | 新浪财经API | 东方财富（降级） |
| 数据缓存 | 内存缓存（5分钟TTL） | Redis（未来） |
| AI流式传输 | SSE (Server-Sent Events) | WebSocket |
| UI动画 | Framer Motion | CSS Transitions |
| 图表库 | lightweight-charts | - |
| 状态管理 | React useState + useEffect | Zustand（复杂场景） |

### 2.3 数据流架构

```
前端组件 → API路由 → 数据服务层 → 外部API
   ↓                                    ↓
 UI渲染  ← 数据转换 ← 缓存层 ← 数据获取
```

---

## 三、K线数据服务详细设计

### 3.1 数据接口定义

```typescript
// lib/kline-api/types.ts
export interface KLineDataPoint {
  time: string;              // 时间戳 "2024-02-28" 或 "2024-02-28 09:30"
  open: number;              // 开盘价
  high: number;              // 最高价
  low: number;               // 最低价
  close: number;             // 收盘价
  volume: number;            // 成交量
  amount?: number;           // 成交额
}

export type TimeFrame = 'daily' | 'weekly' | 'monthly' | '5m' | '15m' | '30m' | '60m';

export interface KLineRequest {
  stockCode: string;         // 股票代码
  timeFrame: TimeFrame;      // 时间周期
  limit?: number;            // 获取数量（默认200）
  startDate?: string;        // 开始日期
  endDate?: string;          // 结束日期
}

export interface KLineResponse {
  success: boolean;
  data: KLineDataPoint[];
  source: 'sina' | 'eastmoney' | 'cache' | 'mock';
  cached: boolean;
  error?: string;
}
```

### 3.2 数据源提供者

**新浪财经API实现：**
- 端点：`http://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData`
- 参数：symbol, scale（周期）, datalen（数据量）
- 返回：JSON数组

**东方财富API实现（备用）：**
- 端点：待实现
- 用于新浪API失败时的降级

### 3.3 缓存策略

| 时间周期 | 缓存TTL | 说明 |
|---------|---------|------|
| 5分钟 | 1分钟 | 高频更新 |
| 15分钟 | 3分钟 | 中频更新 |
| 30分钟 | 5分钟 | 中频更新 |
| 60分钟 | 10分钟 | 低频更新 |
| 日K | 30分钟 | 低频更新 |
| 周K | 1小时 | 低频更新 |
| 月K | 1小时 | 低频更新 |

### 3.4 降级策略

```
数据获取优先级：
1. 缓存数据（如果未过期）
2. 新浪财经API
3. 东方财富API（新浪失败时）
4. Mock数据（全部失败时，用于演示）
```

### 3.5 API路由

```typescript
// app/api/kline/route.ts
GET /api/kline?code=000001&timeframe=daily&limit=200

响应格式：
{
  "success": true,
  "data": [KLineDataPoint[]],
  "source": "sina",
  "cached": false
}
```

---

## 四、K线图UI设计（Apple + Robinhood风格）

### 4.1 设计原则

- **极简主义**：移除所有不必要的UI元素
- **手势优先**：支持捏合缩放、拖拽、长按
- **流畅动画**：所有交互都有平滑过渡
- **价格跟随**：十字线跟随手指/鼠标
- **无边框**：图表融入背景
- **渐变填充**：成交量区域使用渐变

### 4.2 UI组件结构

```
StockChart
├── 顶部价格区域
│   ├── 实时价格（大号字体）
│   ├── 涨跌幅（带颜色）
│   └── 选中点信息（触摸时显示）
├── 时间周期选择器（Robinhood风格圆角按钮）
│   └── [1D, 5D, 1M, 3M, 1Y, 5Y]
├── 图表画布（无边框）
│   ├── K线/线形图
│   ├── 成交量柱状图
│   └── 自定义十字线（Apple风格）
└── 底部控制栏
    ├── 图表类型切换（线形图/K线图）
    └── 指标开关
```

### 4.3 交互设计

**手势交互：**
- 长按300ms：显示十字线 + 震动反馈
- 拖拽：移动图表视图
- 捏合：缩放图表
- 双击：恢复默认缩放

**动画效果：**
- 价格变化：数字滚动动画（Framer Motion）
- 图表加载：渐入动画（opacity + translateY）
- 十字线：平滑跟随（CSS transition）

### 4.4 LightweightCharts配置

```typescript
{
  layout: {
    background: 'transparent',
    textColor: '#a0a0a0',
    fontSize: 11,
  },
  grid: {
    vertLines: { visible: false },      // 隐藏垂直网格线
    horzLines: {
      color: 'rgba(255,255,255,0.05)',
      style: 0,
    },
  },
  crosshair: {
    mode: CrosshairMode.Hidden,         // 使用自定义十字线
  },
  handleScale: {
    mouseWheel: true,
    pinch: true,                        // 触摸捏合缩放
  },
}
```

### 4.5 响应式设计

- 桌面端：图表高度 400px
- 移动端：图表高度 300px
- 自适应宽度：100%

---

## 五、DeepSeek AI对话详细设计

### 5.1 对话消息结构

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  streaming?: boolean;      // 是否正在流式输出
  stockCode?: string;       // 关联的股票代码
}
```

### 5.2 SSE流式API

**端点：** `POST /api/ai/stream`

**请求体：**
```json
{
  "messages": [
    { "role": "user", "content": "分析贵州茅台的技术面" }
  ],
  "stockCode": "600519",
  "context": {
    "currentPrice": 1680.00,
    "changePercent": 2.5,
    "technicalIndicators": {...}
  }
}
```

**响应：** Server-Sent Events流

```
data: {"delta": "根据"}
data: {"delta": "当前"}
data: {"delta": "K线"}
...
event: done
```

### 5.3 真实DeepSeek API集成

**配置：**
- API密钥：从环境变量读取 `process.env.DEEPSEEK_API_KEY`
- 端点：`https://api.deepseek.com/v1/chat/completions`
- 模型：`deepseek-chat`
- 流式：`stream: true`

**关键代码：**
```typescript
const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'deepseek-chat',
    messages: messages,
    stream: true,
  }),
});

// 实时转发到前端，不使用任何模拟数据
```

### 5.4 前端流式接收

使用EventSource接收SSE流：
```typescript
const eventSource = new EventSource(`/api/ai/stream`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // 逐字追加到消息内容
  updateMessage(data.delta);
};
```

### 5.5 预设提问模板

```typescript
[
  {
    label: '📊 技术分析',
    prompt: '请基于当前K线走势和技术指标，分析{stockName}的技术面情况和短期走势预测。'
  },
  {
    label: '🎯 买卖建议',
    prompt: '结合MA60均线、MACD和RSI指标，给出{stockName}当前的买卖建议和止损位。'
  },
  {
    label: '⚠️ 风险评估',
    prompt: '分析{stockName}当前存在的主要风险点，包括技术风险、市场风险和基本面风险。'
  },
  {
    label: '💡 投资策略',
    prompt: '基于五大投资流派，为{stockName}制定短期和中期的投资策略。'
  },
]
```

### 5.6 UI集成位置

在个股详情页（`app/stocks/[code]/page.tsx`）的Tabs中新增：

```typescript
<TabsTrigger value="chat">💬 AI对话</TabsTrigger>

<TabsContent value="chat">
  <ChatInterface
    stockCode={stockCode}
    stockName={stockDetail.name}
    initialContext={...}
  />
</TabsContent>
```

---

## 六、全局搜索功能详细设计

### 6.1 搜索结果数据结构

```typescript
interface SearchResult {
  code: string;              // 股票代码
  name: string;              // 股票名称
  market: string;            // 市场（SH/SZ）
  currentPrice?: number;     // 当前价格
  change?: number;           // 涨跌额
  changePercent?: number;    // 涨跌幅
  volume?: number;           // 成交量
  turnover?: number;         // 成交额
  industry?: string;         // 所属行业
  isInWatchlist?: boolean;   // 是否已在自选股
}
```

### 6.2 全局搜索栏

**位置：** 顶部导航栏中央

**特性：**
- Spotlight风格的下拉面板
- 300ms防抖搜索
- 实时价格数据展示
- 快速添加到自选股按钮
- 点击直接跳转到个股详情

### 6.3 搜索默认界面

无输入时显示：
- 搜索历史记录（最近5条，支持清除）
- 热门股票推荐（涨幅榜前10）

### 6.4 搜索历史管理

- 存储位置：localStorage
- 键名：`search-history`
- 最大数量：10条
- 去重逻辑：新搜索的关键词移到最前

### 6.5 搜索API调用流程

```
1. 用户输入 → 300ms防抖
2. 调用 /api/stocks/search?q={query}
3. 获取股票列表
4. 并行调用 /api/stock-prices?symbols={codes}
5. 合并搜索结果和价格数据
6. 检查是否在自选股中
7. 渲染结果列表
```

### 6.6 自选股页面内搜索

保持现有 `WatchlistMainList` 组件的搜索功能，增强：
- 搜索结果标记是否已在自选股
- 快速添加按钮

---

## 七、技术实现要点

### 7.1 性能优化

1. **K线数据**
   - 内存缓存（不同周期独立TTL）
   - 仅获取必要数量的数据点
   - 数据转换在服务端完成

2. **搜索功能**
   - 防抖300ms
   - 复用现有search-proxy服务
   - 价格数据批量获取

3. **AI对话**
   - SSE流式传输，减少首字延迟
   - 对话历史本地存储
   - 限制单次对话轮数（防止token超限）

### 7.2 错误处理

1. **K线数据获取失败**
   - 降级到备用数据源
   - 最终降级到Mock数据
   - 显示数据来源标识

2. **DeepSeek API失败**
   - 显示真实错误信息
   - 不使用模拟回复
   - 提示检查API密钥和网络

3. **搜索API失败**
   - 显示友好错误提示
   - 保留上次成功的搜索结果
   - 提供重试按钮

### 7.3 移动端适配

- 图表高度自适应
- 手势交互优先
- 触摸反馈（震动）
- 响应式布局

---

## 八、开发计划

### 8.1 第一阶段：K线数据服务（2天）

- [ ] 创建 `lib/kline-api/` 目录结构
- [ ] 实现新浪财经API提供者
- [ ] 实现缓存管理
- [ ] 实现降级策略
- [ ] 创建API路由 `/api/kline`
- [ ] 单元测试

### 8.2 第二阶段：K线图UI改造（3天）

- [ ] 更新 `StockChart.tsx` 组件
- [ ] 实现Apple + Robinhood风格UI
- [ ] 添加手势交互
- [ ] 添加动画效果
- [ ] 实现自定义十字线
- [ ] 集成真实数据API
- [ ] 响应式优化

### 8.3 第三阶段：DeepSeek AI对话（3天）

- [ ] 创建 `lib/ai/` 目录
- [ ] 实现DeepSeek流式API调用
- [ ] 创建SSE API路由
- [ ] 创建 `ChatInterface` 组件
- [ ] 实现流式消息展示
- [ ] 添加预设提问模板
- [ ] 集成到个股详情页
- [ ] 测试真实API连接

### 8.4 第四阶段：全局搜索（2天）

- [ ] 创建 `GlobalSearchBar` 组件
- [ ] 实现搜索逻辑和防抖
- [ ] 创建搜索结果组件
- [ ] 实现搜索历史管理
- [ ] 集成到主布局
- [ ] 优化移动端体验

### 8.5 第五阶段：测试和优化（2天）

- [ ] 端到端测试
- [ ] 性能优化
- [ ] 移动端适配测试
- [ ] 错误处理验证
- [ ] 部署到Vercel
- [ ] 生产环境验证

**总计：约12天**

---

## 九、验收标准

### 9.1 K线图

- [ ] 支持所有7种时间周期切换
- [ ] 数据来自真实API（新浪/东方财富）
- [ ] UI符合Apple + Robinhood风格
- [ ] 手势交互流畅（长按、拖拽、捏合）
- [ ] 动画流畅（60fps）
- [ ] 移动端和桌面端都完美适配

### 9.2 DeepSeek AI对话

- [ ] 使用真实DeepSeek API（不使用模拟数据）
- [ ] 流式响应逐字展示
- [ ] 支持自定义提问
- [ ] 预设模板可用
- [ ] 对话历史正确保存
- [ ] 错误处理正确（不降级到模拟回复）

### 9.3 全局搜索

- [ ] 顶部全局搜索栏正常工作
- [ ] 搜索结果包含完整信息（价格、涨跌、行业等）
- [ ] 搜索历史正确保存和显示
- [ ] 热门推荐正确显示
- [ ] 快速添加到自选股功能正常
- [ ] 点击跳转到个股详情正常

### 9.4 整体质量

- [ ] 无TypeScript类型错误
- [ ] 无console错误
- [ ] 生产构建成功
- [ ] Vercel部署成功
- [ ] 真实环境测试通过

---

## 十、风险和缓解措施

### 10.1 风险识别

| 风险 | 概率 | 影响 | 缓解措施 |
|-----|------|------|---------|
| 新浪/东财API不稳定 | 中 | 高 | 实现降级策略，缓存数据 |
| DeepSeek API调用失败 | 低 | 中 | 显示真实错误，引导用户检查 |
| 图表性能问题 | 中 | 中 | 数据量控制，优化渲染 |
| 移动端手势冲突 | 中 | 低 | 精细调整手势参数 |

### 10.2 回滚计划

如果新功能出现严重问题：
1. 通过feature flag快速禁用新功能
2. 回滚到上一个stable版本
3. 修复问题后重新部署

---

## 十一、附录

### 11.1 环境变量

```bash
# DeepSeek API
DEEPSEEK_API_KEY=sk-xxxxx

# 其他已有配置
DATABASE_URL=...
CLERK_SECRET_KEY=...
```

### 11.2 依赖包

已安装：
- lightweight-charts: ^5.1.0
- framer-motion: ^12.34.3

无需新增依赖。

### 11.3 参考资料

- [Lightweight Charts文档](https://tradingview.github.io/lightweight-charts/)
- [DeepSeek API文档](https://platform.deepseek.com/api-docs/)
- [Server-Sent Events规范](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

---

**文档版本**: 1.0
**最后更新**: 2026-02-28
**审核状态**: ✅ 已通过用户确认
