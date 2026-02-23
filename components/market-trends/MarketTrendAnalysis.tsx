"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Zap,
  Brain,
  Clock,
  AlertTriangle,
  RefreshCw,
  Download,
  Share2
} from "lucide-react"
import { toast } from "sonner"

// 模拟市场趋势数据
interface MarketTrend {
  id: string;
  name: string;
  currentValue: number;
  change: number;
  changePercent: number;
  trend: "up" | "down" | "sideways";
  strength: number; // 0-100
  description: string;
  indicators: {
    name: string;
    value: number;
    status: "positive" | "negative" | "neutral";
  }[];
}

// 模拟快速分析结果
interface QuickAnalysisResult {
  id: string;
  title: string;
  summary: string;
  confidence: number;
  recommendations: string[];
  timestamp: Date;
}

// 模拟趋势预测
interface TrendPrediction {
  id: string;
  timeframe: string;
  probability: number;
  direction: "bullish" | "bearish" | "sideways";
  target: number;
  stopLoss: number;
  reasoning: string;
  keyFactors: string[];
}

export default function MarketTrendAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [quickAnalysisResults, setQuickAnalysisResults] = useState<QuickAnalysisResult[]>([])
  const [trendPredictions, setTrendPredictions] = useState<TrendPrediction[]>([])
  const [selectedTarget, setSelectedTarget] = useState<string>("market") // "market" 或具体的指数ID

  // 模拟市场趋势数据
  const marketTrends: MarketTrend[] = [
    {
      id: "1",
      name: "上证指数",
      currentValue: 3250.42,
      change: 15.68,
      changePercent: 0.48,
      trend: "up",
      strength: 75,
      description: "大盘震荡上行，成交量温和放大，技术面偏多",
      indicators: [
        { name: "MA60", value: 3205.3, status: "positive" },
        { name: "RSI", value: 58.2, status: "neutral" },
        { name: "MACD", value: 12.5, status: "positive" },
        { name: "成交量", value: 1.2, status: "positive" }
      ]
    },
    {
      id: "2",
      name: "创业板指",
      currentValue: 2150.75,
      change: -8.42,
      changePercent: -0.39,
      trend: "down",
      strength: 45,
      description: "科技股调整，资金流向防御板块",
      indicators: [
        { name: "MA60", value: 2180.5, status: "negative" },
        { name: "RSI", value: 42.3, status: "neutral" },
        { name: "MACD", value: -5.8, status: "negative" },
        { name: "成交量", value: 0.8, status: "negative" }
      ]
    },
    {
      id: "3",
      name: "沪深300",
      currentValue: 3800.15,
      change: 5.32,
      changePercent: 0.14,
      trend: "sideways",
      strength: 30,
      description: "权重股震荡整理，等待方向选择",
      indicators: [
        { name: "MA60", value: 3785.2, status: "neutral" },
        { name: "RSI", value: 50.1, status: "neutral" },
        { name: "MACD", value: 2.1, status: "neutral" },
        { name: "成交量", value: 1.0, status: "neutral" }
      ]
    },
    {
      id: "4",
      name: "科创50",
      currentValue: 950.28,
      change: 12.45,
      changePercent: 1.33,
      trend: "up",
      strength: 85,
      description: "科技创新板块强势，资金持续流入",
      indicators: [
        { name: "MA60", value: 920.5, status: "positive" },
        { name: "RSI", value: 65.8, status: "positive" },
        { name: "MACD", value: 18.2, status: "positive" },
        { name: "成交量", value: 1.5, status: "positive" }
      ]
    }
  ]

  // 执行快速分析
  const handleQuickAnalysis = () => {
    setIsAnalyzing(true)

    // 模拟API调用延迟
    setTimeout(() => {
      const newAnalysis: QuickAnalysisResult = {
        id: Date.now().toString(),
        title: "市场快速分析报告",
        summary: "当前市场整体呈现结构性行情，科技成长板块表现强势，传统周期板块相对疲弱。资金面保持宽松，但增量资金有限，市场以存量博弈为主。技术面显示大盘在3200-3300点区间震荡，短期关注成交量变化。",
        confidence: 82,
        recommendations: [
          "关注科技创新板块的持续性",
          "控制仓位在60-70%之间",
          "关注成交量能否有效放大",
          "注意高位股的调整风险"
        ],
        timestamp: new Date()
      }

      setQuickAnalysisResults(prev => [newAnalysis, ...prev.slice(0, 4)])
      setIsAnalyzing(false)

      toast.success("快速分析完成", {
        description: "已生成最新的市场分析报告"
      })
    }, 1500)
  }

  // 执行趋势预测
  const handleTrendPrediction = () => {
    setIsAnalyzing(true)

    // 模拟API调用延迟
    setTimeout(() => {
      const newPrediction: TrendPrediction = {
        id: Date.now().toString(),
        timeframe: "未来1周",
        probability: 78,
        direction: "bullish",
        target: 3300,
        stopLoss: 3180,
        reasoning: "技术面显示多头排列，成交量温和放大，资金面保持宽松，政策面预期向好。",
        keyFactors: [
          "技术面多头排列",
          "成交量温和放大",
          "政策预期向好",
          "外资持续流入"
        ]
      }

      setTrendPredictions(prev => [newPrediction, ...prev.slice(0, 3)])
      setIsAnalyzing(false)

      toast.success("趋势预测完成", {
        description: "已生成最新的趋势预测报告"
      })
    }, 2000)
  }

  // 导出分析报告
  const handleExportReport = () => {
    toast.info("导出功能开发中", {
      description: "PDF导出功能将在下一版本中提供"
    })
  }

  // 分享分析结果
  const handleShareAnalysis = () => {
    toast.info("分享功能开发中", {
      description: "社交分享功能将在下一版本中提供"
    })
  }

  // 初始化时加载一些模拟数据
  useEffect(() => {
    // 初始化一些模拟的快速分析结果
    const initialAnalysis: QuickAnalysisResult = {
      id: "1",
      title: "市场晨间分析",
      summary: "隔夜美股上涨，A股有望高开。关注科技股和新能源板块的表现。成交量是关键，需要观察能否突破前期高点。",
      confidence: 75,
      recommendations: [
        "关注科技股开盘表现",
        "观察成交量变化",
        "控制仓位，避免追高"
      ],
      timestamp: new Date(Date.now() - 3600000) // 1小时前
    }

    const initialPrediction: TrendPrediction = {
      id: "1",
      timeframe: "今日",
      probability: 65,
      direction: "bullish",
      target: 3280,
      stopLoss: 3220,
      reasoning: "技术指标显示短期反弹概率较大，但需要成交量配合。",
      keyFactors: [
        "技术指标超卖反弹",
        "政策面预期",
        "外围市场影响"
      ]
    }

    setQuickAnalysisResults([initialAnalysis])
    setTrendPredictions([initialPrediction])
  }, [])

  return (
    <div className="space-y-6">
      {/* 控制面板 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button
            onClick={handleQuickAnalysis}
            disabled={isAnalyzing}
            className="h-auto py-4"
          >
            <div className="flex items-center justify-center gap-2">
              {isAnalyzing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              <div className="text-left">
                <div className="font-medium">快速分析</div>
                <div className="text-xs text-muted-foreground">一键生成市场分析报告</div>
              </div>
            </div>
          </Button>

          <Button
            onClick={handleTrendPrediction}
            disabled={isAnalyzing}
            className="h-auto py-4"
          >
            <div className="flex items-center justify-center gap-2">
              {isAnalyzing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Brain className="h-4 w-4" />
              )}
              <div className="text-left">
                <div className="font-medium">趋势预测</div>
                <div className="text-xs text-muted-foreground">AI预测未来市场走势</div>
              </div>
            </div>
          </Button>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportReport}>
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button variant="outline" onClick={handleShareAnalysis}>
            <Share2 className="h-4 w-4 mr-2" />
            分享
          </Button>
        </div>
      </div>

      {/* 主内容区域 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 mb-6">
          <TabsTrigger value="overview">市场概览</TabsTrigger>
          <TabsTrigger value="analysis">快速分析</TabsTrigger>
          <TabsTrigger value="prediction">趋势预测</TabsTrigger>
          <TabsTrigger value="indicators">技术指标</TabsTrigger>
        </TabsList>

        {/* 市场概览 */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {marketTrends.map((trend) => (
              <Card key={trend.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{trend.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        trend.trend === "up" ? "default" :
                        trend.trend === "down" ? "destructive" : "outline"
                      }>
                        {trend.trend === "up" ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : trend.trend === "down" ? (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        ) : (
                          <BarChart3 className="h-3 w-3 mr-1" />
                        )}
                        {trend.trend === "up" ? "上涨" : trend.trend === "down" ? "下跌" : "震荡"}
                      </Badge>
                      <span className={`text-sm font-medium ${
                        trend.change >= 0 ? "text-green-600" : "text-red-600"
                      }`}>
                        {trend.change >= 0 ? "+" : ""}{trend.change.toFixed(2)} ({trend.changePercent.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                  <div className="text-2xl font-bold">{trend.currentValue.toFixed(2)}</div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">趋势强度</span>
                        <span>{trend.strength}%</span>
                      </div>
                      <Progress value={trend.strength} className="h-2" />
                    </div>

                    <p className="text-sm text-muted-foreground">{trend.description}</p>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {trend.indicators.map((indicator, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 border rounded">
                          <span className="text-sm">{indicator.name}</span>
                          <span className={`text-sm font-medium ${
                            indicator.status === "positive" ? "text-green-600" :
                            indicator.status === "negative" ? "text-red-600" : "text-gray-600"
                          }`}>
                            {indicator.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 市场总结 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Brain className="h-5 w-5 mr-2" />
                AI市场总结
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium mb-2">📈 整体判断</h4>
                  <p className="text-sm">
                    当前市场呈现结构性分化行情，科技成长板块表现强势，传统周期板块相对疲弱。
                    建议关注科技创新、新能源等成长性板块，同时控制整体仓位在合理水平。
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-sm mb-1">👍 积极因素</h4>
                    <ul className="text-xs space-y-1">
                      <li>• 政策面持续支持</li>
                      <li>• 外资持续流入</li>
                      <li>• 科技创新活跃</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <h4 className="font-medium text-sm mb-1">⚠️ 风险因素</h4>
                    <ul className="text-xs space-y-1">
                      <li>• 成交量不足</li>
                      <li>• 外部不确定性</li>
                      <li>• 估值分化严重</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-purple-50 rounded-lg">
                    <h4 className="font-medium text-sm mb-1">🎯 操作建议</h4>
                    <ul className="text-xs space-y-1">
                      <li>• 仓位控制在60-70%</li>
                      <li>• 关注科技成长股</li>
                      <li>• 设置合理止损</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 快速分析结果 */}
        <TabsContent value="analysis" className="space-y-4">
          {quickAnalysisResults.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">暂无分析结果</h3>
                <p className="text-muted-foreground mb-4">
                  点击上方的"快速分析"按钮，生成最新的市场分析报告
                </p>
                <Button onClick={handleQuickAnalysis}>
                  <Zap className="h-4 w-4 mr-2" />
                  开始快速分析
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {quickAnalysisResults.map((analysis) => (
                <Card key={analysis.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center">
                        <Zap className="h-5 w-5 mr-2 text-yellow-600" />
                        {analysis.title}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          {analysis.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Badge>
                        <Badge variant="secondary">
                          置信度: {analysis.confidence}%
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium mb-2">分析摘要</h4>
                      <p className="text-sm">{analysis.summary}</p>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">操作建议</h4>
                      <ul className="space-y-2">
                        {analysis.recommendations.map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <div className="h-2 w-2 rounded-full bg-blue-500 mt-2"></div>
                            <span className="text-sm">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">分析时间</span>
                        <span>{analysis.timestamp.toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        {/* 趋势预测 */}
        <TabsContent value="prediction" className="space-y-4">
          {trendPredictions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">暂无预测结果</h3>
                <p className="text-muted-foreground mb-4">
                  点击上方的"趋势预测"按钮，生成最新的市场趋势预测
                </p>
                <Button onClick={handleTrendPrediction}>
                  <Brain className="h-4 w-4 mr-2" />
                  开始趋势预测
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {trendPredictions.map((prediction) => (
                <Card key={prediction.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center">
                        <TrendingUp className={`h-5 w-5 mr-2 ${
                          prediction.direction === "bullish" ? "text-green-600" :
                          prediction.direction === "bearish" ? "text-red-600" : "text-gray-600"
                        }`} />
                        趋势预测 - {prediction.timeframe}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          prediction.direction === "bullish" ? "default" :
                          prediction.direction === "bearish" ? "destructive" : "outline"
                        }>
                          {prediction.direction === "bullish" ? "看涨" :
                           prediction.direction === "bearish" ? "看跌" : "震荡"}
                        </Badge>
                        <Badge variant="secondary">
                          概率: {prediction.probability}%
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">目标价位</span>
                          <span className="font-medium text-green-600">{prediction.target}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">止损价位</span>
                          <span className="font-medium text-red-600">{prediction.stopLoss}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">风险收益比</span>
                          <span className="font-medium">
                            {((prediction.target - 3250) / (3250 - prediction.stopLoss)).toFixed(2)}:1
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50 rounded-lg">
                        <h4 className="font-medium text-sm mb-2">预测依据</h4>
                        <p className="text-sm">{prediction.reasoning}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">关键影响因素</h4>
                      <div className="flex flex-wrap gap-2">
                        {prediction.keyFactors.map((factor, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {factor}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        <AlertTriangle className="h-4 w-4 inline mr-1" />
                        免责声明：本预测基于历史数据和AI模型分析，仅供参考，不构成投资建议。
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        {/* 技术指标 */}
        <TabsContent value="indicators">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  技术指标分析
                </CardTitle>

                <div className="w-full sm:w-64">
                  <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择分析目标" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="market">市场整体</SelectItem>
                      {marketTrends.map((trend) => (
                        <SelectItem key={trend.id} value={trend.id}>
                          {trend.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* 分析目标信息 */}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">
                        {selectedTarget === "market"
                          ? "市场整体技术指标分析"
                          : `${
                              marketTrends.find(t => t.id === selectedTarget)?.name || "未知指数"
                            } 技术指标分析`
                        }
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedTarget === "market"
                          ? "基于市场整体数据的技术指标分析，反映整体市场趋势和动能"
                          : `当前价格: ${
                              marketTrends.find(t => t.id === selectedTarget)?.currentValue.toFixed(2) || "N/A"
                            }, 涨跌: ${
                              marketTrends.find(t => t.id === selectedTarget)?.change.toFixed(2) || "N/A"
                            } (${
                              marketTrends.find(t => t.id === selectedTarget)?.changePercent.toFixed(2) || "N/A"
                            }%)`
                        }
                      </p>
                    </div>
                    {selectedTarget !== "market" && (
                      <Badge variant={
                        marketTrends.find(t => t.id === selectedTarget)?.trend === "up" ? "default" :
                        marketTrends.find(t => t.id === selectedTarget)?.trend === "down" ? "destructive" : "outline"
                      }>
                        {marketTrends.find(t => t.id === selectedTarget)?.trend === "up" ? "上涨" :
                         marketTrends.find(t => t.id === selectedTarget)?.trend === "down" ? "下跌" : "震荡"}
                      </Badge>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">主要技术指标</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {getTechnicalIndicators(selectedTarget).map((indicator, idx) => (
                      <div key={idx} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{indicator.name}</span>
                          <span className={`text-sm ${
                            indicator.status === "positive" ? "text-green-600" :
                            indicator.status === "negative" ? "text-red-600" : "text-gray-600"
                          }`}>
                            {indicator.value}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">{indicator.description}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">技术面总结</h4>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm">
                      {getTechnicalSummary(selectedTarget)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium mb-2">积极信号</h4>
                    <ul className="text-sm space-y-1">
                      {getPositiveSignals(selectedTarget).map((signal, idx) => (
                        <li key={idx}>• {signal}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <h4 className="font-medium mb-2">风险提示</h4>
                    <ul className="text-sm space-y-1">
                      {getRiskWarnings(selectedTarget).map((warning, idx) => (
                        <li key={idx}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )

  // 根据选择的目标获取技术指标
  function getTechnicalIndicators(targetId: string) {
    if (targetId === "market") {
      // 市场整体技术指标
      return [
        { name: "RSI", value: 58.2, status: "neutral", description: "相对强弱指标" },
        { name: "MACD", value: 12.5, status: "positive", description: "移动平均收敛发散" },
        { name: "KDJ", value: 72.3, status: "positive", description: "随机指标" },
        { name: "BOLL", value: 1.2, status: "neutral", description: "布林带宽度" },
        { name: "VOL", value: 1.5, status: "positive", description: "成交量比率" },
        { name: "OBV", value: 85.6, status: "positive", description: "能量潮" },
        { name: "ADX", value: 32.4, status: "neutral", description: "平均趋向指数" },
        { name: "ATR", value: 18.7, status: "neutral", description: "平均真实波幅" }
      ]
    } else {
      // 具体指数的技术指标
      const trend = marketTrends.find(t => t.id === targetId)
      if (!trend) return []

      // 根据趋势状态调整指标值
      const baseValue = trend.trend === "up" ? 1.0 : trend.trend === "down" ? 0.8 : 0.9
      return [
        { name: "MA60", value: trend.indicators.find(i => i.name === "MA60")?.value || 0, status: trend.indicators.find(i => i.name === "MA60")?.status || "neutral", description: "60日移动平均线" },
        { name: "RSI", value: trend.indicators.find(i => i.name === "RSI")?.value || (50 + (trend.trend === "up" ? 8 : trend.trend === "down" ? -8 : 0)), status: trend.indicators.find(i => i.name === "RSI")?.status || "neutral", description: "相对强弱指标" },
        { name: "MACD", value: trend.indicators.find(i => i.name === "MACD")?.value || (trend.trend === "up" ? 15 : trend.trend === "down" ? -5 : 2), status: trend.indicators.find(i => i.name === "MACD")?.status || "neutral", description: "移动平均收敛发散" },
        { name: "成交量", value: trend.indicators.find(i => i.name === "成交量")?.value || baseValue, status: trend.indicators.find(i => i.name === "成交量")?.status || "neutral", description: "成交量比率" },
        { name: "KDJ", value: trend.trend === "up" ? 75 : trend.trend === "down" ? 35 : 50, status: trend.trend === "up" ? "positive" : trend.trend === "down" ? "negative" : "neutral", description: "随机指标" },
        { name: "BOLL", value: 1.0, status: "neutral", description: "布林带宽度" },
        { name: "OBV", value: trend.trend === "up" ? 90 : trend.trend === "down" ? 60 : 75, status: trend.trend === "up" ? "positive" : "neutral", description: "能量潮" },
        { name: "ATR", value: 20.5, status: "neutral", description: "平均真实波幅" }
      ]
    }
  }

  // 获取技术面总结
  function getTechnicalSummary(targetId: string) {
    if (targetId === "market") {
      return "当前技术面整体偏多，主要技术指标显示市场处于健康上涨状态。RSI指标处于中性偏强区域，MACD金叉向上，成交量温和放大。但需要注意部分指标已接近超买区域，短期可能有技术性调整需求。"
    } else {
      const trend = marketTrends.find(t => t.id === targetId)
      if (!trend) return "暂无技术面分析数据"

      if (trend.trend === "up") {
        return `${trend.name}技术面整体偏多，主要技术指标显示处于健康上涨状态。RSI指标处于中性偏强区域，MACD金叉向上，成交量温和放大。但需要注意部分指标已接近超买区域，短期可能有技术性调整需求。`
      } else if (trend.trend === "down") {
        return `${trend.name}技术面整体偏空，主要技术指标显示处于调整状态。RSI指标处于中性偏弱区域，MACD死叉向下，成交量萎缩。需要关注下方支撑位和成交量变化。`
      } else {
        return `${trend.name}技术面处于震荡整理状态，主要技术指标显示多空力量均衡。RSI指标处于中性区域，MACD接近零轴，成交量平稳。需要等待方向性突破。`
      }
    }
  }

  // 获取积极信号
  function getPositiveSignals(targetId: string) {
    if (targetId === "market") {
      return [
        "MACD金叉向上，多头信号明确",
        "成交量温和放大，资金参与积极",
        "均线系统呈多头排列",
        "OBV指标持续上升"
      ]
    } else {
      const trend = marketTrends.find(t => t.id === targetId)
      if (!trend) return ["暂无积极信号"]

      if (trend.trend === "up") {
        return [
          "MACD金叉向上，多头信号明确",
          "成交量温和放大，资金参与积极",
          "均线系统呈多头排列",
          "RSI处于健康上涨区域"
        ]
      } else if (trend.trend === "down") {
        return [
          "RSI接近超卖区域，可能有反弹机会",
          "成交量萎缩，抛压减轻",
          "接近重要支撑位",
          "技术指标出现背离迹象"
        ]
      } else {
        return [
          "技术指标处于中性区域",
          "成交量平稳，多空均衡",
          "波动率较低，风险可控",
          "等待方向性突破"
        ]
      }
    }
  }

  // 获取风险提示
  function getRiskWarnings(targetId: string) {
    if (targetId === "market") {
      return [
        "RSI接近超买区域",
        "部分指标出现背离迹象",
        "需要关注成交量持续性",
        "外部市场波动影响"
      ]
    } else {
      const trend = marketTrends.find(t => t.id === targetId)
      if (!trend) return ["暂无风险提示"]

      if (trend.trend === "up") {
        return [
          "RSI接近超买区域",
          "短期涨幅较大，有调整需求",
          "需要关注成交量能否持续放大",
          "注意高位获利了结压力"
        ]
      } else if (trend.trend === "down") {
        return [
          "技术面整体偏空",
          "均线系统呈空头排列",
          "成交量萎缩，缺乏买盘",
          "需要关注下方支撑有效性"
        ]
      } else {
        return [
          "方向不明，震荡时间可能延长",
          "成交量不足，突破动力有限",
          "需要等待明确的方向信号",
          "外部因素可能打破平衡"
        ]
      }
    }
  }
}