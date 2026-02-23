/**
 * WebSocket API Route (Alternative to SSE)
 * Real-time bidirectional communication for Alpha-Quant-Copilot
 */

import { NextRequest, NextResponse } from 'next/server';
import { WebSocketServer, WebSocket } from 'ws';
import { fetchMultipleStocks, MarketData } from '@/skills/data_crawler';

// WebSocket连接管理
interface WebSocketClient {
  socket: WebSocket;
  id: string;
  symbols: string[];
  lastActivity: number;
  subscribedChannels: Set<string>;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;

  // 初始化WebSocket服务器
  initialize(_server: any) {
    if (this.wss) {
      console.log('WebSocket服务器已初始化');
      return;
    }

    this.wss = new WebSocketServer({ noServer: true });

    this.wss.on('connection', (socket: WebSocket, request: any) => {
      this.handleConnection(socket, request);
    });

    console.log('WebSocket服务器初始化完成');

    // 启动定期数据更新
    this.startPeriodicUpdates();
  }

  // 处理新连接
  private handleConnection(socket: WebSocket, request: any) {
    const clientId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const url = new URL(request.url, `http://${request.headers.host}`);
    const symbolsParam = url.searchParams.get('symbols');
    const symbols = symbolsParam ? symbolsParam.split(',') : ['000001', '600000'];

    const client: WebSocketClient = {
      socket,
      id: clientId,
      symbols,
      lastActivity: Date.now(),
      subscribedChannels: new Set(['market-data', 'warnings', 'ai-recommendations'])
    };

    this.clients.set(clientId, client);
    console.log(`新的WebSocket连接: ${clientId}, 监控股票: ${symbols.join(',')}`);

    // 发送连接确认
    this.sendToClient(clientId, {
      type: 'CONNECTED',
      clientId,
      timestamp: new Date().toISOString(),
      message: 'WebSocket连接已建立',
      symbols,
      availableChannels: Array.from(client.subscribedChannels)
    });

    // 立即发送初始数据
    this.sendMarketUpdate(clientId);

    // 消息处理
    socket.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(clientId, message);
      } catch (error) {
        console.error('消息解析失败:', error);
        this.sendToClient(clientId, {
          type: 'ERROR',
          message: '消息格式错误',
          error: error instanceof Error ? error.message : '未知错误'
        });
      }
    });

    // 错误处理
    socket.on('error', (error) => {
      console.error(`WebSocket错误 (${clientId}):`, error);
    });

    // 连接关闭
    socket.on('close', () => {
      console.log(`WebSocket连接关闭: ${clientId}`);
      this.clients.delete(clientId);
    });

    // 心跳检测
    const heartbeatInterval = setInterval(() => {
      if (!this.clients.has(clientId)) {
        clearInterval(heartbeatInterval);
        return;
      }

      const now = Date.now();
      if (now - client.lastActivity > 60000) { // 60秒无活动
        console.log(`客户端 ${clientId} 心跳超时`);
        socket.close();
        clearInterval(heartbeatInterval);
        return;
      }

      // 发送心跳
      this.sendToClient(clientId, {
        type: 'HEARTBEAT',
        timestamp: new Date().toISOString()
      });
    }, 30000); // 每30秒检查一次
  }

  // 处理客户端消息
  private handleMessage(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastActivity = Date.now();

    switch (message.type) {
      case 'SUBSCRIBE':
        this.handleSubscribe(clientId, message.channels);
        break;

      case 'UNSUBSCRIBE':
        this.handleUnsubscribe(clientId, message.channels);
        break;

      case 'UPDATE_SYMBOLS':
        this.handleUpdateSymbols(clientId, message.symbols);
        break;

      case 'REQUEST_UPDATE':
        this.sendMarketUpdate(clientId);
        break;

      case 'PING':
        this.sendToClient(clientId, {
          type: 'PONG',
          timestamp: new Date().toISOString(),
          originalTimestamp: message.timestamp
        });
        break;

      default:
        console.log(`未知消息类型: ${message.type}`);
        this.sendToClient(clientId, {
          type: 'ERROR',
          message: `未知消息类型: ${message.type}`,
          supportedTypes: ['SUBSCRIBE', 'UNSUBSCRIBE', 'UPDATE_SYMBOLS', 'REQUEST_UPDATE', 'PING']
        });
    }
  }

  // 处理订阅
  private handleSubscribe(clientId: string, channels: string[]) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const validChannels = ['market-data', 'warnings', 'ai-recommendations', 'system-status'];
    const addedChannels: string[] = [];

    channels.forEach(channel => {
      if (validChannels.includes(channel) && !client.subscribedChannels.has(channel)) {
        client.subscribedChannels.add(channel);
        addedChannels.push(channel);
      }
    });

    if (addedChannels.length > 0) {
      this.sendToClient(clientId, {
        type: 'SUBSCRIBED',
        channels: addedChannels,
        timestamp: new Date().toISOString()
      });
    }
  }

  // 处理取消订阅
  private handleUnsubscribe(clientId: string, channels: string[]) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const removedChannels: string[] = [];

    channels.forEach(channel => {
      if (client.subscribedChannels.has(channel)) {
        client.subscribedChannels.delete(channel);
        removedChannels.push(channel);
      }
    });

    if (removedChannels.length > 0) {
      this.sendToClient(clientId, {
        type: 'UNSUBSCRIBED',
        channels: removedChannels,
        timestamp: new Date().toISOString()
      });
    }
  }

  // 处理更新股票列表
  private handleUpdateSymbols(clientId: string, symbols: string[]) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (Array.isArray(symbols) && symbols.length > 0) {
      client.symbols = symbols.slice(0, 20); // 限制最多20只股票
      this.sendToClient(clientId, {
        type: 'SYMBOLS_UPDATED',
        symbols: client.symbols,
        timestamp: new Date().toISOString()
      });

      // 立即发送更新
      this.sendMarketUpdate(clientId);
    }
  }

  // 发送市场数据更新
  private async sendMarketUpdate(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      // 获取市场数据
      const marketData = await fetchMultipleStocks(client.symbols);

      // 生成警告（简化版）
      const warnings = this.generateWarnings(marketData);

      // 生成AI推荐（简化版）
      const aiRecommendations = this.generateAIRecommendations(marketData);

      // 发送数据到订阅的频道
      if (client.subscribedChannels.has('market-data')) {
        this.sendToClient(clientId, {
          type: 'MARKET_DATA',
          data: marketData,
          timestamp: new Date().toISOString()
        });
      }

      if (client.subscribedChannels.has('warnings') && warnings.length > 0) {
        this.sendToClient(clientId, {
          type: 'WARNINGS',
          warnings,
          timestamp: new Date().toISOString()
        });
      }

      if (client.subscribedChannels.has('ai-recommendations')) {
        this.sendToClient(clientId, {
          type: 'AI_RECOMMENDATIONS',
          recommendations: aiRecommendations,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error('发送市场更新失败:', error);
      this.sendToClient(clientId, {
        type: 'ERROR',
        message: '获取市场数据失败',
        error: error instanceof Error ? error.message : '未知错误',
        timestamp: new Date().toISOString()
      });
    }
  }

  // 生成警告
  private generateWarnings(marketData: MarketData[]): Array<{
    symbol: string;
    type: string;
    message: string;
    severity: string;
  }> {
    const warnings = [];

    for (const stock of marketData) {
      // 模拟MA60检查
      const ma60 = this.getSimulatedMA60(stock.symbol);
      const breachPercent = ((stock.currentPrice - ma60) / ma60) * 100;

      if (stock.currentPrice <= ma60) {
        warnings.push({
          symbol: stock.symbol,
          type: 'MA60_BREACH',
          message: `MA60破位！当前价格${stock.currentPrice}低于MA60(${ma60})`,
          severity: 'critical'
        });
      } else if (breachPercent <= 3) {
        warnings.push({
          symbol: stock.symbol,
          type: 'MA60_WARNING',
          message: `接近MA60！当前价格${stock.currentPrice}仅高于MA60(${ma60}) ${breachPercent.toFixed(2)}%`,
          severity: 'medium'
        });
      }

      // 价格波动警告
      if (stock.changePercent && Math.abs(stock.changePercent) > 5) {
        warnings.push({
          symbol: stock.symbol,
          type: 'PRICE_VOLATILITY',
          message: `价格大幅波动！涨跌${stock.changePercent}%`,
          severity: stock.changePercent > 0 ? 'medium' : 'high'
        });
      }
    }

    return warnings;
  }

  // 生成AI推荐
  private generateAIRecommendations(marketData: MarketData[]): Array<{
    symbol: string;
    action: string;
    confidence: number;
    reasoning: string;
  }> {
    return marketData.map(stock => {
      const ma60 = this.getSimulatedMA60(stock.symbol);
      const priceRatio = stock.currentPrice / ma60;

      let action = 'hold';
      let confidence = 50;
      let reasoning = '';

      if (priceRatio > 1.1) {
        action = 'sell';
        confidence = 70;
        reasoning = `价格显著高于MA60(${ma60.toFixed(2)})，建议获利了结`;
      } else if (priceRatio < 0.95) {
        action = 'buy';
        confidence = 65;
        reasoning = `价格低于MA60(${ma60.toFixed(2)})，具备安全边际`;
      } else {
        action = 'hold';
        confidence = 60;
        reasoning = `价格在MA60(${ma60.toFixed(2)})附近震荡，建议观望`;
      }

      return {
        symbol: stock.symbol,
        action,
        confidence,
        reasoning
      };
    });
  }

  // 获取模拟的MA60值
  private getSimulatedMA60(symbol: string): number {
    const basePrices: Record<string, number> = {
      '000001': 10.50,
      '600000': 8.20,
      '000002': 25.30,
      '600036': 32.10
    };

    const basePrice = basePrices[symbol] || 10.0;
    return basePrice * (0.95 + Math.random() * 0.1); // 0.95-1.05倍
  }

  // 发送消息到客户端
  private sendToClient(clientId: string, data: any) {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      client.socket.send(JSON.stringify(data));
    } catch (error) {
      console.error(`发送消息到客户端 ${clientId} 失败:`, error);
    }
  }

  // 广播消息到所有客户端
  broadcast(data: any, channel?: string) {
    this.clients.forEach((client, clientId) => {
      if (!channel || client.subscribedChannels.has(channel)) {
        this.sendToClient(clientId, data);
      }
    });
  }

  // 启动定期更新
  private startPeriodicUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(() => {
      this.clients.forEach((_client, clientId) => {
        this.sendMarketUpdate(clientId);
      });
    }, 10000); // 每10秒更新一次
  }

  // 获取连接统计
  getStats() {
    return {
      totalConnections: this.clients.size,
      activeConnections: Array.from(this.clients.entries()).map(([clientId, client]) => ({
        clientId,
        symbols: client.symbols,
        subscribedChannels: Array.from(client.subscribedChannels),
        lastActivity: new Date(client.lastActivity).toISOString(),
        age: Date.now() - client.lastActivity
      }))
    };
  }

  // 关闭所有连接
  closeAll() {
    this.clients.forEach(client => {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.close();
      }
    });
    this.clients.clear();

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

// 全局WebSocket管理器实例
const wsManager = new WebSocketManager();

// 导出WebSocket升级处理
export async function GET(_request: NextRequest) {
  try {
    // 这个路由主要用于WebSocket升级，实际处理在WebSocketManager中
    return NextResponse.json({
      message: 'WebSocket API已就绪',
      endpoints: {
        websocket: 'ws://localhost:3000/api/websocket',
        stats: 'POST /api/websocket/stats'
      },
      usage: '使用WebSocket客户端连接ws://localhost:3000/api/websocket?symbols=000001,600000'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'WebSocket API错误', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// 处理WebSocket升级
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === 'stats') {
      const stats = wsManager.getStats();
      return NextResponse.json(stats);
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: '请求处理失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// 导出WebSocket管理器用于服务器设置
export { wsManager };