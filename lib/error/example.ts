/**
 * 错误处理系统使用示例
 *
 * 注意：这是一个示例文件，实际使用时需要将文件扩展名改为 .tsx
 * 或者在构建配置中排除此文件
 */

// 示例代码，实际使用时需要将文件扩展名改为 .tsx
// 或者在构建配置中排除此文件

// 以下代码包含JSX语法，需要在.tsx文件中使用
// 为了通过TypeScript检查，暂时注释掉JSX部分

/**
 * 示例1: 使用useErrorHandler Hook
 */
function ExampleComponent() {
  const {
    handleError,
    createError,
    fetchWithRetry: fetchWithRetryHook,
    api: apiClient
  } = useErrorHandler();

  // 示例：处理按钮点击错误
  const handleButtonClick = async () => {
    try {
      // 模拟一个可能失败的操作
      throw new Error('按钮点击操作失败');
    } catch (error) {
      const standardError = createError(
        '按钮操作失败',
        ErrorType.CLIENT,
        ErrorSeverity.MEDIUM,
        'BUTTON_CLICK_ERROR',
        error instanceof Error ? error : undefined
      );
      await handleError(standardError, 'button_click');
    }
  };

  // 示例：使用fetchWithRetry获取数据
  const fetchData = async () => {
    const { data, error, isFallback } = await fetchWithRetryHook('/api/data', {
      fallbackData: { items: [] }, // 降级数据
      timeout: 10000 // 10秒超时
    });

    if (error) {
      // 错误已自动处理，这里可以执行额外逻辑
      console.log('请求失败，使用降级数据:', isFallback);
    }

    return data;
  };

  // 示例：使用API客户端
  const fetchWithApiClient = async () => {
    try {
      const { data, error, isFallback } = await apiClient.get('/api/watchlist');

      if (error) {
        // 错误已自动处理
        return null;
      }

      return data;
    } catch (error) {
      // 这里不会执行，因为错误已在fetchWithRetry中处理
      return null;
    }
  };

  return null;
  // 实际使用时需要将文件扩展名改为 .tsx
  // return (
  //   <div>
  //     <button onClick={handleButtonClick}>点击我（会触发错误）</button>
  //     <button onClick={fetchData}>获取数据（带重试）</button>
  //   </div>
  // );
}

/**
 * 示例2: 使用ErrorDisplay组件
 */
function ExampleWithErrorDisplay() {
  const { createError } = useErrorHandler();

  const error = createError(
    '数据加载失败',
    ErrorType.NETWORK,
    ErrorSeverity.HIGH,
    'NETWORK_ERROR'
  );

  const handleRetry = () => {
    console.log('重试操作');
  };

  return null;
  // 实际使用时需要将文件扩展名改为 .tsx
  // return (
  //   <div className="space-y-4">
  //     {/* 卡片样式错误显示 */}
  //     <ErrorDisplay
  //       error={error}
  //       title="网络错误"
  //       description="无法连接到服务器，请检查网络连接"
  //       showRetry={true}
  //       onRetry={handleRetry}
  //       variant="card"
  //     />
  //
  //     {/* 内联样式错误显示 */}
  //     <ErrorDisplay
  //       error={error}
  //       variant="inline"
  //       showDetails={true}
  //     />
  //
  //     {/* 全屏样式错误显示 */}
  //     <ErrorDisplay
  //       error={error}
  //       variant="full"
  //       showRetry={true}
  //       onRetry={handleRetry}
  //     />
  //   </div>
  // );
}

/**
 * 示例3: 使用ErrorBoundary
 */
function ExampleWithErrorBoundary() {
  const BuggyComponent = () => {
    throw new Error('这个组件会崩溃！');
    return null;
    // 实际使用时需要将文件扩展名改为 .tsx
    // return <div>这个组件不会渲染</div>;
  };

  return null;
  // 实际使用时需要将文件扩展名改为 .tsx
  // return (
  //   <ErrorBoundary
  //     onError={(error, errorInfo) => {
  //       console.error('组件崩溃:', error, errorInfo);
  //     }}
  //   >
  //     <BuggyComponent />
  //   </ErrorBoundary>
  // );
}

/**
 * 示例4: 使用FallbackDataDisplay
 */
function ExampleWithFallbackData() {
  const { createError } = useErrorHandler();

  // 模拟数据
  const data = {
    items: [
      { id: 1, name: '项目1' },
      { id: 2, name: '项目2' }
    ]
  };

  const error = createError(
    '实时数据获取失败',
    ErrorType.NETWORK,
    ErrorSeverity.MEDIUM,
    'DATA_FETCH_ERROR'
  );

  const fallbackData = {
    data,
    isFallback: true,
    timestamp: new Date(),
    error
  };

  return null;
  // 实际使用时需要将文件扩展名改为 .tsx
  // return (
  //   <FallbackDataDisplay
  //     data={fallbackData.data}
  //     isFallback={fallbackData.isFallback}
  //     error={fallbackData.error}
  //   >
  //     {(data, isFallback) => (
  //       <div>
  //         <h3>数据列表 {isFallback && '(缓存数据)'}</h3>
  //         <ul>
  //           {data.items.map(item => (
  //             <li key={item.id}>{item.name}</li>
  //           ))}
  //         </ul>
  //       </div>
  //     )}
  //   </FallbackDataDisplay>
  // );
}

/**
 * 示例5: 使用useError简化Hook
 */
function ExampleWithUseError() {
  const { showError, showSuccess, handleAsyncError } = useError();

  const handleAsyncOperation = async () => {
    // 使用handleAsyncError包装异步操作
    const result = await handleAsyncError(
      fetch('/api/data').then(res => res.json()),
      { fallback: 'default' } // 降级数据
    );

    if (result) {
      showSuccess('操作成功');
    }
  };

  const handleManualError = () => {
    showError('这是一个手动触发的错误', ErrorSeverity.MEDIUM);
  };

  return null;
  // 实际使用时需要将文件扩展名改为 .tsx
  // return (
  //   <div>
  //     <button onClick={handleAsyncOperation}>执行异步操作</button>
  //     <button onClick={handleManualError}>触发错误</button>
  //   </div>
  // );
}

/**
 * 示例6: 迁移现有代码
 */
function ExampleMigration() {
  // 旧代码模式
  const oldWay = async () => {
    try {
      const response = await fetch('/api/data');
      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('请求失败:', error);
      // 旧方式：直接toast
      // toast.error(error instanceof Error ? error.message : '请求失败');
      return null;
    }
  };

  // 新代码模式
  const newWay = async () => {
    const { data, error, isFallback } = await safeFetch('/api/data', {
      fallbackData: { items: [] }
    });

    if (error) {
      // 错误已自动处理（toast + 日志 + 上报）
      console.log('使用降级数据:', isFallback);
    }

    return data;
  };

  // 更简洁的方式
  const simplerWay = async () => {
    const { handleAsyncError } = useError();
    return await handleAsyncError(
      fetch('/api/data').then(res => res.json()),
      { items: [] }
    );
  };

  return null;
  // 实际使用时需要将文件扩展名改为 .tsx
  // return (
  //   <div>
  //     <button onClick={oldWay}>旧方式</button>
  //     <button onClick={newWay}>新方式</button>
  //     <button onClick={simplerWay}>简化方式</button>
  //   </div>
  // );
}

export {
  ExampleComponent,
  ExampleWithErrorDisplay,
  ExampleWithErrorBoundary,
  ExampleWithFallbackData,
  ExampleWithUseError,
  ExampleMigration
};