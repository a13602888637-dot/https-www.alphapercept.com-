/**
 * K线数据格式转换器
 * 将不同数据源的格式统一转换为标准格式
 */

import { KLineDataPoint, SinaRawData } from './providers/types';

/**
 * 转换新浪财经数据格式
 */
export function transformSinaData(rawData: SinaRawData[]): KLineDataPoint[] {
  return rawData.map(item => ({
    time: item.day,
    open: parseFloat(item.open),
    high: parseFloat(item.high),
    low: parseFloat(item.low),
    close: parseFloat(item.close),
    volume: parseFloat(item.volume),
  }));
}

/**
 * 转换东方财富数据格式（待实现）
 */
export function transformEastmoneyData(rawData: any[]): KLineDataPoint[] {
  // TODO: 实现东方财富数据格式转换
  return [];
}

/**
 * 验证K线数据点的有效性
 */
export function validateKLineData(data: KLineDataPoint[]): boolean {
  if (!Array.isArray(data) || data.length === 0) {
    return false;
  }

  // 检查必要字段
  for (const point of data) {
    if (
      !point.time ||
      typeof point.open !== 'number' ||
      typeof point.high !== 'number' ||
      typeof point.low !== 'number' ||
      typeof point.close !== 'number' ||
      typeof point.volume !== 'number' ||
      isNaN(point.open) ||
      isNaN(point.high) ||
      isNaN(point.low) ||
      isNaN(point.close) ||
      isNaN(point.volume)
    ) {
      return false;
    }

    // 检查价格逻辑
    if (point.high < point.low || point.high < point.open || point.high < point.close || point.low > point.open || point.low > point.close) {
      console.warn('[Validator] Invalid price logic:', point);
      return false;
    }
  }

  return true;
}

/**
 * 过滤和清洗K线数据
 */
export function cleanKLineData(data: KLineDataPoint[]): KLineDataPoint[] {
  return data.filter(point => {
    // 过滤掉无效数据点
    return (
      point.open > 0 &&
      point.high > 0 &&
      point.low > 0 &&
      point.close > 0 &&
      point.volume >= 0
    );
  });
}

/**
 * 限制数据点数量
 */
export function limitDataPoints(data: KLineDataPoint[], limit: number): KLineDataPoint[] {
  if (data.length <= limit) {
    return data;
  }

  // 返回最新的limit个数据点
  return data.slice(-limit);
}
