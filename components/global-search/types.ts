/**
 * 全局搜索模块类型定义
 */

export type SearchResultType = 'stock' | 'intelligence';

export interface SearchResult {
  type: SearchResultType;    // 结果类型
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
  // Intelligence-specific fields
  eventSummary?: string;     // 情报事件摘要
  actionSignal?: string;     // 操作信号
  trapProbability?: number;  // 陷阱概率
  intelligenceId?: string;   // 情报ID
  createdAt?: string;        // 创建时间
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
