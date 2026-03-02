/**
 * 搜索聚合器
 * 并行调用多个数据源，聚合结果并去重
 */

import { UnifiedAsset, SearchResultGroup, UnifiedSearchResponse, DataSourceStatus, MarketType } from './types';
import { searchRouter } from './router';
import { PythonFastAPIAdapter, FinnhubAdapter, LocalFallbackAdapter } from './adapters';
import { MARKET_DISPLAY_NAMES, DEFAULT_SEARCH_TIMEOUT } from './constants';

export class SearchAggregator {
  private pythonAdapter = new PythonFastAPIAdapter();
  private finnhubAdapter = new FinnhubAdapter();
  private fallbackAdapter = new LocalFallbackAdapter();

  /**
   * 统一搜索入口
   */
  async search(
    query: string,
    options: {
      markets?: MarketType[];
      limit?: number;
      timeout?: number;
    } = {}
  ): Promise<UnifiedSearchResponse> {
    const {
      limit = 15,
      timeout = DEFAULT_SEARCH_TIMEOUT
    } = options;

    const startTime = Date.now();
    const sourceStatuses: DataSourceStatus[] = [];

    try {
      // 1. 智能路由：选择数据源
      const sources = searchRouter.route(query);

      // 2. 并行调用数据源（使用 Promise.allSettled 确保部分失败不影响其他源）
      const results = await Promise.race([
        this.fetchFromSources(sources, query, limit, sourceStatuses),
        this.timeoutPromise(timeout)
      ]);

      // 3. 去重和分组
      const deduplicated = this.deduplicateResults(results);
      const grouped = this.groupByMarket(deduplicated);

      // 4. 按市场排序（A股优先，美股次之）
      grouped.sort((a, b) => {
        const order: MarketType[] = ['CN_A_STOCK', 'US_STOCK', 'COMMODITY', 'CRYPTO'];
        return order.indexOf(a.market) - order.indexOf(b.market);
      });

      return {
        success: grouped.length > 0,
        data: grouped,
        metadata: {
          totalResults: deduplicated.length,
          responseTime: Date.now() - startTime,
          sources: sourceStatuses
        }
      };

    } catch (error) {
      console.error('SearchAggregator error:', error);

      // 降级：返回本地数据
      const fallbackResults = this.getFallbackResults(query, limit);
      const grouped = this.groupByMarket(fallbackResults);

      return {
        success: fallbackResults.length > 0,
        data: grouped,
        metadata: {
          totalResults: fallbackResults.length,
          responseTime: Date.now() - startTime,
          sources: sourceStatuses
        },
        error: error instanceof Error ? error.message : 'Search failed'
      };
    }
  }

  /**
   * 从多个数据源并行获取数据
   */
  private async fetchFromSources(
    sources: any[],
    query: string,
    limit: number,
    statuses: DataSourceStatus[]
  ): Promise<UnifiedAsset[]> {
    const promises = sources.map(async (source) => {
      const sourceStartTime = Date.now();

      try {
        let results: UnifiedAsset[] = [];

        switch (source.name) {
          case 'python-fastapi':
            results = await this.pythonAdapter.search(query, limit);
            break;
          case 'finnhub':
            results = await this.finnhubAdapter.search(query, limit);
            break;
          case 'local-cn-fallback':
            results = this.fallbackAdapter.searchCN(query, limit);
            break;
          case 'local-us-fallback':
            results = this.fallbackAdapter.searchUS(query, limit);
            break;
        }

        statuses.push({
          name: source.name,
          available: true,
          responseTime: Date.now() - sourceStartTime
        });

        return results;

      } catch (error) {
        statuses.push({
          name: source.name,
          available: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return [];
      }
    });

    const results = await Promise.allSettled(promises);

    // 合并所有成功的结果
    return results
      .filter((r): r is PromiseFulfilledResult<UnifiedAsset[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);
  }

  /**
   * 去重（基于 symbol）
   */
  private deduplicateResults(assets: UnifiedAsset[]): UnifiedAsset[] {
    const seen = new Set<string>();
    const unique: UnifiedAsset[] = [];

    for (const asset of assets) {
      if (!seen.has(asset.symbol)) {
        seen.add(asset.symbol);
        unique.push(asset);
      }
    }

    return unique;
  }

  /**
   * 按市场分组
   */
  private groupByMarket(assets: UnifiedAsset[]): SearchResultGroup[] {
    const groups = new Map<MarketType, UnifiedAsset[]>();

    for (const asset of assets) {
      const market = this.determineMarket(asset);

      if (!groups.has(market)) {
        groups.set(market, []);
      }
      groups.get(market)!.push(asset);
    }

    return Array.from(groups.entries()).map(([market, results]) => ({
      market,
      displayName: MARKET_DISPLAY_NAMES[market],
      results
    }));
  }

  /**
   * 确定资产所属市场
   */
  private determineMarket(asset: UnifiedAsset): MarketType {
    if (asset.market === 'SH' || asset.market === 'SZ') {
      return 'CN_A_STOCK';
    }
    if (asset.market === 'US') {
      return 'US_STOCK';
    }
    if (asset.type === 'COMMODITY' || asset.type === 'FOREX') {
      return 'COMMODITY';
    }
    if (asset.type === 'CRYPTO') {
      return 'CRYPTO';
    }
    return 'CN_A_STOCK'; // 默认
  }

  /**
   * 获取降级结果（所有数据源失败时）
   */
  private getFallbackResults(query: string, limit: number): UnifiedAsset[] {
    const cnResults = this.fallbackAdapter.searchCN(query, limit);
    const usResults = this.fallbackAdapter.searchUS(query, limit);
    return [...cnResults, ...usResults].slice(0, limit);
  }

  /**
   * 超时 Promise
   */
  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Search timeout after ${ms}ms`)), ms);
    });
  }

  /**
   * 获取数据源健康状态
   */
  async getHealthStatus(): Promise<Record<string, boolean>> {
    const [pythonHealth, finnhubHealth] = await Promise.all([
      this.pythonAdapter.healthCheck(),
      this.finnhubAdapter.healthCheck()
    ]);

    return {
      'python-fastapi': pythonHealth,
      'finnhub': finnhubHealth,
      'local-fallback': this.fallbackAdapter.healthCheck()
    };
  }
}

// 导出单例
export const searchAggregator = new SearchAggregator();
