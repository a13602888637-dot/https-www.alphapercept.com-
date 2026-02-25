/**
 * BMAD 类型定义
 * 双向多智能体数据并发协议类型
 */

// ==================== WebSocket 类型 ====================
export interface WebSocketMessage {
  type: 'price_update' | 'volume_update' | 'order_book' | 'trade' | 'heartbeat' | 'error' | 'subscribe' | 'unsubscribe';
  payload: any;
  timestamp: number;
  channel?: string;
}

export interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  timeout: number;
}

export interface Subscription {
  id: string;
  symbol: string;
  channels: string[];
  callback: (data: any) => void;
  lastActivity: number;
}

// ==================== 数据同步 类型 ====================
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

// ==================== 离线队列 类型 ====================
export interface OfflineOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  data: any;
  metadata?: Record<string, any>;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  lastAttempt?: number;
}

export interface QueueConfig {
  maxQueueSize: number;
  maxRetries: number;
  retryDelay: number;
  cleanupInterval: number;
  maxOperationAge: number;
  deduplicationWindow: number;
}

// ==================== 节流防抖 类型 ====================
export interface ThrottleConfig {
  mode: 'throttle' | 'debounce' | 'raf';
  delay: number;
  maxWait?: number;
  leading: boolean;
  trailing: boolean;
}

export interface ThrottleInstance {
  id: string;
  callback: (...args: any[]) => void;
  config: ThrottleConfig;
  lastCallTime: number;
  lastExecutionTime: number;
  timeoutId: NodeJS.Timeout | null;
  rafId: number | null;
  pendingArgs: any[] | null;
  isPending: boolean;
}

// ==================== React Hook 类型 ====================
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

// ==================== 股票数据 类型 ====================
export interface StockPriceUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  timestamp: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
}

export interface StockVolumeUpdate {
  symbol: string;
  volume: number;
  timestamp: number;
  averageVolume?: number;
}

export interface StockOrderBook {
  symbol: string;
  bids: Array<{ price: number; quantity: number }>;
  asks: Array<{ price: number; quantity: number }>;
  timestamp: number;
}

// ==================== 事件 类型 ====================
export type BMADEvent =
  | { type: 'CONNECTED' }
  | { type: 'DISCONNECTED'; reason: string }
  | { type: 'SYNC_STARTED' }
  | { type: 'SYNC_COMPLETED'; success: boolean }
  | { type: 'SYNC_PROGRESS'; progress: number }
  | { type: 'DATA_UPDATED'; symbol: string; data: any }
  | { type: 'NETWORK_CHANGED'; isOnline: boolean }
  | { type: 'ERROR'; error: Error }
  | { type: 'CONFLICT_DETECTED'; conflict: Conflict }
  | { type: 'OFFLINE_OPERATION_ADDED'; operation: OfflineOperation }
  | { type: 'OFFLINE_OPERATION_COMPLETED'; operationId: string }
  | { type: 'OFFLINE_OPERATION_FAILED'; operationId: string; error: string };

// ==================== 配置 类型 ====================
export interface BMADGlobalConfig {
  websocket: Partial<WebSocketConfig>;
  sync: Partial<SyncConfig>;
  queue: Partial<QueueConfig>;
  throttle: Partial<ThrottleConfig>;
}

// 默认配置
export const DEFAULT_BMAD_CONFIG: BMADGlobalConfig = {
  websocket: {
    url: typeof window !== 'undefined' ? `ws://${window.location.host}/api/websocket` : '',
    reconnectInterval: 3000,
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000,
    timeout: 10000,
  },
  sync: {
    storageType: 'indexeddb',
    dbName: 'alpha-quant-watchlist',
    storeName: 'watchlist',
    version: 1,
    syncInterval: 30000,
    batchSize: 50,
    conflictResolution: 'timestamp',
    maxRetries: 3,
    networkCheckInterval: 5000,
    offlineTimeout: 10000,
  },
  queue: {
    maxQueueSize: 1000,
    maxRetries: 3,
    retryDelay: 5000,
    cleanupInterval: 60000,
    maxOperationAge: 7 * 24 * 60 * 60 * 1000, // 7天
    deduplicationWindow: 5000,
  },
  throttle: {
    mode: 'raf',
    delay: 16,
    leading: true,
    trailing: true,
  },
};