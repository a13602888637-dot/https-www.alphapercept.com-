# 错误处理系统迁移指南

## 概述

本文档指导如何将现有代码迁移到新的统一错误处理系统。新系统提供了标准化的错误处理、自动重试、降级策略和错误监控。

## 新系统特性

1. **标准化错误** - 统一的错误类型和严重程度分类
2. **自动重试** - 指数退避重试机制
3. **降级策略** - 优雅降级数据支持
4. **错误监控** - 自动错误上报和日志
5. **统一UI** - 一致的错误显示组件
6. **简化API** - 易于使用的Hook和工具函数

## 快速开始

### 安装依赖

新系统已集成到项目中，无需额外安装。

### 基本使用

```typescript
// 1. 使用useErrorHandler Hook
import { useErrorHandler } from '@/hooks/useErrorHandler';

function MyComponent() {
  const { handleError, createError, fetchWithRetry } = useErrorHandler();

  // 处理错误
  const handleClick = async () => {
    try {
      // 你的代码
    } catch (error) {
      const standardError = createError(
        '操作失败',
        'client', // ErrorType.CLIENT
        'medium', // ErrorSeverity.MEDIUM
        'MY_ERROR',
        error instanceof Error ? error : undefined
      );
      await handleError(standardError, 'my_component');
    }
  };

  // 使用带重试的fetch
  const fetchData = async () => {
    const { data, error, isFallback } = await fetchWithRetry('/api/data', {
      fallbackData: [], // 降级数据
      timeout: 10000    // 10秒超时
    });

    if (error) {
      // 错误已自动处理
      console.log('使用降级数据:', isFallback);
    }

    return data;
  };
}
```

## 迁移示例

### 示例1: 迁移try-catch + toast模式

**旧代码:**
```typescript
try {
  const response = await fetch('/api/watchlist');
  if (!response.ok) {
    throw new Error(`API请求失败: ${response.status}`);
  }
  const data = await response.json();
  setWatchlist(data.watchlist);
} catch (error) {
  console.error('加载自选股失败:', error);
  toast({
    title: "加载失败",
    description: error instanceof Error ? error.message : "加载自选股失败",
    variant: "destructive",
  });
  setError(error instanceof Error ? error.message : "加载自选股失败");
}
```

**新代码:**
```typescript
import { useErrorHandler } from '@/hooks/useErrorHandler';

function MyComponent() {
  const { safeFetch } = useErrorHandler();

  const loadWatchlist = async () => {
    const { data, error, isFallback } = await safeFetch('/api/watchlist', {
      fallbackData: { watchlist: [] }
    });

    if (error) {
      // 错误已自动处理（toast + 日志 + 上报）
      setError(error.userFriendlyMessage || error.message);
    }

    if (data) {
      setWatchlist(data.watchlist);
    }

    // 如果是降级数据，可以显示提示
    if (isFallback) {
      console.log('使用缓存的自选股数据');
    }
  };
}
```

### 示例2: 迁移API调用

**旧代码:**
```typescript
const handleAddToWatchlist = async (stock) => {
  setAddingStock(stock.code);
  try {
    const response = await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stockCode: stock.code,
        stockName: stock.name,
      })
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("请先登录以添加自选股");
      }
      const data = await response.json();
      throw new Error(data.error || `添加失败: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      await loadWatchlist();
      toast({
        title: "添加成功",
        description: `已成功添加 ${stock.name} (${stock.code}) 到自选股`,
        variant: "default",
      });
    } else {
      throw new Error(data.error || "添加失败");
    }
  } catch (error) {
    console.error("添加自选股失败:", error);
    const errorMessage = error instanceof Error ? error.message : "添加自选股失败";

    toast({
      title: "添加失败",
      description: errorMessage,
      variant: "destructive",
    });
    setError(errorMessage);
  } finally {
    setAddingStock(null);
  }
};
```

**新代码:**
```typescript
import { useErrorHandler } from '@/hooks/useErrorHandler';

function MyComponent() {
  const { api } = useErrorHandler();

  const handleAddToWatchlist = async (stock) => {
    setAddingStock(stock.code);

    const { data, error, isFallback } = await api.post('/api/watchlist', {
      stockCode: stock.code,
      stockName: stock.name,
    });

    if (error) {
      // 错误已自动处理
      setError(error.userFriendlyMessage || error.message);
    } else if (data?.success) {
      await loadWatchlist();
      // 成功toast可以单独处理
      toast({
        title: "添加成功",
        description: `已成功添加 ${stock.name} (${stock.code}) 到自选股`,
        variant: "default",
      });
    }

    setAddingStock(null);
  };
}
```

### 示例3: 使用ErrorDisplay组件

**旧代码:**
```typescript
{error && (
  <Card className="border-red-200 bg-red-50">
    <CardContent className="pt-6">
      <div className="space-y-3">
        <div className="flex items-center text-red-600">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </div>
      </div>
    </CardContent>
  </Card>
)}
```

**新代码:**
```typescript
import { ErrorDisplay } from '@/components/error/ErrorDisplay';
import { useErrorHandler } from '@/hooks/useErrorHandler';

function MyComponent() {
  const { createError } = useErrorHandler();

  // 如果有错误状态
  const error = errorState ? createError(
    errorState,
    'client',
    'medium',
    'COMPONENT_ERROR'
  ) : null;

  return (
    <div>
      {error && (
        <ErrorDisplay
          error={error}
          variant="card"
          showRetry={true}
          onRetry={() => window.location.reload()}
        />
      )}
    </div>
  );
}
```

## 高级用法

### 自定义错误处理配置

```typescript
// 在应用初始化时配置
import { getErrorHandlerConfig } from '@/lib/error/config';

// 可以通过环境变量配置
// NEXT_PUBLIC_ERROR_TOAST_ENABLED=true
// NEXT_PUBLIC_ERROR_MAX_RETRIES=5
// NEXT_PUBLIC_ERROR_BASE_DELAY=2000
```

### 错误边界使用

```typescript
import { ErrorBoundary } from '@/components/error/ErrorDisplay';

function App() {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-8 text-center">
          <h2>应用崩溃</h2>
          <p>抱歉，应用遇到了严重错误</p>
          <button onClick={() => window.location.reload()}>
            重新加载
          </button>
        </div>
      }
      onError={(error, errorInfo) => {
        // 自定义错误处理逻辑
        console.error('应用崩溃:', error, errorInfo);
        // 上报到监控服务
      }}
    >
      <YourApp />
    </ErrorBoundary>
  );
}
```

### 降级策略

```typescript
import { FallbackDataDisplay } from '@/components/error/ErrorDisplay';

function DataComponent() {
  const { data, error, isFallback } = useData();

  return (
    <FallbackDataDisplay
      data={data}
      isFallback={isFallback}
      error={error}
      fallbackComponent={
        <div>数据加载失败，显示备用UI</div>
      }
    >
      {(data, isFallback) => (
        <div>
          <h3>数据展示 {isFallback && '(缓存数据)'}</h3>
          {/* 渲染数据 */}
        </div>
      )}
    </FallbackDataDisplay>
  );
}
```

## 最佳实践

### 1. 错误分类
- 使用正确的错误类型（ErrorType）和严重程度（ErrorSeverity）
- 网络错误：ErrorType.NETWORK, ErrorSeverity.HIGH
- 验证错误：ErrorType.VALIDATION, ErrorSeverity.LOW
- 认证错误：ErrorType.AUTH, ErrorSeverity.HIGH

### 2. 错误消息
- 提供用户友好的错误消息
- 包含足够的调试信息
- 避免暴露敏感信息

### 3. 重试策略
- 对可重试错误启用自动重试
- 配置合理的重试次数和延迟
- 对用户操作提供手动重试按钮

### 4. 降级处理
- 为关键数据提供降级数据
- 明确标识降级状态
- 提供刷新或重试选项

### 5. 错误监控
- 在生产环境启用错误上报
- 定期检查错误报告
- 建立错误响应流程

## 常见问题

### Q: 如何禁用特定请求的错误toast？
A: 使用`skipGlobalErrorHandler`选项：
```typescript
const { data } = await fetchWithRetry('/api/data', {
  skipGlobalErrorHandler: true
});
```

### Q: 如何自定义重试逻辑？
A: 传递自定义重试配置：
```typescript
const { data } = await fetchWithRetry('/api/data', {
  retry: {
    maxRetries: 5,
    baseDelay: 2000,
    retryableStatusCodes: [500, 502, 503, 504]
  }
});
```

### Q: 如何集成现有的toast系统？
A: 新系统自动使用现有的`useToast` hook，无需额外配置。

### Q: 错误上报到哪里？
A: 默认不上报，可以通过设置`NEXT_PUBLIC_ERROR_REPORT_URL`环境变量启用。

## 下一步

1. **逐步迁移** - 从关键组件开始，逐步替换旧代码
2. **测试验证** - 确保错误处理逻辑正确
3. **监控配置** - 配置生产环境错误监控
4. **团队培训** - 确保团队成员了解新系统

## 支持

如有问题，请参考：
- 示例代码：`/lib/error/example.ts`
- 类型定义：`/lib/error/types.ts`
- 组件文档：`/components/error/ErrorDisplay.tsx`
- Hook文档：`/hooks/useErrorHandler.ts`