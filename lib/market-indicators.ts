/**
 * Market Indicators Service
 * Fetches real-time market index data for header display
 */

import { fetchMultipleStocks, MarketData } from '@/skills/data_crawler';

// Market index symbols mapping
export const MARKET_INDEX_SYMBOLS = {
  SHANGHAI: '000001',      // 上证指数
  SHENZHEN: '399001',      // 深证成指
  CHUANGYE: '399006',      // 创业板指
  // 北向资金特殊符号
  NORTHBOUND: 'NORTHBOUND',    // 北向资金
};

// Market indicator interface for header display
export interface MarketIndicator {
  label: string;
  value: string;
  change: string;
  rawValue?: number;
  rawChange?: number;
  isLoading?: boolean;
  error?: string;
}

// Format number with commas for display
function formatNumberWithCommas(num: number): string {
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Format change percentage
function formatChange(change: number, changePercent: number): string {
  const sign = change >= 0 ? '+' : '';
  const percent = Math.abs(changePercent).toFixed(2);
  return `${sign}${percent}%`;
}

// Format value for display
function formatValue(value: number): string {
  if (value >= 10000) {
    // For large numbers like indices
    return formatNumberWithCommas(value);
  } else if (value >= 1000) {
    // For medium numbers
    return formatNumberWithCommas(value);
  } else {
    // For small numbers
    return value.toFixed(2);
  }
}

// Convert market data to indicator format
function convertToIndicator(
  marketData: MarketData,
  label: string,
  isNorthbound: boolean = false
): MarketIndicator {
  if (!marketData || marketData.currentPrice === 0) {
    return {
      label,
      value: '--',
      change: '--',
      isLoading: false,
      error: '数据获取失败',
    };
  }

  if (isNorthbound) {
    // 北向资金特殊处理：显示净流入金额
    const netFlow = marketData.currentPrice; // currentPrice代表净流入金额（单位：亿）
    const change = marketData.change || 0;
    const sign = netFlow >= 0 ? '+' : '';

    // 格式化变化百分比
    let changeDisplay = '--';
    if (marketData.changePercent !== undefined) {
      const changePercent = marketData.changePercent;
      const changeSign = changePercent >= 0 ? '+' : '';
      changeDisplay = `${changeSign}${Math.abs(changePercent).toFixed(2)}%`;
    } else if (change !== 0) {
      changeDisplay = change >= 0 ? '+' : '-';
    }

    return {
      label,
      value: `${sign}${Math.abs(netFlow).toFixed(1)}亿`,
      change: changeDisplay,
      rawValue: netFlow,
      rawChange: marketData.changePercent || change,
    };
  }

  return {
    label,
    value: formatValue(marketData.currentPrice),
    change: formatChange(marketData.change || 0, marketData.changePercent || 0),
    rawValue: marketData.currentPrice,
    rawChange: marketData.changePercent || 0,
  };
}

// Fetch all market indicators
export async function fetchMarketIndicators(): Promise<MarketIndicator[]> {
  try {
    const symbols = [
      MARKET_INDEX_SYMBOLS.SHANGHAI,
      MARKET_INDEX_SYMBOLS.SHENZHEN,
      MARKET_INDEX_SYMBOLS.CHUANGYE,
      MARKET_INDEX_SYMBOLS.NORTHBOUND,
    ];

    const marketDataList = await fetchMultipleStocks(symbols, 2);

    // Map to indicators
    const indicators: MarketIndicator[] = [
      convertToIndicator(marketDataList[0], '上证指数'),
      convertToIndicator(marketDataList[1], '深证成指'),
      convertToIndicator(marketDataList[2], '创业板指'),
      convertToIndicator(marketDataList[3], '北向资金', true),
    ];

    return indicators;
  } catch (error) {
    console.error('Failed to fetch market indicators:', error);

    // Return fallback indicators with error state
    return [
      {
        label: '上证指数',
        value: '--',
        change: '--',
        isLoading: false,
        error: '数据获取失败',
      },
      {
        label: '深证成指',
        value: '--',
        change: '--',
        isLoading: false,
        error: '数据获取失败',
      },
      {
        label: '创业板指',
        value: '--',
        change: '--',
        isLoading: false,
        error: '数据获取失败',
      },
      {
        label: '北向资金',
        value: '--',
        change: '--',
        isLoading: false,
        error: '数据获取失败',
      },
    ];
  }
}

// Mock data for development/testing
export function getMockMarketIndicators(): MarketIndicator[] {
  return [
    { label: '上证指数', value: '3,245.67', change: '+1.23%' },
    { label: '深证成指', value: '10,523.89', change: '+0.89%' },
    { label: '创业板指', value: '2,156.34', change: '+2.15%' },
    { label: '北向资金', value: '+15.2亿', change: '+' },
  ];
}

// Check if market is open (rough estimation for China market hours)
export function isMarketOpen(): boolean {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000); // Convert to Beijing time
  const day = beijingTime.getDay();
  const hour = beijingTime.getHours();
  const minute = beijingTime.getMinutes();

  // Market hours: Monday-Friday, 9:30-11:30 and 13:00-15:00 Beijing time
  if (day >= 1 && day <= 5) { // Monday to Friday
    const time = hour * 100 + minute;
    return (time >= 930 && time <= 1130) || (time >= 1300 && time <= 1500);
  }
  return false;
}

// Get next market open time
export function getNextMarketOpenTime(): string {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const day = beijingTime.getDay();
  const hour = beijingTime.getHours();
  const minute = beijingTime.getMinutes();
  const time = hour * 100 + minute;

  if (day >= 1 && day <= 5) { // Weekday
    if (time < 930) {
      return '今日 9:30 开市';
    } else if (time >= 1130 && time < 1300) {
      return '今日 13:00 开市';
    } else if (time >= 1500) {
      // Next trading day
      const nextDay = new Date(beijingTime);
      if (day === 5) { // Friday
        nextDay.setDate(nextDay.getDate() + 3); // Monday
      } else {
        nextDay.setDate(nextDay.getDate() + 1); // Next weekday
      }
      return `下个交易日 ${nextDay.getMonth() + 1}/${nextDay.getDate()} 9:30`;
    } else {
      return '交易中';
    }
  } else { // Weekend
    const nextMonday = new Date(beijingTime);
    const daysToAdd = day === 0 ? 1 : 8 - day; // Sunday=0, Saturday=6
    nextMonday.setDate(nextMonday.getDate() + daysToAdd);
    return `下周一 ${nextMonday.getMonth() + 1}/${nextMonday.getDate()} 9:30`;
  }

  return '交易中';
}