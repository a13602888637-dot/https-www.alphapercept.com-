/**
 * BMAD 离线操作队列
 * 记录离线时的操作，网络恢复后自动同步
 * 支持持久化存储、重试机制、操作去重
 */

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

export class OfflineQueue {
  private config: QueueConfig;
  private queue: OfflineOperation[] = [];
  private isInitialized = false;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private storageKey = 'bmad-offline-queue';

  // 事件监听器
  private listeners = {
    operationAdded: [] as ((operation: OfflineOperation) => void)[],
    operationCompleted: [] as ((operationId: string) => void)[],
    operationFailed: [] as ((operationId: string, error: string) => void)[],
    queueCleaned: [] as ((removedCount: number) => void)[],
  };

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      maxQueueSize: config.maxQueueSize || 1000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 5000, // 5秒
      cleanupInterval: config.cleanupInterval || 60000, // 1分钟
      maxOperationAge: config.maxOperationAge || 7 * 24 * 60 * 60 * 1000, // 7天
      deduplicationWindow: config.deduplicationWindow || 5000, // 5秒
    };
  }

  /**
   * 初始化队列
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 从持久化存储加载队列
      await this.loadFromStorage();

      // 启动清理定时器
      this.startCleanupTimer();

      this.isInitialized = true;
      console.log('OfflineQueue initialized');
    } catch (error) {
      console.error('Failed to initialize OfflineQueue:', error);
      throw error;
    }
  }

  /**
   * 添加操作到队列
   */
  async addOperation(operation: Omit<OfflineOperation, 'status' | 'retryCount'>): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // 检查队列大小
    if (this.queue.length >= this.config.maxQueueSize) {
      throw new Error('Queue is full');
    }

    // 去重检查
    const duplicate = this.findDuplicate(operation);
    if (duplicate) {
      console.log('Duplicate operation detected, merging:', operation.id);
      return duplicate.id;
    }

    const fullOperation: OfflineOperation = {
      ...operation,
      status: 'pending',
      retryCount: 0,
    };

    this.queue.push(fullOperation);
    this.emit('operationAdded', fullOperation);

    // 保存到持久化存储
    await this.saveToStorage();

    return operation.id;
  }

  /**
   * 获取待处理的操作
   */
  getPendingOperations(): OfflineOperation[] {
    return this.queue.filter(op => op.status === 'pending');
  }

  /**
   * 获取可重试的操作
   */
  getRetryableOperations(): OfflineOperation[] {
    const now = Date.now();
    return this.queue.filter(op =>
      op.status === 'failed' &&
      op.retryCount < this.config.maxRetries &&
      (!op.lastAttempt || now - op.lastAttempt >= this.config.retryDelay)
    );
  }

  /**
   * 标记操作为处理中
   */
  async markOperationProcessing(operationId: string): Promise<void> {
    const operation = this.queue.find(op => op.id === operationId);
    if (!operation) return;

    operation.status = 'processing';
    operation.lastAttempt = Date.now();

    await this.saveToStorage();
  }

  /**
   * 标记操作为完成
   */
  async markOperationComplete(operationId: string): Promise<void> {
    const operationIndex = this.queue.findIndex(op => op.id === operationId);
    if (operationIndex === -1) return;

    const operation = this.queue[operationIndex];
    operation.status = 'completed';
    operation.error = undefined;

    this.emit('operationCompleted', operationId);

    // 从队列中移除已完成的旧操作
    this.queue.splice(operationIndex, 1);
    await this.saveToStorage();
  }

  /**
   * 标记操作为失败
   */
  async markOperationFailed(operationId: string, error: string): Promise<void> {
    const operation = this.queue.find(op => op.id === operationId);
    if (!operation) return;

    operation.status = 'failed';
    operation.error = error;
    operation.retryCount++;
    operation.lastAttempt = Date.now();

    this.emit('operationFailed', operationId, error);
    await this.saveToStorage();
  }

  /**
   * 重试操作
   */
  async retryOperation(operationId: string): Promise<void> {
    const operation = this.queue.find(op => op.id === operationId);
    if (!operation) return;

    if (operation.retryCount >= this.config.maxRetries) {
      throw new Error(`Max retries exceeded for operation ${operationId}`);
    }

    operation.status = 'pending';
    await this.saveToStorage();
  }

  /**
   * 获取操作状态
   */
  getOperationStatus(operationId: string): {
    status: OfflineOperation['status'];
    retryCount: number;
    error?: string;
    timestamp: number;
  } | null {
    const operation = this.queue.find(op => op.id === operationId);
    if (!operation) return null;

    return {
      status: operation.status,
      retryCount: operation.retryCount,
      error: operation.error,
      timestamp: operation.timestamp,
    };
  }

  /**
   * 获取队列统计信息
   */
  getQueueStats(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
  } {
    if (this.queue.length === 0) {
      return {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        oldestTimestamp: null,
        newestTimestamp: null,
      };
    }

    const timestamps = this.queue.map(op => op.timestamp);
    const oldest = Math.min(...timestamps);
    const newest = Math.max(...timestamps);

    return {
      total: this.queue.length,
      pending: this.queue.filter(op => op.status === 'pending').length,
      processing: this.queue.filter(op => op.status === 'processing').length,
      completed: this.queue.filter(op => op.status === 'completed').length,
      failed: this.queue.filter(op => op.status === 'failed').length,
      oldestTimestamp: oldest,
      newestTimestamp: newest,
    };
  }

  /**
   * 清理队列
   */
  async cleanup(): Promise<number> {
    const now = Date.now();
    const initialLength = this.queue.length;

    // 移除过期的操作（超过最大年龄）
    this.queue = this.queue.filter(op => {
      // 保留未完成的操作
      if (op.status !== 'completed') return true;

      // 移除过期的已完成操作
      return now - op.timestamp <= this.config.maxOperationAge;
    });

    // 移除超过最大重试次数的失败操作
    this.queue = this.queue.filter(op => {
      if (op.status === 'failed' && op.retryCount >= this.config.maxRetries) {
        return false;
      }
      return true;
    });

    const removedCount = initialLength - this.queue.length;

    if (removedCount > 0) {
      await this.saveToStorage();
      this.emit('queueCleaned', removedCount);
    }

    return removedCount;
  }

  /**
   * 事件监听
   */
  on(event: 'operationAdded', listener: (operation: OfflineOperation) => void): void;
  on(event: 'operationCompleted', listener: (operationId: string) => void): void;
  on(event: 'operationFailed', listener: (operationId: string, error: string) => void): void;
  on(event: 'queueCleaned', listener: (removedCount: number) => void): void;
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
  cleanupResources(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * 私有方法
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        this.queue = parsed.queue || [];
        console.log(`Loaded ${this.queue.length} operations from storage`);
      }
    } catch (error) {
      console.error('Failed to load queue from storage:', error);
      this.queue = [];
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      const data = JSON.stringify({
        queue: this.queue,
        version: '1.0',
        savedAt: Date.now(),
      });
      localStorage.setItem(this.storageKey, data);
    } catch (error) {
      console.error('Failed to save queue to storage:', error);
    }
  }

  private findDuplicate(newOperation: Omit<OfflineOperation, 'status' | 'retryCount'>): OfflineOperation | null {
    const now = Date.now();
    const windowStart = now - this.config.deduplicationWindow;

    // 查找相同类型和数据的最近操作
    for (const operation of this.queue) {
      if (operation.timestamp < windowStart) continue;

      if (
        operation.type === newOperation.type &&
        this.isSameData(operation.data, newOperation.data) &&
        operation.status !== 'completed'
      ) {
        return operation;
      }
    }

    return null;
  }

  private isSameData(data1: any, data2: any): boolean {
    // 简单比较，可以根据需要实现更复杂的比较逻辑
    if (typeof data1 !== typeof data2) return false;

    if (typeof data1 === 'object' && data1 !== null && data2 !== null) {
      const keys1 = Object.keys(data1).sort();
      const keys2 = Object.keys(data2).sort();

      if (keys1.length !== keys2.length) return false;

      for (let i = 0; i < keys1.length; i++) {
        if (keys1[i] !== keys2[i]) return false;

        const key = keys1[i];
        if (!this.isSameData(data1[key], data2[key])) return false;
      }

      return true;
    }

    return data1 === data2;
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(console.error);
    }, this.config.cleanupInterval);
  }

  private emit(event: 'operationAdded', operation: OfflineOperation): void;
  private emit(event: 'operationCompleted', operationId: string): void;
  private emit(event: 'operationFailed', operationId: string, error: string): void;
  private emit(event: 'queueCleaned', removedCount: number): void;
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
let globalOfflineQueue: OfflineQueue | null = null;

export function getOfflineQueue(config?: Partial<QueueConfig>): OfflineQueue {
  if (!globalOfflineQueue) {
    globalOfflineQueue = new OfflineQueue(config);
  }
  return globalOfflineQueue;
}