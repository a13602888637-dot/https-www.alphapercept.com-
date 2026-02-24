/**
 * 错误处理器 - 核心错误处理逻辑
 */

import { toast } from '@/hooks/use-toast';
import { StandardError, ErrorSeverity, FallbackData, RequestConfig } from './types';
import { ErrorFactory } from './ErrorFactory';
import { getErrorHandlerConfig, getUserFriendlyMessage, isRetryable, calculateRetryDelay } from './config';

export class ErrorHandler {
  private static instance: ErrorHandler;
  private config = getErrorHandlerConfig();

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * 处理错误
   */
  async handleError(error: StandardError, context?: string): Promise<void> {
    // 记录到控制台
    if (this.config.consoleEnabled) {
      this.logError(error, context);
    }

    // 显示toast通知
    if (this.config.toastEnabled && this.shouldShowToast(error)) {
      this.showToast(error);
    }

    // 上报错误
    if (this.config.reportEnabled) {
      await this.reportError(error);
    }

    // 处理严重错误
    if (error.severity === ErrorSeverity.CRITICAL) {
      this.handleCriticalError(error);
    }
  }

  /**
   * 处理fetch请求错误
   */
  async handleFetchError(
    response: Response,
    data?: any,
    originalError?: Error,
    requestConfig?: RequestConfig
  ): Promise<StandardError> {
    const error = ErrorFactory.fromApiResponse(response, data, originalError);

    // 检查是否跳过全局错误处理
    if (requestConfig?.skipGlobalErrorHandler) {
      return error;
    }

    await this.handleError(error, 'fetch_request');
    return error;
  }

  /**
   * 处理网络错误
   */
  async handleNetworkError(
    error: Error,
    requestConfig?: RequestConfig
  ): Promise<StandardError> {
    const standardError = ErrorFactory.fromNetworkError(error);

    // 检查是否跳过全局错误处理
    if (requestConfig?.skipGlobalErrorHandler) {
      return standardError;
    }

    await this.handleError(standardError, 'network');
    return standardError;
  }

  /**
   * 处理超时错误
   */
  async handleTimeoutError(
    timeout: number,
    requestConfig?: RequestConfig
  ): Promise<StandardError> {
    const error = ErrorFactory.fromTimeoutError(timeout);

    // 检查是否跳过全局错误处理
    if (requestConfig?.skipGlobalErrorHandler) {
      return error;
    }

    await this.handleError(error, 'timeout');
    return error;
  }

  /**
   * 处理验证错误
   */
  async handleValidationError(
    message: string,
    field?: string,
    details?: Record<string, any>
  ): Promise<StandardError> {
    const error = ErrorFactory.fromValidationError(message, field, details);
    await this.handleError(error, 'validation');
    return error;
  }

  /**
   * 处理认证错误
   */
  async handleAuthError(
    message: string,
    details?: Record<string, any>
  ): Promise<StandardError> {
    const error = ErrorFactory.fromAuthError(message, details);
    await this.handleError(error, 'auth');
    return error;
  }

  /**
   * 创建降级数据
   */
  createFallbackData<T = any>(
    data: T,
    error?: StandardError
  ): FallbackData<T> {
    return {
      data,
      isFallback: true,
      timestamp: new Date(),
      error
    };
  }

  /**
   * 检查是否应该显示toast
   */
  private shouldShowToast(error: StandardError): boolean {
    // 根据错误严重程度决定是否显示toast
    switch (error.severity) {
      case ErrorSeverity.LOW:
        return false; // 轻微错误不显示toast
      case ErrorSeverity.MEDIUM:
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return true;
      default:
        return true;
    }
  }

  /**
   * 显示toast通知
   */
  private showToast(error: StandardError): void {
    const title = this.getToastTitle(error);
    const description = error.userFriendlyMessage || error.message;

    toast({
      title,
      description,
      variant: this.getToastVariant(error),
      duration: this.getToastDuration(error)
    });
  }

  /**
   * 记录错误到控制台
   */
  private logError(error: StandardError, context?: string): void {
    const logContext = context ? `[${context}]` : '';

    console.group(`🚨 Error ${logContext}`);
    console.error('Code:', error.code);
    console.error('Message:', error.message);
    console.error('Severity:', error.severity);
    console.error('Type:', error.type);
    console.error('Timestamp:', error.timestamp);

    if (error.details) {
      console.error('Details:', error.details);
    }

    if (error.originalError) {
      console.error('Original Error:', error.originalError);
    }

    if (error.stack) {
      console.error('Stack:', error.stack);
    }

    console.groupEnd();
  }

  /**
   * 上报错误到监控服务
   */
  private async reportError(error: StandardError): Promise<void> {
    try {
      // 这里可以集成Sentry、LogRocket等错误监控服务
      // 示例：发送到自定义错误收集端点
      if (process.env.NEXT_PUBLIC_ERROR_REPORT_URL) {
        await fetch(process.env.NEXT_PUBLIC_ERROR_REPORT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...error,
            timestamp: error.timestamp.toISOString(),
            url: typeof window !== 'undefined' ? window.location.href : undefined,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          }),
        });
      }
    } catch (reportError) {
      // 错误上报失败时不阻塞主流程
      console.error('Failed to report error:', reportError);
    }
  }

  /**
   * 处理严重错误
   */
  private handleCriticalError(error: StandardError): void {
    // 对于严重错误，可以执行特殊操作
    // 例如：强制刷新页面、显示全屏错误页面等

    if (typeof window !== 'undefined') {
      // 记录到localStorage以便错误恢复
      try {
        localStorage.setItem('last_critical_error', JSON.stringify({
          ...error,
          timestamp: error.timestamp.toISOString(),
          url: window.location.href
        }));
      } catch (e) {
        // 忽略localStorage错误
      }
    }
  }

  /**
   * 获取toast标题
   */
  private getToastTitle(error: StandardError): string {
    switch (error.severity) {
      case ErrorSeverity.MEDIUM:
        return '操作失败';
      case ErrorSeverity.HIGH:
        return '系统错误';
      case ErrorSeverity.CRITICAL:
        return '严重错误';
      default:
        return '错误';
    }
  }

  /**
   * 获取toast变体
   */
  private getToastVariant(error: StandardError): 'default' | 'destructive' {
    switch (error.severity) {
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return 'destructive';
      default:
        return 'default';
    }
  }

  /**
   * 获取toast持续时间
   */
  private getToastDuration(error: StandardError): number {
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        return 10000; // 10秒
      case ErrorSeverity.HIGH:
        return 5000; // 5秒
      default:
        return 3000; // 3秒
    }
  }

  /**
   * 检查是否可重试
   */
  canRetry(statusCode?: number, errorType?: string): boolean {
    return isRetryable(statusCode, errorType as any);
  }

  /**
   * 获取重试延迟
   */
  getRetryDelay(retryCount: number): number {
    return calculateRetryDelay(retryCount);
  }
}