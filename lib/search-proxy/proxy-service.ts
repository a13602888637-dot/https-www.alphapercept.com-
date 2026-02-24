/**
 * 代理服务
 * 用于处理海外IP限制问题
 */

import { SearchSourceConfig, StockResult, PROXY_CONFIG } from './config';

export interface ProxyRequest {
  query: string;
  source: string;
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface ProxyResponse {
  success: boolean;
  data: string;
  source: string;
  status: number;
  error?: string;
}

export class ProxyService {
  /**
   * 通过代理发送请求
   */
  async fetchThroughProxy(request: ProxyRequest): Promise<ProxyResponse> {
    const { query, source, url, headers, timeout } = request;

    try {
      // 根据代理配置选择代理方式
      switch (PROXY_CONFIG.type) {
        case 'direct':
          return await this.directFetch(url, headers, timeout);

        case 'proxy':
          return await this.proxyFetch(url, headers, timeout);

        case 'cloud-function':
          return await this.cloudFunctionFetch(query, source, url, headers, timeout);

        default:
          throw new Error(`Unsupported proxy type: ${PROXY_CONFIG.type}`);
      }
    } catch (error) {
      return {
        success: false,
        data: '',
        source,
        status: 500,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 直接请求（无代理）
   */
  private async directFetch(
    url: string,
    headers?: Record<string, string>,
    timeout: number = 8000
  ): Promise<ProxyResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          ...headers,
        },
        signal: controller.signal,
      });

      const data = await response.text();

      return {
        success: response.ok,
        data,
        source: 'direct',
        status: response.status,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 通过HTTP代理请求
   */
  private async proxyFetch(
    url: string,
    headers?: Record<string, string>,
    timeout: number = 10000
  ): Promise<ProxyResponse> {
    // 这里需要配置代理服务器地址
    const proxyUrl = PROXY_CONFIG.proxyUrl;
    if (!proxyUrl) {
      throw new Error('Proxy URL not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // 通过代理服务器转发请求
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          url,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
          },
        }),
        signal: controller.signal,
      });

      const data = await response.text();

      return {
        success: response.ok,
        data,
        source: 'proxy',
        status: response.status,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 通过云函数代理请求
   */
  private async cloudFunctionFetch(
    query: string,
    source: string,
    url: string,
    headers?: Record<string, string>,
    timeout: number = 10000
  ): Promise<ProxyResponse> {
    const cloudFunctionUrl = PROXY_CONFIG.cloudFunctionUrl;
    if (!cloudFunctionUrl) {
      throw new Error('Cloud function URL not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(cloudFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          query,
          source,
          url,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
          },
        }),
        signal: controller.signal,
      });

      const data = await response.text();

      return {
        success: response.ok,
        data,
        source: 'cloud-function',
        status: response.status,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 测试代理连接
   */
  async testConnection(): Promise<{
    direct: boolean;
    proxy: boolean;
    cloudFunction: boolean;
  }> {
    const testUrl = 'https://httpbin.org/get';
    const results = {
      direct: false,
      proxy: false,
      cloudFunction: false,
    };

    try {
      // 测试直接连接
      const directResult = await this.directFetch(testUrl);
      results.direct = directResult.success;
    } catch (error) {
      console.warn('Direct connection test failed:', error);
    }

    // 测试代理连接（如果配置了代理）
    if (PROXY_CONFIG.type === 'proxy' && PROXY_CONFIG.proxyUrl) {
      try {
        const proxyResult = await this.proxyFetch(testUrl);
        results.proxy = proxyResult.success;
      } catch (error) {
        console.warn('Proxy connection test failed:', error);
      }
    }

    // 测试云函数连接（如果配置了云函数）
    if (PROXY_CONFIG.type === 'cloud-function' && PROXY_CONFIG.cloudFunctionUrl) {
      try {
        const cfResult = await this.cloudFunctionFetch('test', 'test', testUrl);
        results.cloudFunction = cfResult.success;
      } catch (error) {
        console.warn('Cloud function connection test failed:', error);
      }
    }

    return results;
  }
}

// 全局代理服务实例
let globalProxyService: ProxyService | null = null;

/**
 * 获取全局代理服务实例
 */
export function getProxyService(): ProxyService {
  if (!globalProxyService) {
    globalProxyService = new ProxyService();
  }
  return globalProxyService;
}