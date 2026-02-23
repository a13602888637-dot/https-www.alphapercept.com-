"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import {
  Brain,
  Filter,
  Search,
  TrendingUp,
  BarChart3,
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

// 生成模拟策略数据
const generateMockStrategies = (count: number): StrategyRecommendation[] => {
  const investmentStyles: StrategyRecommendation["investmentStyle"][] = [
    "value", "growth", "momentum", "macro", "quant", "technical"
  ]
  const riskLevels: StrategyRecommendation["riskLevel"][] = ["low", "medium", "high"]
  const timeHorizons: StrategyRecommendation["timeHorizon"][] = ["short", "medium", "long"]
  const aiModels: StrategyRecommendation["aiModel"][] = ["deepseek", "claude", "gpt", "gemini"]

  const titles = [
    "价值回归策略 - 低估值蓝筹股",
    "成长加速策略 - 科技龙头股",
    "动量突破策略 - 强势股追涨",
    "宏观对冲策略 - 经济周期轮动",
    "量化套利策略 - 统计套利机会",
    "技术分析策略 - 趋势跟踪交易",
    "行业轮动策略 - 政策驱动板块",
    "事件驱动策略 - 财报季机会",
  ]

  const tags = [
    "低估值", "高成长", "政策利好", "技术突破", "资金流入",
    "业绩超预期", "行业龙头", "国产替代", "消费升级", "数字化转型"
  ]

  return Array.from({ length: count }, (_, i) => {
    const style = investmentStyles[i % investmentStyles.length]
    const risk = riskLevels[Math.floor(Math.random() * riskLevels.length)]
    const timeHorizon = timeHorizons[Math.floor(Math.random() * timeHorizons.length)]
    const aiModel = aiModels[Math.floor(Math.random() * aiModels.length)]

    return {
      id: `strategy-${Date.now()}-${i}`,
      title: titles[i % titles.length],
      description: getStrategyDescription(style, risk, timeHorizon),
      investmentStyle: style,
      riskLevel: risk,
      expectedReturn: 5 + Math.random() * 20, // 5-25%
      confidence: 60 + Math.random() * 35, // 60-95%
      timeHorizon,
      aiModel,
      reasoning: [
        "宏观经济指标显示复苏迹象",
        "行业政策面持续利好",
        "技术面出现突破信号",
        "资金流向显示机构增持",
        "估值处于历史低位区间",
      ],
      keyMetrics: [
        { label: "市盈率", value: "15.2", change: -2.1 },
        { label: "市净率", value: "1.8", change: 0.5 },
        { label: "股息率", value: "2.5%", change: 0.3 },
        { label: "ROE", value: "18.5%", change: 1.2 },
        { label: "营收增长", value: "25.3%", change: 3.4 },
        { label: "净利润增长", value: "32.1%", change: 4.2 },
      ],
      recommendedStocks: [
        {
          symbol: "000001.SZ",
          name: "平安银行",
          weight: 25,
          rationale: "估值修复，业绩稳健",
        },
        {
          symbol: "300750.SZ",
          name: "宁德时代",
          weight: 20,
          rationale: "新能源龙头，技术领先",
        },
        {
          symbol: "600519.SH",
          name: "贵州茅台",
          weight: 15,
          rationale: "消费升级，品牌护城河",
        },
      ],
      timestamp: new Date(Date.now() - Math.random() * 86400000), // 过去24小时内
      tags: tags.slice(i % 5, (i % 5) + 3),
    }
  })
}

const getStrategyDescription = (
  style: StrategyRecommendation["investmentStyle"],
  risk: StrategyRecommendation["riskLevel"],
  horizon: StrategyRecommendation["timeHorizon"]
): string => {
  const styleText = style === "value" ? "价值投资" :
                   style === "growth" ? "成长投资" :
                   style === "momentum" ? "动量交易" :
                   style === "macro" ? "宏观对冲" :
                   style === "quant" ? "量化策略" : "技术分析"

  const riskText = risk === "low" ? "低风险" :
                  risk === "medium" ? "中风险" : "高风险"

  const horizonText = horizon === "short" ? "短期" :
                     horizon === "medium" ? "中期" : "长期"

  return `${styleText}策略，${riskText}等级，适合${horizonText}投资者。基于多因子模型和AI分析生成。`
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
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyRecommendation | null>(null)

  // 初始化数据
  useEffect(() => {
    const mockStrategies = generateMockStrategies(8)
    setStrategies(mockStrategies)
    setFilteredStrategies(mockStrategies)
  }, [])

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
    setIsLoading(true)
    // 模拟API调用延迟
    setTimeout(() => {
      const newStrategies = generateMockStrategies(2)
      setStrategies((prev) => [
        ...newStrategies,
        ...prev.slice(0, 6), // 保持最多8条记录
      ])
      setIsLoading(false)
    }, 1000)
  }

  const handleSelectStrategy = (strategy: StrategyRecommendation) => {
    setSelectedStrategy(strategy)
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