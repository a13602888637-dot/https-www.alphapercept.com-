/**
 * BMAD WebSocket管理器
 * 统一管理实时数据流，解耦静态元数据与高频动态数据
 * 支持多路复用、自动重连、错误处理
 */

export interface WebSocketMessage {
  type: 'price_update' | 'volume_update' | 'order_book' | 'trade' | 'heartbeat' | 'error';
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

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private subscriptions: Map<string, Subscription> = new Map();
  private reconnectAttempts = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isConnected = false;
  private pendingMessages: WebSocketMessage[] = [];
  private connectionPromise: Promise<void> | null = null;

  // 事件监听器
  private listeners = {
    connect: [] as (() => void)[],
    disconnect: [] as ((reason: string) => void)[],
    error: [] as ((error: Error) => void)[],
    message: [] as ((message: WebSocketMessage) => void)[],
  };

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = {
      url: config.url || 'ws://localhost:3000/api/websocket',
      reconnectInterval: config.reconnectInterval || 3000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      heartbeatInterval: config.heartbeatInterval || 30000,
      timeout: config.timeout || 10000,
    };
  }

  /**
   * 连接到WebSocket服务器
   */
  async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url);

        const timeoutId = setTimeout(() => {
          this.ws?.close();
          reject(new Error('WebSocket connection timeout'));
        }, this.config.timeout);

        this.ws.onopen = () => {
          clearTimeout(timeoutId);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.flushPendingMessages();
          this.emit('connect');
          resolve();
        };

        this.ws.onclose = (event) => {
          this.isConnected = false;
          this.stopHeartbeat();
          const reason = event.reason || 'Connection closed';
          this.emit('disconnect', reason);

          // 自动重连
          if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
            setTimeout(() => {
              this.reconnectAttempts++;
              this.connect().catch(console.error);
            }, this.config.reconnectInterval);
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeoutId);
          this.isConnected = false;
          this.emit('error', new Error('WebSocket error'));
          reject(error);
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as WebSocketMessage;
            this.handleMessage(message);
            this.emit('message', message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };
      } catch (error) {
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnected');
      this.ws = null;
    }
    this.isConnected = false;
    this.stopHeartbeat();
    this.connectionPromise = null;
  }

  /**
   * 订阅股票数据
   */
  subscribe(symbol: string, channels: string[], callback: (data: any) => void): string {
    const subscriptionId = `${symbol}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const subscription: Subscription = {
      id: subscriptionId,
      symbol,
      channels,
      callback,
      lastActivity: Date.now(),
    };

    this.subscriptions.set(subscriptionId, subscription);

    // 发送订阅请求
    if (this.isConnected) {
      this.send({
        type: 'subscribe',
        payload: { symbol, channels },
        timestamp: Date.now(),
      });
    }

    return subscriptionId;
  }

  /**
   * 取消订阅
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    if (this.isConnected) {
      this.send({
        type: 'unsubscribe',
        payload: { symbol: subscription.symbol, channels: subscription.channels },
        timestamp: Date.now(),
      });
    }

    this.subscriptions.delete(subscriptionId);
  }

  /**
   * 批量订阅多个股票
   */
  batchSubscribe(symbols: string[], channels: string[], callback: (symbol: string, data: any) => void): string[] {
    return symbols.map(symbol => {
      return this.subscribe(symbol, channels, (data) => callback(symbol, data));
    });
  }

  /**
   * 发送消息
   */
  send(message: WebSocketMessage): void {
    if (!this.isConnected || !this.ws) {
      this.pendingMessages.push(message);
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      this.pendingMessages.push(message);
    }
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(): {
    isConnected: boolean;
    reconnectAttempts: number;
    subscriptionCount: number;
  } {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      subscriptionCount: this.subscriptions.size,
    };
  }

  /**
   * 清理不活跃的订阅
   */
  cleanupInactiveSubscriptions(maxAge: number = 300000): void { // 5分钟
    const now = Date.now();
    for (const [id, subscription] of this.subscriptions.entries()) {
      if (now - subscription.lastActivity > maxAge) {
        this.unsubscribe(id);
      }
    }
  }

  /**
   * 事件监听
   */
  on(event: 'connect', listener: () => void): void;
  on(event: 'disconnect', listener: (reason: string) => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  on(event: 'message', listener: (message: WebSocketMessage) => void): void;
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
   * 私有方法
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({
          type: 'heartbeat',
          payload: { timestamp: Date.now() },
          timestamp: Date.now(),
        });
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private flushPendingMessages(): void {
    while (this.pendingMessages.length > 0 && this.isConnected) {
      const message = this.pendingMessages.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'price_update':
        this.handlePriceUpdate(message.payload);
        break;
      case 'volume_update':
        this.handleVolumeUpdate(message.payload);
        break;
      case 'heartbeat':
        // 心跳响应，更新连接状态
        break;
      case 'error':
        console.error('WebSocket server error:', message.payload);
        this.emit('error', new Error(message.payload.message || 'Server error'));
        break;
      default:
        // 广播给所有订阅者
        this.broadcastToSubscriptions(message);
    }
  }

  private handlePriceUpdate(payload: any): void {
    const { symbol, price, change, changePercent, timestamp } = payload;

    // 更新相关订阅
    for (const subscription of this.subscriptions.values()) {
      if (subscription.symbol === symbol && subscription.channels.includes('price')) {
        subscription.lastActivity = Date.now();
        subscription.callback({
          type: 'price_update',
          symbol,
          price,
          change,
          changePercent,
          timestamp,
        });
      }
    }
  }

  private handleVolumeUpdate(payload: any): void {
    const { symbol, volume, timestamp } = payload;

    for (const subscription of this.subscriptions.values()) {
      if (subscription.symbol === symbol && subscription.channels.includes('volume')) {
        subscription.lastActivity = Date.now();
        subscription.callback({
          type: 'volume_update',
          symbol,
          volume,
          timestamp,
        });
      }
    }
  }

  private broadcastToSubscriptions(message: WebSocketMessage): void {
    for (const subscription of this.subscriptions.values()) {
      subscription.lastActivity = Date.now();
      subscription.callback(message.payload);
    }
  }

  private emit(event: 'connect'): void;
  private emit(event: 'disconnect', reason: string): void;
  private emit(event: 'error', error: Error): void;
  private emit(event: 'message', message: WebSocketMessage): void;
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
let globalWebSocketManager: WebSocketManager | null = null;

export function getWebSocketManager(config?: Partial<WebSocketConfig>): WebSocketManager {
  if (!globalWebSocketManager) {
    globalWebSocketManager = new WebSocketManager(config);
  }
  return globalWebSocketManager;
}