/**
 * AI推理代理集成示例
 * 展示如何在现有组件中集成AI推理功能
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, TrendingUp, AlertTriangle, Shield, Info } from 'lucide-react';

import { MiniAIInferenceAgent, SimpleAIInferenceAgent } from './AIInferenceAgent';
import { StockMarketData } from '@/lib/ai/inference-types';

// 示例股票数据
const exampleStock: StockMarketData = {
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
};

// 示例1：股票卡片集成
export function StockCardWithAI() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              {exampleStock.name}
              <span className="text-sm font-normal text-muted-foreground">
                ({exampleStock.symbol})
              </span>
            </CardTitle>
            <div className="text-2xl font-bold mt-1">
              ¥{exampleStock.currentPrice.toFixed(2)}
            </div>
          </div>

          {/* 迷你AI推理代理 */}
          <MiniAIInferenceAgent
            stockData={exampleStock}
            symbol={exampleStock.symbol}
            name={exampleStock.name}
            autoTrigger={true}
          />
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground">涨跌幅</div>
            <div className={`font-medium ${exampleStock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {exampleStock.change >= 0 ? '+' : ''}{exampleStock.change.toFixed(2)} ({exampleStock.changePercent.toFixed(2)}%)
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">成交量</div>
            <div className="font-medium">
              {(exampleStock.volume / 10000).toFixed(0)}万手
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">MA60</div>
            <div className="font-medium">{exampleStock.ma60?.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">MD60</div>
            <div className="font-medium">{exampleStock.md60?.toFixed(2)}%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 示例2：自选股列表项集成
export function WatchlistItemWithAI() {
  const [showAnalysis, setShowAnalysis] = React.useState(false);

  return (
    <div className="border-b py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <div className="font-medium">{exampleStock.name}</div>
            <div className="text-sm text-muted-foreground">{exampleStock.symbol}</div>
          </div>

          {/* 简化AI推理代理 */}
          <SimpleAIInferenceAgent
            stockData={exampleStock}
            symbol={exampleStock.symbol}
            name={exampleStock.name}
            autoTrigger={true}
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-lg font-bold">¥{exampleStock.currentPrice.toFixed(2)}</div>
            <div className={`text-sm ${exampleStock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {exampleStock.change >= 0 ? '+' : ''}{exampleStock.change.toFixed(2)}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAnalysis(!showAnalysis)}
          >
            <Brain className="h-4 w-4 mr-1" />
            {showAnalysis ? '隐藏' : '分析'}
          </Button>
        </div>
      </div>

      {showAnalysis && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm font-medium text-gray-800 mb-2">AI量化分析</div>
          <SimpleAIInferenceAgent
            stockData={exampleStock}
            symbol={exampleStock.symbol}
            name={exampleStock.name}
            compactMode={true}
            autoTrigger={true}
          />
        </div>
      )}
    </div>
  );
}

// 示例3：实时行情面板集成
export function LiveMarketPanelWithAI() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          实时行情 + AI分析
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="analysis">AI分析</TabsTrigger>
            <TabsTrigger value="details">详情</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">当前价格</div>
                <div className="text-2xl font-bold">¥{exampleStock.currentPrice.toFixed(2)}</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">涨跌幅</div>
                <div className={`text-2xl font-bold ${exampleStock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {exampleStock.change >= 0 ? '+' : ''}{exampleStock.changePercent.toFixed(2)}%
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <MiniAIInferenceAgent
                stockData={exampleStock}
                symbol={exampleStock.symbol}
                name={exampleStock.name}
                autoTrigger={true}
              />
              <span className="ml-2 text-sm text-muted-foreground">
                AI实时监控中...
              </span>
            </div>
          </TabsContent>

          <TabsContent value="analysis">
            <SimpleAIInferenceAgent
              stockData={exampleStock}
              symbol={exampleStock.symbol}
              name={exampleStock.name}
              autoTrigger={true}
            />
          </TabsContent>

          <TabsContent value="details" className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">最高价</div>
                <div className="font-medium">¥{exampleStock.highPrice.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">最低价</div>
                <div className="font-medium">¥{exampleStock.lowPrice.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">成交量</div>
                <div className="font-medium">{(exampleStock.volume / 10000).toFixed(0)}万手</div>
              </div>
              <div>
                <div className="text-muted-foreground">成交额</div>
                <div className="font-medium">{(exampleStock.turnover / 100000000).toFixed(2)}亿元</div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// 示例4：风险预警面板集成
export function RiskWarningPanelWithAI() {
  return (
    <Card className="border-red-200 bg-red-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="h-5 w-5" />
          风险预警中心
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-white border border-red-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-500" />
              <span className="font-medium">{exampleStock.name}</span>
              <span className="text-sm text-muted-foreground">({exampleStock.symbol})</span>
            </div>
            <div className="text-sm text-red-600 font-medium">实时监控</div>
          </div>

          <div className="mt-3">
            <SimpleAIInferenceAgent
              stockData={exampleStock}
              symbol={exampleStock.symbol}
              name={exampleStock.name}
              autoTrigger={true}
            />
          </div>
        </div>

        <div className="p-3 bg-red-100/50 border border-red-300 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-red-800 mb-1">AI风险监控说明</p>
              <p className="text-red-700">
                系统实时监控股票风险，当检测到诱多、洗盘、龙头衰竭等模式时，
                会立即触发视觉警报并提供操作建议。
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 主示例组件
export function IntegrationExamples() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">AI推理代理集成示例</h2>
        <p className="text-muted-foreground mb-6">
          以下示例展示如何在现有组件中集成AI推理代理功能
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-medium mb-3">1. 股票卡片集成</h3>
          <StockCardWithAI />
        </div>

        <div>
          <h3 className="text-lg font-medium mb-3">2. 自选股列表集成</h3>
          <div className="border rounded-lg p-4">
            <WatchlistItemWithAI />
          </div>
        </div>

        <div className="lg:col-span-2">
          <h3 className="text-lg font-medium mb-3">3. 实时行情面板集成</h3>
          <LiveMarketPanelWithAI />
        </div>

        <div className="lg:col-span-2">
          <h3 className="text-lg font-medium mb-3">4. 风险预警面板集成</h3>
          <RiskWarningPanelWithAI />
        </div>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-blue-800 mb-2">集成要点</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• <strong>迷你模式</strong>：适合空间有限的场景（如列表项）</li>
              <li>• <strong>简化模式</strong>：显示关键信息，适合卡片集成</li>
              <li>• <strong>完整模式</strong>：显示详细分析，适合详情页</li>
              <li>• <strong>自动触发</strong>：组件挂载时自动开始推理</li>
              <li>• <strong>错误处理</strong>：内置降级方案和错误显示</li>
              <li>• <strong>性能优化</strong>：支持批量处理和缓存</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}