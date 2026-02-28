/**
 * K线数据类型定义
 */

export interface KLineDataPoint {
  time: string;              // 时间戳 "2024-02-28" 或 "2024-02-28 09:30"
  open: number;              // 开盘价
  high: number;              // 最高价
  low: number;               // 最低价
  close: number;             // 收盘价
  volume: number;            // 成交量
  amount?: number;           // 成交额
}

export type TimeFrame = 'daily' | 'weekly' | 'monthly' | '5m' | '15m' | '30m' | '60m';

export interface KLineRequest {
  stockCode: string;         // 股票代码
  timeFrame: TimeFrame;      // 时间周期
  limit?: number;            // 获取数量（默认200）
  startDate?: string;        // 开始日期
  endDate?: string;          // 结束日期
}

export interface KLineResponse {
  success: boolean;
  data: KLineDataPoint[];
  source: 'sina' | 'eastmoney' | 'cache' | 'mock';
  cached: boolean;
  error?: string;
}

// 新浪财经API原始数据格式
export interface SinaRawData {
  day: string;               // 日期 "2024-02-28"
  open: string;              // 开盘价
  high: string;              // 最高价
  low: string;               // 最低价
  close: string;             // 收盘价
  volume: string;            // 成交量
}

// 东方财富API原始数据格式（备用）
export interface EastmoneyRawData {
  // 待实现
}

// 数据提供者接口
export interface KLineProvider {
  name: 'sina' | 'eastmoney';
  fetch(request: KLineRequest): Promise<KLineDataPoint[]>;
}
