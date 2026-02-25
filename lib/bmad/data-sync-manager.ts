/**
 * BMAD 数据同步管理器
 * 负责本地优先持久化、离线队列同步、冲突解决
 * 集成IndexedDB和localStorage，支持双向同步
 */

import { getWebSocketManager, WebSocketManager } from './websocket-manager';
import { OfflineQueue, OfflineOperation } from './offline-queue';
import { ThrottleManager } from './throttle-manager';
import { useWatchlistStore, WatchlistItem } from '../store/watchlist-store';

export interface SyncConfig {
  // 存储配置
  storageType: 'indexeddb' | 'localstorage';
  dbName: string;
  storeName: string;
  version: number;

  // 同步配置
  syncInterval: number;
  batchSize: number;
  conflictResolution: 'client_wins' | 'server_wins' | 'timestamp';
  maxRetries: number;

  // 网络检测
  networkCheckInterval: number;
  offlineTimeout: number;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
  pendingOperations: number;
  failedOperations: number;
  syncProgress: number;
}

export interface Conflict {
  localData: any;
  serverData: any;
  timestamp: number;
  resolved: boolean;
  resolution?: 'local' | 'server' | 'merged';
}

export class DataSyncManager {
  private config: SyncConfig;
  private wsManager: WebSocketManager;
  private offlineQueue: OfflineQueue;
  private throttleManager: ThrottleManager;
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private syncTimer: NodeJS.Timeout | null = null;
  private networkCheckTimer: NodeJS.Timeout | null = null;
  private isOnline = navigator.onLine;

  // 状态
  private status: SyncStatus = {
    isOnline: this.isOnline,
    isSyncing: false,
    lastSyncTime: null,
    pendingOperations: 0,
    failedOperations: 0,
    syncProgress: 0,
  };

  // 事件监听器
  private listeners = {
    syncStart: [] as (() => void)[],
    syncComplete: [] as ((success: boolean) => void)[],
    syncProgress: [] as ((progress: number) => void)[],
    conflictDetected: [] as ((conflict: Conflict) => void)[],
    networkChange: [] as ((isOnline: boolean) => void)[],
    error: [] as ((error: Error) => void)[],
  };

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = {
      storageType: config.storageType || 'indexeddb',
      dbName: config.dbName || 'alpha-quant-watchlist',
      storeName: config.storeName || 'watchlist',
      version: config.version || 1,
      syncInterval: config.syncInterval || 30000, // 30秒
      batchSize: config.batchSize || 50,
      conflictResolution: config.conflictResolution || 'timestamp',
      maxRetries: config.maxRetries || 3,
      networkCheckInterval: config.networkCheckInterval || 5000, // 5秒
      offlineTimeout: config.offlineTimeout || 10000, // 10秒
    };

    this.wsManager = getWebSocketManager();
    this.offlineQueue = new OfflineQueue();
    this.throttleManager = new ThrottleManager();

    this.setupNetworkMonitoring();
  }

  /**
   * 初始化同步管理器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 初始化存储
      await this.initStorage();

      // 初始化离线队列
      await this.offlineQueue.initialize();

      // 加载本地数据到store
      await this.loadLocalData();

      // 开始定期同步
      this.startPeriodicSync();

      this.isInitialized = true;
      console.log('DataSyncManager initialized');
    } catch (error) {
      console.error('Failed to initialize DataSyncManager:', error);
      throw error;
    }
  }

  /**
   * 同步数据（手动触发）
   */
  async sync(force = false): Promise<boolean> {
    if (this.status.isSyncing && !force) {
      console.log('Sync already in progress');
      return false;
    }

    this.status.isSyncing = true;
    this.status.syncProgress = 0;
    this.emit('syncStart');

    try {
      // 步骤1: 处理离线队列
      await this.processOfflineQueue();

      // 步骤2: 从服务器拉取最新数据
      await this.pullFromServer();

      // 步骤3: 推送本地变更到服务器
      await this.pushToServer();

      // 步骤4: 解决冲突
      await this.resolveConflicts();

      this.status.lastSyncTime = Date.now();
      this.status.isSyncing = false;
      this.status.syncProgress = 100;
      this.emit('syncComplete', true);

      return true;
    } catch (error) {
      console.error('Sync failed:', error);
      this.status.isSyncing = false;
      this.status.failedOperations++;
      this.emit('syncComplete', false);
      this.emit('error', error instanceof Error ? error : new Error('Sync failed'));

      return false;
    }
  }

  /**
   * 获取同步状态
   */
  getStatus(): SyncStatus {
    return { ...this.status };
  }

  /**
   * 添加数据变更（自动排队和同步）
   */
  async addChange(
    operation: 'create' | 'update' | 'delete',
    data: any,
    metadata?: Record<string, any>
  ): Promise<string> {
    const changeId = `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 立即更新本地存储（乐观更新）
    await this.applyLocalChange(operation, data);

    // 添加到离线队列
    const operationData: OfflineOperation = {
      id: changeId,
      type: operation,
      data,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        localVersion: this.getLocalVersion(),
      },
      timestamp: Date.now(),
      retryCount: 0,
    };

    await this.offlineQueue.addOperation(operationData);
    this.status.pendingOperations++;

    // 如果在线，立即尝试同步
    if (this.isOnline) {
      this.throttleManager.throttle('sync', () => {
        this.sync().catch(console.error);
      }, 1000); // 1秒防抖
    }

    return changeId;
  }

  /**
   * 订阅实时数据更新
   */
  subscribeToRealtimeData(symbols: string[], callback: (data: any) => void): string[] {
    return this.wsManager.batchSubscribe(
      symbols,
      ['price', 'volume'],
      (symbol, data) => {
        // 更新本地存储
        this.updateLocalPriceData(symbol, data).catch(console.error);

        // 调用回调
        callback(data);
      }
    );
  }

  /**
   * 事件监听
   */
  on(event: 'syncStart', listener: () => void): void;
  on(event: 'syncComplete', listener: (success: boolean) => void): void;
  on(event: 'syncProgress', listener: (progress: number) => void): void;
  on(event: 'conflictDetected', listener: (conflict: Conflict) => void): void;
  on(event: 'networkChange', listener: (isOnline: boolean) => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  on(event: string, listener: any): void {
    if (this.listeners[event as keyof typeof this.listeners]) {
      this.listeners[event as keyof typeof this.listeners].push(listener);
    }
  }

  /**
   * 移除事件监听
   */
  off(event: string, listener: any): void {
    if (this.listeners[event as keyof typeof this.listeners]) {
      const index = this.listeners[event as keyof typeof this.listeners].indexOf(listener);
      if (index > -1) {
        this.listeners[event as keyof typeof this.listeners].splice(index, 1);
      }
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    if (this.networkCheckTimer) {
      clearInterval(this.networkCheckTimer);
      this.networkCheckTimer = null;
    }

    this.wsManager.disconnect();
  }

  /**
   * 私有方法
   */
  private async initStorage(): Promise<void> {
    if (this.config.storageType === 'indexeddb') {
      await this.initIndexedDB();
    } else {
      await this.initLocalStorage();
    }
  }

  private async initIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.version);

      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建对象存储
        if (!db.objectStoreNames.contains(this.config.storeName)) {
          const store = db.createObjectStore(this.config.storeName, { keyPath: 'id' });
          store.createIndex('stockCode', 'stockCode', { unique: true });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('syncStatus', 'syncStatus', { unique: false });
        }

        // 创建冲突存储
        if (!db.objectStoreNames.contains('conflicts')) {
          const conflictStore = db.createObjectStore('conflicts', { keyPath: 'id' });
          conflictStore.createIndex('timestamp', 'timestamp', { unique: false });
          conflictStore.createIndex('resolved', 'resolved', { unique: false });
        }
      };
    });
  }

  private async initLocalStorage(): Promise<void> {
    // localStorage不需要特殊初始化
    console.log('Using localStorage for persistence');
  }

  private async loadLocalData(): Promise<void> {
    const store = useWatchlistStore.getState();

    try {
      const items = await this.getAllLocalItems();

      // 批量更新store
      // 注意：这里需要根据实际store API调整
      items.forEach(item => {
        // 这里需要根据实际store结构更新
        // 暂时留空，需要与store集成
      });

      console.log(`Loaded ${items.length} items from local storage`);
    } catch (error) {
      console.error('Failed to load local data:', error);
    }
  }

  private async getAllLocalItems(): Promise<WatchlistItem[]> {
    if (this.config.storageType === 'indexeddb' && this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.config.storeName], 'readonly');
        const store = transaction.objectStore(this.config.storeName);
        const request = store.getAll();

        request.onerror = () => reject(new Error('Failed to get items from IndexedDB'));
        request.onsuccess = () => resolve(request.result || []);
      });
    } else {
      // localStorage实现
      const data = localStorage.getItem(this.config.dbName);
      return data ? JSON.parse(data).items || [] : [];
    }
  }

  private async processOfflineQueue(): Promise<void> {
    const operations = await this.offlineQueue.getPendingOperations();

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];

      try {
        await this.syncOperationToServer(operation);
        await this.offlineQueue.markOperationComplete(operation.id);
        this.status.pendingOperations--;

        // 更新进度
        this.status.syncProgress = Math.floor((i + 1) / operations.length * 50); // 占50%进度
        this.emit('syncProgress', this.status.syncProgress);
      } catch (error) {
        console.error(`Failed to sync operation ${operation.id}:`, error);

        if (operation.retryCount >= this.config.maxRetries) {
          await this.offlineQueue.markOperationFailed(operation.id, error instanceof Error ? error.message : 'Unknown error');
          this.status.failedOperations++;
        } else {
          await this.offlineQueue.retryOperation(operation.id);
        }
      }
    }
  }

  private async pullFromServer(): Promise<void> {
    try {
      const response = await fetch('/api/watchlist');
      if (!response.ok) throw new Error(`Server returned ${response.status}`);

      const data = await response.json();

      if (data.success && data.watchlist) {
        // 处理服务器数据
        await this.mergeServerData(data.watchlist);

        // 更新进度
        this.status.syncProgress = 75;
        this.emit('syncProgress', this.status.syncProgress);
      }
    } catch (error) {
      console.error('Failed to pull from server:', error);
      throw error;
    }
  }

  private async pushToServer(): Promise<void> {
    // 获取需要同步的本地变更
    const localChanges = await this.getLocalChanges();

    for (const change of localChanges) {
      try {
        await this.syncChangeToServer(change);

        // 标记为已同步
        await this.markChangeAsSynced(change.id);
      } catch (error) {
        console.error(`Failed to push change ${change.id}:`, error);
        throw error;
      }
    }

    // 更新进度
    this.status.syncProgress = 90;
    this.emit('syncProgress', this.status.syncProgress);
  }

  private async resolveConflicts(): Promise<void> {
    const conflicts = await this.getConflicts();

    for (const conflict of conflicts) {
      try {
        const resolution = await this.resolveConflict(conflict);

        if (resolution) {
          await this.applyConflictResolution(conflict.id, resolution);
          await this.markConflictAsResolved(conflict.id);
        }
      } catch (error) {
        console.error(`Failed to resolve conflict ${conflict.id}:`, error);
      }
    }
  }

  private async syncOperationToServer(operation: OfflineOperation): Promise<void> {
    const { type, data } = operation;

    let url = '/api/watchlist';
    let method = 'POST';
    let body: any;

    switch (type) {
      case 'create':
        method = 'POST';
        body = data;
        break;
      case 'update':
        method = 'PUT';
        body = { id: data.id, ...data };
        break;
      case 'delete':
        method = 'DELETE';
        url = `/api/watchlist?id=${data.id}`;
        break;
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      ...(method !== 'DELETE' && { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
  }

  private async syncChangeToServer(change: any): Promise<void> {
    // 实现具体的服务器同步逻辑
    // 这里需要根据实际API调整
  }

  private async applyLocalChange(operation: 'create' | 'update' | 'delete', data: any): Promise<void> {
    // 应用变更到本地存储
    if (this.config.storageType === 'indexeddb' && this.db) {
      const transaction = this.db.transaction([this.config.storeName], 'readwrite');
      const store = transaction.objectStore(this.config.storeName);

      switch (operation) {
        case 'create':
        case 'update':
          store.put({
            ...data,
            syncStatus: 'pending',
            localVersion: this.getLocalVersion(),
            updatedAt: Date.now(),
          });
          break;
        case 'delete':
          store.delete(data.id);
          break;
      }
    } else {
      // localStorage实现
      const currentData = JSON.parse(localStorage.getItem(this.config.dbName) || '{"items":[]}');

      switch (operation) {
        case 'create':
          currentData.items.push({
            ...data,
            syncStatus: 'pending',
            localVersion: this.getLocalVersion(),
            updatedAt: Date.now(),
          });
          break;
        case 'update':
          const index = currentData.items.findIndex((item: any) => item.id === data.id);
          if (index !== -1) {
            currentData.items[index] = {
              ...currentData.items[index],
              ...data,
              syncStatus: 'pending',
              localVersion: this.getLocalVersion(),
              updatedAt: Date.now(),
            };
          }
          break;
        case 'delete':
          currentData.items = currentData.items.filter((item: any) => item.id !== data.id);
          break;
      }

      localStorage.setItem(this.config.dbName, JSON.stringify(currentData));
    }
  }

  private async updateLocalPriceData(symbol: string, priceData: any): Promise<void> {
    // 更新本地价格数据
    const store = useWatchlistStore.getState();
    const item = store.getItem(symbol);

    if (item) {
      store.updateItemPrice(symbol, {
        currentPrice: priceData.price,
        priceChange: priceData.change,
        priceChangePercent: priceData.changePercent,
      });
    }
  }

  private async mergeServerData(serverItems: any[]): Promise<void> {
    // 合并服务器数据到本地
    // 实现冲突检测和合并逻辑
  }

  private async getLocalChanges(): Promise<any[]> {
    // 获取需要同步的本地变更
    return [];
  }

  private async markChangeAsSynced(changeId: string): Promise<void> {
    // 标记变更已同步
  }

  private async getConflicts(): Promise<Conflict[]> {
    // 获取冲突列表
    return [];
  }

  private async resolveConflict(conflict: Conflict): Promise<'local' | 'server' | 'merged' | null> {
    // 根据配置解决冲突
    this.emit('conflictDetected', conflict);

    switch (this.config.conflictResolution) {
      case 'client_wins':
        return 'local';
      case 'server_wins':
        return 'server';
      case 'timestamp':
        return conflict.localData.timestamp > conflict.serverData.timestamp ? 'local' : 'server';
      default:
        return null;
    }
  }

  private async applyConflictResolution(conflictId: string, resolution: 'local' | 'server' | 'merged'): Promise<void> {
    // 应用冲突解决方案
  }

  private async markConflictAsResolved(conflictId: string): Promise<void> {
    // 标记冲突已解决
  }

  private getLocalVersion(): string {
    return `v${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      if (this.isOnline && !this.status.isSyncing) {
        this.sync().catch(console.error);
      }
    }, this.config.syncInterval);
  }

  private setupNetworkMonitoring(): void {
    // 监听网络状态变化
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));

    // 定期检查网络状态
    this.networkCheckTimer = setInterval(() => {
      const wasOnline = this.isOnline;
      this.isOnline = navigator.onLine;

      if (wasOnline !== this.isOnline) {
        this.handleNetworkChange(this.isOnline);
      }
    }, this.config.networkCheckInterval);
  }

  private handleNetworkChange(isOnline: boolean): void {
    this.isOnline = isOnline;
    this.status.isOnline = isOnline;

    this.emit('networkChange', isOnline);

    if (isOnline) {
      // 网络恢复，立即同步
      this.throttleManager.throttle('network-recovery-sync', () => {
        this.sync().catch(console.error);
      }, 2000); // 2秒后同步
    }
  }

  private emit(event: 'syncStart'): void;
  private emit(event: 'syncComplete', success: boolean): void;
  private emit(event: 'syncProgress', progress: number): void;
  private emit(event: 'conflictDetected', conflict: Conflict): void;
  private emit(event: 'networkChange', isOnline: boolean): void;
  private emit(event: 'error', error: Error): void;
  private emit(event: string, ...args: any[]): void {
    if (this.listeners[event as keyof typeof this.listeners]) {
      for (const listener of this.listeners[event as keyof typeof this.listeners]) {
        try {
          (listener as any)(...args);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      }
    }
  }
}

// 单例实例
let globalDataSyncManager: DataSyncManager | null = null;

export function getDataSyncManager(config?: Partial<SyncConfig>): DataSyncManager {
  if (!globalDataSyncManager) {
    globalDataSyncManager = new DataSyncManager(config);
  }
  return globalDataSyncManager;
}