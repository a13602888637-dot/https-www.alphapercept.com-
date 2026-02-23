"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { AlertTriangle, TrendingDown, Clock, BarChart3 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export interface MA60WarningData {
  id: string
  symbol: string
  name: string
  currentPrice: number
  ma60Price: number
  breakPercentage: number // 跌破百分比
  volumeRatio: number // 成交量比率 (当前/平均)
  breakDuration: number // 破位持续时间(小时)
  timestamp: Date
  severity: "low" | "medium" | "high" | "critical"
  previousSupport?: number // 前支撑位
  nextSupport?: number // 下一支撑位
}

interface MA60WarningProps {
  warning: MA60WarningData
  className?: string
  onAcknowledge?: (id: string) => void
}

export function MA60Warning({ warning, className, onAcknowledge }: MA60WarningProps) {
  const [isAcknowledged, setIsAcknowledged] = useState(false)
  const [pulse, setPulse] = useState(true)

  // 脉冲动画效果
  useEffect(() => {
    const interval = setInterval(() => {
      setPulse((prev) => !prev)
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  const getSeverityColor = () => {
    switch (warning.severity) {
      case "low":
        return "text-yellow-500"
      case "medium":
        return "text-orange-500"
      case "high":
        return "text-red-500"
      case "critical":
        return "text-red-700"
    }
  }

  const getSeverityBg = () => {
    switch (warning.severity) {
      case "low":
        return "bg-yellow-500/10"
      case "medium":
        return "bg-orange-500/10"
      case "high":
        return "bg-red-500/10"
      case "critical":
        return "bg-red-700/10"
    }
  }

  const getSeverityText = () => {
    switch (warning.severity) {
      case "low":
        return "轻度破位"
      case "medium":
        return "中度破位"
      case "high":
        return "严重破位"
      case "critical":
        return "极度危险"
    }
  }

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatDuration = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}分钟`
    }
    return `${hours.toFixed(1)}小时`
  }

  const handleAcknowledge = () => {
    setIsAcknowledged(true)
    if (onAcknowledge) {
      onAcknowledge(warning.id)
    }
  }

  return (
    <Card
      className={cn(
        "border-red-500/50 transition-all duration-300",
        pulse && "shadow-lg shadow-red-500/20",
        isAcknowledged && "opacity-70",
        getSeverityBg(),
        className
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className={cn("h-5 w-5", getSeverityColor())} />
            <CardTitle className="text-lg font-semibold">
              MA60破位警告
            </CardTitle>
          </div>
          <Badge variant="destructive" className="font-semibold">
            {getSeverityText()}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="font-medium">
            {warning.symbol} - {warning.name}
          </div>
          <div className="flex items-center text-muted-foreground">
            <Clock className="mr-1 h-3 w-3" />
            {formatTime(warning.timestamp)}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 价格信息 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">当前价格</div>
            <div className="text-2xl font-bold text-red-600">
              ¥{warning.currentPrice.toFixed(2)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">MA60价格</div>
            <div className="text-2xl font-bold">
              ¥{warning.ma60Price.toFixed(2)}
            </div>
          </div>
        </div>

        {/* 破位程度 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center">
              <TrendingDown className="mr-1 h-4 w-4 text-red-500" />
              <span>破位程度</span>
            </div>
            <span className="font-semibold text-red-600">
              -{warning.breakPercentage.toFixed(2)}%
            </span>
          </div>
          <Progress
            value={Math.min(warning.breakPercentage * 10, 100)}
            className={cn(
              "h-2",
              warning.severity === "critical" ? "[&>div]:bg-red-700" :
              warning.severity === "high" ? "[&>div]:bg-red-600" :
              warning.severity === "medium" ? "[&>div]:bg-orange-500" : "[&>div]:bg-yellow-500"
            )}
          />
        </div>

        {/* 技术指标 */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="text-muted-foreground">成交量比率</div>
            <div className="flex items-center">
              <BarChart3 className="mr-1 h-4 w-4" />
              <span className={cn(
                "font-semibold",
                warning.volumeRatio > 1.5 ? "text-red-500" :
                warning.volumeRatio > 1.2 ? "text-orange-500" : "text-yellow-500"
              )}>
                {warning.volumeRatio.toFixed(1)}x
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">破位时长</div>
            <div className="font-semibold">
              {formatDuration(warning.breakDuration)}
            </div>
          </div>
        </div>

        {/* 支撑位信息 */}
        {(warning.previousSupport || warning.nextSupport) && (
          <div className="pt-2 border-t">
            <div className="text-sm font-medium mb-2">支撑位分析</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {warning.previousSupport && (
                <div>
                  <div className="text-muted-foreground">前支撑位</div>
                  <div className="font-semibold">
                    ¥{warning.previousSupport.toFixed(2)}
                  </div>
                </div>
              )}
              {warning.nextSupport && (
                <div>
                  <div className="text-muted-foreground">下一支撑位</div>
                  <div className="font-semibold text-blue-500">
                    ¥{warning.nextSupport.toFixed(2)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        {!isAcknowledged && (
          <div className="pt-4">
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={handleAcknowledge}
            >
              确认警告
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}