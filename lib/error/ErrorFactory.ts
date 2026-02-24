/**
 * 错误工厂类 - 创建标准化错误
 */

import { StandardError, ErrorSeverity, ErrorType } from './types';

export class ErrorFactory {
  /**
   * 创建标准化错误
   */
  static create(
    message: string,
    type: ErrorType,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    code?: string,
    originalError?: Error,
    details?: Record<string, any>
  ): StandardError {
    const errorCode = code || this.generateErrorCode(type, severity);

    return {
      code: errorCode,
      message,
      severity,
      type,
      timestamp: new Date(),
      details,
      originalError,
      stack: originalError?.stack,
      userFriendlyMessage: this.getUserFriendlyMessage(errorCode, message)
    };
  }

  /**
   * 从HTTP状态码创建错误
   */
  static fromHttpStatus(
    status: number,
    message?: string,
    originalError?: Error,
    details?: Record<string, any>
  ): StandardError {
    const { type, severity, defaultMessage } = this.mapHttpStatusToError(status);

    return this.create(
      message || defaultMessage,
      type,
      severity,
      `HTTP_${status}`,
      originalError,
      details
    );
  }

  /**
   * 从API响应创建错误
   */
  static fromApiResponse(
    response: Response,
    data?: any,
    originalError?: Error
  ): StandardError {
    const status = response.status;
    const errorMessage = data?.error || `API请求失败: ${status}`;

    return this.fromHttpStatus(
      status,
      errorMessage,
      originalError,
      { responseData: data }
    );
  }

  /**
   * 从网络错误创建错误
   */
  static fromNetworkError(
    error: Error,
    details?: Record<string, any>
  ): StandardError {
    return this.create(
      error.message || '网络连接失败',
      ErrorType.NETWORK,
      ErrorSeverity.HIGH,
      'NETWORK_ERROR',
      error,
      details
    );
  }

  /**
   * 从超时错误创建错误
   */
  static fromTimeoutError(
    timeout: number,
    details?: Record<string, any>
  ): StandardError {
    return this.create(
      `请求超时 (${timeout}ms)`,
      ErrorType.TIMEOUT,
      ErrorSeverity.MEDIUM,
      'TIMEOUT_ERROR',
      undefined,
      details
    );
  }

  /**
   * 从验证错误创建错误
   */
  static fromValidationError(
    message: string,
    field?: string,
    details?: Record<string, any>
  ): StandardError {
    return this.create(
      message,
      ErrorType.VALIDATION,
      ErrorSeverity.LOW,
      'VALIDATION_ERROR',
      undefined,
      { field, ...details }
    );
  }

  /**
   * 从认证错误创建错误
   */
  static fromAuthError(
    message: string,
    details?: Record<string, any>
  ): StandardError {
    return this.create(
      message,
      ErrorType.AUTH,
      ErrorSeverity.HIGH,
      'AUTH_ERROR',
      undefined,
      details
    );
  }

  /**
   * 生成错误代码
   */
  private static generateErrorCode(type: ErrorType, severity: ErrorSeverity): string {
    const typeCode = type.toUpperCase();
    const severityCode = severity.toUpperCase();
    return `${typeCode}_${severityCode}_${Date.now().toString(36)}`;
  }

  /**
   * 获取用户友好消息
   */
  private static getUserFriendlyMessage(code: string, defaultMessage: string): string {
    const messages: Record<string, string> = {
      'HTTP_401': '请先登录以继续操作',
      'HTTP_403': '您没有权限执行此操作',
      'HTTP_404': '请求的资源不存在',
      'HTTP_500': '服务器内部错误，请稍后重试',
      'HTTP_502': '服务器暂时不可用，请稍后重试',
      'HTTP_503': '服务暂时不可用，请稍后重试',
      'HTTP_504': '请求超时，请检查网络连接',
      'NETWORK_ERROR': '网络连接失败，请检查网络设置',
      'TIMEOUT_ERROR': '请求超时，请稍后重试',
      'AUTH_ERROR': '认证失败，请重新登录',
      'VALIDATION_ERROR': '输入数据验证失败',
    };

    return messages[code] || defaultMessage;
  }

  /**
   * 映射HTTP状态码到错误类型和严重程度
   */
  private static mapHttpStatusToError(status: number): {
    type: ErrorType;
    severity: ErrorSeverity;
    defaultMessage: string;
  } {
    switch (true) {
      case status === 401:
        return {
          type: ErrorType.AUTH,
          severity: ErrorSeverity.HIGH,
          defaultMessage: '未授权访问'
        };
      case status === 403:
        return {
          type: ErrorType.PERMISSION,
          severity: ErrorSeverity.HIGH,
          defaultMessage: '权限不足'
        };
      case status === 404:
        return {
          type: ErrorType.NOT_FOUND,
          severity: ErrorSeverity.MEDIUM,
          defaultMessage: '资源不存在'
        };
      case status >= 400 && status < 500:
        return {
          type: ErrorType.CLIENT,
          severity: ErrorSeverity.MEDIUM,
          defaultMessage: `客户端错误: ${status}`
        };
      case status >= 500:
        return {
          type: ErrorType.SERVER,
          severity: ErrorSeverity.HIGH,
          defaultMessage: `服务器错误: ${status}`
        };
      default:
        return {
          type: ErrorType.UNKNOWN,
          severity: ErrorSeverity.MEDIUM,
          defaultMessage: `未知错误: ${status}`
        };
    }
  }
}