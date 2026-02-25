/**
 * BMAD 集成示例
 * 展示如何将BMAD组件与现有watchlist store集成
 */

import { getDataSyncManager } from './data-sync-manager';
import { getOfflineQueue } from './offline-queue';
import { getThrottleManager } from './throttle-manager';
import { useBMADSubscription, useWatchlistSubscription } from '../hooks/useBMADSubscription';
import { useWatchlistStore, WatchlistItem } from '../store/watchlist-store';
import { DEFAULT_BMAD_CONFIG } from './types';

/**
 * 初始化BMAD系统
 */
export async function initializeBMADSystem(): Promise<void> {
  console.log('Initializing BMAD system...');

  try {
    // 1. 初始化DataSyncManager
    const dataSyncManager = getDataSyncManager(DEFAULT_BMAD_CONFIG.sync);
    await dataSyncManager.initialize();

    // 2. 初始化OfflineQueue
    const offlineQueue = getOfflineQueue(DEFAULT_BMAD_CONFIG.queue);
    await offlineQueue.initialize();

    // 3. 设置事件监听
    setupEventListeners(dataSyncManager, offlineQueue);

    console.log('BMAD system initialized successfully');
  } catch (error) {
    console.error('Failed to initialize BMAD system:', error);
    throw error;
  }
}

/**
 * 设置事件监听器
 */
function setupEventListeners(
  dataSyncManager: ReturnType<typeof getDataSyncManager>,
  offlineQueue: ReturnType<typeof getOfflineQueue>
): void {
  // 数据同步事件
  dataSyncManager.on('syncStart', () => {
    console.log('Sync started');
  });

  dataSyncManager.on('syncComplete', (success) => {
    console.log(`Sync completed: ${success ? 'success' : 'failed'}`);
  });

  dataSyncManager.on('networkChange', (isOnline) => {
    console.log(`Network changed: ${isOnline ? 'online' : 'offline'}`);
  });

  dataSyncManager.on('error', (error) => {
    console.error('DataSyncManager error:', error);
  });

  // 离线队列事件
  offlineQueue.on('operationAdded', (operation) => {
    console.log(`Operation added to queue: ${operation.type} ${operation.id}`);
  });

  offlineQueue.on('operationCompleted', (operationId) => {
    console.log(`Operation completed: ${operationId}`);
  });

  offlineQueue.on('operationFailed', (operationId, error) => {
    console.error(`Operation failed: ${operationId}`, error);
  });
}

/**
 * 集成示例：将watchlist store操作与BMAD同步
 */
export function createBMADIntegratedWatchlistStore() {
  const store = useWatchlistStore.getState();
  const dataSyncManager = getDataSyncManager();

  return {
    /**
     * 添加股票到自选股（集成BMAD）
     */
    async addStockWithBMAD(stockCode: string, stockName: string, itemData?: Partial<WatchlistItem>): Promise<string> {
      // 1. 开始状态机事务
      const transactionId = store.startToggleTransaction(stockCode, stockName, 'ADD');

      // 2. 通过BMAD添加变更
      const changeId = await dataSyncManager.addChange('create', {
        stockCode,
        stockName,
        ...itemData,
        isFavorite: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }, {
        transactionId,
        source: 'watchlist_add',
      });

      console.log(`Stock added with BMAD: ${stockCode}, changeId: ${changeId}, transactionId: ${transactionId}`);

      return transactionId;
    },

    /**
     * 从自选股移除股票（集成BMAD）
     */
    async removeStockWithBMAD(stockCode: string): Promise<string> {
      const item = store.getItem(stockCode);
      if (!item) throw new Error(`Stock ${stockCode} not found in watchlist`);

      // 1. 开始状态机事务
      const transactionId = store.startToggleTransaction(stockCode, item.stockName, 'REMOVE');

      // 2. 通过BMAD添加删除变更
      const changeId = await dataSyncManager.addChange('delete', {
        id: item.id,
        stockCode,
      }, {
        transactionId,
        source: 'watchlist_remove',
      });

      console.log(`Stock removed with BMAD: ${stockCode}, changeId: ${changeId}, transactionId: ${transactionId}`);

      return transactionId;
    },

    /**
     * 更新股票信息（集成BMAD）
     */
    async updateStockWithBMAD(stockCode: string, updates: Partial<WatchlistItem>): Promise<string> {
      const item = store.getItem(stockCode);
      if (!item) throw new Error(`Stock ${stockCode} not found in watchlist`);

      // 1. 更新本地store
      store.updateItem(stockCode, updates);

      // 2. 通过BMAD添加更新变更
      const changeId = await dataSyncManager.addChange('update', {
        id: item.id,
        stockCode,
        ...updates,
        updatedAt: new Date(),
      }, {
        source: 'watchlist_update',
      });

      console.log(`Stock updated with BMAD: ${stockCode}, changeId: ${changeId}`);

      return changeId;
    },

    /**
     * 手动同步数据
     */
    async syncWithBMAD(): Promise<boolean> {
      console.log('Manual sync triggered');
      return await dataSyncManager.sync(true);
    },

    /**
     * 获取BMAD状态
     */
    getBMADStatus() {
      return dataSyncManager.getStatus();
    },
  };
}

/**
 * React组件集成示例
 */
export function BMADIntegrationExample() {
  // 使用watchlist订阅hook
  const {
    isConnected,
    isSyncing,
    data,
    syncStatus,
    refresh,
    subscribe,
    unsubscribe,
  } = useWatchlistSubscription({
    throttleMode: 'raf',
    updateLocalStore: true,
    onDataUpdate: (symbol, stockData) => {
      console.log(`Stock data updated: ${symbol}`, stockData);
    },
    onSyncStatusChange: (status) => {
      console.log('Sync status changed:', status);
    },
    onError: (error) => {
      console.error('BMAD subscription error:', error);
    },
  });

  // 获取store状态
  const store = useWatchlistStore();
  const favoriteItems = store.getFavoriteItems();

  return {
    // BMAD状态
    bmadStatus: {
      isConnected,
      isSyncing,
      syncStatus,
      subscribedSymbols: favoriteItems.map(item => item.stockCode),
      lastUpdateTime: syncStatus?.lastSyncTime || null,
    },

    // 数据
    stockData: data,
    watchlistItems: favoriteItems,

    // 操作方法
    refreshData: refresh,
    subscribeToStock: subscribe,
    unsubscribeFromStock: unsubscribe,

    // Store集成方法
    addStock: (stockCode: string, stockName: string) => {
      const integratedStore = createBMADIntegratedWatchlistStore();
      return integratedStore.addStockWithBMAD(stockCode, stockName);
    },

    removeStock: (stockCode: string) => {
      const integratedStore = createBMADIntegratedWatchlistStore();
      return integratedStore.removeStockWithBMAD(stockCode);
    },

    updateStock: (stockCode: string, updates: Partial<WatchlistItem>) => {
      const integratedStore = createBMADIntegratedWatchlistStore();
      return integratedStore.updateStockWithBMAD(stockCode, updates);
    },

    manualSync: () => {
      const integratedStore = createBMADIntegratedWatchlistStore();
      return integratedStore.syncWithBMAD();
    },
  };
}

/**
 * 初始化函数，应在应用启动时调用
 */
export async function setupBMADIntegration(): Promise<void> {
  try {
    // 初始化BMAD系统
    await initializeBMADSystem();

    // 创建集成store
    const integratedStore = createBMADIntegratedWatchlistStore();

    // 监听网络状态变化
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('Network restored, triggering sync...');
        integratedStore.syncWithBMAD().catch(console.error);
      });

      window.addEventListener('offline', () => {
        console.log('Network lost, operations will be queued');
      });
    }

    console.log('BMAD integration setup complete');
  } catch (error) {
    console.error('Failed to setup BMAD integration:', error);
    throw error;
  }
}

/**
 * 工具函数：将store操作包装为BMAD集成操作
 */
export function withBMADIntegration<T extends Record<string, (...args: any[]) => any>>(
  storeMethods: T
): T & {
  bmad: ReturnType<typeof createBMADIntegratedWatchlistStore>;
} {
  const bmadStore = createBMADIntegratedWatchlistStore();

  return {
    ...storeMethods,
    bmad: bmadStore,
  };
}