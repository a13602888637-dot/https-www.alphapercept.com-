"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useWatchlistStore, WatchlistItem } from "@/lib/store/watchlist-store";
import { getDataSyncManager } from "@/lib/bmad/data-sync-manager";

/**
 * 自选股数据Hook
 * 封装数据获取、订阅和状态管理逻辑
 */
export interface UseWatchlistDataOptions {
  // 是否启用实时数据订阅
  enableRealtime?: boolean;
  // 实时数据更新间隔（毫秒）
  realtimeInterval?: number;
  // 是否自动同步
  autoSync?: boolean;
  // 同步间隔（毫秒）
  syncInterval?: number;
}

export interface WatchlistData {
  items: WatchlistItem[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  // 实时数据状态
  isRealtimeConnected: boolean;
  // 同步状态
  isSyncing: boolean;
  syncProgress: number;
  // 操作方法
  refresh: () => Promise<void>;
  addItem: (stockCode: string, stockName: string) => Promise<string>;
  removeItem: (stockCode: string) => Promise<string>;
  updateItem: (stockCode: string, updates: Partial<WatchlistItem>) => Promise<void>;
  reorderItems: (newOrder: string[]) => void;
}

/**
 * 价格变化检测器
 * 用于检测价格跳变并触发动画
 */
class PriceChangeDetector {
  private previousPrices: Map<string, number> = new Map();
  private changeThreshold = 0.01; // 1%变化阈值

  detectChange(stockCode: string, currentPrice: number): boolean {
    const previousPrice = this.previousPrices.get(stockCode);

    if (previousPrice === undefined) {
      this.previousPrices.set(stockCode, currentPrice);
      return false;
    }

    const changePercent = Math.abs((currentPrice - previousPrice) / previousPrice);
    const hasSignificantChange = changePercent >= this.changeThreshold;

    if (hasSignificantChange) {
      this.previousPrices.set(stockCode, currentPrice);
    }

    return hasSignificantChange;
  }

  clear(stockCode?: string) {
    if (stockCode) {
      this.previousPrices.delete(stockCode);
    } else {
      this.previousPrices.clear();
    }
  }
}

export function useWatchlistData(options: UseWatchlistDataOptions = {}): WatchlistData {
  const {
    enableRealtime = true,
    realtimeInterval = 5000,
    autoSync = true,
    syncInterval = 30000,
  } = options;

  // Store状态
  const store = useWatchlistStore();
  const items = store.getFavoriteItems();
  const isLoading = store.isLoading;
  const error = store.error;

  // 本地状态
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  // Refs
  const priceChangeDetectorRef = useRef(new PriceChangeDetector());
  const syncManagerRef = useRef(getDataSyncManager());
  const realtimeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 刷新数据
   */
  const refresh = useCallback(async () => {
    try {
      await store.syncWithServer();
      setLastUpdated(Date.now());
    } catch (error) {
      console.error("Failed to refresh watchlist:", error);
    }
  }, [store]);

  /**
   * 添加自选股
   */
  const addItem = useCallback(async (stockCode: string, stockName: string): Promise<string> => {
    return store.addItemOptimistic(stockCode, stockName);
  }, [store]);

  /**
   * 移除自选股
   */
  const removeItem = useCallback(async (stockCode: string): Promise<string> => {
    return store.removeItemOptimistic(stockCode);
  }, [store]);

  /**
   * 更新自选股
   */
  const updateItem = useCallback(async (stockCode: string, updates: Partial<WatchlistItem>) => {
    store.updateItem(stockCode, updates);
  }, [store]);

  /**
   * 重新排序
   */
  const reorderItems = useCallback((newOrder: string[]) => {
    store.reorderItems(newOrder);
  }, [store]);

  /**
   * 订阅实时价格数据
   */
  const subscribeToRealtimeData = useCallback(() => {
    if (!enableRealtime || items.length === 0) {
      return () => {};
    }

    const symbols = items.map(item => item.stockCode);
    const syncManager = syncManagerRef.current;

    // 订阅WebSocket实时数据
    const subscriptionIds = syncManager.subscribeToRealtimeData(
      symbols,
      (data) => {
        const { symbol, price, change, changePercent } = data;

        // 检测价格跳变
        const hasSignificantChange = priceChangeDetectorRef.current.detectChange(symbol, price);

        // 更新store
        store.updateItemPrice(symbol, {
          currentPrice: price,
          priceChange: change,
          priceChangePercent: changePercent,
        });

        // 如果有显著变化，触发更新事件
        if (hasSignificantChange) {
          setLastUpdated(Date.now());
        }
      }
    );

    setIsRealtimeConnected(true);

    // 清理函数
    return () => {
      subscriptionIds.forEach(id => {
        // 这里需要根据实际WebSocket管理器实现取消订阅
        // 暂时留空，需要与WebSocket管理器集成
      });
      setIsRealtimeConnected(false);
    };
  }, [enableRealtime, items, store]);

  /**
   * 初始化同步管理器
   */
  const initializeSyncManager = useCallback(async () => {
    try {
      const syncManager = syncManagerRef.current;

      // 设置事件监听
      syncManager.on("syncStart", () => {
        setIsSyncing(true);
        setSyncProgress(0);
      });

      syncManager.on("syncProgress", (progress: number) => {
        setSyncProgress(progress);
      });

      syncManager.on("syncComplete", (success: boolean) => {
        setIsSyncing(false);
        if (success) {
          setLastUpdated(Date.now());
        }
      });

      syncManager.on("networkChange", (isOnline: boolean) => {
        console.log(`Network changed: ${isOnline ? "online" : "offline"}`);
      });

      // 初始化
      await syncManager.initialize();
    } catch (error) {
      console.error("Failed to initialize sync manager:", error);
    }
  }, []);

  /**
   * 设置定期同步
   */
  const setupPeriodicSync = useCallback(() => {
    if (!autoSync) {
      return () => {};
    }

    const syncManager = syncManagerRef.current;

    // 立即执行一次同步
    syncManager.sync().catch(console.error);

    // 设置定期同步
    syncTimerRef.current = setInterval(() => {
      syncManager.sync().catch(console.error);
    }, syncInterval);

    // 清理函数
    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [autoSync, syncInterval]);

  /**
   * 设置定期数据更新
   */
  const setupPeriodicDataUpdate = useCallback(() => {
    if (!enableRealtime) {
      return () => {};
    }

    // 模拟定期数据更新（实际应该通过WebSocket）
    realtimeTimerRef.current = setInterval(() => {
      // 这里可以添加模拟数据更新逻辑
      // 实际应用中应该通过WebSocket接收实时数据
    }, realtimeInterval);

    // 清理函数
    return () => {
      if (realtimeTimerRef.current) {
        clearInterval(realtimeTimerRef.current);
        realtimeTimerRef.current = null;
      }
    };
  }, [enableRealtime, realtimeInterval]);

  // 初始化效果
  useEffect(() => {
    initializeSyncManager();
  }, [initializeSyncManager]);

  // 订阅实时数据效果
  useEffect(() => {
    const cleanupRealtime = subscribeToRealtimeData();
    return cleanupRealtime;
  }, [subscribeToRealtimeData]);

  // 设置定期同步效果
  useEffect(() => {
    const cleanupSync = setupPeriodicSync();
    return cleanupSync;
  }, [setupPeriodicSync]);

  // 设置定期数据更新效果
  useEffect(() => {
    const cleanupDataUpdate = setupPeriodicDataUpdate();
    return cleanupDataUpdate;
  }, [setupPeriodicDataUpdate]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (realtimeTimerRef.current) {
        clearInterval(realtimeTimerRef.current);
      }
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
      syncManagerRef.current.cleanup();
    };
  }, []);

  return {
    items,
    isLoading,
    error,
    lastUpdated,
    isRealtimeConnected,
    isSyncing,
    syncProgress,
    refresh,
    addItem,
    removeItem,
    updateItem,
    reorderItems,
  };
}