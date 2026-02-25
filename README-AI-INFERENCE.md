# AI推理代理使用说明

## 快速开始

### 1. 环境配置
```bash
# 复制环境变量模板
cp .env.example .env.local

# 编辑.env.local，设置DeepSeek API密钥
NEXT_PUBLIC_DEEPSEEK_API_KEY=your_deepseek_api_key_here

# 启动开发服务器
npm run dev
```

### 2. 访问演示页面
打开浏览器访问：`http://localhost:3000/ai-inference-demo`

### 3. 运行测试
访问：`http://localhost:3000/ai-inference-test`

## 核心组件

### 1. AI推理代理组件
```typescript
import { AIInferenceAgent } from '@/components/quant-inference/AIInferenceAgent';

// 完整模式
<AIInferenceAgent
  stockData={stock}
  symbol={stock.symbol}
  name={stock.name}
  autoTrigger={true}
  showDetails={true}
/>

// 简化模式
<SimpleAIInferenceAgent
  stockData={stock}
  symbol={stock.symbol}
  name={stock.name}
  autoTrigger={true}
/>

// 迷你模式
<MiniAIInferenceAgent
  stockData={stock}
  symbol={stock.symbol}
  name={stock.name}
  autoTrigger={true}
/>
```

### 2. 风险警报环组件
```typescript
import { RiskAlertRing } from '@/components/quant-inference/RiskAlertRing';

<RiskAlertRing
  config={alertConfig}
  showCloseButton={true}
  onClose={() => console.log('关闭警报')}
/>
```

### 3. AI推理Hook
```typescript
import { useAIInference } from '@/hooks/useAIInference';

const { infer, state, reset } = useAIInference();

// 执行推理
const response = await infer({
  stockData: stock,
  context: {
    portfolio: {...},
    marketCondition: {...}
  }
});

// 批量推理
const results = await batchInfer(['000001', '600519']);
```

## 集成示例

### 集成到股票详情页
```typescript
// app/stock/[symbol]/page.tsx
import { AIInferenceAgent } from '@/components/quant-inference/AIInferenceAgent';

export default function StockDetailPage({ params }) {
  const { symbol } = params;
  const stock = await fetchStockData(symbol);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">{stock.name}</h1>
      <p className="text-muted-foreground mb-6">{stock.symbol}</p>

      {/* AI推理代理 */}
      <div className="mb-8">
        <AIInferenceAgent
          stockData={stock}
          symbol={stock.symbol}
          name={stock.name}
          autoTrigger={true}
          showDetails={true}
        />
      </div>

      {/* 其他内容 */}
    </div>
  );
}
```

### 集成到自选股列表
```typescript
// components/watchlist/WatchlistItem.tsx
import { MiniAIInferenceAgent } from '@/components/quant-inference/AIInferenceAgent';

function WatchlistItem({ stock }) {
  return (
    <div className="flex items-center justify-between p-4 border-b">
      <div>
        <div className="font-medium">{stock.name}</div>
        <div className="text-sm text-muted-foreground">{stock.symbol}</div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="font-bold">¥{stock.price.toFixed(2)}</div>
          <div className={`text-sm ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}
          </div>
        </div>

        {/* 迷你AI推理代理 */}
        <MiniAIInferenceAgent
          stockData={stock}
          symbol={stock.symbol}
          name={stock.name}
          autoTrigger={true}
        />
      </div>
    </div>
  );
}
```

## 配置选项

### AI推理代理配置
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `autoTrigger` | `boolean` | `true` | 是否自动触发推理 |
| `showDetails` | `boolean` | `true` | 是否显示详细分析 |
| `compactMode` | `boolean` | `false` | 是否使用紧凑模式 |
| `refreshInterval` | `number` | `undefined` | 刷新间隔（毫秒） |
| `onInferenceComplete` | `function` | `undefined` | 推理完成回调 |
| `onError` | `function` | `undefined` | 错误回调 |

### 上下文信息配置
```typescript
const context = {
  // 投资组合信息
  portfolio: {
    '000001': {
      quantity: 1000,
      avgPrice: 10.50,
      currentValue: 10960,
      unrealizedPnl: 460
    }
  },

  // 市场环境
  marketCondition: {
    trend: 'sideways', // bullish, bearish, sideways
    volatility: 'medium', // low, medium, high
    liquidity: '充足' // 充足, 一般, 紧张
  },

  // 用户偏好
  riskTolerance: 'moderate', // conservative, moderate, aggressive
  availableCapital: 100000,

  // 用户标识
  userId: 'user-123'
};
```

## 故障排除

### 常见问题

1. **API密钥错误**
   ```
   错误：未设置DeepSeek API密钥
   解决：检查NEXT_PUBLIC_DEEPSEEK_API_KEY环境变量
   ```

2. **网络超时**
   ```
   错误：DeepSeek API调用超时
   解决：增加timeoutMs选项，检查网络连接
   ```

3. **组件不显示**
   ```
   问题：组件渲染但无内容
   解决：检查stockData格式，确保必需字段存在
   ```

4. **动画不工作**
   ```
   问题：警报环无动画效果
   解决：检查CSS注入，确保样式正确加载
   ```

### 调试模式
```typescript
// 启用详细日志
console.log('AI推理状态:', state);
console.log('AI响应:', data);
console.log('错误信息:', error);

// 检查环境变量
console.log('API密钥:', process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY ? '已设置' : '未设置');
```

## 性能优化

### 1. 批量处理
```typescript
// 批量推理多个股票
const { batchInfer } = useAIInference();

const analyzeWatchlist = async (symbols: string[]) => {
  const results = await batchInfer(symbols);
  // 处理结果
};
```

### 2. 缓存策略
```typescript
// 使用SWR缓存推理结果
import useSWR from 'swr';

function useCachedInference(symbol: string) {
  const { data, error } = useSWR(
    `ai-inference-${symbol}`,
    () => fetchInference(symbol),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000 // 60秒去重
    }
  );

  return { data, error, isLoading: !data && !error };
}
```

### 3. 按需加载
```typescript
// 动态加载AI推理组件
import dynamic from 'next/dynamic';

const AIInferenceAgent = dynamic(
  () => import('@/components/quant-inference/AIInferenceAgent'),
  {
    loading: () => <div>加载中...</div>,
    ssr: false // 禁用服务端渲染
  }
);
```

## 安全建议

### 1. API密钥管理
- 使用环境变量，不要硬编码
- 开发和生产环境使用不同密钥
- 定期轮换密钥
- 监控API使用情况

### 2. 速率限制
```typescript
// 实现简单的速率限制
let lastCallTime = 0;
const MIN_INTERVAL = 1000; // 1秒

const throttledInfer = async (request: AIInferenceRequest) => {
  const now = Date.now();
  if (now - lastCallTime < MIN_INTERVAL) {
    throw new Error('请求过于频繁');
  }
  lastCallTime = now;
  return await infer(request);
};
```

### 3. 错误处理
```typescript
// 完整的错误处理
try {
  const response = await infer(request);
} catch (error) {
  // 记录错误
  console.error('AI推理失败:', error);

  // 显示用户友好的错误信息
  toast.error('AI分析暂时不可用，请稍后重试');

  // 触发降级方案
  showFallbackAnalysis();
}
```

## 扩展开发

### 1. 添加新的数据源
```typescript
// 扩展股票数据接口
interface EnhancedStockData extends StockMarketData {
  // 新增字段
  newIndicator?: number;
  customMetric?: string;
}

// 在推理前增强数据
const enhancedStockData = {
  ...stockData,
  newIndicator: calculateNewIndicator(stockData),
  customMetric: fetchCustomMetric(stockData.symbol)
};
```

### 2. 自定义策略规则
```typescript
// 添加自定义策略
const customRules = `
## 自定义策略模块
- 新增规则1: ...
- 新增规则2: ...
`;

// 构建增强提示词
const enhancedPrompt = buildInferencePrompt(stockData, context, {
  customStrategy: customRules
});
```

### 3. 自定义视觉主题
```typescript
// 自定义警报环样式
const customAlertConfig = {
  ...alertConfig,
  color: '#FF0000', // 自定义颜色
  animation: 'custom-animation', // 自定义动画
  icon: CustomIcon // 自定义图标
};
```

## 支持与反馈

### 1. 文档资源
- [集成指南](./docs/ai-inference-integration.md)
- [实施报告](./docs/ai-inference-implementation-report.md)
- [API文档](./docs/api-reference.md)

### 2. 问题反馈
- 检查控制台错误信息
- 验证环境变量配置
- 测试网络连接
- 查看浏览器开发者工具

### 3. 更新日志
- 关注GitHub仓库更新
- 查看CHANGELOG.md
- 订阅发布通知

---

**重要提示**：AI推理代理严格遵循CLAUDE.md中的策略规则，所有分析基于公开市场数据和量化规则。投资有风险，决策需谨慎。

**版本**: v1.0.0
**最后更新**: 2026年2月24日
**状态**: ✅ 生产就绪