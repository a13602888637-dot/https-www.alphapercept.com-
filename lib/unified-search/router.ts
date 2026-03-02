/**
 * 智能搜索路由器
 * 根据查询内容自动选择最佳数据源
 */

import { DataSourceConfig } from './types';

export interface RoutingDecision {
  sources: DataSourceConfig[];
  reasoning: string;
}

export class SearchRouter {
  /**
   * 根据查询内容路由到最佳数据源
   */
  route(query: string): DataSourceConfig[] {
    const trimmedQuery = query.trim();

    // 1. A股识别（优先级最高，中国用户最常用）
    if (this.isCNStock(trimmedQuery)) {
      return [
        { name: 'python-fastapi', priority: 1, enabled: true, timeout: 8000, retryCount: 2 },
        { name: 'local-cn-fallback', priority: 3, enabled: true, timeout: 1000, retryCount: 1 }
      ];
    }

    // 2. 美股识别
    if (this.isUSStock(trimmedQuery)) {
      return [
        { name: 'finnhub', priority: 1, enabled: true, timeout: 5000, retryCount: 2 },
        { name: 'local-us-fallback', priority: 3, enabled: true, timeout: 1000, retryCount: 1 }
      ];
    }

    // 3. 商品/贵金属识别
    if (this.isCommodity(trimmedQuery)) {
      return [
        { name: 'commodity-crawler', priority: 1, enabled: true, timeout: 5000, retryCount: 2 }
      ];
    }

    // 4. 默认：并行查询 A股 + 美股（不确定市场时）
    return [
      { name: 'python-fastapi', priority: 1, enabled: true, timeout: 8000, retryCount: 2 },
      { name: 'finnhub', priority: 1, enabled: true, timeout: 5000, retryCount: 2 },
      { name: 'local-cn-fallback', priority: 3, enabled: true, timeout: 1000, retryCount: 1 }
    ];
  }

  /**
   * 判断是否为 A股查询
   */
  private isCNStock(query: string): boolean {
    // 规则1: 6位纯数字（A股代码格式）
    if (/^[0-9]{6}$/.test(query)) {
      return true;
    }

    // 规则2: 包含中文字符（A股名称）
    if (/[\u4e00-\u9fa5]/.test(query)) {
      return true;
    }

    // 规则3: 明确的 A股市场标识
    if (query.toUpperCase().endsWith('.SH') || query.toUpperCase().endsWith('.SZ')) {
      return true;
    }

    return false;
  }

  /**
   * 判断是否为美股查询
   */
  private isUSStock(query: string): boolean {
    // 规则1: 1-5位大写字母（美股 Ticker 格式）
    if (/^[A-Z]{1,5}$/.test(query)) {
      return true;
    }

    // 规则2: 明确的美股交易所标识
    const usExchanges = ['NASDAQ:', 'NYSE:', 'AMEX:'];
    if (usExchanges.some(ex => query.toUpperCase().startsWith(ex))) {
      return true;
    }

    return false;
  }

  /**
   * 判断是否为商品/贵金属查询
   */
  private isCommodity(query: string): boolean {
    const commodityKeywords = [
      '黄金', 'gold', 'xau',
      '白银', 'silver', 'xag',
      '原油', 'oil', 'crude', 'wti', 'brent',
      '铜', 'copper', 'hg',
      '天然气', 'gas', 'ng'
    ];

    const lowerQuery = query.toLowerCase();
    return commodityKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  /**
   * 获取路由决策的详细说明（用于调试）
   */
  explainRouting(query: string): RoutingDecision {
    const sources = this.route(query);

    let reasoning = '';
    if (this.isCNStock(query)) {
      reasoning = 'A股查询（6位数字或中文）';
    } else if (this.isUSStock(query)) {
      reasoning = '美股查询（1-5位大写字母）';
    } else if (this.isCommodity(query)) {
      reasoning = '商品查询（包含商品关键词）';
    } else {
      reasoning = '混合查询（并行搜索多个市场）';
    }

    return { sources, reasoning };
  }
}

// 导出单例
export const searchRouter = new SearchRouter();
