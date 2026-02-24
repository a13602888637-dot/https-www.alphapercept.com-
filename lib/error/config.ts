/**
 * 错误处理配置
 */

import { ErrorHandlerConfig, ErrorType } from './types';

// 默认重试配置
const defaultRetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1秒
  maxDelay: 10000, // 10秒
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableErrorTypes: [
    ErrorType.NETWORK,
    ErrorType.TIMEOUT,
    ErrorType.SERVER
  ]
};

// 用户友好消息映射
const userFriendlyMessages: Record<string, string> = {
  // HTTP错误
  'HTTP_400': '请求参数错误',
  'HTTP_401': '请先登录以继续操作',
  'HTTP_403': '您没有权限执行此操作',
  'HTTP_404': '请求的资源不存在',
  'HTTP_409': '资源冲突，请检查数据',
  'HTTP_429': '请求过于频繁，请稍后重试',
  'HTTP_500': '服务器内部错误，请稍后重试',
  'HTTP_502': '服务器暂时不可用，请稍后重试',
  'HTTP_503': '服务暂时不可用，请稍后重试',
  'HTTP_504': '请求超时，请检查网络连接',

  // 网络错误
  'NETWORK_ERROR': '网络连接失败，请检查网络设置',
  'NETWORK_OFFLINE': '网络连接已断开，请检查网络',

  // 超时错误
  'TIMEOUT_ERROR': '请求超时，请稍后重试',

  // 认证错误
  'AUTH_ERROR': '认证失败，请重新登录',
  'AUTH_EXPIRED': '登录已过期，请重新登录',
  'AUTH_INVALID': '无效的认证信息',

  // 验证错误
  'VALIDATION_ERROR': '输入数据验证失败',
  'VALIDATION_REQUIRED': '必填字段不能为空',
  'VALIDATION_FORMAT': '数据格式不正确',
  'VALIDATION_RANGE': '数据超出允许范围',

  // 权限错误
  'PERMISSION_ERROR': '您没有执行此操作的权限',
  'PERMISSION_DENIED': '权限被拒绝',

  // 资源错误
  'NOT_FOUND': '请求的资源不存在',
  'RESOURCE_CONFLICT': '资源冲突',
  'RESOURCE_LIMIT': '资源使用达到限制',

  // 业务错误
  'STOCK_NOT_FOUND': '股票代码不存在',
  'WATCHLIST_FULL': '自选股数量已达上限',
  'WATCHLIST_DUPLICATE': '股票已在自选股中',
  'ANALYSIS_FAILED': '分析失败，请稍后重试',
  'DATA_FETCH_FAILED': '数据获取失败',

  // 未知错误
  'UNKNOWN_ERROR': '系统发生未知错误，请联系技术支持'
};

// 默认错误处理配置
export const defaultErrorHandlerConfig: ErrorHandlerConfig = {
  retry: defaultRetryConfig,
  toastEnabled: true,
  consoleEnabled: process.env.NODE_ENV !== 'production',
  reportEnabled: process.env.NODE_ENV === 'production',
  fallbackEnabled: true,
  userFriendlyMessages
};

// 获取配置（支持环境变量覆盖）
export function getErrorHandlerConfig(): ErrorHandlerConfig {
  const config = { ...defaultErrorHandlerConfig };

  // 从环境变量读取配置
  if (process.env.NEXT_PUBLIC_ERROR_TOAST_ENABLED !== undefined) {
    config.toastEnabled = process.env.NEXT_PUBLIC_ERROR_TOAST_ENABLED === 'true';
  }

  if (process.env.NEXT_PUBLIC_ERROR_CONSOLE_ENABLED !== undefined) {
    config.consoleEnabled = process.env.NEXT_PUBLIC_ERROR_CONSOLE_ENABLED === 'true';
  }

  if (process.env.NEXT_PUBLIC_ERROR_REPORT_ENABLED !== undefined) {
    config.reportEnabled = process.env.NEXT_PUBLIC_ERROR_REPORT_ENABLED === 'true';
  }

  if (process.env.NEXT_PUBLIC_ERROR_FALLBACK_ENABLED !== undefined) {
    config.fallbackEnabled = process.env.NEXT_PUBLIC_ERROR_FALLBACK_ENABLED === 'true';
  }

  // 重试配置
  if (process.env.NEXT_PUBLIC_ERROR_MAX_RETRIES) {
    config.retry.maxRetries = parseInt(process.env.NEXT_PUBLIC_ERROR_MAX_RETRIES, 10);
  }

  if (process.env.NEXT_PUBLIC_ERROR_BASE_DELAY) {
    config.retry.baseDelay = parseInt(process.env.NEXT_PUBLIC_ERROR_BASE_DELAY, 10);
  }

  if (process.env.NEXT_PUBLIC_ERROR_MAX_DELAY) {
    config.retry.maxDelay = parseInt(process.env.NEXT_PUBLIC_ERROR_MAX_DELAY, 10);
  }

  return config;
}

// 获取用户友好消息
export function getUserFriendlyMessage(code: string, defaultMessage?: string): string {
  const config = getErrorHandlerConfig();
  return config.userFriendlyMessages[code] || defaultMessage || '系统发生错误，请稍后重试';
}

// 检查是否可重试
export function isRetryable(statusCode?: number, errorType?: ErrorType): boolean {
  const config = getErrorHandlerConfig();

  if (statusCode && config.retry.retryableStatusCodes.includes(statusCode)) {
    return true;
  }

  if (errorType && config.retry.retryableErrorTypes.includes(errorType)) {
    return true;
  }

  return false;
}

// 计算重试延迟（指数退避）
export function calculateRetryDelay(retryCount: number): number {
  const config = getErrorHandlerConfig();
  const { baseDelay, maxDelay } = config.retry;

  // 指数退避：delay = baseDelay * 2^retryCount
  const delay = baseDelay * Math.pow(2, retryCount);

  // 限制最大延迟
  return Math.min(delay, maxDelay);
}