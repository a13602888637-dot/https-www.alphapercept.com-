"use client"

import * as React from "react"
import { useState } from "react"
import {
  Brain,
  TrendingUp,
  Shield,
  Target,
  BarChart3,
  Clock,
  DollarSign,
  Users,
  Zap,
  Star,
  ChevronRight,
  ExternalLink,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export interface StrategyRecommendation {
  id: string
  title: string
  description: string
  investmentStyle: "value" | "growth" | "momentum" | "macro" | "quant" | "technical"
  riskLevel: "low" | "medium" | "high"
  expectedReturn: number // 预期收益率百分比
  confidence: number // 置信度百分比
  timeHorizon: "short" | "medium" | "long" // 投资期限
  aiModel: "deepseek" | "claude" | "gpt" | "gemini"
  reasoning: string[]
  keyMetrics: {
    label: string
    value: string
    change?: number
  }[]
  recommendedStocks?: {
    symbol: string
    name: string
    weight: number // 权重百分比
    rationale: string
  }[]
  timestamp: Date
  tags: string[]
}

interface StrategyRecommendationProps {
  strategy: StrategyRecommendation
  className?: string
  expanded?: boolean
  onSelect?: (strategy: StrategyRecommendation) => void
}

export function StrategyRecommendationCard({
  strategy,
  className,
  expanded = false,
  onSelect,
}: StrategyRecommendationProps) {
  const [isExpanded, setIsExpanded] = useState(expanded)

  const getInvestmentStyleIcon = () => {
    switch (strategy.investmentStyle) {
      case "value":
        return <Shield className="h-4 w-4" />
      case "growth":
        return <TrendingUp className="h-4 w-4" />
      case "momentum":
        return <Zap className="h-4 w-4" />
      case "macro":
        return <BarChart3 className="h-4 w-4" />
      case "quant":
        return <Brain className="h-4 w-4" />
      case "technical":
        return <Target className="h-4 w-4" />
    }
  }

  const getInvestmentStyleColor = () => {
    switch (strategy.investmentStyle) {
      case "value":
        return "bg-blue-500/10 text-blue-500"
      case "growth":
        return "bg-green-500/10 text-green-500"
      case "momentum":
        return "bg-purple-500/10 text-purple-500"
      case "macro":
        return "bg-orange-500/10 text-orange-500"
      case "quant":
        return "bg-indigo-500/10 text-indigo-500"
      case "technical":
        return "bg-cyan-500/10 text-cyan-500"
    }
  }

  const getRiskLevelColor = () => {
    switch (strategy.riskLevel) {
      case "low":
        return "bg-green-500/10 text-green-500"
      case "medium":
        return "bg-yellow-500/10 text-yellow-500"
      case "high":
        return "bg-red-500/10 text-red-500"
    }
  }

  const getTimeHorizonText = () => {
    switch (strategy.timeHorizon) {
      case "short":
        return "短期 (1-3个月)"
      case "medium":
        return "中期 (3-12个月)"
      case "long":
        return "长期 (1年以上)"
    }
  }

  const getAIModelColor = () => {
    switch (strategy.aiModel) {
      case "deepseek":
        return "bg-gradient-to-r from-blue-500 to-purple-500"
      case "claude":
        return "bg-gradient-to-r from-orange-500 to-red-500"
      case "gpt":
        return "bg-gradient-to-r from-green-500 to-emerald-500"
      case "gemini":
        return "bg-gradient-to-r from-blue-400 to-cyan-400"
    }
  }

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const handleSelect = () => {
    if (onSelect) {
      onSelect(strategy)
    }
  }

  const handleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <Card className={cn("transition-all duration-300 hover:shadow-lg", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className={cn("p-1.5 rounded-md", getInvestmentStyleColor())}>
                {getInvestmentStyleIcon()}
              </div>
              <CardTitle className="text-lg font-semibold">
                {strategy.title}
              </CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              {strategy.description}
            </p>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <div className={cn("px-2 py-1 rounded-full text-xs font-medium", getAIModelColor())}>
              {strategy.aiModel.toUpperCase()}
            </div>
            <Badge variant="outline" className={getRiskLevelColor()}>
              {strategy.riskLevel === "low" ? "低风险" :
               strategy.riskLevel === "medium" ? "中风险" : "高风险"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 关键指标 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <DollarSign className="mr-1 h-3 w-3" />
              预期收益
            </div>
            <div className={cn(
              "text-xl font-bold",
              strategy.expectedReturn >= 0 ? "text-green-500" : "text-red-500"
            )}>
              {strategy.expectedReturn >= 0 ? "+" : ""}
              {strategy.expectedReturn.toFixed(1)}%
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <Brain className="mr-1 h-3 w-3" />
              置信度
            </div>
            <div className="flex items-center">
              <Progress
                value={strategy.confidence}
                className={cn(
                  "h-2 mr-2 flex-1",
                  strategy.confidence > 80 ? "[&>div]:bg-green-500" :
                  strategy.confidence > 60 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-orange-500"
                )}
              />
              <span className="text-sm font-medium">
                {strategy.confidence.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="mr-1 h-3 w-3" />
              投资期限
            </div>
            <div className="text-sm font-medium">
              {getTimeHorizonText()}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <Users className="mr-1 h-3 w-3" />
              适用风格
            </div>
            <div className="text-sm font-medium">
              {strategy.investmentStyle === "value" ? "价值投资" :
               strategy.investmentStyle === "growth" ? "成长投资" :
               strategy.investmentStyle === "momentum" ? "动量交易" :
               strategy.investmentStyle === "macro" ? "宏观对冲" :
               strategy.investmentStyle === "quant" ? "量化策略" : "技术分析"}
            </div>
          </div>
        </div>

        {/* 标签 */}
        <div className="flex flex-wrap gap-2">
          {strategy.tags.map((tag, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        {/* 展开的详细信息 */}
        {isExpanded && (
          <div className="space-y-4 pt-4 border-t">
            {/* 推理过程 */}
            <div>
              <h4 className="text-sm font-semibold mb-2">AI推理过程</h4>
              <ul className="space-y-2 text-sm">
                {strategy.reasoning.map((reason, index) => (
                  <li key={index} className="flex items-start">
                    <Star className="h-3 w-3 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 关键指标 */}
            <div>
              <h4 className="text-sm font-semibold mb-2">关键指标</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {strategy.keyMetrics.map((metric, index) => (
                  <div key={index} className="space-y-1">
                    <div className="text-xs text-muted-foreground">
                      {metric.label}
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium">{metric.value}</span>
                      {metric.change !== undefined && (
                        <span className={cn(
                          "ml-2 text-xs",
                          metric.change >= 0 ? "text-green-500" : "text-red-500"
                        )}>
                          {metric.change >= 0 ? "+" : ""}
                          {metric.change}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 推荐股票 */}
            {strategy.recommendedStocks && strategy.recommendedStocks.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">推荐股票组合</h4>
                <div className="space-y-2">
                  {strategy.recommendedStocks.map((stock, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                    >
                      <div>
                        <div className="font-medium">
                          {stock.symbol} - {stock.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {stock.rationale}
                        </div>
                      </div>
                      <Badge variant="outline">
                        {stock.weight.toFixed(1)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between pt-4 border-t">
        <div className="text-xs text-muted-foreground">
          生成时间: {formatTime(strategy.timestamp)}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExpand}
          >
            {isExpanded ? "收起详情" : "查看详情"}
            <ChevronRight className={cn(
              "ml-1 h-4 w-4 transition-transform",
              isExpanded && "rotate-90"
            )} />
          </Button>
          <Button
            size="sm"
            onClick={handleSelect}
          >
            应用策略
            <ExternalLink className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}