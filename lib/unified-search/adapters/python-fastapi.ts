/**
 * Python FastAPI A股数据源适配器
 */

import { UnifiedAsset } from '../types';

export class PythonFastAPIAdapter {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
  }

  /**
   * 搜索 A股
   */
  async search(query: string, limit: number = 15): Promise<UnifiedAsset[]> {
    try {
      const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&limit=${limit}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        // Next.js 缓存配置
        next: { revalidate: 60 } // 60秒缓存
      });

      if (!response.ok) {
        throw new Error(`Python service error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success || !Array.isArray(data.data)) {
        throw new Error('Invalid response format from Python service');
      }

      // 转换为统一格式
      return data.data.map((item: any) => ({
        symbol: item.symbol,
        name: item.name,
        market: item.market,
        type: item.type || 'STOCK',
        metadata: {
          pinyin: item.pinyin
        }
      }));

    } catch (error) {
      console.error('PythonFastAPIAdapter error:', error);
      throw error;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000) // 3秒超时
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
