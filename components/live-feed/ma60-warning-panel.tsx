"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { AlertTriangle, Filter, BellOff, Bell } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Toggle } from "@/components/ui/toggle"
import { MA60Warning, MA60WarningData } from "./ma60-warning"
import { cn } from "@/lib/utils"

interface MA60WarningPanelProps {
  className?: string
  maxWarnings?: number
}

// 生成模拟MA60警告数据
const generateMockWarnings = (count: number): MA60WarningData[] => {
  const symbols = ["000001.SZ", "000002.SZ", "600519.SH", "300750.SZ", "002415.SZ"]
  const names = ["平安银行", "万科A", "贵州茅台", "宁德时代", "海康威视"]
  const severities: MA60WarningData["severity"][] = ["low", "medium", "high", "critical"]

  return Array.from({ length: count }, (_, i) => {
    const symbolIndex = i % symbols.length
    const severity = severities[Math.floor(Math.random() * severities.length)]
    const basePrice = 100 + Math.random() * 900
    const breakPercentage = 1 + Math.random() * 5 // 1-6%破位

    return {
      id: `ma60-warning-${Date.now()}-${i}`,
      symbol: symbols[symbolIndex],
      name: names[symbolIndex],
      currentPrice: basePrice * (1 - breakPercentage / 100),
      ma60Price: basePrice,
      breakPercentage,
      volumeRatio: 1 + Math.random() * 2, // 1-3x
      breakDuration: Math.random() * 24, // 0-24小时
      timestamp: new Date(Date.now() - Math.random() * 3600000), // 过去1小时内
      severity,
      previousSupport: basePrice * (1 - (breakPercentage + 2) / 100),
      nextSupport: basePrice * (1 - (breakPercentage + 5) / 100),
    }
  })
}

export function MA60WarningPanel({
  className,
  maxWarnings = 5,
}: MA60WarningPanelProps) {
  const [warnings, setWarnings] = useState<MA60WarningData[]>([])
  const [filteredWarnings, setFilteredWarnings] = useState<MA60WarningData[]>([])
  const [isMuted, setIsMuted] = useState(false)
  const [showCriticalOnly, setShowCriticalOnly] = useState(false)
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set())

  // 初始化数据
  useEffect(() => {
    const mockWarnings = generateMockWarnings(maxWarnings)
    setWarnings(mockWarnings)
    setFilteredWarnings(mockWarnings)
  }, [maxWarnings])

  // 过滤警告
  useEffect(() => {
    let filtered = warnings.filter(w => !acknowledgedIds.has(w.id))

    if (showCriticalOnly) {
      filtered = filtered.filter(w => w.severity === "critical" || w.severity === "high")
    }

    setFilteredWarnings(filtered)
  }, [warnings, showCriticalOnly, acknowledgedIds])

  const handleAcknowledge = (id: string) => {
    setAcknowledgedIds(prev => new Set([...prev, id]))
  }

  const handleClearAll = () => {
    const allIds = warnings.map(w => w.id)
    setAcknowledgedIds(new Set(allIds))
  }

  const handleRefresh = () => {
    const newWarnings = generateMockWarnings(2) // 新增2个警告
    setWarnings(prev => [...newWarnings, ...prev.slice(0, maxWarnings - 2)])
  }

  const getWarningStats = () => {
    const critical = warnings.filter(w => w.severity === "critical").length
    const high = warnings.filter(w => w.severity === "high").length
    const active = warnings.filter(w => !acknowledgedIds.has(w.id)).length

    return { critical, high, active }
  }

  const stats = getWarningStats()

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <CardTitle className="text-lg font-semibold">
              MA60破位监控
            </CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="destructive" className="font-semibold">
              活跃: {stats.active}
            </Badge>
            <Badge variant="outline" className="bg-red-500/10 text-red-500">
              严重: {stats.critical}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 控制面板 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Toggle
              pressed={showCriticalOnly}
              onPressedChange={setShowCriticalOnly}
              variant="outline"
              size="sm"
              aria-label="仅显示严重警告"
            >
              <Filter className="h-4 w-4" />
              <span className="ml-2 text-sm">仅严重</span>
            </Toggle>

            <Toggle
              pressed={isMuted}
              onPressedChange={setIsMuted}
              variant="outline"
              size="sm"
              aria-label="静音警告"
            >
              {isMuted ? (
                <BellOff className="h-4 w-4" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
              <span className="ml-2 text-sm">
                {isMuted ? "已静音" : "静音"}
              </span>
            </Toggle>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={acknowledgedIds.size === warnings.length}
            >
              全部确认
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
            >
              刷新
            </Button>
          </div>
        </div>

        {/* 警告列表 */}
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
          {filteredWarnings.length > 0 ? (
            filteredWarnings.map((warning) => (
              <MA60Warning
                key={warning.id}
                warning={warning}
                onAcknowledge={handleAcknowledge}
              />
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {acknowledgedIds.size === warnings.length
                ? "所有警告已确认"
                : "暂无符合条件的MA60破位警告"}
            </div>
          )}
        </div>

        {/* 统计信息 */}
        <div className="pt-4 border-t">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-muted-foreground">总警告数</div>
              <div className="font-semibold">{warnings.length}</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">已确认</div>
              <div className="font-semibold">{acknowledgedIds.size}</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">待处理</div>
              <div className="font-semibold text-red-500">
                {warnings.length - acknowledgedIds.size}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}