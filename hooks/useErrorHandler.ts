/**
 * 错误处理Hook
 */

import { useCallback } from 'react';
import { ErrorHandler } from '@/lib/error/ErrorHandler';
import { ErrorFactory } from '@/lib/error/ErrorFactory';
import { StandardError, ErrorSeverity, ErrorType, FallbackData } from '@/lib/error/types';
import { fetchWithRetry, safeFetch, createApiClient } from '@/lib/api/fetchWithRetry';

/**
 * 错误处理Hook返回值
 */
interface UseErrorHandlerReturn {
  // 错误处理
  handleError: (error: StandardError, context?: string) => Promise<void>;
  handleFetchError: (
    response: Response,
    data?: any,
    originalError?: Error,
    skipGlobalHandler?: boolean
  ) => Promise<StandardError>;
  handleNetworkError: (error: Error, skipGlobalHandler?: boolean) => Promise<StandardError>;

  // 错误创建
  createError: (
    message: string,
    type: ErrorType,
    severity?: ErrorSeverity,
    code?: string,
    originalError?: Error,
    details?: Record<string, any>
  ) => StandardError;
  createHttpError: (
    status: number,
    message?: string,
    originalError?: Error,
    details?: Record<string, any>
  ) => StandardError;
  createNetworkError: (error: Error, details?: Record<string, any>) => StandardError;
  createValidationError: (
    message: string,
    field?: string,
    details?: Record<string, any>
  ) => StandardError;
  createAuthError: (message: string, details?: Record<string, any>) => StandardError;

  // 降级数据
  createFallbackData: <T = any>(data: T, error?: StandardError) => FallbackData<T>;

  // Fetch包装器
  fetchWithRetry: typeof fetchWithRetry;
  safeFetch: typeof safeFetch;
  api: ReturnType<typeof createApiClient>;

  // 工具函数
  isRetryable: (statusCode?: number, errorType?: ErrorType) => boolean;
  getRetryDelay: (retryCount: number) => number;
}

/**
 * 错误处理Hook
 */
export function useErrorHandler(): UseErrorHandlerReturn {
  const errorHandler = ErrorHandler.getInstance();

  // 错误处理函数
  const handleError = useCallback(
    async (error: StandardError, context?: string) => {
      return errorHandler.handleError(error, context);
    },
    [errorHandler]
  );

  const handleFetchError = useCallback(
    async (
      response: Response,
      data?: any,
      originalError?: Error,
      skipGlobalHandler?: boolean
    ) => {
      return errorHandler.handleFetchError(
        response,
        data,
        originalError,
        { skipGlobalErrorHandler: skipGlobalHandler }
      );
    },
    [errorHandler]
  );

  const handleNetworkError = useCallback(
    async (error: Error, skipGlobalHandler?: boolean) => {
      return errorHandler.handleNetworkError(error, {
        skipGlobalErrorHandler: skipGlobalHandler
      });
    },
    [errorHandler]
  );

  // 错误创建函数
  const createError = useCallback((
    message: string,
    type: ErrorType,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    code?: string,
    originalError?: Error,
    details?: Record<string, any>
  ) => {
    return ErrorFactory.create(
      message,
      type,
      severity,
      code,
      originalError,
      details
    );
  }, []);

  const createHttpError = useCallback((
    status: number,
    message?: string,
    originalError?: Error,
    details?: Record<string, any>
  ) => {
    return ErrorFactory.fromHttpStatus(
      status,
      message,
      originalError,
      details
    );
  }, []);

  const createNetworkError = useCallback((
    error: Error,
    details?: Record<string, any>
  ) => {
    return ErrorFactory.fromNetworkError(error, details);
  }, []);

  const createValidationError = useCallback((
    message: string,
    field?: string,
    details?: Record<string, any>
  ) => {
    return ErrorFactory.fromValidationError(message, field, details);
  }, []);

  const createAuthError = useCallback((
    message: string,
    details?: Record<string, any>
  ) => {
    return ErrorFactory.fromAuthError(message, details);
  }, []);

  // 降级数据
  const createFallbackData = useCallback(<T = any>(
    data: T,
    error?: StandardError
  ): FallbackData<T> => {
    return errorHandler.createFallbackData(data, error);
  }, [errorHandler]);

  // 工具函数
  const isRetryable = useCallback((statusCode?: number, errorType?: ErrorType): boolean => {
    return errorHandler.canRetry(statusCode, errorType);
  }, [errorHandler]);

  const getRetryDelay = useCallback((retryCount: number): number => {
    return errorHandler.getRetryDelay(retryCount);
  }, [errorHandler]);

  // API客户端
  const api = createApiClient();

  return {
    handleError,
    handleFetchError,
    handleNetworkError,
    createError,
    createHttpError,
    createNetworkError,
    createValidationError,
    createAuthError,
    createFallbackData,
    fetchWithRetry,
    safeFetch,
    api,
    isRetryable,
    getRetryDelay
  };
}

/**
 * 简化的错误处理Hook（用于快速集成）
 */
export function useError(): {
  showError: (message: string, severity?: ErrorSeverity) => void;
  showSuccess: (message: string) => void;
  handleAsyncError: <T>(promise: Promise<T>, fallback?: T) => Promise<T | null>;
} {
  const { handleError, createError } = useErrorHandler();

  const showError = useCallback(async (
    message: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
  ) => {
    const error = createError(
      message,
      ErrorType.UNKNOWN,
      severity,
      'USER_ERROR'
    );
    await handleError(error, 'user_action');
  }, [createError, handleError]);

  const showSuccess = useCallback((message: string) => {
    // 这里可以集成成功toast
    console.log('Success:', message);
    // 在实际项目中，这里可以调用toast.success()
  }, []);

  const handleAsyncError = useCallback(async <T>(
    promise: Promise<T>,
    fallback?: T
  ): Promise<T | null> => {
    try {
      return await promise;
    } catch (error) {
      const standardError = createError(
        error instanceof Error ? error.message : '操作失败',
        ErrorType.UNKNOWN,
        ErrorSeverity.MEDIUM,
        'ASYNC_ERROR',
        error instanceof Error ? error : undefined
      );
      await handleError(standardError, 'async_operation');
      return fallback || null;
    }
  }, [createError, handleError]);

  return {
    showError,
    showSuccess,
    handleAsyncError
  };
}