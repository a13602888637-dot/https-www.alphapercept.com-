/**
 * K线数据缓存管理
 * 使用内存缓存，不同时间周期使用不同的TTL
 */

import { TimeFrame, KLineDataPoint } from './providers/types';

// 缓存TTL配置（毫秒）
const CACHE_TTL_MAP: Record<TimeFrame, number> = {
  '5m': 1 * 60 * 1000,       // 1分钟
  '15m': 3 * 60 * 1000,      // 3分钟
  '30m': 5 * 60 * 1000,      // 5分钟
  '60m': 10 * 60 * 1000,     // 10分钟
  'daily': 30 * 60 * 1000,   // 30分钟
  'weekly': 60 * 60 * 1000,  // 1小时
  'monthly': 60 * 60 * 1000, // 1小时
};

interface CacheEntry {
  data: KLineDataPoint[];
  timestamp: number;
  ttl: number;
}

class KLineCache {
  private cache: Map<string, CacheEntry> = new Map();

  // 生成缓存键
  private getCacheKey(stockCode: string, timeFrame: TimeFrame): string {
    return `${stockCode}:${timeFrame}`;
  }

  // 检查缓存是否过期
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  // 获取缓存数据
  get(stockCode: string, timeFrame: TimeFrame): KLineDataPoint[] | null {
    const key = this.getCacheKey(stockCode, timeFrame);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      console.log(`[Cache] Expired: ${key}`);
      return null;
    }

    console.log(`[Cache] Hit: ${key} (age: ${Math.round((Date.now() - entry.timestamp) / 1000)}s)`);
    return entry.data;
  }

  // 设置缓存数据
  set(stockCode: string, timeFrame: TimeFrame, data: KLineDataPoint[]): void {
    const key = this.getCacheKey(stockCode, timeFrame);
    const ttl = CACHE_TTL_MAP[timeFrame];

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    console.log(`[Cache] Set: ${key} (TTL: ${ttl / 1000}s, points: ${data.length})`);
  }

  // 清除指定缓存
  clear(stockCode: string, timeFrame: TimeFrame): void {
    const key = this.getCacheKey(stockCode, timeFrame);
    this.cache.delete(key);
    console.log(`[Cache] Cleared: ${key}`);
  }

  // 清除所有缓存
  clearAll(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`[Cache] Cleared all (${size} entries)`);
  }

  // 清理过期缓存
  cleanup(): void {
    let removed = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      console.log(`[Cache] Cleanup: removed ${removed} expired entries`);
    }
  }

  // 获取缓存统计信息
  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }
}

// 单例模式
export const klineCache = new KLineCache();

// 定期清理过期缓存（每5分钟）
if (typeof window === 'undefined') {
  // 仅在服务端运行
  setInterval(() => {
    klineCache.cleanup();
  }, 5 * 60 * 1000);
}
