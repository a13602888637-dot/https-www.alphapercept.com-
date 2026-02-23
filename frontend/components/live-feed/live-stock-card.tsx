"use client"

import * as React from "react"
import { TrendingUp, TrendingDown, AlertTriangle, Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface StockAlert {
  id: string
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  alertType: "price_breakout" | "ma60_break" | "volume_surge" | "news_alert"
  timestamp: Date
  description: string
}

interface LiveStockCardProps {
  alert: StockAlert
  className?: string
}

export function LiveStockCard({ alert, className }: LiveStockCardProps) {
  const isPositive = alert.change >= 0
  const isMA60Break = alert.alertType === "ma60_break"

  const getAlertIcon = () => {
    switch (alert.alertType) {
      case "price_breakout":
        return isPositive ? (
          <TrendingUp className="h-4 w-4 text-green-500" />
        ) : (
          <TrendingDown className="h-4 w-4 text-red-500" />
        )
      case "ma60_break":
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case "volume_surge":
        return <TrendingUp className="h-4 w-4 text-orange-500" />
      case "news_alert":
        return <AlertTriangle className="h-4 w-4 text-blue-500" />
    }
  }

  const getAlertBadge = () => {
    switch (alert.alertType) {
      case "price_breakout":
        return (
          <Badge variant={isPositive ? "default" : "destructive"}>
            {isPositive ? "突破" : "跌破"}
          </Badge>
        )
      case "ma60_break":
        return <Badge variant="destructive">MA60破位</Badge>
      case "volume_surge":
        return <Badge variant="secondary">放量</Badge>
      case "news_alert":
        return <Badge variant="outline">新闻</Badge>
    }
  }

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  return (
    <Card
      className={cn(
        "transition-all duration-300 hover:shadow-lg",
        isMA60Break && "border-red-500/50 bg-red-500/5",
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center space-x-2">
          {getAlertIcon()}
          <CardTitle className="text-sm font-medium">
            {alert.symbol} - {alert.name}
          </CardTitle>
        </div>
        <div className="flex items-center space-x-2">
          {getAlertBadge()}
          <div className="flex items-center text-xs text-muted-foreground">
            <Clock className="mr-1 h-3 w-3" />
            {formatTime(alert.timestamp)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold">
              ¥{alert.price.toFixed(2)}
            </div>
            <div
              className={cn(
                "text-lg font-semibold",
                isPositive ? "text-green-500" : "text-red-500"
              )}
            >
              {isPositive ? "+" : ""}
              {alert.change.toFixed(2)} ({isPositive ? "+" : ""}
              {alert.changePercent.toFixed(2)}%)
            </div>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>成交量: {(alert.volume / 10000).toFixed(0)}万手</div>
            <div className="text-right max-w-[200px] truncate">
              {alert.description}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}