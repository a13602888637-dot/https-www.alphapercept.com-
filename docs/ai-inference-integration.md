# AI推理代理集成指南

## 概述

量化推演显化代理（AI Inference Agent）是Alpha-Quant-Copilot的核心引擎，负责将直觉与底层数据转化为严谨的交易策略结晶。本指南说明如何将AI推理代理集成到现有系统中。

## 核心组件

### 1. 类型定义 (`lib/ai/inference-types.ts`)
- 定义AI推理相关的所有类型接口
- 包含股票数据、AI响应、风险等级、警报配置等
- 提供默认配置和关键词映射

### 2. Prompt工程工具 (`lib/ai/prompt-engineering.ts`)
- 构建符合CLAUDE.md策略规则的提示词
- 提取反人性破解器模块和硬性交易纪律
- 格式化股票数据和上下文信息

### 3. 风险解析器 (`lib/ai/risk-parser.ts`)
- 解析AI响应，提取风险信息
- 生成视觉警报环配置
- 验证AI响应格式
- 生成CSS动画样式

### 4. AI推理Hook (`hooks/useAIInference.ts`)
- 提供React Hook用于调用AI推理
- 处理API调用、错误处理和状态管理
- 支持单股票和批量推理

### 5. 风险警报环组件 (`components/quant-inference/RiskAlertRing.tsx`)
- 显示高危状态的视觉警报
- 支持脉冲、闪烁、发光等动画效果
- 提供简化版和迷你版变体

### 6. AI推理代理组件 (`components/quant-inference/AIInferenceAgent.tsx`)
- 完整的AI推理界面组件
- 支持完整、简化、迷你三种模式
- 自动触发推理和定时刷新

## 快速开始

### 1. 环境配置

```bash
# 设置DeepSeek API密钥
NEXT_PUBLIC_DEEPSEEK_API_KEY=your_api_key_here
```

### 2. 基本使用

```typescript
import { AIInferenceAgent } from '@/components/quant-inference/AIInferenceAgent';

function StockDetailPage({ stock }) {
  return (
    <div>
      <h1>{stock.name} ({stock.symbol})</h1>

      {/* 集成AI推理代理 */}
      <AIInferenceAgent
        stockData={stock}
        symbol={stock.symbol}
        name={stock.name}
        autoTrigger={true}
        showDetails={true}
        onInferenceComplete={(response) => {
          console.log('推理完成:', response);
        }}
      />
    </div>
  );
}
```

### 3. 集成到现有组件

#### 股票卡片集成

```typescript
import { MiniAIInferenceAgent } from '@/components/quant-inference/AIInferenceAgent';

function StockCard({ stock }) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{stock.name}</h3>
          <p className="text-sm text-muted-foreground">{stock.symbol}</p>
          <p className="text-lg font-bold">¥{stock.price.toFixed(2)}</p>
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

#### 自选股列表集成

```typescript
import { SimpleAIInferenceAgent } from '@/components/quant-inference/AIInferenceAgent';

function WatchlistItem({ stock }) {
  const [showAnalysis, setShowAnalysis] = useState(false);

  return (
    <div className="border-b py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <div className="font-medium">{stock.name}</div>
            <div className="text-sm text-muted-foreground">{stock.symbol}</div>
          </div>

          {/* 简化AI推理代理 */}
          <SimpleAIInferenceAgent
            stockData={stock}
            symbol={stock.symbol}
            name={stock.name}
            autoTrigger={true}
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAnalysis(!showAnalysis)}
        >
          {showAnalysis ? '隐藏分析' : '查看分析'}
        </Button>
      </div>

      {showAnalysis && (
        <div className="mt-3">
          <AIInferenceAgent
            stockData={stock}
            symbol={stock.symbol}
            name={stock.name}
            compactMode={true}
          />
        </div>
      )}
    </div>
  );
}
```

## 配置选项

### AIInferenceAgent Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `stockData` | `StockMarketData` | 必填 | 股票市场数据 |
| `symbol` | `string` | 必填 | 股票代码 |
| `name` | `string` | 必填 | 股票名称 |
| `autoTrigger` | `boolean` | `true` | 是否自动触发推理 |
| `showDetails` | `boolean` | `true` | 是否显示详细分析 |
| `compactMode` | `boolean` | `false` | 是否使用紧凑模式 |
| `refreshInterval` | `number` | `undefined` | 刷新间隔（毫秒） |
| `context` | `AIInferenceRequest['context']` | `undefined` | 上下文信息（投资组合等） |
| `options` | `AIInferenceRequest['options']` | `undefined` | AI推理选项 |
| `onInferenceComplete` | `(response: AIInferenceResponse) => void` | `undefined` | 推理完成回调 |
| `onError` | `(error: any) => void` | `undefined` | 错误回调 |
| `onStatusChange` | `(status: string) => void` | `undefined` | 状态变化回调 |

### 上下文信息配置

```typescript
const context = {
  portfolio: {
    '000001': {
      quantity: 1000,
      avgPrice: 10.50,
      currentValue: 10960,
      unrealizedPnl: 460
    }
  },
  marketCondition: {
    trend: 'sideways' as const,
    volatility: 'medium' as const,
    liquidity: '充足' as const
  },
  riskTolerance: 'moderate' as const,
  availableCapital: 100000,
  userId: 'user-123'
};
```

## 数据流

### 1. 数据准备
```
股票API → 股票数据 → 格式化 → AI推理请求
```

### 2. AI推理
```
策略规则 + 股票数据 → Prompt工程 → DeepSeek API → AI响应
```

### 3. 风险解析
```
AI响应 → 风险解析器 → 风险等级 + 警报配置 + 可视化建议
```

### 4. 视觉反馈
```
警报配置 → 风险警报环 → 动画效果 + 颜色编码 + 优先级显示
```

## 高危状态处理

### 触发条件
1. **反人性破解器识别**：诱多模式置信度 > 70%
2. **龙头衰竭识别**：衰竭模式置信度 > 80%
3. **陷阱概率**：trap_probability ≥ 90%
4. **关键词匹配**：检测到"强衰竭"、"诱多"、"清仓"等关键词

### 视觉警报
- **颜色**：高饱和度红色 (#FF4D4F)
- **动画**：脉冲动画 (pulse-alert)
- **强度**：最大强度 (10/10)
- **消息**：明确的高危警告信息

### 自动动作
1. 触发全局状态突变
2. 接管视觉焦点
3. 显示紧急操作建议
4. 记录高危事件日志

## 性能优化

### 1. 缓存策略
```typescript
// 使用SWR或React Query缓存推理结果
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

### 2. 批量处理
```typescript
// 批量推理，减少API调用
const { batchInfer } = useAIInference();

const handleBatchAnalyze = async (symbols: string[]) => {
  const results = await batchInfer(symbols);
  // 处理批量结果
};
```

### 3. 降级方案
```typescript
// API失败时使用模拟数据
try {
  const response = await infer(request);
} catch (error) {
  // 使用模拟数据继续显示
  const mockResponse = createMockInferenceResponse(stockData);
  // 显示降级UI
}
```

## 测试与调试

### 1. 演示页面
访问 `/ai-inference-demo` 查看完整功能演示。

### 2. 环境变量
```bash
# 开发环境
NEXT_PUBLIC_DEEPSEEK_API_KEY=dev_key_here

# 生产环境
NEXT_PUBLIC_DEEPSEEK_API_KEY=prod_key_here
```

### 3. 日志记录
```typescript
// 启用详细日志
console.log('AI推理请求:', request);
console.log('AI响应:', response);
console.log('解析结果:', parsedResult);
```

## 最佳实践

### 1. 错误处理
```typescript
<AIInferenceAgent
  onError={(error) => {
    // 记录错误
    console.error('AI推理错误:', error);
    // 显示用户友好的错误信息
    toast.error('AI分析暂时不可用，请稍后重试');
    // 触发降级方案
    showFallbackAnalysis();
  }}
/>
```

### 2. 用户体验
- 显示加载状态和进度指示
- 提供手动刷新按钮
- 支持展开/收起详细分析
- 高危状态时提供明确的操作指引

### 3. 性能监控
- 记录推理耗时
- 监控API调用成功率
- 跟踪高危状态触发频率
- 分析用户交互数据

## 故障排除

### 常见问题

1. **API密钥错误**
   ```
   错误：未设置DeepSeek API密钥
   解决：检查环境变量 NEXT_PUBLIC_DEEPSEEK_API_KEY
   ```

2. **网络超时**
   ```
   错误：DeepSeek API调用超时
   解决：增加timeoutMs选项，添加重试机制
   ```

3. **响应格式错误**
   ```
   错误：AI响应不是有效的JSON格式
   解决：检查Prompt工程，确保AI返回正确格式
   ```

4. **内存泄漏**
   ```
   警告：组件卸载后仍有未完成的请求
   解决：使用abort controller取消请求
   ```

### 调试工具

```typescript
// 启用调试模式
const DEBUG_MODE = process.env.NODE_ENV === 'development';

if (DEBUG_MODE) {
  // 输出详细日志
  // 启用性能分析
  // 显示调试信息
}
```

## 扩展开发

### 1. 自定义策略规则
```typescript
// 扩展策略规则
import { readStrategyDocument } from '@/lib/ai/prompt-engineering';

const customRules = `
## 自定义策略模块
- 新增规则1: ...
- 新增规则2: ...
`;

const enhancedPrompt = buildInferencePrompt(stockData, context, {
  customStrategy: customRules
});
```

### 2. 新增数据源
```typescript
// 集成新的数据源
const enhancedStockData = {
  ...stockData,
  // 新增技术指标
  newIndicator: calculateNewIndicator(stockData),
  // 新增资金流向数据
  enhancedFlowData: fetchEnhancedFlowData(symbol)
};
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

## 版本历史

### v1.0.0 (2026-02-24)
- 初始版本发布
- 实现核心AI推理代理
- 集成反人性破解器模块
- 添加视觉警报环系统
- 提供三种显示模式

---

**注意**：本系统严格遵循CLAUDE.md中的策略规则，所有AI推理必须基于具体数据和规则条款，不能主观臆断。高危状态时，必须立即触发视觉警报并提供明确的操作指引。