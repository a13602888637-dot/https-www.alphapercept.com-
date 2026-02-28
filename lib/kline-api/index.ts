/**
 * K线数据服务统一导出
 */

// 类型定义
export type {
  KLineDataPoint,
  TimeFrame,
  KLineRequest,
  KLineResponse,
  KLineProvider,
} from './providers/types';

// 数据提供者
export { sinaProvider } from './providers/sina';
export { eastmoneyProvider } from './providers/eastmoney';

// 缓存管理
export { klineCache } from './cache';

// 数据转换
export {
  transformSinaData,
  transformEastmoneyData,
  validateKLineData,
  cleanKLineData,
  limitDataPoints,
} from './transformer';

// 降级策略（主要API）
export {
  getKLineData,
  clearCache,
  getCacheStats,
} from './fallback';
