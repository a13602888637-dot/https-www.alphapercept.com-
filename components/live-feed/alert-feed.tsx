"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { Play, Pause, RefreshCw, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LiveStockCard, StockAlert } from "./live-stock-card"
import { cn } from "@/lib/utils"

interface AlertFeedProps {
  className?: string
  autoScroll?: boolean
  scrollSpeed?: number // 毫秒
}

// 模拟数据生成函数
const generateMockAlerts = (count: number): StockAlert[] => {
  const symbols = ["000001.SZ", "000002.SZ", "600519.SH", "300750.SZ", "002415.SZ"]
  const names = ["平安银行", "万科A", "贵州茅台", "宁德时代", "海康威视"]
  const alertTypes: StockAlert["alertType"][] = [
    "price_breakout",
    "ma60_break",
    "volume_surge",
    "news_alert",
  ]

  return Array.from({ length: count }, (_, i) => {
    const symbolIndex = i % symbols.length
    const alertType = alertTypes[Math.floor(Math.random() * alertTypes.length)]
    const basePrice = 100 + Math.random() * 900
    const changePercent = (Math.random() * 10 - 5) // -5% 到 +5%
    const change = basePrice * (changePercent / 100)

    return {
      id: `alert-${Date.now()}-${i}`,
      symbol: symbols[symbolIndex],
      name: names[symbolIndex],
      price: basePrice,
      change,
      changePercent,
      volume: Math.floor(Math.random() * 10000000) + 1000000,
      alertType,
      timestamp: new Date(Date.now() - Math.random() * 600000), // 过去10分钟内
      description: getAlertDescription(alertType, symbols[symbolIndex], names[symbolIndex]),
    }
  })
}

const getAlertDescription = (
  alertType: StockAlert["alertType"],
  symbol: string,
  name: string
): string => {
  switch (alertType) {
    case "price_breakout":
      return `${name}(${symbol})价格突破关键阻力位`
    case "ma60_break":
      return `${name}(${symbol})跌破60日移动平均线，注意风险`
    case "volume_surge":
      return `${name}(${symbol})成交量异常放大，关注资金流向`
    case "news_alert":
      return `${name}(${symbol})相关重大新闻发布`
    default:
      return `${name}(${symbol})市场异动`
  }
}

export function AlertFeed({
  className,
  autoScroll = true,
  scrollSpeed = 3000,
}: AlertFeedProps) {
  const [alerts, setAlerts] = useState<StockAlert[]>([])
  const [isPlaying, setIsPlaying] = useState(autoScroll)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  // 初始化模拟数据
  useEffect(() => {
    setAlerts(generateMockAlerts(10).sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ))
  }, [])

  // 自动滚动逻辑
  useEffect(() => {
    if (!isPlaying || alerts.length === 0) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % alerts.length)
    }, scrollSpeed)

    return () => clearInterval(interval)
  }, [isPlaying, alerts.length, scrollSpeed])

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const handleRefresh = useCallback(() => {
    setIsLoading(true)
    // 模拟API调用延迟
    setTimeout(() => {
      const newAlerts = generateMockAlerts(5)
      setAlerts((prev) => [
        ...newAlerts,
        ...prev.slice(0, 15), // 保持最多15条记录
      ])
      setIsLoading(false)
    }, 500)
  }, [])

  const handleAlertClick = (alert: StockAlert) => {
    console.log("Alert clicked:", alert)
    // 这里可以添加点击后的逻辑，比如跳转到详情页
  }

  const getAlertStats = () => {
    const ma60Breaks = alerts.filter(a => a.alertType === "ma60_break").length
    const priceBreakouts = alerts.filter(a => a.alertType === "price_breakout").length
    return { ma60Breaks, priceBreakouts }
  }

  const stats = getAlertStats()

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <CardTitle className="text-lg font-semibold">实时市场警报</CardTitle>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="bg-red-500/10 text-red-500">
            MA60破位: {stats.ma60Breaks}
          </Badge>
          <Badge variant="outline" className="bg-green-500/10 text-green-500">
            突破: {stats.priceBreakouts}
          </Badge>
          <div className="flex items-center space-x-1">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePlayPause}
              className="h-8 w-8"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-8 w-8"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground mb-2">
          当前显示: {currentIndex + 1} / {alerts.length}
        </div>

        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
          {alerts.map((alert, index) => (
            <div
              key={alert.id}
              className={cn(
                "transition-all duration-300",
                index === currentIndex && "ring-2 ring-primary/50"
              )}
              onClick={() => handleAlertClick(alert)}
            >
              <LiveStockCard alert={alert} />
            </div>
          ))}
        </div>

        {alerts.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            暂无市场警报
          </div>
        )}
      </CardContent>
    </Card>
  )
}