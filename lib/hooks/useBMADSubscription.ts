/**
 * BMAD 订阅Hook
 * 用于React组件订阅实时数据，自动管理订阅生命周期
 * 集成节流防抖，避免组件掉帧
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { getDataSyncManager, SyncStatus } from '../bmad/data-sync-manager';
import { getThrottleManager, createRafThrottle } from '../bmad/throttle-manager';
import { useWatchlistStore, WatchlistItem } from '../store/watchlist-store';

export interface UseBMADSubscriptionOptions {
  // 订阅配置
  symbols?: string[];
  autoSubscribe?: boolean;
  throttleMode?: 'raf' | 'throttle' | 'debounce';
  throttleDelay?: number;

  // 数据更新配置
  updateLocalStore?: boolean;
  onDataUpdate?: (symbol: string, data: any) => void;
  onSyncStatusChange?: (status: SyncStatus) => void;

  // 错误处理
  onError?: (error: Error) => void;
}

export interface BMADSubscriptionState {
  // 数据状态
  isConnected: boolean;
  isSyncing: boolean;
  lastUpdateTime: number | null;
  subscribedSymbols: string[];
  data: Record<string, any>;

  // 同步状态
  syncStatus: SyncStatus | null;
  pendingOperations: number;
  failedOperations: number;

  // 控制方法
  subscribe: (symbols: string[]) => void;
  unsubscribe: (symbols?: string[]) => void;
  refresh: () => Promise<void>;
  cleanup: () => void;
}

/**
 * BMAD订阅Hook
 */
export function useBMADSubscription(
  options: UseBMADSubscriptionOptions = {}
): BMADSubscriptionState {
  const {
    symbols: initialSymbols = [],
    autoSubscribe = true,
    throttleMode = 'raf',
    throttleDelay = 16,
    updateLocalStore = true,
    onDataUpdate,
    onSyncStatusChange,
    onError,
  } = options;

  // 状态
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number | null>(null);
  const [subscribedSymbols, setSubscribedSymbols] = useState<string[]>(initialSymbols);
  const [data, setData] = useState<Record<string, any>>({});
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [pendingOperations, setPendingOperations] = useState(0);
  const [failedOperations, setFailedOperations] = useState(0);

  // Refs
  const subscriptionIdsRef = useRef<string[]>([]);
  const dataSyncManagerRef = useRef(getDataSyncManager());
  const throttleManagerRef = useRef(getThrottleManager());
  const isMountedRef = useRef(true);
  const store = useWatchlistStore();

  // 节流更新函数
  const throttledSetData = useCallback(
    createRafThrottle((newData: Record<string, any>) => {
      if (!isMountedRef.current) return;
      setData(prev => ({ ...prev, ...newData }));
      setLastUpdateTime(Date.now());
    }),
    []
  );

  // 处理数据更新
  const handleDataUpdate = useCallback(
    (symbol: string, updateData: any) => {
      if (!isMountedRef.current) return;

      // 更新本地状态
      const newData = { [symbol]: updateData };
      throttledSetData(newData);

      // 更新本地store（如果启用）
      if (updateLocalStore) {
        const item = store.getItem(symbol);
        if (item && updateData.price) {
          store.updateItemPrice(symbol, {
            currentPrice: updateData.price,
            priceChange: updateData.change || 0,
            priceChangePercent: updateData.changePercent || 0,
          });
        }
      }

      // 调用用户回调
      if (onDataUpdate) {
        try {
          onDataUpdate(symbol, updateData);
        } catch (error) {
          console.error('Error in onDataUpdate callback:', error);
        }
      }
    },
    [throttledSetData, updateLocalStore, store, onDataUpdate]
  );

  // 处理同步状态更新
  const handleSyncStatusChange = useCallback(
    (status: SyncStatus) => {
      if (!isMountedRef.current) return;

      setSyncStatus(status);
      setIsSyncing(status.isSyncing);
      setPendingOperations(status.pendingOperations);
      setFailedOperations(status.failedOperations);

      if (onSyncStatusChange) {
        try {
          onSyncStatusChange(status);
        } catch (error) {
          console.error('Error in onSyncStatusChange callback:', error);
        }
      }
    },
    [onSyncStatusChange]
  );

  // 订阅股票数据
  const subscribe = useCallback(
    (symbols: string[]) => {
      if (!isMountedRef.current) return;

      // 去重
      const newSymbols = [...new Set([...subscribedSymbols, ...symbols])];
      setSubscribedSymbols(newSymbols);

      // 通过DataSyncManager订阅
      const subscriptionIds = dataSyncManagerRef.current.subscribeToRealtimeData(
        symbols,
        (updateData) => {
          // updateData应该包含symbol信息
          const symbol = updateData.symbol || symbols[0]; // 简化处理
          handleDataUpdate(symbol, updateData);
        }
      );

      subscriptionIdsRef.current.push(...subscriptionIds);
    },
    [subscribedSymbols, handleDataUpdate]
  );

  // 取消订阅
  const unsubscribe = useCallback(
    (symbols?: string[]) => {
      if (!isMountedRef.current) return;

      if (symbols) {
        // 取消订阅指定symbols
        const newSubscribedSymbols = subscribedSymbols.filter(s => !symbols.includes(s));
        setSubscribedSymbols(newSubscribedSymbols);

        // 这里需要实现具体的取消订阅逻辑
        // 目前DataSyncManager没有提供取消订阅的方法
      } else {
        // 取消所有订阅
        setSubscribedSymbols([]);
        subscriptionIdsRef.current = [];
      }
    },
    [subscribedSymbols]
  );

  // 刷新数据
  const refresh = useCallback(async (): Promise<void> => {
    if (!isMountedRef.current) return;

    setIsSyncing(true);
    try {
      await dataSyncManagerRef.current.sync(true);
    } catch (error) {
      console.error('Failed to refresh data:', error);
      if (onError) {
        onError(error instanceof Error ? error : new Error('Refresh failed'));
      }
    } finally {
      setIsSyncing(false);
    }
  }, [onError]);

  // 清理资源
  const cleanup = useCallback(() => {
    if (!isMountedRef.current) return;

    // 取消所有订阅
    unsubscribe();

    // 清理DataSyncManager
    dataSyncManagerRef.current.cleanup();

    // 清理ThrottleManager
    throttleManagerRef.current.cleanupAll();
  }, [unsubscribe]);

  // 初始化
  useEffect(() => {
    isMountedRef.current = true;

    // 初始化DataSyncManager
    const initDataSyncManager = async () => {
      try {
        await dataSyncManagerRef.current.initialize();

        // 监听同步状态变化
        dataSyncManagerRef.current.on('syncStart', () => {
          if (isMountedRef.current) {
            setIsSyncing(true);
          }
        });

        dataSyncManagerRef.current.on('syncComplete', (success) => {
          if (isMountedRef.current) {
            setIsSyncing(false);
            if (!success) {
              setFailedOperations(prev => prev + 1);
            }
          }
        });

        dataSyncManagerRef.current.on('syncProgress', (progress) => {
          // 可以用于显示进度条
        });

        dataSyncManagerRef.current.on('networkChange', (isOnline) => {
          if (isMountedRef.current) {
            setIsConnected(isOnline);
          }
        });

        dataSyncManagerRef.current.on('error', (error) => {
          console.error('DataSyncManager error:', error);
          if (onError) {
            onError(error);
          }
        });

        // 获取初始状态
        const initialStatus = dataSyncManagerRef.current.getStatus();
        handleSyncStatusChange(initialStatus);
        setIsConnected(initialStatus.isOnline);

        // 自动订阅
        if (autoSubscribe && initialSymbols.length > 0) {
          subscribe(initialSymbols);
        }
      } catch (error) {
        console.error('Failed to initialize DataSyncManager:', error);
        if (onError) {
          onError(error instanceof Error ? error : new Error('Initialization failed'));
        }
      }
    };

    initDataSyncManager();

    // 清理函数
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [autoSubscribe, initialSymbols, handleSyncStatusChange, onError, subscribe, cleanup]);

  // 监听symbols变化
  useEffect(() => {
    if (!isMountedRef.current || !autoSubscribe) return;

    // 如果symbols变化，重新订阅
    if (initialSymbols.length > 0) {
      subscribe(initialSymbols);
    }

    return () => {
      if (initialSymbols.length > 0) {
        unsubscribe(initialSymbols);
      }
    };
  }, [initialSymbols.join(','), autoSubscribe, subscribe, unsubscribe]);

  return {
    // 数据状态
    isConnected,
    isSyncing,
    lastUpdateTime,
    subscribedSymbols,
    data,

    // 同步状态
    syncStatus,
    pendingOperations,
    failedOperations,

    // 控制方法
    subscribe,
    unsubscribe,
    refresh,
    cleanup,
  };
}

/**
 * 简化的Hook：用于订阅单个股票
 */
export function useStockSubscription(
  symbol: string,
  options: Omit<UseBMADSubscriptionOptions, 'symbols'> = {}
) {
  const subscription = useBMADSubscription({
    ...options,
    symbols: [symbol],
  });

  const stockData = subscription.data[symbol] || null;

  return {
    ...subscription,
    stockData,
    symbol,
  };
}

/**
 * 简化的Hook：用于订阅自选股列表
 */
export function useWatchlistSubscription(
  options: Omit<UseBMADSubscriptionOptions, 'symbols'> = {}
) {
  const store = useWatchlistStore();
  const favoriteItems = store.getFavoriteItems();
  const symbols = favoriteItems.map(item => item.stockCode);

  const subscription = useBMADSubscription({
    ...options,
    symbols,
  });

  // 当自选股变化时更新订阅
  useEffect(() => {
    const newSymbols = favoriteItems.map(item => item.stockCode);

    // 取消不再需要的订阅
    const symbolsToUnsubscribe = subscription.subscribedSymbols.filter(
      s => !newSymbols.includes(s)
    );

    if (symbolsToUnsubscribe.length > 0) {
      subscription.unsubscribe(symbolsToUnsubscribe);
    }

    // 订阅新增的股票
    const symbolsToSubscribe = newSymbols.filter(
      s => !subscription.subscribedSymbols.includes(s)
    );

    if (symbolsToSubscribe.length > 0) {
      subscription.subscribe(symbolsToSubscribe);
    }
  }, [favoriteItems, subscription]);

  return {
    ...subscription,
    watchlistItems: favoriteItems,
  };
}