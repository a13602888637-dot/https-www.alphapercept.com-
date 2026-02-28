/**
 * 全局搜索模块类型定义
 */

export interface SearchResult {
  code: string;              // 股票代码
  name: string;              // 股票名称
  market: string;            // 市场（SH/SZ）
  currentPrice?: number;     // 当前价格
  change?: number;           // 涨跌额
  changePercent?: number;    // 涨跌幅
  volume?: number;           // 成交量
  turnover?: number;         // 成交额
  industry?: string;         // 所属行业
  isInWatchlist?: boolean;   // 是否已在自选股
}

export interface SearchHistoryItem {
  query: string;
  timestamp: number;
}

export interface HotStock {
  code: string;
  name: string;
  market: string;
  changePercent: number;
  currentPrice: number;
  volume: number;
}
