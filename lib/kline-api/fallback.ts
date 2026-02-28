/**
 * K线数据降级策略
 * 优先级：缓存 → 新浪API → 东财API → Mock数据
 */

import { KLineRequest, KLineResponse, KLineDataPoint } from './providers/types';
import { sinaProvider } from './providers/sina';
import { eastmoneyProvider } from './providers/eastmoney';
import { klineCache } from './cache';
import { validateKLineData, cleanKLineData, limitDataPoints } from './transformer';
import { generateMockKLineByStockCode } from '../utils/mockKlineData';

/**
 * 生成Mock数据作为最终降级方案
 */
function generateMockFallback(request: KLineRequest): KLineDataPoint[] {
  const { stockCode, limit = 200 } = request;

  console.log(`[Fallback] Generating mock data for ${stockCode}`);

  const mockData = generateMockKLineByStockCode(stockCode, limit);

  // 转换为标准格式（mockKlineData已经是兼容格式）
  return mockData.map(item => ({
    time: item.time,
    open: item.open,
    high: item.high,
    low: item.low,
    close: item.close,
    volume: item.volume || 0,
  }));
}

/**
 * 获取K线数据（带降级策略）
 */
export async function getKLineData(request: KLineRequest): Promise<KLineResponse> {
  const { stockCode, timeFrame, limit = 200 } = request;

  // 1. 检查缓存
  const cachedData = klineCache.get(stockCode, timeFrame);
  if (cachedData) {
    return {
      success: true,
      data: limitDataPoints(cachedData, limit),
      source: 'cache',
      cached: true,
    };
  }

  // 2. 尝试新浪API
  try {
    console.log(`[Fallback] Trying Sina API for ${stockCode}`);
    const sinaData = await sinaProvider.fetch(request);

    if (validateKLineData(sinaData)) {
      const cleanedData = cleanKLineData(sinaData);
      // 缓存数据
      klineCache.set(stockCode, timeFrame, cleanedData);

      return {
        success: true,
        data: limitDataPoints(cleanedData, limit),
        source: 'sina',
        cached: false,
      };
    }
  } catch (error) {
    console.error('[Fallback] Sina API failed:', error);
  }

  // 3. 尝试东方财富API（备用）
  try {
    console.log(`[Fallback] Trying Eastmoney API for ${stockCode}`);
    const eastmoneyData = await eastmoneyProvider.fetch(request);

    if (validateKLineData(eastmoneyData)) {
      const cleanedData = cleanKLineData(eastmoneyData);
      // 缓存数据
      klineCache.set(stockCode, timeFrame, cleanedData);

      return {
        success: true,
        data: limitDataPoints(cleanedData, limit),
        source: 'eastmoney',
        cached: false,
      };
    }
  } catch (error) {
    console.error('[Fallback] Eastmoney API failed:', error);
  }

  // 4. 使用Mock数据作为最终降级
  console.warn(`[Fallback] All APIs failed, using mock data for ${stockCode}`);
  const mockData = generateMockFallback(request);

  return {
    success: true,
    data: limitDataPoints(mockData, limit),
    source: 'mock',
    cached: false,
    error: 'All data sources failed, using mock data',
  };
}

/**
 * 清除缓存
 */
export function clearCache(stockCode?: string, timeFrame?: string) {
  if (stockCode && timeFrame) {
    klineCache.clear(stockCode, timeFrame as any);
  } else {
    klineCache.clearAll();
  }
}

/**
 * 获取缓存统计
 */
export function getCacheStats() {
  return klineCache.getStats();
}
