/**
 * AI推理代理演示页面
 * 展示量化推演显化代理的功能
 */

"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Brain, Search, TrendingUp, AlertTriangle, Shield, Zap, Info } from 'lucide-react';

import { AIInferenceAgent, SimpleAIInferenceAgent, MiniAIInferenceAgent } from '@/components/quant-inference/AIInferenceAgent';
import { StockMarketData } from '@/lib/ai/inference-types';

// 示例股票数据
const EXAMPLE_STOCKS: Record<string, StockMarketData> = {
  '000001': {
    symbol: '000001',
    name: '平安银行',
    currentPrice: 10.96,
    highPrice: 11.20,
    lowPrice: 10.85,
    change: 0.15,
    changePercent: 1.39,
    volume: 12500000,
    turnover: 137000000,
    lastUpdateTime: new Date().toISOString(),
    ma60: 10.80,
    md60: 1.48,
    rsi: 55.3,
    macd: {
      diff: 0.12,
      signal: 0.08,
      histogram: 0.04
    },
    mainNetInflow: 12500000,
    largeOrderRatio: 0.25
  },
  '600519': {
    symbol: '600519',
    name: '贵州茅台',
    currentPrice: 1750.50,
    highPrice: 1765.80,
    lowPrice: 1742.30,
    change: -8.50,
    changePercent: -0.48,
    volume: 850000,
    turnover: 1487500000,
    lastUpdateTime: new Date().toISOString(),
    ma60: 1720.80,
    md60: 2.15,
    rsi: 48.7,
    macd: {
      diff: -1.25,
      signal: -0.85,
      histogram: -0.40
    },
    mainNetInflow: -12500000,
    largeOrderRatio: 0.18
  },
  '300750': {
    symbol: '300750',
    name: '宁德时代',
    currentPrice: 195.80,
    highPrice: 198.50,
    lowPrice: 193.20,
    change: 3.20,
    changePercent: 1.66,
    volume: 28500000,
    turnover: 558000000,
    lastUpdateTime: new Date().toISOString(),
    ma60: 185.40,
    md60: 8.25,
    rsi: 62.5,
    macd: {
      diff: 2.15,
      signal: 1.85,
      histogram: 0.30
    },
    mainNetInflow: 28500000,
    largeOrderRatio: 0.32
  },
  '002415': {
    symbol: '002415',
    name: '海康威视',
    currentPrice: 35.20,
    highPrice: 35.80,
    lowPrice: 34.90,
    change: 0.45,
    changePercent: 1.29,
    volume: 18500000,
    turnover: 65120000,
    lastUpdateTime: new Date().toISOString(),
    ma60: 33.80,
    md60: 4.15,
    rsi: 58.3,
    macd: {
      diff: 0.45,
      signal: 0.35,
      histogram: 0.10
    },
    mainNetInflow: 12500000,
    largeOrderRatio: 0.22
  }
};

export default function AIInferenceDemoPage() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('000001');
  const [customSymbol, setCustomSymbol] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('full');
  const [inferenceResults, setInferenceResults] = useState<Record<string, any>>({});

  // 获取当前选中的股票数据
  const currentStock = EXAMPLE_STOCKS[selectedSymbol];

  // 处理推理完成
  const handleInferenceComplete = (symbol: string, response: any) => {
    setInferenceResults(prev => ({
      ...prev,
      [symbol]: response
    }));
  };

  // 处理自定义股票搜索
  const handleSearch = () => {
    if (customSymbol.trim()) {
      // 这里可以添加从API获取股票数据的逻辑
      alert(`搜索股票: ${customSymbol} (演示模式，使用示例数据)`);
      // 暂时使用平安银行作为示例
      setSelectedSymbol('000001');
      setCustomSymbol('');
    }
  };

  // 批量运行推理
  const runBatchInference = () => {
    alert('批量推理功能将在实际API集成后可用');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold">量化推演显化代理</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Alpha-Quant-Copilot核心引擎：将直觉与底层数据转化为严谨的交易策略结晶
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左侧：控制面板 */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                股票选择
              </CardTitle>
              <CardDescription>
                选择要分析的股票或输入自定义代码
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 自定义搜索 */}
              <div className="space-y-2">
                <Label htmlFor="custom-symbol">股票代码</Label>
                <div className="flex gap-2">
                  <Input
                    id="custom-symbol"
                    placeholder="例如: 000001, 600519"
                    value={customSymbol}
                    onChange={(e) => setCustomSymbol(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Separator />

              {/* 示例股票列表 */}
              <div className="space-y-2">
                <Label>示例股票</Label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(EXAMPLE_STOCKS).map(([symbol, stock]) => (
                    <Button
                      key={symbol}
                      variant={selectedSymbol === symbol ? "default" : "outline"}
                      onClick={() => setSelectedSymbol(symbol)}
                      className="justify-start"
                    >
                      <div className="text-left">
                        <div className="font-medium">{stock.name}</div>
                        <div className="text-xs text-muted-foreground">{symbol}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* 批量操作 */}
              <div className="space-y-2">
                <Label>批量操作</Label>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={runBatchInference}
                >
                  <Brain className="h-4 w-4 mr-2" />
                  批量分析所有示例股票
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 当前股票信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                股票信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentStock && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="font-medium">名称</div>
                    <div>{currentStock.name}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="font-medium">代码</div>
                    <div>{currentStock.symbol}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="font-medium">当前价格</div>
                    <div className="text-lg font-bold">¥{currentStock.currentPrice.toFixed(2)}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="font-medium">涨跌幅</div>
                    <div className={`text-lg font-bold ${currentStock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {currentStock.change >= 0 ? '+' : ''}{currentStock.change.toFixed(2)} ({currentStock.changePercent.toFixed(2)}%)
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="font-medium">成交量</div>
                    <div>{(currentStock.volume / 10000).toFixed(0)}万手</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="font-medium">MA60</div>
                    <div>{currentStock.ma60?.toFixed(2)}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="font-medium">MD60</div>
                    <div>{currentStock.md60?.toFixed(2)}%</div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右侧：AI推理代理 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 模式选择 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                推演模式
              </CardTitle>
              <CardDescription>
                选择AI推理代理的显示模式
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid grid-cols-3">
                  <TabsTrigger value="full" className="flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    完整模式
                  </TabsTrigger>
                  <TabsTrigger value="simple" className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    简化模式
                  </TabsTrigger>
                  <TabsTrigger value="mini" className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    迷你模式
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>

          {/* AI推理代理显示 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                AI量化推演结果
              </CardTitle>
              <CardDescription>
                基于CLAUDE.md策略规则的AI推理分析
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentStock && (
                <div className="space-y-6">
                  {/* 根据模式显示不同的组件 */}
                  {activeTab === 'full' && (
                    <AIInferenceAgent
                      stockData={currentStock}
                      symbol={currentStock.symbol}
                      name={currentStock.name}
                      autoTrigger={true}
                      showDetails={true}
                      onInferenceComplete={(response) => handleInferenceComplete(currentStock.symbol, response)}
                      onError={(error) => console.error('推理错误:', error)}
                    />
                  )}

                  {activeTab === 'simple' && (
                    <SimpleAIInferenceAgent
                      stockData={currentStock}
                      symbol={currentStock.symbol}
                      name={currentStock.name}
                      autoTrigger={true}
                      onInferenceComplete={(response) => handleInferenceComplete(currentStock.symbol, response)}
                    />
                  )}

                  {activeTab === 'mini' && (
                    <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
                      <div className="text-center">
                        <div className="mb-4">
                          <MiniAIInferenceAgent
                            stockData={currentStock}
                            symbol={currentStock.symbol}
                            name={currentStock.name}
                            autoTrigger={true}
                            onInferenceComplete={(response) => handleInferenceComplete(currentStock.symbol, response)}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          迷你模式：仅显示警报环，适合集成到列表项中
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 功能说明 */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium text-blue-800 mb-2">功能说明</h4>
                        <ul className="text-sm text-blue-700 space-y-1">
                          <li>• <strong>反人性破解器</strong>：自动识别诱多、洗盘、龙头衰竭模式</li>
                          <li>• <strong>MA60/MD60纪律</strong>：严格执行硬性交易纪律</li>
                          <li>• <strong>视觉警报环</strong>：高危状态时触发脉冲动画警报</li>
                          <li>• <strong>量化推演</strong>：将直觉转化为严谨的交易策略结晶</li>
                          <li>• <strong>预期差计算</strong>：捕捉宏观周期与市场预期的错配</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 集成示例 */}
          <Card>
            <CardHeader>
              <CardTitle>集成示例</CardTitle>
              <CardDescription>
                如何在现有组件中集成AI推理代理
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <pre className="text-sm overflow-x-auto">
{`// 1. 导入组件
import { MiniAIInferenceAgent } from '@/components/quant-inference/AIInferenceAgent';

// 2. 在股票卡片中集成
function StockCard({ stock }) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3>{stock.name} ({stock.symbol})</h3>
          <p>¥{stock.price}</p>
        </div>
        {/* 迷你AI推理代理 */}
        <MiniAIInferenceAgent
          stockData={stock}
          symbol={stock.symbol}
          name={stock.name}
          autoTrigger={true}
        />
      </div>
    </div>
  );
}`}
                  </pre>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="text-sm font-medium text-green-800 mb-1">适用场景</div>
                    <ul className="text-xs text-green-700 space-y-1">
                      <li>• 股票详情页头部</li>
                      <li>• 自选股列表项</li>
                      <li>• 实时行情卡片</li>
                      <li>• 投资组合管理</li>
                      <li>• 风险预警面板</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="text-sm font-medium text-purple-800 mb-1">数据流</div>
                    <ul className="text-xs text-purple-700 space-y-1">
                      <li>1. 获取股票K线数据</li>
                      <li>2. 调用AI推理代理</li>
                      <li>3. 解析风险等级</li>
                      <li>4. 触发视觉警报</li>
                      <li>5. 更新UI状态</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 页脚说明 */}
      <div className="mt-12 pt-8 border-t">
        <div className="max-w-3xl mx-auto text-center">
          <h3 className="text-lg font-medium mb-3">Alpha-Quant-Copilot 核心引擎</h3>
          <p className="text-muted-foreground mb-4">
            量化推演显化代理是Alpha-Quant-Copilot的核心引擎，严格遵循CLAUDE.md中的策略规则，
            将直觉与底层数据转化为严谨的交易策略结晶。通过反人性破解器、MA60/MD60纪律和视觉警报环，
            实现从数据到决策的完整闭环。
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-red-500"></div>
              <span>高危状态：强衰竭/诱多/清仓</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-orange-500"></div>
              <span>风险预警：陷阱概率 > 80%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span>安全状态：趋势正常</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}