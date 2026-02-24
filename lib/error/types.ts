/**
 * 错误处理类型定义
 */

// 错误严重程度
export enum ErrorSeverity {
  LOW = 'low',        // 轻微错误，不影响核心功能
  MEDIUM = 'medium',  // 中等错误，部分功能受影响
  HIGH = 'high',      // 严重错误，核心功能受影响
  CRITICAL = 'critical' // 致命错误，应用无法运行
}

// 错误类型
export enum ErrorType {
  NETWORK = 'network',          // 网络错误
  API = 'api',                  // API错误
  VALIDATION = 'validation',    // 验证错误
  AUTH = 'auth',                // 认证错误
  PERMISSION = 'permission',    // 权限错误
  NOT_FOUND = 'not_found',     // 资源不存在
  TIMEOUT = 'timeout',         // 超时错误
  SERVER = 'server',           // 服务器错误
  CLIENT = 'client',           // 客户端错误
  UNKNOWN = 'unknown'          // 未知错误
}

// 标准化错误接口
export interface StandardError {
  code: string;                // 错误代码
  message: string;             // 错误消息
  severity: ErrorSeverity;     // 严重程度
  type: ErrorType;            // 错误类型
  timestamp: Date;            // 时间戳
  details?: Record<string, any>; // 错误详情
  originalError?: Error;      // 原始错误
  stack?: string;             // 错误堆栈
  userFriendlyMessage?: string; // 用户友好消息
}

// API响应错误格式
export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, any>;
  timestamp?: string;
}

// API成功响应格式
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  timestamp?: string;
}

// 重试配置
export interface RetryConfig {
  maxRetries: number;          // 最大重试次数
  baseDelay: number;           // 基础延迟（毫秒）
  maxDelay: number;            // 最大延迟（毫秒）
  retryableStatusCodes: number[]; // 可重试的状态码
  retryableErrorTypes: ErrorType[]; // 可重试的错误类型
}

// 错误处理配置
export interface ErrorHandlerConfig {
  retry: RetryConfig;
  toastEnabled: boolean;       // 是否启用toast通知
  consoleEnabled: boolean;     // 是否启用控制台日志
  reportEnabled: boolean;      // 是否启用错误上报
  fallbackEnabled: boolean;    // 是否启用降级策略
  userFriendlyMessages: Record<string, string>; // 用户友好消息映射
}

// 降级数据接口
export interface FallbackData<T = any> {
  data: T;
  isFallback: boolean;
  timestamp: Date;
  error?: StandardError;
}

// 请求配置
export interface RequestConfig extends RequestInit {
  retry?: Partial<RetryConfig>;
  skipGlobalErrorHandler?: boolean;
  fallbackData?: any;
  timeout?: number;
}