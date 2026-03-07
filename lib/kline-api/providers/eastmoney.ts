/**
 * 东方财富K线数据提供者（备用）
 * API: push2his.eastmoney.com — 对境外IP限制较松
 */

import { KLineProvider, KLineRequest, KLineDataPoint, TimeFrame } from './types';

// 东方财富时间周期映射
const KLT_MAP: Record<TimeFrame, number> = {
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '60m': 60,
  'daily': 101,
  'weekly': 102,
  'monthly': 103,
};

// 构造东方财富的 secid (市场代码.股票代码)
function getSecId(code: string): string {
  const cleanCode = code.replace(/^(SH|SZ)/i, '');
  // 指数优先判断
  if (cleanCode === '000300' || cleanCode === '000905') {
    return `1.${cleanCode}`;
  }
  if (cleanCode.startsWith('399')) {
    return `0.${cleanCode}`;
  }
  // 上海: 6开头、9开头
  if (cleanCode.startsWith('6') || cleanCode.startsWith('9')) {
    return `1.${cleanCode}`;
  }
  // 深圳: 0开头、3开头
  if (cleanCode.startsWith('0') || cleanCode.startsWith('3')) {
    return `0.${cleanCode}`;
  }
  return `1.${cleanCode}`;
}

export class EastmoneyKLineProvider implements KLineProvider {
  name: 'eastmoney' = 'eastmoney';

  async fetch(request: KLineRequest): Promise<KLineDataPoint[]> {
    const { stockCode, timeFrame, limit = 200 } = request;

    const secid = getSecId(stockCode);
    const klt = KLT_MAP[timeFrame];

    if (!klt) {
      throw new Error(`Unsupported timeframe: ${timeFrame}`);
    }

    const params = new URLSearchParams({
      secid,
      fields1: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13',
      fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
      klt: klt.toString(),
      fqt: '1', // 前复权
      end: '20500101',
      lmt: limit.toString(),
    });

    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?${params}`;
    console.log(`[Eastmoney API] Fetching: ${url}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, {
        headers: {
          'Referer': 'https://quote.eastmoney.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Eastmoney API error: ${response.status}`);
      }

      const json = await response.json();

      if (!json.data || !json.data.klines || !Array.isArray(json.data.klines)) {
        throw new Error('Invalid response from Eastmoney API');
      }

      const klines: string[] = json.data.klines;

      // 解析格式: "2024-01-02,10.50,10.80,10.90,10.40,1234567,1234567890,..."
      // 字段顺序: 日期,开盘,收盘,最高,最低,成交量,成交额,...
      const result: KLineDataPoint[] = [];
      for (const line of klines) {
        const parts = line.split(',');
        if (parts.length < 7) continue;

        const open = parseFloat(parts[1]);
        const close = parseFloat(parts[2]);
        const high = parseFloat(parts[3]);
        const low = parseFloat(parts[4]);
        const volume = parseFloat(parts[5]);

        if (isNaN(open) || isNaN(close)) continue;

        result.push({
          time: parts[0],
          open,
          high,
          low,
          close,
          volume,
          amount: parseFloat(parts[6]) || undefined,
        });
      }

      console.log(`[Eastmoney API] Fetched ${result.length} data points for ${stockCode}`);
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const eastmoneyProvider = new EastmoneyKLineProvider();
