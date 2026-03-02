/**
 * 实时数据流类型定义
 */

export interface DataPoint {
  symbol: string;           // 'index.000001.SH' | 'commodity.XAU'
  name: string;             // '上证指数' | '黄金'
  value: number;            // 当前值
  change: number;           // 涨跌额
  changePercent: number;    // 涨跌幅
  timestamp: number;        // 时间戳
  metadata?: {
    high?: number;          // 最高
    low?: number;           // 最低
    volume?: number;        // 成交量
    trend?: number[];       // 迷你趋势图数据（最近20个点）
  };
}

export interface MarketDataUpdate {
  type: 'update' | 'snapshot' | 'heartbeat';
  tier: 'core' | 'secondary' | 'watchlist';
  data: DataPoint[];
  timestamp: number;
}

export type DataSourcePoller = NodeJS.Timeout;
