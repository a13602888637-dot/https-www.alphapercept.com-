# Tool Calling 2.0 开发模式文档

**文档版本**: 1.0
**创建日期**: 2026-02-28
**目的**: 标准化Tool Calling 2.0架构，作为后续开发的可复用模式

---

## 一、核心概念与架构原则

### 1.1 本质转变

Tool Calling 2.0实现了**从文本对话到函数路由的范式转变**：

```
传统模式：
用户 → AI → 文本回复

Tool Calling 2.0：
用户 → AI → JSON结构（指定调用哪个函数及参数）→ 执行函数 → 结果返回AI → 最终回复
```

### 1.2 核心架构原则

1. **函数即能力** - 每个工具函数代表AI的一种能力扩展
2. **JSON Schema驱动** - 通过标准化Schema让AI理解函数签名
3. **类型安全** - TypeScript严格类型定义确保调用正确性
4. **流式兼容** - 工具调用应在SSE流式传输中无缝工作
5. **可观测性** - 完整的调用链路追踪和日志

### 1.3 适用场景

**✅ 适用：**
- AI需要访问外部数据（数据库、API）
- AI需要执行计算或复杂逻辑
- AI需要与系统交互（文件操作、代码执行）

**❌ 不适用：**
- 纯文本对话场景（过度设计）

---

## 二、Function Schema 标准规范

### 2.1 Schema结构定义

```typescript
interface FunctionSchema {
  name: string;              // 函数名称（snake_case）
  description: string;       // 功能描述（AI用于理解何时调用）
  parameters: {             // 参数定义（JSON Schema格式）
    type: "object";
    properties: {
      [key: string]: {
        type: "string" | "number" | "boolean" | "array" | "object";
        description: string;
        enum?: any[];        // 可选：枚举值
        items?: object;      // 可选：数组元素类型
      };
    };
    required: string[];      // 必填参数列表
  };
}
```

### 2.2 实例示例 - 股票查询工具

```typescript
const getStockInfoSchema: FunctionSchema = {
  name: "get_stock_info",
  description: "查询股票的实时价格、涨跌幅、成交量等信息。当用户询问股票价格或行情时使用。",
  parameters: {
    type: "object",
    properties: {
      stock_code: {
        type: "string",
        description: "股票代码，例如：600519（贵州茅台）、000001（平安银行）"
      },
      fields: {
        type: "array",
        description: "需要查询的字段列表（可选）",
        items: {
          type: "string",
          enum: ["price", "change", "volume", "turnover", "pe_ratio"]
        }
      }
    },
    required: ["stock_code"]
  }
};
```

### 2.3 Schema编写最佳实践

1. **描述要详尽** - AI依赖description判断何时调用
2. **参数要明确** - 包含示例值和格式说明
3. **类型要严格** - 使用enum限制可选值
4. **验证要完整** - required字段必须明确

---

## 三、工具函数实现规范

### 3.1 标准函数签名

```typescript
type ToolFunction<TParams = any, TResult = any> = {
  schema: FunctionSchema;
  handler: (params: TParams) => Promise<ToolResult<TResult>>;
};

interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    executionTime?: number;
    source?: string;
    cached?: boolean;
  };
}
```

### 3.2 完整实现示例

```typescript
// 1. 定义参数类型
interface GetStockInfoParams {
  stock_code: string;
  fields?: string[];
}

// 2. 定义返回数据类型
interface StockInfo {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
}

// 3. 实现工具函数
const getStockInfoTool: ToolFunction<GetStockInfoParams, StockInfo> = {
  schema: getStockInfoSchema,

  handler: async (params) => {
    const startTime = Date.now();

    try {
      // 参数验证
      if (!params.stock_code || params.stock_code.length !== 6) {
        return {
          success: false,
          error: "股票代码格式错误，应为6位数字"
        };
      }

      // 调用数据服务
      const stockData = await fetchStockDataSmart(params.stock_code);

      // 数据转换
      const result: StockInfo = {
        code: stockData.symbol,
        name: stockData.name,
        price: stockData.currentPrice,
        change: stockData.change || 0,
        changePercent: stockData.changePercent || 0,
      };

      if (!params.fields || params.fields.includes('volume')) {
        result.volume = stockData.volume;
      }

      return {
        success: true,
        data: result,
        metadata: {
          executionTime: Date.now() - startTime,
          source: 'smart_router',
          cached: false
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
        metadata: {
          executionTime: Date.now() - startTime
        }
      };
    }
  }
};
```

### 3.3 函数实现最佳实践

1. **参数验证优先** - 先验证参数合法性，快速失败
2. **异常捕获完整** - 所有外部调用都要try-catch
3. **返回格式统一** - 始终返回ToolResult结构
4. **性能追踪** - 记录executionTime用于监控
5. **幂等性保证** - 相同参数多次调用结果一致
6. **超时控制** - 设置合理的超时时间避免阻塞

### 3.4 错误处理策略

```typescript
// 错误分类
enum ToolErrorType {
  VALIDATION_ERROR = "validation_error",    // 参数验证错误
  NOT_FOUND = "not_found",                 // 数据不存在
  API_ERROR = "api_error",                 // 外部API错误
  TIMEOUT = "timeout",                     // 超时错误
  PERMISSION_DENIED = "permission_denied", // 权限错误
  UNKNOWN = "unknown"                      // 未知错误
}

interface ToolError {
  type: ToolErrorType;
  message: string;
  details?: any;
}

// 错误返回示例
return {
  success: false,
  error: JSON.stringify({
    type: ToolErrorType.NOT_FOUND,
    message: "股票代码不存在",
    details: { code: params.stock_code }
  })
};
```

---

## 四、流式输出集成

### 4.1 SSE流式传输中的工具调用

```typescript
// API路由示例
export async function POST(request: NextRequest) {
  const { messages, tools } = await request.json();

  const stream = new ReadableStream({
    async start(controller) {
      // 1. 调用AI API（支持tools参数）
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          messages,
          tools,  // Function Schema数组
          stream: true
        })
      });

      // 2. 处理流式响应
      for await (const chunk of response.body) {
        const parsed = JSON.parse(chunk);

        // 3. 检测工具调用请求
        if (parsed.type === 'tool_use') {
          // 执行工具函数
          const tool = toolRegistry[parsed.name];
          const result = await tool.handler(parsed.input);

          // 将结果返回给AI
          controller.enqueue({
            type: 'tool_result',
            tool_use_id: parsed.id,
            content: JSON.stringify(result)
          });
        } else {
          // 转发其他内容
          controller.enqueue(chunk);
        }
      }

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
}
```

### 4.2 工具调用流程图

```
1. 用户消息 → AI API
2. AI API → 返回 tool_use 事件
3. 服务器 → 执行工具函数
4. 服务器 → 返回 tool_result 给AI
5. AI API → 基于结果生成最终回复
6. 服务器 → 流式传输给前端
```

---

## 五、工具注册与管理

### 5.1 工具注册中心

```typescript
class ToolRegistry {
  private tools = new Map<string, ToolFunction>();

  register(tool: ToolFunction) {
    this.tools.set(tool.schema.name, tool);
  }

  getSchemas(): FunctionSchema[] {
    return Array.from(this.tools.values()).map(t => t.schema);
  }

  async execute(name: string, params: any): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Tool ${name} not found` };
    }
    return await tool.handler(params);
  }

  list(): string[] {
    return Array.from(this.tools.keys());
  }
}

// 全局单例
export const toolRegistry = new ToolRegistry();
```

### 5.2 使用示例

```typescript
// 注册工具
toolRegistry.register(getStockInfoTool);
toolRegistry.register(calculateCostTool);
toolRegistry.register(searchStockTool);

// 获取所有Schema（传给AI）
const schemas = toolRegistry.getSchemas();

// 执行工具
const result = await toolRegistry.execute('get_stock_info', {
  stock_code: '600519'
});
```

---

## 六、完整集成示例

### 6.1 目录结构

```
lib/tools/
├── registry.ts           # 工具注册中心
├── schemas/              # Schema定义
│   ├── stock.ts
│   └── calculator.ts
└── handlers/             # 工具实现
    ├── stock.ts
    └── calculator.ts

app/api/ai/chat-with-tools/
└── route.ts              # 支持工具调用的API路由
```

### 6.2 端到端示例

```typescript
// lib/tools/handlers/stock.ts
export const getStockInfoTool: ToolFunction = {
  schema: {
    name: "get_stock_info",
    description: "查询股票实时行情",
    parameters: {
      type: "object",
      properties: {
        stock_code: {
          type: "string",
          description: "6位股票代码"
        }
      },
      required: ["stock_code"]
    }
  },

  handler: async ({ stock_code }) => {
    const data = await fetchStockDataSmart(stock_code);
    return { success: true, data };
  }
};

// app/api/ai/chat-with-tools/route.ts
import { toolRegistry } from '@/lib/tools/registry';
import { getStockInfoTool } from '@/lib/tools/handlers/stock';

toolRegistry.register(getStockInfoTool);

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  // 调用AI时传入工具schemas
  const response = await callAI({
    messages,
    tools: toolRegistry.getSchemas()
  });

  // 处理工具调用...
}
```

---

## 七、测试与验证

### 7.1 单元测试

```typescript
describe('getStockInfoTool', () => {
  it('should return stock info for valid code', async () => {
    const result = await getStockInfoTool.handler({
      stock_code: '600519'
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('price');
  });

  it('should return error for invalid code', async () => {
    const result = await getStockInfoTool.handler({
      stock_code: 'invalid'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

### 7.2 集成测试

```bash
# 测试AI调用工具
curl -X POST http://localhost:3000/api/ai/chat-with-tools \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "role": "user",
      "content": "贵州茅台现在多少钱？"
    }]
  }'

# 预期：AI应该调用get_stock_info工具并返回价格
```

---

## 八、最佳实践总结

### 8.1 Do's ✅

- 工具函数保持单一职责
- Schema描述详细准确
- 完整的错误处理
- 记录性能指标
- 类型安全优先

### 8.2 Don'ts ❌

- 不要在工具函数中执行长时间操作（>30秒）
- 不要在Schema中使用模糊的描述
- 不要忽略参数验证
- 不要在工具函数中直接访问全局状态
- 不要返回不符合ToolResult格式的数据

---

## 九、参考资料

- [Anthropic API - Tool Use](https://docs.anthropic.com/claude/docs/tool-use)
- [OpenAI API - Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [JSON Schema Specification](https://json-schema.org/)

---

**文档维护**：
- 创建者：Claude Sonnet 4.5
- 最后更新：2026-02-28
- 状态：✅ 已完成
