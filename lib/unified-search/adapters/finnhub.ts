/**
 * Finnhub 美股数据源适配器
 */

import { UnifiedAsset } from '../types';

export class FinnhubAdapter {
  private apiKey: string;
  private baseUrl = 'https://finnhub.io/api/v1';

  constructor() {
    this.apiKey = process.env.FINNHUB_API_KEY || '';

    if (!this.apiKey) {
      console.warn('FINNHUB_API_KEY not configured, Finnhub adapter disabled');
    }
  }

  /**
   * 搜索美股
   */
  async search(query: string, limit: number = 15): Promise<UnifiedAsset[]> {
    if (!this.apiKey) {
      console.warn('Finnhub API key not configured, returning empty results');
      return [];
    }

    try {
      const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&token=${this.apiKey}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        // Next.js 缓存配置（Finnhub 免费层有速率限制）
        next: { revalidate: 3600 } // 1小时缓存
      });

      if (!response.ok) {
        throw new Error(`Finnhub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.result || !Array.isArray(data.result)) {
        return [];
      }

      // 转换为统一格式，限制结果数量
      return data.result.slice(0, limit).map((item: any) => ({
        symbol: item.symbol,
        name: item.description || item.symbol,
        market: 'US',
        type: this.mapFinnhubType(item.type),
        exchange: item.displaySymbol?.split(':')[0], // 提取交易所
        metadata: {
          country: 'US'
        }
      }));

    } catch (error) {
      console.error('FinnhubAdapter error:', error);
      throw error;
    }
  }

  /**
   * 映射 Finnhub 资产类型到统一类型
   */
  private mapFinnhubType(type: string): 'STOCK' | 'ETF' | 'INDEX' {
    if (type === 'Common Stock') return 'STOCK';
    if (type === 'ETF') return 'ETF';
    if (type === 'Index') return 'INDEX';
    return 'STOCK'; // 默认
  }

  /**
   * 健康检查（测试 API Key 有效性）
   */
  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      const response = await fetch(
        `${this.baseUrl}/search?q=AAPL&token=${this.apiKey}`,
        { signal: AbortSignal.timeout(3000) }
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}
