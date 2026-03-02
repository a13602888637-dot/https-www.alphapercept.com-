/**
 * 统一搜索常量定义
 */

import { MarketType, AssetType } from './types';

/**
 * 市场显示名称映射
 */
export const MARKET_DISPLAY_NAMES: Record<MarketType, string> = {
  [MarketType.CN_STOCK]: 'A股',
  [MarketType.CN_INDEX]: 'A股指数',
  [MarketType.CN_FUND]: '基金',
  [MarketType.US_STOCK]: '美股',
  [MarketType.US_INDEX]: '美股指数',
  [MarketType.US_ETF]: 'ETF',
  [MarketType.HK_STOCK]: '港股',
  [MarketType.CRYPTO]: '加密货币',
  [MarketType.COMMODITY]: '大宗商品',
};

/**
 * 资产类型名称映射
 */
export const ASSET_TYPE_NAMES: Record<AssetType, string> = {
  [AssetType.STOCK]: '股票',
  [AssetType.INDEX]: '指数',
  [AssetType.FUND]: '基金',
  [AssetType.ETF]: 'ETF',
  [AssetType.CRYPTO]: '加密货币',
  [AssetType.COMMODITY]: '商品',
};

/**
 * 默认搜索超时时间（毫秒）
 */
export const DEFAULT_SEARCH_TIMEOUT = 5000;

/**
 * 默认搜索结果限制
 */
export const DEFAULT_SEARCH_LIMIT = 10;

/**
 * 搜索防抖延迟（毫秒）
 */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * 中国市场列表
 */
export const CN_MARKETS = [MarketType.CN_STOCK, MarketType.CN_INDEX, MarketType.CN_FUND];

/**
 * 美股交易所列表
 */
export const US_EXCHANGES = ['NASDAQ', 'NYSE', 'AMEX'];
