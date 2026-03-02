/**
 * SSE Stream Manager
 * 管理实时数据流的推送（分级：核心1s，次要10s）
 */

import { DataPoint, MarketDataUpdate, DataSourcePoller } from './types';

export class SSEStreamManager {
  private connections: Map<string, WritableStreamDefaultWriter> = new Map();
  private pollers: Map<string, DataSourcePoller> = new Map();

  /**
   * 数据源配置（分级推送策略）
   */
  private config = {
    // 核心指标：1秒推送
    core: {
      interval: 1000,
      sources: [
        'index.000001.SH',  // 上证指数
        'index.399001.SZ',  // 深证成指
        'commodity.XAU',    // 黄金
        'commodity.CL',     // 原油 WTI
      ]
    },
    // 次要指标：10秒推送
    secondary: {
      interval: 10000,
      sources: [
        'macro.BDI',        // 波罗的海指数
        'macro.SCFI',       // 上海集装箱运价
        'forex.USDCNY',     // 美元人民币
      ]
    }
  };

  /**
   * 启动流管理器
   */
  start(clientId: string, writer: WritableStreamDefaultWriter) {
    console.log(`[SSE] Client ${clientId} connected`);
    this.connections.set(clientId, writer);

    // 发送初始快照
    this.sendInitialSnapshot(clientId);

    // 启动各优先级轮询器
    this.startPoller(clientId, 'core');
    this.startPoller(clientId, 'secondary');
  }

  /**
   * 启动数据轮询器
   */
  private startPoller(clientId: string, tier: 'core' | 'secondary') {
    const { interval, sources } = this.config[tier];
    const pollerKey = `${clientId}-${tier}`;

    const poller = setInterval(async () => {
      try {
        // 获取数据点
        const dataPoints = await this.fetchDataPoints(sources);

        // 推送到客户端
        this.broadcast(clientId, {
          type: 'update',
          tier,
          data: dataPoints,
          timestamp: Date.now()
        });

      } catch (error) {
        console.error(`[SSE] Poller error (${tier}):`, error);
      }
    }, interval);

    this.pollers.set(pollerKey, poller);
  }

  /**
   * 获取数据点（模拟数据，实际应调用数据源）
   */
  private async fetchDataPoints(sources: string[]): Promise<DataPoint[]> {
    // TODO: 实际实现应调用 Python FastAPI / Finnhub / 爬虫
    // 这里返回模拟数据
    return sources.map(source => {
      const [type, symbol] = source.split('.');

      return {
        symbol: source,
        name: this.getDisplayName(source),
        value: Math.random() * 3000 + 1000,
        change: Math.random() * 100 - 50,
        changePercent: Math.random() * 5 - 2.5,
        timestamp: Date.now(),
        metadata: {
          high: Math.random() * 3200 + 1000,
          low: Math.random() * 2800 + 1000,
          trend: Array.from({ length: 20 }, () => Math.random() * 3000 + 1000)
        }
      };
    });
  }

  /**
   * 发送初始快照
   */
  private async sendInitialSnapshot(clientId: string) {
    const allSources = [
      ...this.config.core.sources,
      ...this.config.secondary.sources
    ];

    const snapshot = await this.fetchDataPoints(allSources);

    this.broadcast(clientId, {
      type: 'snapshot',
      tier: 'core',
      data: snapshot,
      timestamp: Date.now()
    });
  }

  /**
   * 广播消息到客户端
   */
  private async broadcast(clientId: string, message: MarketDataUpdate) {
    const writer = this.connections.get(clientId);
    if (!writer) return;

    try {
      const encoder = new TextEncoder();
      const data = `data: ${JSON.stringify(message)}\n\n`;
      await writer.write(encoder.encode(data));
    } catch (error) {
      console.error(`[SSE] Broadcast error for client ${clientId}:`, error);
      this.cleanup(clientId);
    }
  }

  /**
   * 清理连接
   */
  cleanup(clientId: string) {
    console.log(`[SSE] Cleaning up client ${clientId}`);

    // 清除所有轮询器
    this.pollers.forEach((poller, key) => {
      if (key.startsWith(clientId)) {
        clearInterval(poller);
        this.pollers.delete(key);
      }
    });

    // 移除连接
    this.connections.delete(clientId);
  }

  /**
   * 获取显示名称（辅助函数）
   */
  private getDisplayName(source: string): string {
    const names: Record<string, string> = {
      'index.000001.SH': '上证指数',
      'index.399001.SZ': '深证成指',
      'commodity.XAU': '黄金',
      'commodity.CL': '原油WTI',
      'macro.BDI': '波罗的海指数',
      'macro.SCFI': '上海集装箱运价',
      'forex.USDCNY': '美元人民币'
    };
    return names[source] || source;
  }
}

// 全局单例
let globalStreamManager: SSEStreamManager | null = null;

export function getStreamManager(): SSEStreamManager {
  if (!globalStreamManager) {
    globalStreamManager = new SSEStreamManager();
  }
  return globalStreamManager;
}
