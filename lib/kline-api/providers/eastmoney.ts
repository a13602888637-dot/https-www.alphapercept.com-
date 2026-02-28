/**
 * 东方财富K线数据提供者（备用）
 * 当新浪API失败时使用
 */

import { KLineProvider, KLineRequest, KLineDataPoint } from './types';

export class EastmoneyKLineProvider implements KLineProvider {
  name: 'eastmoney' = 'eastmoney';

  async fetch(request: KLineRequest): Promise<KLineDataPoint[]> {
    // TODO: 实现东方财富API调用
    // 当前作为降级备用方案，暂不实现
    console.log('[Eastmoney API] Not implemented yet, will use fallback');
    throw new Error('Eastmoney provider not implemented');
  }
}

export const eastmoneyProvider = new EastmoneyKLineProvider();
