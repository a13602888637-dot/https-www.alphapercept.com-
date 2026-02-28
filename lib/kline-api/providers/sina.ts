/**
 * 新浪财经K线数据提供者
 * API文档: http://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData
 */

import { KLineProvider, KLineRequest, KLineDataPoint, SinaRawData, TimeFrame } from './types';

// 时间周期映射
const TIME_FRAME_MAP: Record<TimeFrame, string> = {
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '60m': '60',
  'daily': '240',      // 日K
  'weekly': '1200',    // 周K
  'monthly': '7200',   // 月K
};

// 股票代码格式转换
const formatStockCode = (code: string): string => {
  // 去除市场前缀 (SH/SZ)
  const cleanCode = code.replace(/^(SH|SZ)/i, '');

  // 判断市场
  if (code.toUpperCase().startsWith('SH') || cleanCode.startsWith('6')) {
    return `sh${cleanCode}`;
  } else if (code.toUpperCase().startsWith('SZ') || cleanCode.startsWith('0') || cleanCode.startsWith('3')) {
    return `sz${cleanCode}`;
  }

  // 默认深圳
  return `sz${cleanCode}`;
};

export class SinaKLineProvider implements KLineProvider {
  name: 'sina' = 'sina';
  private baseUrl = 'http://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData';

  async fetch(request: KLineRequest): Promise<KLineDataPoint[]> {
    const { stockCode, timeFrame, limit = 200 } = request;

    try {
      const symbol = formatStockCode(stockCode);
      const scale = TIME_FRAME_MAP[timeFrame];

      if (!scale) {
        throw new Error(`Unsupported timeframe: ${timeFrame}`);
      }

      const url = `${this.baseUrl}?symbol=${symbol}&scale=${scale}&datalen=${limit}`;

      console.log(`[Sina API] Fetching: ${url}`);

      const response = await fetch(url, {
        headers: {
          'Referer': 'http://finance.sina.com.cn',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        // 设置10秒超时
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Sina API error: ${response.status} ${response.statusText}`);
      }

      const rawData: SinaRawData[] = await response.json();

      if (!Array.isArray(rawData) || rawData.length === 0) {
        throw new Error('No data returned from Sina API');
      }

      // 转换为标准格式
      const klineData: KLineDataPoint[] = rawData.map(item => ({
        time: item.day,
        open: parseFloat(item.open),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        close: parseFloat(item.close),
        volume: parseFloat(item.volume),
      }));

      console.log(`[Sina API] Fetched ${klineData.length} data points for ${stockCode}`);

      return klineData;

    } catch (error) {
      console.error('[Sina API] Error:', error);
      throw error;
    }
  }
}

export const sinaProvider = new SinaKLineProvider();
