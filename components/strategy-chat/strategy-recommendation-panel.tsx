"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import {
  Brain,
  // Filter, // 未使用
  Search,
  // TrendingUp, // 未使用
  // BarChart3, // 未使用
  RefreshCw,
  Download,
  Share2,
  Bookmark,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StrategyRecommendationCard, StrategyRecommendation } from "./strategy-recommendation"
import { cn } from "@/lib/utils"

// Map API risk levels to component risk levels
const mapRiskLevel = (level: string): StrategyRecommendation["riskLevel"] => {
  if (level === "低") return "low"
  if (level === "高") return "high"
  return "medium"
}

// Map API strategy names to investment styles
const mapInvestmentStyle = (name: string): StrategyRecommendation["investmentStyle"] => {
  if (name.includes("价值") || name.includes("防守")) return "value"
  if (name.includes("成长")) return "growth"
  if (name.includes("情绪") || name.includes("动量")) return "momentum"
  if (name.includes("宏观") || name.includes("对冲")) return "macro"
  if (name.includes("量化")) return "quant"
  return "technical"
}

// Map time horizon text to enum
const mapTimeHorizon = (text: string): StrategyRecommendation["timeHorizon"] => {
  if (text.includes("1-3") || text.includes("短")) return "short"
  if (text.includes("12") || text.includes("24") || text.includes("长")) return "long"
  return "medium"
}

// Convert API strategies to StrategyRecommendation format
const convertApiStrategy = (apiStrategy: any, index: number): StrategyRecommendation => {
  const style = mapInvestmentStyle(apiStrategy.name)
  const risk = mapRiskLevel(apiStrategy.riskLevel)
  const timeHorizon = mapTimeHorizon(apiStrategy.timeHorizon || "")
  const tags: string[] = apiStrategy.keyFactors?.slice(0, 3) || []

  return {
    id: apiStrategy.id || `strategy-${index}`,
    title: apiStrategy.name,
    description: apiStrategy.description,
    investmentStyle: style,
    riskLevel: risk,
    expectedReturn: parseFloat(apiStrategy.expectedReturn?.replace(/[^0-9.-]/g, '') || '15'),
    confidence: apiStrategy.confidence || 80,
    timeHorizon,
    aiModel: "deepseek",
    reasoning: apiStrategy.keyFactors || [],
    keyMetrics: [
      { label: "置信度", value: `${apiStrategy.confidence}%` },
      { label: "预期收益", value: apiStrategy.expectedReturn },
      { label: "投资期限", value: apiStrategy.timeHorizon },
    ],
    recommendedStocks: (apiStrategy.recommendedStocks || []).map((code: string, i: number) => ({
      symbol: code,
      name: code,
      weight: Math.round(100 / Math.max((apiStrategy.recommendedStocks || []).length, 1)),
      rationale: "AI推荐",
    })),
    timestamp: new Date(apiStrategy.lastUpdated || Date.now()),
    tags,
  }
}

interface StrategyRecommendationPanelProps {
  className?: string
}

export function StrategyRecommendationPanel({ className }: StrategyRecommendationPanelProps) {
  const [strategies, setStrategies] = useState<StrategyRecommendation[]>([])
  const [filteredStrategies, setFilteredStrategies] = useState<StrategyRecommendation[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStyle, setSelectedStyle] = useState<string>("all")
  const [selectedRisk, setSelectedRisk] = useState<string>("all")
  const [selectedModel, setSelectedModel] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(false)
  const [_selectedStrategy, _setSelectedStrategy] = useState<StrategyRecommendation | null>(null)

  // 从API加载策略数据
  const loadStrategies = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/strategy-recommendation')
      const data = await response.json()
      if (data.success && data.strategies) {
        const converted = data.strategies.map(convertApiStrategy)
        setStrategies(converted)
        setFilteredStrategies(converted)
      }
    } catch (error) {
      console.error('加载策略失败:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 初始化数据
  useEffect(() => {
    loadStrategies()
  }, [loadStrategies])

  // 过滤策略
  useEffect(() => {
    let filtered = strategies

    // 搜索过滤
    if (searchQuery) {
      filtered = filtered.filter(
        (strategy) =>
          strategy.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          strategy.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          strategy.tags.some((tag) =>
            tag.toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    }

    // 投资风格过滤
    if (selectedStyle !== "all") {
      filtered = filtered.filter(
        (strategy) => strategy.investmentStyle === selectedStyle
      )
    }

    // 风险等级过滤
    if (selectedRisk !== "all") {
      filtered = filtered.filter(
        (strategy) => strategy.riskLevel === selectedRisk
      )
    }

    // AI模型过滤
    if (selectedModel !== "all") {
      filtered = filtered.filter(
        (strategy) => strategy.aiModel === selectedModel
      )
    }

    setFilteredStrategies(filtered)
  }, [strategies, searchQuery, selectedStyle, selectedRisk, selectedModel])

  const handleRefresh = () => {
    loadStrategies()
  }

  const handleSelectStrategy = (strategy: StrategyRecommendation) => {
    _setSelectedStrategy(strategy)
    console.log("策略已选择:", strategy)
    // 这里可以添加策略应用逻辑
  }

  const handleExport = () => {
    // 导出策略数据
    const dataStr = JSON.stringify(filteredStrategies, null, 2)
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`
    const link = document.createElement("a")
    link.setAttribute("href", dataUri)
    link.setAttribute("download", `strategies-${new Date().toISOString().split("T")[0]}.json`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getStats = () => {
    const total = strategies.length
    const highReturn = strategies.filter(s => s.expectedReturn > 15).length
    const highConfidence = strategies.filter(s => s.confidence > 80).length
    const deepseekStrategies = strategies.filter(s => s.aiModel === "deepseek").length

    return { total, highReturn, highConfidence, deepseekStrategies }
  }

  const stats = getStats()

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="h-6 w-6 text-blue-500" />
            <CardTitle className="text-xl font-bold">
              DeepSeek策略推荐
            </CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
              DeepSeek: {stats.deepseekStrategies}
            </Badge>
            <Badge variant="outline" className="bg-green-500/10 text-green-500">
              高收益: {stats.highReturn}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 搜索和过滤 */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索策略标题、描述或标签..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              刷新
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={selectedStyle} onValueChange={setSelectedStyle}>
              <SelectTrigger>
                <SelectValue placeholder="投资风格" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有风格</SelectItem>
                <SelectItem value="value">价值投资</SelectItem>
                <SelectItem value="growth">成长投资</SelectItem>
                <SelectItem value="momentum">动量交易</SelectItem>
                <SelectItem value="macro">宏观对冲</SelectItem>
                <SelectItem value="quant">量化策略</SelectItem>
                <SelectItem value="technical">技术分析</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedRisk} onValueChange={setSelectedRisk}>
              <SelectTrigger>
                <SelectValue placeholder="风险等级" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有风险</SelectItem>
                <SelectItem value="low">低风险</SelectItem>
                <SelectItem value="medium">中风险</SelectItem>
                <SelectItem value="high">高风险</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger>
                <SelectValue placeholder="AI模型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有模型</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
                <SelectItem value="claude">Claude</SelectItem>
                <SelectItem value="gpt">GPT</SelectItem>
                <SelectItem value="gemini">Gemini</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 策略列表 */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="all">全部策略</TabsTrigger>
            <TabsTrigger value="high-return">高收益</TabsTrigger>
            <TabsTrigger value="high-confidence">高置信度</TabsTrigger>
            <TabsTrigger value="recent">最新</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {filteredStrategies.length > 0 ? (
              filteredStrategies.map((strategy) => (
                <StrategyRecommendationCard
                  key={strategy.id}
                  strategy={strategy}
                  onSelect={handleSelectStrategy}
                />
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                未找到符合条件的策略
              </div>
            )}
          </TabsContent>

          <TabsContent value="high-return" className="space-y-4">
            {filteredStrategies
              .filter(s => s.expectedReturn > 15)
              .map((strategy) => (
                <StrategyRecommendationCard
                  key={strategy.id}
                  strategy={strategy}
                  onSelect={handleSelectStrategy}
                />
              ))}
          </TabsContent>

          <TabsContent value="high-confidence" className="space-y-4">
            {filteredStrategies
              .filter(s => s.confidence > 80)
              .map((strategy) => (
                <StrategyRecommendationCard
                  key={strategy.id}
                  strategy={strategy}
                  onSelect={handleSelectStrategy}
                />
              ))}
          </TabsContent>

          <TabsContent value="recent" className="space-y-4">
            {[...filteredStrategies]
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .slice(0, 3)
              .map((strategy) => (
                <StrategyRecommendationCard
                  key={strategy.id}
                  strategy={strategy}
                  onSelect={handleSelectStrategy}
                />
              ))}
          </TabsContent>
        </Tabs>

        {/* 操作按钮 */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            共 {filteredStrategies.length} 个策略
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              分享
            </Button>
            <Button variant="outline" size="sm">
              <Bookmark className="h-4 w-4 mr-2" />
              收藏
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}