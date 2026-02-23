'use client';

import React, { useState, useEffect, useCallback } from 'react';

// 数据类型定义
interface MarketData {
  symbol: string;
  name: string;
  currentPrice: number;
  highPrice: number;
  lowPrice: number;
  lastUpdateTime: string;
  change?: number;
  changePercent?: number;
  volume?: number;
  turnover?: number;
}

interface Warning {
  symbol: string;
  type: 'MA60' | 'MD60' | 'AI' | 'SYSTEM';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface AIRecommendation {
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
}

interface LiveFeedUpdate {
  timestamp: string;
  marketData: MarketData[];
  warnings: Warning[];
  aiRecommendations: AIRecommendation[];
}

interface ConnectionStatus {
  connected: boolean;
  type: 'SSE' | 'WebSocket' | 'none';
  lastUpdate: string | null;
  error: string | null;
}

export default function LiveMarketFeed() {
  // 状态管理
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    type: 'none',
    lastUpdate: null,
    error: null
  });

  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');
  const [symbols, setSymbols] = useState<string>('000001,600000,000002,600036');
  const [connectionType, setConnectionType] = useState<'SSE' | 'WebSocket'>('SSE');
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [webSocket, setWebSocket] = useState<WebSocket | null>(null);

  // 格式化数字
  const formatNumber = (num: number | undefined): string => {
    if (num === undefined) return 'N/A';
    return num.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // 格式化百分比
  const formatPercent = (num: number | undefined): string => {
    if (num === undefined) return 'N/A';
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
  };

  // 获取颜色类名
  const getChangeColor = (change: number | undefined): string => {
    if (change === undefined) return 'text-gray-600';
    return change >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const getActionColor = (action: string): string => {
    switch (action) {
      case 'buy': return 'bg-green-100 text-green-800 border-green-300';
      case 'sell': return 'bg-red-100 text-red-800 border-red-300';
      case 'hold': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // 连接SSE
  const connectSSE = useCallback(() => {
    if (eventSource) {
      eventSource.close();
    }

    const symbolsParam = symbols.split(',').map(s => s.trim()).filter(s => s).join(',');
    const url = `/api/sse?symbols=${encodeURIComponent(symbolsParam)}&clientId=${Date.now()}`;

    const es = new EventSource(url);

    es.onopen = () => {
      console.log('SSE连接已建立');
      setConnectionStatus({
        connected: true,
        type: 'SSE',
        lastUpdate: new Date().toISOString(),
        error: null
      });
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleUpdate(data);
      } catch (error) {
        console.error('解析SSE消息失败:', error);
      }
    };

    es.addEventListener('market-update', (event) => {
      try {
        const data = JSON.parse(event.data);
        handleUpdate(data);
      } catch (error) {
        console.error('解析市场更新失败:', error);
      }
    });

    es.addEventListener('connected', (event) => {
      console.log('SSE连接确认:', JSON.parse(event.data));
    });

    es.addEventListener('error', (event) => {
      console.error('SSE连接错误:', event);
      setConnectionStatus(prev => ({
        ...prev,
        connected: false,
        error: 'SSE连接错误'
      }));
    });

    setEventSource(es);
  }, [symbols]);

  // 连接WebSocket
  const connectWebSocket = useCallback(() => {
    if (webSocket && webSocket.readyState === WebSocket.OPEN) {
      webSocket.close();
    }

    const symbolsParam = symbols.split(',').map(s => s.trim()).filter(s => s).join(',');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/api/websocket?symbols=${encodeURIComponent(symbolsParam)}`;

    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('WebSocket连接已建立');
      setConnectionStatus({
        connected: true,
        type: 'WebSocket',
        lastUpdate: new Date().toISOString(),
        error: null
      });

      // 订阅所有频道
      ws.send(JSON.stringify({
        type: 'SUBSCRIBE',
        channels: ['market-data', 'warnings', 'ai-recommendations']
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('解析WebSocket消息失败:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket错误:', error);
      setConnectionStatus(prev => ({
        ...prev,
        connected: false,
        error: 'WebSocket连接错误'
      }));
    };

    ws.onclose = () => {
      console.log('WebSocket连接关闭');
      setConnectionStatus(prev => ({
        ...prev,
        connected: false
      }));
    };

    setWebSocket(ws);
  }, [symbols]);

  // 处理WebSocket消息
  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'CONNECTED':
        console.log('WebSocket连接确认:', data);
        break;

      case 'MARKET_DATA':
        setMarketData(data.data);
        setLastUpdateTime(data.timestamp);
        break;

      case 'WARNINGS':
        setWarnings(data.warnings);
        break;

      case 'AI_RECOMMENDATIONS':
        setAiRecommendations(data.recommendations);
        break;

      case 'HEARTBEAT':
        // 更新最后活动时间
        setConnectionStatus(prev => ({
          ...prev,
          lastUpdate: data.timestamp
        }));
        break;

      case 'ERROR':
        console.error('WebSocket错误:', data);
        setConnectionStatus(prev => ({
          ...prev,
          error: data.message
        }));
        break;
    }
  };

  // 处理更新数据
  const handleUpdate = (update: LiveFeedUpdate) => {
    setMarketData(update.marketData);
    setWarnings(update.warnings);
    setAiRecommendations(update.aiRecommendations);
    setLastUpdateTime(update.timestamp);
    setConnectionStatus(prev => ({
      ...prev,
      lastUpdate: update.timestamp
    }));
  };

  // 连接/断开连接
  const toggleConnection = () => {
    if (connectionStatus.connected) {
      disconnect();
    } else {
      connect();
    }
  };

  const connect = () => {
    if (connectionType === 'SSE') {
      connectSSE();
    } else {
      connectWebSocket();
    }
  };

  const disconnect = () => {
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }
    if (webSocket && webSocket.readyState === WebSocket.OPEN) {
      webSocket.close();
      setWebSocket(null);
    }
    setConnectionStatus({
      connected: false,
      type: 'none',
      lastUpdate: null,
      error: null
    });
  };

  // 更新监控的股票
  const updateSymbols = () => {
    if (connectionStatus.connected) {
      disconnect();
      setTimeout(connect, 100); // 短暂延迟后重新连接
    }
  };

  // 组件挂载时连接
  useEffect(() => {
    connect();

    // 清理函数
    return () => {
      disconnect();
    };
  }, []);

  // 连接类型变化时重新连接
  useEffect(() => {
    if (connectionStatus.connected) {
      disconnect();
      setTimeout(connect, 100);
    }
  }, [connectionType]);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* 头部：连接状态和控制 */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">实时市场数据推送</h2>
          <div className="flex items-center space-x-4">
            <div className={`px-3 py-1 rounded-full ${connectionStatus.connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {connectionStatus.connected ? '已连接' : '未连接'}
            </div>
            <button
              onClick={toggleConnection}
              className={`px-4 py-2 rounded-md ${connectionStatus.connected ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white font-medium`}
            >
              {connectionStatus.connected ? '断开连接' : '连接'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* 连接类型选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">连接类型</label>
            <div className="flex space-x-2">
              <button
                onClick={() => setConnectionType('SSE')}
                className={`px-3 py-2 rounded-md ${connectionType === 'SSE' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                SSE
              </button>
              <button
                onClick={() => setConnectionType('WebSocket')}
                className={`px-3 py-2 rounded-md ${connectionType === 'WebSocket' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                WebSocket
              </button>
            </div>
          </div>

          {/* 股票代码输入 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">监控股票（逗号分隔）</label>
            <div className="flex">
              <input
                type="text"
                value={symbols}
                onChange={(e) => setSymbols(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例如：000001,600000"
              />
              <button
                onClick={updateSymbols}
                className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700"
              >
                更新
              </button>
            </div>
          </div>

          {/* 状态信息 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">连接状态</label>
            <div className="text-sm">
              <div>类型：{connectionStatus.type}</div>
              <div>最后更新：{lastUpdateTime ? new Date(lastUpdateTime).toLocaleString('zh-CN') : '无'}</div>
              {connectionStatus.error && (
                <div className="text-red-600">错误：{connectionStatus.error}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 警告区域 */}
      {warnings.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">⚠️ 市场警告</h3>
          <div className="space-y-2">
            {warnings.map((warning, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${getSeverityColor(warning.severity)}`}
              >
                <div className="flex justify-between items-center">
                  <div className="font-medium">{warning.symbol} - {warning.type}</div>
                  <div className="text-sm capitalize">{warning.severity}</div>
                </div>
                <div className="mt-1 text-sm">{warning.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI推荐区域 */}
      {aiRecommendations.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">🤖 AI交易推荐</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {aiRecommendations.map((rec, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${getActionColor(rec.action)}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="font-bold">{rec.symbol}</div>
                  <div className={`px-2 py-1 rounded text-sm font-medium ${getActionColor(rec.action)}`}>
                    {rec.action === 'buy' ? '买入' : rec.action === 'sell' ? '卖出' : '持有'}
                  </div>
                </div>
                <div className="mb-2">
                  <div className="text-sm font-medium">信心指数：{rec.confidence.toFixed(1)}%</div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${rec.confidence}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-sm">{rec.reasoning}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 市场数据表格 */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">📊 实时市场数据</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">股票代码</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名称</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">当前价</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">涨跌</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">涨跌幅</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最高价</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最低价</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">成交量</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">更新时间</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {marketData.map((stock, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{stock.symbol}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{stock.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatNumber(stock.currentPrice)}
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${getChangeColor(stock.change)}`}>
                    {stock.change !== undefined ? (stock.change >= 0 ? '+' : '') + formatNumber(stock.change) : 'N/A'}
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${getChangeColor(stock.changePercent)}`}>
                    {formatPercent(stock.changePercent)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{formatNumber(stock.highPrice)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{formatNumber(stock.lowPrice)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {stock.volume ? `${(stock.volume / 10000).toFixed(2)}万手` : 'N/A'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{stock.lastUpdateTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {marketData.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            暂无市场数据，请检查连接状态
          </div>
        )}
      </div>

      {/* 底部信息 */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          <div className="flex justify-between">
            <div>
              数据源：新浪财经API | 更新频率：5秒
            </div>
            <div>
              总监控股票：{marketData.length}只 | 警告：{warnings.length}条 | AI推荐：{aiRecommendations.length}条
            </div>
          </div>
          <div className="mt-2 text-xs">
            提示：SSE适用于单向数据推送，WebSocket支持双向通信。MA60破位警告基于60日移动平均线计算。
          </div>
        </div>
      </div>
    </div>
  );
}