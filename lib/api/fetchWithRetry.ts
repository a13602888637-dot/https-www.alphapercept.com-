/**
 * 带重试机制的fetch包装器
 */

import { ErrorHandler } from '../error/ErrorHandler';
import { ErrorFactory } from '../error/ErrorFactory';
import { StandardError, RequestConfig, FallbackData } from '../error/types';
import { getErrorHandlerConfig, isRetryable, calculateRetryDelay } from '../error/config';

/**
 * 带重试机制的fetch请求
 */
export async function fetchWithRetry<T = any>(
  url: string,
  config: RequestConfig = {}
): Promise<{
  data: T;
  error: StandardError | null;
  response: Response | null;
  isFallback: boolean;
}> {
  const errorHandler = ErrorHandler.getInstance();
  const retryConfig = {
    ...getErrorHandlerConfig().retry,
    ...config.retry
  };

  let lastError: StandardError | null = null;
  let retryCount = 0;

  while (retryCount <= retryConfig.maxRetries) {
    try {
      // 设置超时
      const timeout = config.timeout || 30000; // 默认30秒
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const fetchConfig = {
        ...config,
        signal: controller.signal
      };

      // 执行请求
      const response = await fetch(url, fetchConfig);
      clearTimeout(timeoutId);

      // 检查响应状态
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `HTTP ${response.status}` };
        }

        const error = await errorHandler.handleFetchError(
          response,
          errorData,
          undefined,
          config
        );

        // 检查是否可重试
        if (
          retryCount < retryConfig.maxRetries &&
          isRetryable(response.status, error.type)
        ) {
          retryCount++;
          const delay = calculateRetryDelay(retryCount);
          await sleep(delay);
          continue;
        }

        lastError = error;

        // 如果有降级数据，返回降级数据
        if (config.fallbackData !== undefined) {
          const fallbackData = errorHandler.createFallbackData(
            config.fallbackData,
            error
          );
          return {
            data: fallbackData.data,
            error,
            response,
            isFallback: true
          };
        }

        // 抛出错误
        throw error;
      }

      // 解析响应数据
      let data: T;
      try {
        data = await response.json();
      } catch (error) {
        // JSON解析失败
        const parseError = ErrorFactory.create(
          '响应数据解析失败',
          'api' as any,
          'medium' as any,
          'JSON_PARSE_ERROR',
          error as Error
        );

        await errorHandler.handleError(parseError, 'json_parse');

        // 如果有降级数据，返回降级数据
        if (config.fallbackData !== undefined) {
          const fallbackData = errorHandler.createFallbackData(
            config.fallbackData,
            parseError
          );
          return {
            data: fallbackData.data,
            error: parseError,
            response,
            isFallback: true
          };
        }

        throw parseError;
      }

      // 检查API响应格式
      if (data && typeof data === 'object' && 'success' in data) {
        if (!data.success) {
          const apiError = ErrorFactory.create(
            data.error || 'API请求失败',
            'api' as any,
            'medium' as any,
            'API_ERROR',
            undefined,
            data
          );

          await errorHandler.handleError(apiError, 'api_response');

          // 如果有降级数据，返回降级数据
          if (config.fallbackData !== undefined) {
            const fallbackData = errorHandler.createFallbackData(
              config.fallbackData,
              apiError
            );
            return {
              data: fallbackData.data,
              error: apiError,
              response,
              isFallback: true
            };
          }

          throw apiError;
        }
      }

      // 请求成功
      return {
        data,
        error: null,
        response,
        isFallback: false
      };

    } catch (error) {
      // 处理AbortError（超时）
      if (error instanceof DOMException && error.name === 'AbortError') {
        const timeoutError = await errorHandler.handleTimeoutError(
          config.timeout || 30000,
          config
        );

        // 检查是否可重试
        if (retryCount < retryConfig.maxRetries) {
          retryCount++;
          const delay = calculateRetryDelay(retryCount);
          await sleep(delay);
          continue;
        }

        lastError = timeoutError;

        // 如果有降级数据，返回降级数据
        if (config.fallbackData !== undefined) {
          const fallbackData = errorHandler.createFallbackData(
            config.fallbackData,
            timeoutError
          );
          return {
            data: fallbackData.data,
            error: timeoutError,
            response: null,
            isFallback: true
          };
        }

        throw timeoutError;
      }

      // 处理网络错误
      if (
        error instanceof TypeError &&
        (error.message.includes('Failed to fetch') || error.message.includes('Network request failed'))
      ) {
        const networkError = await errorHandler.handleNetworkError(error, config);

        // 检查是否可重试
        if (retryCount < retryConfig.maxRetries) {
          retryCount++;
          const delay = calculateRetryDelay(retryCount);
          await sleep(delay);
          continue;
        }

        lastError = networkError;

        // 如果有降级数据，返回降级数据
        if (config.fallbackData !== undefined) {
          const fallbackData = errorHandler.createFallbackData(
            config.fallbackData,
            networkError
          );
          return {
            data: fallbackData.data,
            error: networkError,
            response: null,
            isFallback: true
          };
        }

        throw networkError;
      }

      // 处理其他错误
      if (error instanceof Error) {
        const standardError = ErrorFactory.create(
          error.message,
          'unknown' as any,
          'medium' as any,
          'UNKNOWN_ERROR',
          error
        );

        await errorHandler.handleError(standardError, 'fetch_unknown');

        // 检查是否可重试
        if (
          retryCount < retryConfig.maxRetries &&
          isRetryable(undefined, standardError.type)
        ) {
          retryCount++;
          const delay = calculateRetryDelay(retryCount);
          await sleep(delay);
          continue;
        }

        lastError = standardError;

        // 如果有降级数据，返回降级数据
        if (config.fallbackData !== undefined) {
          const fallbackData = errorHandler.createFallbackData(
            config.fallbackData,
            standardError
          );
          return {
            data: fallbackData.data,
            error: standardError,
            response: null,
            isFallback: true
          };
        }

        throw standardError;
      }

      // 未知错误类型
      const unknownError = ErrorFactory.create(
        '未知错误',
        'unknown' as any,
        'high' as any,
        'UNKNOWN_ERROR'
      );

      await errorHandler.handleError(unknownError, 'fetch_unknown_type');
      throw unknownError;
    }
  }

  // 所有重试都失败
  if (lastError) {
    throw lastError;
  }

  // 不应该执行到这里
  const unexpectedError = ErrorFactory.create(
    '意外的错误处理流程',
    'unknown' as any,
    'high' as any,
    'UNEXPECTED_ERROR'
  );
  throw unexpectedError;
}

/**
 * 简化的fetch包装器（不处理重试）
 */
export async function safeFetch<T = any>(
  url: string,
  config: RequestConfig = {}
): Promise<{
  data: T | null;
  error: StandardError | null;
  response: Response | null;
  isFallback: boolean;
}> {
  try {
    const result = await fetchWithRetry<T>(url, {
      ...config,
      retry: { maxRetries: 0 } // 禁用重试
    });
    return result;
  } catch (error) {
    const errorHandler = ErrorHandler.getInstance();

    // 如果有降级数据，返回降级数据
    if (config.fallbackData !== undefined) {
      const fallbackData = errorHandler.createFallbackData(
        config.fallbackData,
        error as StandardError
      );
      return {
        data: fallbackData.data,
        error: error as StandardError,
        response: null,
        isFallback: true
      };
    }

    return {
      data: null,
      error: error as StandardError,
      response: null,
      isFallback: false
    };
  }
}

/**
 * 睡眠函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 创建API客户端
 */
export function createApiClient(baseUrl: string = '') {
  return {
    get: <T = any>(endpoint: string, config?: RequestConfig) =>
      fetchWithRetry<T>(`${baseUrl}${endpoint}`, { ...config, method: 'GET' }),

    post: <T = any>(endpoint: string, data?: any, config?: RequestConfig) =>
      fetchWithRetry<T>(`${baseUrl}${endpoint}`, {
        ...config,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config?.headers
        },
        body: data ? JSON.stringify(data) : undefined
      }),

    put: <T = any>(endpoint: string, data?: any, config?: RequestConfig) =>
      fetchWithRetry<T>(`${baseUrl}${endpoint}`, {
        ...config,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...config?.headers
        },
        body: data ? JSON.stringify(data) : undefined
      }),

    delete: <T = any>(endpoint: string, config?: RequestConfig) =>
      fetchWithRetry<T>(`${baseUrl}${endpoint}`, { ...config, method: 'DELETE' }),

    patch: <T = any>(endpoint: string, data?: any, config?: RequestConfig) =>
      fetchWithRetry<T>(`${baseUrl}${endpoint}`, {
        ...config,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...config?.headers
        },
        body: data ? JSON.stringify(data) : undefined
      })
  };
}

// 默认API客户端
export const api = createApiClient();