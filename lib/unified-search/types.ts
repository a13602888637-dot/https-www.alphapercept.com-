/**
 * 统一搜索类型定义
 * 定义跨市场、跨数据源的统一数据模型
 */

/**
 * 市场类型枚举
 */
export enum MarketType {
  CN_STOCK = 'cn_stock',           // 中国A股
  CN_INDEX = 'cn_index',           // 中国指数
  CN_FUND = 'cn_fund',             // 中国基金
  US_STOCK = 'us_stock',           // 美股
  US_INDEX = 'us_index',           // 美股指数
  US_ETF = 'us_etf',               // 美股ETF
  HK_STOCK = 'hk_stock',           // 港股
  CRYPTO = 'crypto',               // 加密货币
  COMMODITY = 'commodity',         // 大宗商品
}

/**
 * 资产类型
 */
export enum AssetType {
  STOCK = 'stock',
  INDEX = 'index',
  FUND = 'fund',
  ETF = 'etf',
  CRYPTO = 'crypto',
  COMMODITY = 'commodity',
}

/**
 * 统一资产模型
 */
export interface UnifiedAsset {
  // 标识信息
  symbol: string;                  // 股票代码（如 AAPL, 600519）
  name: string;                    // 资产名称
  market: MarketType;              // 市场类型
  assetType: AssetType;            // 资产类型
  exchange?: string;               // 交易所（如 NASDAQ, SSE）

  // 显示信息
  displaySymbol?: string;          // 显示用代码（如 AAPL.US, 600519.SH）
  searchScore?: number;            // 搜索相关度评分（0-1）

  // 元数据
  metadata?: {
    industry?: string;             // 行业
    sector?: string;               // 板块
    listingDate?: string;          // 上市日期
    region?: string;               // 地区
    [key: string]: unknown;        // 其他扩展字段
  };
}

/**
 * 搜索结果分组
 */
export interface SearchResultGroup {
  market: MarketType;
  label: string;                   // 分组显示名称
  results: UnifiedAsset[];
  totalCount: number;              // 该市场总结果数
}

/**
 * 数据源状态
 */
export interface DataSourceStatus {
  source: string;                  // 数据源名称（如 'akshare', 'yahoo', 'mongodb'）
  available: boolean;              // 是否可用
  latency?: number;                // 响应延迟（毫秒）
  error?: string;                  // 错误信息
}

/**
 * 统一搜索响应
 */
export interface UnifiedSearchResponse {
  query: string;                   // 原始查询
  groups: SearchResultGroup[];     // 分组结果
  totalResults: number;            // 总结果数
  sources: DataSourceStatus[];     // 数据源状态
  timestamp: string;               // 查询时间戳
}

/**
 * 统一搜索请求
 */
export interface UnifiedSearchRequest {
  query: string;                   // 搜索关键词
  markets?: MarketType[];          // 限定市场范围（空则搜索全部）
  limit?: number;                  // 每个市场最大返回数
  offset?: number;                 // 分页偏移
}

/**
 * 数据源配置
 */
export interface DataSourceConfig {
  name: string;
  enabled: boolean;
  timeout: number;                 // 超时时间（毫秒）
  priority: number;                // 优先级（数字越大越优先）
}
