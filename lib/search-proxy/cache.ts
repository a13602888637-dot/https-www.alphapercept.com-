/**
 * 搜索缓存服务
 * 用于缓存搜索结果，减少API调用
 */

import { StockResult } from './config';

interface CacheEntry {
  data: StockResult[];
  timestamp: number;
  query: string;
  source: string;
}

export class SearchCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private ttl: number; // 缓存存活时间（毫秒）

  constructor(maxSize: number = 1000, ttl: number = 5 * 60 * 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * 获取缓存结果
   */
  get(query: string): StockResult[] | null {
    const key = this.normalizeKey(query);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // 检查缓存是否过期
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * 设置缓存结果
   */
  set(query: string, data: StockResult[], source: string): void {
    const key = this.normalizeKey(query);

    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      query,
      source,
    });
  }

  /**
   * 删除缓存
   */
  delete(query: string): void {
    const key = this.normalizeKey(query);
    this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    size: number;
    maxSize: number;
    ttl: number;
    hitRate?: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
    };
  }

  /**
   * 获取所有缓存键
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 清理过期缓存
   */
  cleanup(): number {
    const now = Date.now();
    let deletedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * 规范化查询键
   */
  private normalizeKey(query: string): string {
    return query.trim().toLowerCase();
  }

  /**
   * 删除最旧的缓存条目
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

// 全局缓存实例
let globalCache: SearchCache | null = null;

/**
 * 获取全局缓存实例
 */
export function getCache(): SearchCache {
  if (!globalCache) {
    globalCache = new SearchCache();
  }
  return globalCache;
}

/**
 * 重置全局缓存
 */
export function resetCache(maxSize?: number, ttl?: number): SearchCache {
  globalCache = new SearchCache(maxSize, ttl);
  return globalCache;
}

/**
 * 缓存装饰器
 */
export function cacheable(ttl: number = 5 * 60 * 1000) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const cache = getCache();

    descriptor.value = async function (...args: any[]) {
      const query = args[0] as string;

      // 从缓存获取
      const cachedResult = cache.get(query);
      if (cachedResult) {
        return {
          data: cachedResult,
          source: 'cache',
          cached: true,
          timestamp: Date.now(),
        };
      }

      // 执行原始方法
      const result = await originalMethod.apply(this, args);

      // 缓存结果
      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        cache.set(query, result.data, result.source || 'unknown');
      }

      return {
        ...result,
        cached: false,
      };
    };

    return descriptor;
  };
}