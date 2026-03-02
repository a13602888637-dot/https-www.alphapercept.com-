/**
 * 本地降级数据适配器
 * 当所有外部数据源失败时使用
 */

import { UnifiedAsset } from '../types';

// 沪深300核心股票（与现有系统保持一致）
const CN_FALLBACK_STOCKS: UnifiedAsset[] = [
  { symbol: "600519.SH", code: "600519", name: "贵州茅台", market: "SH", type: "STOCK" },
  { symbol: "600036.SH", code: "600036", name: "招商银行", market: "SH", type: "STOCK" },
  { symbol: "601318.SH", code: "601318", name: "中国平安", market: "SH", type: "STOCK" },
  { symbol: "600276.SH", code: "600276", name: "恒瑞医药", market: "SH", type: "STOCK" },
  { symbol: "000858.SZ", code: "000858", name: "五粮液", market: "SZ", type: "STOCK" },
  { symbol: "000333.SZ", code: "000333", name: "美的集团", market: "SZ", type: "STOCK" },
  { symbol: "002415.SZ", code: "002415", name: "海康威视", market: "SZ", type: "STOCK" },
  { symbol: "300750.SZ", code: "300750", name: "宁德时代", market: "SZ", type: "STOCK" },
  // ... 可添加更多核心股票
];

const US_FALLBACK_STOCKS: UnifiedAsset[] = [
  { symbol: "AAPL", name: "Apple Inc.", market: "US", type: "STOCK", exchange: "NASDAQ" },
  { symbol: "MSFT", name: "Microsoft Corporation", market: "US", type: "STOCK", exchange: "NASDAQ" },
  { symbol: "GOOGL", name: "Alphabet Inc.", market: "US", type: "STOCK", exchange: "NASDAQ" },
  { symbol: "AMZN", name: "Amazon.com Inc.", market: "US", type: "STOCK", exchange: "NASDAQ" },
  { symbol: "TSLA", name: "Tesla Inc.", market: "US", type: "STOCK", exchange: "NASDAQ" },
  { symbol: "NVDA", name: "NVIDIA Corporation", market: "US", type: "STOCK", exchange: "NASDAQ" },
  // ... 可添加更多美股
];

export class LocalFallbackAdapter {
  /**
   * 搜索本地 A股数据
   */
  searchCN(query: string, limit: number = 15): UnifiedAsset[] {
    const lowerQuery = query.toLowerCase();

    // 精确匹配代码
    const exactMatch = CN_FALLBACK_STOCKS.filter(
      stock => stock.symbol.includes(query) || stock.code === query
    );
    if (exactMatch.length > 0) {
      return exactMatch.slice(0, limit);
    }

    // 模糊匹配名称
    const fuzzyMatch = CN_FALLBACK_STOCKS.filter(
      stock => stock.name.includes(query)
    );
    return fuzzyMatch.slice(0, limit);
  }

  /**
   * 搜索本地美股数据
   */
  searchUS(query: string, limit: number = 15): UnifiedAsset[] {
    const upperQuery = query.toUpperCase();

    // 精确匹配 Symbol
    const exactMatch = US_FALLBACK_STOCKS.filter(
      stock => stock.symbol === upperQuery
    );
    if (exactMatch.length > 0) {
      return exactMatch.slice(0, limit);
    }

    // 模糊匹配名称
    const lowerQuery = query.toLowerCase();
    const fuzzyMatch = US_FALLBACK_STOCKS.filter(
      stock => stock.name.toLowerCase().includes(lowerQuery) ||
               stock.symbol.toLowerCase().includes(lowerQuery)
    );
    return fuzzyMatch.slice(0, limit);
  }

  /**
   * 健康检查（本地数据总是可用）
   */
  healthCheck(): boolean {
    return true;
  }
}
