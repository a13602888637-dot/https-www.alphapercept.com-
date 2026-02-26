/**
 * 搜索服务
 * 主搜索逻辑，包含多数据源路由和智能重试
 */

import {
  SearchSourceConfig,
  StockResult,
  selectOptimalSource,
  getEnabledSources,
  PROXY_CONFIG,
} from './config';
import { getCache, cacheable } from './cache';
import { getProxyService, ProxyRequest } from './proxy-service';

export interface SearchOptions {
  query: string;
  clientIp?: string;
  useCache?: boolean;
  maxResults?: number;
  timeout?: number;
  preferredSource?: string;
}

export interface SearchResult {
  success: boolean;
  data: StockResult[];
  source: string;
  cached: boolean;
  query: string;
  error?: string;
  metadata?: {
    responseTime: number;
    sourcesTried: string[];
    fallbackUsed: boolean;
  };
}

export class SearchService {
  private cache = getCache();
  private proxyService = getProxyService();

  /**
   * 搜索股票
   */
  async search(options: SearchOptions): Promise<SearchResult> {
    const {
      query,
      clientIp,
      useCache = true,
      maxResults = 15,
      timeout = 10000,
      preferredSource,
    } = options;

    const startTime = Date.now();
    const sourcesTried: string[] = [];
    let fallbackUsed = false;

    // 检查缓存
    if (useCache) {
      const cachedResult = this.cache.get(query);
      if (cachedResult) {
        return {
          success: true,
          data: cachedResult.slice(0, maxResults),
          source: 'cache',
          cached: true,
          query,
          metadata: {
            responseTime: Date.now() - startTime,
            sourcesTried: ['cache'],
            fallbackUsed: false,
          },
        };
      }
    }

    // 选择数据源
    let sources: SearchSourceConfig[];
    if (preferredSource) {
      // 使用指定的数据源
      const source = getEnabledSources().find(s => s.name === preferredSource);
      sources = source ? [source] : selectOptimalSource(clientIp);
    } else {
      // 智能选择数据源
      sources = selectOptimalSource(clientIp);
    }

    // 尝试每个数据源
    for (const source of sources) {
      if (!source.enabled) continue;

      sourcesTried.push(source.name);

      try {
        const results = await this.fetchFromSource(source, query, timeout);

        if (results.length > 0) {
          // 缓存结果
          this.cache.set(query, results, source.name);

          return {
            success: true,
            data: results.slice(0, maxResults),
            source: source.name,
            cached: false,
            query,
            metadata: {
              responseTime: Date.now() - startTime,
              sourcesTried,
              fallbackUsed,
            },
          };
        }
      } catch (error) {
        console.warn(`Source ${source.name} failed:`, error);
        // 继续尝试下一个数据源
      }
    }

    // 所有数据源都失败，使用降级数据
    fallbackUsed = true;
    const fallbackResults = this.getFallbackResults(query);

    return {
      success: fallbackResults.length > 0,
      data: fallbackResults.slice(0, maxResults),
      source: 'fallback',
      cached: false,
      query,
      error: fallbackResults.length > 0 ? undefined : 'All search sources failed',
      metadata: {
        responseTime: Date.now() - startTime,
        sourcesTried,
        fallbackUsed,
      },
    };
  }

  /**
   * 从指定数据源获取数据
   */
  private async fetchFromSource(
    source: SearchSourceConfig,
    query: string,
    timeout: number
  ): Promise<StockResult[]> {
    const url = this.buildSourceUrl(source, query);

    const proxyRequest: ProxyRequest = {
      query,
      source: source.name,
      url,
      headers: source.headers,
      timeout: Math.min(source.timeout, timeout),
    };

    // 重试机制
    for (let attempt = 1; attempt <= source.retryCount; attempt++) {
      try {
        const response = await this.proxyService.fetchThroughProxy(proxyRequest);

        if (response.success) {
          return source.parser(response.data, query);
        }

        if (attempt < source.retryCount) {
          // 指数退避
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.warn(`Attempt ${attempt} failed for source ${source.name}:`, error);
        if (attempt === source.retryCount) {
          throw error;
        }
        // 指数退避
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return [];
  }

  /**
   * 构建数据源URL
   */
  private buildSourceUrl(source: SearchSourceConfig, query: string): string {
    const encodedQuery = encodeURIComponent(query);

    switch (source.name) {
      case 'sina':
        return `${source.url}?key=${encodedQuery}`;

      case 'xueqiu':
        return `${source.url}?code=${encodedQuery}&size=20`;

      case 'eastmoney':
        return `${source.url}?input=${encodedQuery}&type=14&token=D43F4A25-9B42-4B17-9B7B-2F4B4B4B4B4B`;

      case 'tencent':
        return `${source.url}?q=${encodedQuery}&t=all&c=1&v=2`;

      default:
        return `${source.url}?q=${encodedQuery}`;
    }
  }

  /**
   * 获取降级结果（本地静态数据）
   */
  private getFallbackResults(query: string): StockResult[] {
    // 沪深300核心标的（与现有代码保持一致）
    const fallbackStocks: StockResult[] = [
      // 深圳交易所
      { code: "000001", name: "平安银行", market: "SZ" },
      { code: "000002", name: "万科A", market: "SZ" },
      { code: "000858", name: "五粮液", market: "SZ" },
      { code: "000333", name: "美的集团", market: "SZ" },
      { code: "000651", name: "格力电器", market: "SZ" },
      { code: "000725", name: "京东方A", market: "SZ" },
      { code: "000063", name: "中兴通讯", market: "SZ" },
      { code: "000100", name: "TCL科技", market: "SZ" },
      { code: "000166", name: "申万宏源", market: "SZ" },
      { code: "000338", name: "潍柴动力", market: "SZ" },
      { code: "000568", name: "泸州老窖", market: "SZ" },
      { code: "000625", name: "长安汽车", market: "SZ" },
      { code: "000661", name: "长春高新", market: "SZ" },
      { code: "000776", name: "广发证券", market: "SZ" },
      { code: "000876", name: "新希望", market: "SZ" },
      { code: "000977", name: "浪潮信息", market: "SZ" },
      { code: "002024", name: "苏宁易购", market: "SZ" },
      { code: "002142", name: "宁波银行", market: "SZ" },
      { code: "002153", name: "石基信息", market: "SZ" },
      { code: "002230", name: "科大讯飞", market: "SZ" },
      { code: "002236", name: "大华股份", market: "SZ" },
      { code: "002241", name: "歌尔股份", market: "SZ" },
      { code: "002304", name: "洋河股份", market: "SZ" },
      { code: "002352", name: "顺丰控股", market: "SZ" },
      { code: "002415", name: "海康威视", market: "SZ" },
      { code: "002475", name: "立讯精密", market: "SZ" },
      { code: "002594", name: "比亚迪", market: "SZ" },
      { code: "300015", name: "爱尔眼科", market: "SZ" },
      { code: "300059", name: "东方财富", market: "SZ" },
      { code: "300122", name: "智飞生物", market: "SZ" },
      { code: "300142", name: "沃森生物", market: "SZ" },
      { code: "300347", name: "泰格医药", market: "SZ" },
      { code: "300750", name: "宁德时代", market: "SZ" },
      // 上海交易所
      { code: "600000", name: "浦发银行", market: "SH" },
      { code: "600009", name: "上海机场", market: "SH" },
      { code: "600010", name: "包钢股份", market: "SH" },
      { code: "600016", name: "民生银行", market: "SH" },
      { code: "600028", name: "中国石化", market: "SH" },
      { code: "600030", name: "中信证券", market: "SH" },
      { code: "600036", name: "招商银行", market: "SH" },
      { code: "600048", name: "保利发展", market: "SH" },
      { code: "600050", name: "中国联通", market: "SH" },
      { code: "600104", name: "上汽集团", market: "SH" },
      { code: "600276", name: "恒瑞医药", market: "SH" },
      { code: "600309", name: "万华化学", market: "SH" },
      { code: "600436", name: "片仔癀", market: "SH" },
      { code: "600519", name: "贵州茅台", market: "SH" },
      { code: "600547", name: "山东黄金", market: "SH" },
      { code: "600585", name: "海螺水泥", market: "SH" },
      { code: "600588", name: "用友网络", market: "SH" },
      { code: "600690", name: "海尔智家", market: "SH" },
      { code: "600703", name: "三安光电", market: "SH" },
      { code: "600745", name: "闻泰科技", market: "SH" },
      { code: "600795", name: "国电电力", market: "SH" },
      { code: "600837", name: "海通证券", market: "SH" },
      { code: "600887", name: "伊利股份", market: "SH" },
      { code: "600900", name: "长江电力", market: "SH" },
      { code: "600919", name: "江苏银行", market: "SH" },
      { code: "600958", name: "东方证券", market: "SH" },
      { code: "600999", name: "招商证券", market: "SH" },
      { code: "601006", name: "大秦铁路", market: "SH" },
      { code: "601012", name: "隆基绿能", market: "SH" },
      { code: "601066", name: "中信建投", market: "SH" },
      { code: "601088", name: "中国神华", market: "SH" },
      { code: "601138", name: "工业富联", market: "SH" },
      { code: "601166", name: "兴业银行", market: "SH" },
      { code: "601169", name: "北京银行", market: "SH" },
      { code: "601186", name: "中国铁建", market: "SH" },
      { code: "601198", name: "东兴证券", market: "SH" },
      { code: "601211", name: "国泰君安", market: "SH" },
      { code: "601216", name: "君正集团", market: "SH" },
      { code: "601229", name: "上海银行", market: "SH" },
      { code: "601288", name: "农业银行", market: "SH" },
      { code: "601318", name: "中国平安", market: "SH" },
      { code: "601328", name: "交通银行", market: "SH" },
      { code: "601336", name: "新华保险", market: "SH" },
      { code: "601398", name: "工商银行", market: "SH" },
      { code: "601601", name: "中国太保", market: "SH" },
      { code: "601628", name: "中国人寿", market: "SH" },
      { code: "601668", name: "中国建筑", market: "SH" },
      { code: "601688", name: "华泰证券", market: "SH" },
      { code: "601766", name: "中国中车", market: "SH" },
      { code: "601788", name: "光大证券", market: "SH" },
      { code: "601800", name: "中国交建", market: "SH" },
      { code: "601818", name: "光大银行", market: "SH" },
      { code: "601857", name: "中国石油", market: "SH" },
      { code: "601878", name: "浙商证券", market: "SH" },
      { code: "601888", name: "中国中免", market: "SH" },
      { code: "601899", name: "紫金矿业", market: "SH" },
      { code: "601919", name: "中远海控", market: "SH" },
      { code: "601939", name: "建设银行", market: "SH" },
      { code: "601988", name: "中国银行", market: "SH" },
      { code: "601998", name: "中信银行", market: "SH" },
      { code: "603259", name: "药明康德", market: "SH" },
      { code: "603288", name: "海天味业", market: "SH" },
      { code: "603501", name: "韦尔股份", market: "SH" },
      { code: "603986", name: "兆易创新", market: "SH" },
    ];

    const lowercaseQuery = query.toLowerCase();

    // 优先精确匹配股票代码
    const exactCodeMatches = fallbackStocks.filter(stock =>
      stock.code === query
    );
    if (exactCodeMatches.length > 0) {
      return exactCodeMatches;
    }

    // 其次精确匹配股票名称
    const exactNameMatches = fallbackStocks.filter(stock =>
      stock.name.toLowerCase() === lowercaseQuery
    );
    if (exactNameMatches.length > 0) {
      return exactNameMatches;
    }

    // 最后进行模糊匹配
    return fallbackStocks.filter(stock =>
      stock.code.includes(query) ||
      stock.name.toLowerCase().includes(lowercaseQuery) ||
      stock.market.toLowerCase().includes(lowercaseQuery)
    );
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    const cacheStats = this.cache.getStats();
    const enabledSources = getEnabledSources();

    return {
      cache: {
        enabled: true,
        size: cacheStats.size,
        maxSize: cacheStats.maxSize,
        ttl: cacheStats.ttl,
      },
      sources: enabledSources.map(source => ({
        name: source.name,
        enabled: source.enabled,
        priority: source.priority,
        timeout: source.timeout,
        retryCount: source.retryCount,
      })),
      proxy: {
        type: PROXY_CONFIG.type, // 从配置读取
        enabled: PROXY_CONFIG.enabled,
      },
    };
  }

  /**
   * 清理缓存
   */
  clearCache(): number {
    const beforeSize = this.cache.getStats().size;
    this.cache.clear();
    const afterSize = this.cache.getStats().size;
    return beforeSize - afterSize;
  }

  /**
   * 清理过期缓存
   */
  cleanupCache(): number {
    return this.cache.cleanup();
  }
}

// 全局搜索服务实例
let globalSearchService: SearchService | null = null;

/**
 * 获取全局搜索服务实例
 */
export function getSearchService(): SearchService {
  if (!globalSearchService) {
    globalSearchService = new SearchService();
  }
  return globalSearchService;
}