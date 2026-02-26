"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, RefreshCw, Plus, Minus, TrendingUp, TrendingDown } from "lucide-react";
import { RealTimeStockPrice, RealTimeStockPriceGrid } from "@/components/live-feed/RealTimeStockPrice";
import { useRealTimeStockPrices } from "@/hooks/useRealTimeStockPrices";

// Default stock symbols for demonstration
const DEFAULT_SYMBOLS = ['000001', '600000', '000002', '600036', '000858', '600519'];

export default function RealtimePricesPage() {
  const [customSymbol, setCustomSymbol] = useState('');
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS);
  const [updateInterval, setUpdateInterval] = useState(3000);

  // Use real-time prices hook for demonstration
  const realTimePrices = useRealTimeStockPrices({
    symbols,
    updateInterval,
    autoConnect: true,
    onPriceUpdate: (update) => {
      console.log('Price update received:', update.timestamp);
    },
    onConnectionChange: (connected) => {
      console.log('Connection changed:', connected);
    }
  });

  // Add a custom symbol
  const handleAddSymbol = () => {
    if (customSymbol && !symbols.includes(customSymbol)) {
      setSymbols([...symbols, customSymbol]);
      setCustomSymbol('');
    }
  };

  // Remove a symbol
  const handleRemoveSymbol = (symbolToRemove: string) => {
    setSymbols(symbols.filter(s => s !== symbolToRemove));
  };

  // Reset to default symbols
  const handleResetSymbols = () => {
    setSymbols(DEFAULT_SYMBOLS);
  };

  // Update interval
  const handleUpdateInterval = (interval: number) => {
    setUpdateInterval(interval);
    realTimePrices.updateSymbols(symbols); // This will trigger reconnection with new interval
  };

  // Get symbols with price changes
  const changedSymbols = realTimePrices.getChangedSymbols();

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">实时股票价格演示</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            使用Server-Sent Events (SSE)实现的实时股票价格更新系统
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Connection status */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-full ${realTimePrices.connected ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
            {realTimePrices.connected ? (
              <>
                <Wifi className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-700 dark:text-green-300">实时连接</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-600 dark:text-red-400" />
                <span className="text-sm font-medium text-red-700 dark:text-red-300">离线</span>
              </>
            )}
          </div>

          {/* Connection controls */}
          <div className="flex gap-2">
            {realTimePrices.connected ? (
              <Button variant="outline" size="sm" onClick={realTimePrices.disconnect}>
                断开连接
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={realTimePrices.connect}>
                重新连接
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats and controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{symbols.length}</div>
            <div className="text-sm text-muted-foreground">监控股票数量</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{changedSymbols.length}</div>
            <div className="text-sm text-muted-foreground">价格变化股票</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{updateInterval / 1000}s</div>
            <div className="text-sm text-muted-foreground">更新间隔</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {realTimePrices.lastUpdate ? '✓' : '—'}
            </div>
            <div className="text-sm text-muted-foreground">最后更新</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="grid" className="space-y-4">
        <TabsList>
          <TabsTrigger value="grid">网格视图</TabsTrigger>
          <TabsTrigger value="single">单股视图</TabsTrigger>
          <TabsTrigger value="controls">控制面板</TabsTrigger>
          <TabsTrigger value="stats">统计信息</TabsTrigger>
        </TabsList>

        <TabsContent value="grid" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>实时价格网格</CardTitle>
              <CardDescription>
                显示所有监控股票的实时价格，价格变化时有动画效果
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RealTimeStockPriceGrid
                symbols={symbols}
                showName={true}
                showChange={true}
                showChangePercent={true}
                showConnectionStatus={false}
                animateChanges={true}
                className="border-0 shadow-none"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="single" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>单股详细视图</CardTitle>
              <CardDescription>
                查看单只股票的详细信息，包括成交量、更新时间等
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {symbols.slice(0, 4).map(symbol => (
                  <RealTimeStockPrice
                    key={symbol}
                    symbol={symbol}
                    showName={true}
                    showChange={true}
                    showChangePercent={true}
                    showVolume={true}
                    showLastUpdate={true}
                    showConnectionStatus={true}
                    animateChanges={true}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="controls" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>控制面板</CardTitle>
              <CardDescription>
                管理监控的股票和更新设置
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add custom symbol */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">添加股票</h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="输入股票代码 (如: 000001)"
                    value={customSymbol}
                    onChange={(e) => setCustomSymbol(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleAddSymbol} disabled={!customSymbol}>
                    <Plus className="h-4 w-4 mr-2" />
                    添加
                  </Button>
                  <Button variant="outline" onClick={handleResetSymbols}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    重置
                  </Button>
                </div>
              </div>

              {/* Current symbols */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">当前监控的股票</h3>
                <div className="flex flex-wrap gap-2">
                  {symbols.map(symbol => (
                    <Badge key={symbol} variant="outline" className="px-3 py-1">
                      {symbol}
                      <button
                        onClick={() => handleRemoveSymbol(symbol)}
                        className="ml-2 text-gray-500 hover:text-red-500"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Update interval controls */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">更新间隔</h3>
                <div className="flex gap-2">
                  {[1000, 3000, 5000, 10000].map(interval => (
                    <Button
                      key={interval}
                      variant={updateInterval === interval ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleUpdateInterval(interval)}
                    >
                      {interval / 1000}秒
                    </Button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  更短的间隔提供更实时的更新，但会增加服务器负载
                </p>
              </div>

              {/* Connection controls */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">连接控制</h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={realTimePrices.connect}
                    disabled={realTimePrices.connected || realTimePrices.loading}
                  >
                    连接
                  </Button>
                  <Button
                    variant="outline"
                    onClick={realTimePrices.disconnect}
                    disabled={!realTimePrices.connected}
                  >
                    断开
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => realTimePrices.updateSymbols(symbols)}
                    disabled={!realTimePrices.connected}
                  >
                    更新股票列表
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>统计信息</CardTitle>
              <CardDescription>
                实时价格系统的运行状态和性能指标
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Connection status */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">连接状态</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">状态</div>
                    <div className="flex items-center gap-2">
                      {realTimePrices.connected ? (
                        <>
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="font-medium">已连接</span>
                        </>
                      ) : (
                        <>
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <span className="font-medium">已断开</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">连接ID</div>
                    <div className="font-mono text-sm truncate">
                      {realTimePrices.connectionId || '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Price statistics */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">价格统计</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">已获取价格</div>
                    <div className="text-xl font-bold">
                      {Object.keys(realTimePrices.prices).length}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">价格变化</div>
                    <div className="text-xl font-bold">
                      {changedSymbols.length}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">最后更新</div>
                    <div className="text-sm">
                      {realTimePrices.lastUpdate ? new Date(realTimePrices.lastUpdate).toLocaleTimeString('zh-CN') : '—'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">更新间隔</div>
                    <div className="text-sm">
                      {updateInterval / 1000}秒
                    </div>
                  </div>
                </div>
              </div>

              {/* Error display */}
              {realTimePrices.error && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-red-600">错误信息</h3>
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                    <div className="text-sm text-red-700 dark:text-red-400">
                      {realTimePrices.error}
                    </div>
                  </div>
                </div>
              )}

              {/* Sample prices */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">示例价格数据</h3>
                <div className="space-y-2">
                  {symbols.slice(0, 3).map(symbol => {
                    const price = realTimePrices.getPrice(symbol);
                    return price ? (
                      <div key={symbol} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <div className="font-medium">{symbol}</div>
                        <div className="flex items-center gap-4">
                          <div className="font-bold">¥{price.price.toFixed(2)}</div>
                          <div className={`flex items-center gap-1 ${price.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {price.changePercent >= 0 ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : (
                              <TrendingDown className="h-4 w-4" />
                            )}
                            <span>{price.changePercent >= 0 ? '+' : ''}{price.changePercent.toFixed(2)}%</span>
                          </div>
                        </div>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Technical info */}
      <Card>
        <CardHeader>
          <CardTitle>技术实现</CardTitle>
          <CardDescription>
            实时价格更新系统的技术架构和工作原理
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold">Server-Sent Events (SSE)</h4>
              <p className="text-sm text-muted-foreground">
                使用SSE实现单向实时数据流，相比WebSocket更轻量，适合价格更新场景。
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">数据源</h4>
              <p className="text-sm text-muted-foreground">
                从新浪财经API获取实时股票数据，支持批量查询和自动重试机制。
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">前端优化</h4>
              <p className="text-sm text-muted-foreground">
                使用React Hook管理连接状态，支持自动重连、错误处理和性能优化。
              </p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-semibold mb-2">API端点</h4>
            <div className="space-y-2 text-sm">
              <div className="font-mono p-2 bg-gray-100 dark:bg-gray-800 rounded">
                GET /api/stock-prices/realtime?symbols=000001,600000&interval=3000
              </div>
              <div className="font-mono p-2 bg-gray-100 dark:bg-gray-800 rounded">
                POST /api/stock-prices/realtime {"{"}clientId, symbols{"}"}
              </div>
              <div className="font-mono p-2 bg-gray-100 dark:bg-gray-800 rounded">
                PUT /api/stock-prices/realtime {"{"}action: "stats"{"}"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}