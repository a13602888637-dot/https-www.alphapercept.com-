/**
 * 错误处理系统 - 主入口文件
 */

// 类型定义
export * from './types';

// 错误工厂
export { ErrorFactory } from './ErrorFactory';

// 错误处理器
export { ErrorHandler } from './ErrorHandler';

// 配置
export {
  getErrorHandlerConfig,
  getUserFriendlyMessage,
  isRetryable,
  calculateRetryDelay,
  defaultErrorHandlerConfig
} from './config';

// API工具
export {
  fetchWithRetry,
  safeFetch,
  createApiClient,
  api
} from '../api/fetchWithRetry';