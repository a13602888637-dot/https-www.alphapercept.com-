"use client"

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { PulseAnimation, ChangeAnimation } from './PulseAnimation'

export interface MarketIndicatorProps {
  label: string
  value: string
  change: string
  rawChange?: number
  isLoading?: boolean
  error?: string
  isActive?: boolean
  pulseIntensity?: 'low' | 'medium' | 'high'
  compact?: boolean
  className?: string
}

export function MarketIndicator({
  label,
  value,
  change,
  rawChange,
  isLoading = false,
  error,
  isActive = false,
  pulseIntensity = 'medium',
  compact = false,
  className
}: MarketIndicatorProps) {
  const [previousChange, setPreviousChange] = useState<string>(change)
  const [hasUpdated, setHasUpdated] = useState(false)

  // 检测变化并触发动画
  useEffect(() => {
    if (change !== previousChange) {
      setHasUpdated(true)
      setPreviousChange(change)

      // 重置更新状态
      const timer = setTimeout(() => {
        setHasUpdated(false)
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [change, previousChange])

  const isPositive = change.startsWith('+')
  const isNegative = change.startsWith('-')
  const isNorthbound = label === '北向资金'

  // 根据涨跌幅确定脉冲强度
  const getPulseIntensity = () => {
    if (!rawChange) return pulseIntensity

    const absChange = Math.abs(rawChange)
    if (absChange > 3) return 'high'
    if (absChange > 1.5) return 'medium'
    return 'low'
  }

  if (isLoading) {
    return (
      <div className={cn(
        "flex flex-col items-center whitespace-nowrap min-w-0",
        compact ? "px-2" : "px-3",
        className
      )}>
        <div className="h-3 w-12 bg-muted rounded animate-pulse mb-1" />
        <div className="h-5 w-16 bg-muted rounded animate-pulse mb-1" />
        <div className="h-4 w-10 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn(
        "flex flex-col items-center whitespace-nowrap min-w-0 text-muted-foreground",
        compact ? "px-2" : "px-3",
        className
      )}>
        <div className="text-xs opacity-70">{label}</div>
        <div className="text-sm font-medium">--</div>
        <div className="text-xs">--</div>
      </div>
    )
  }

  return (
    <PulseAnimation
      isActive={isActive || hasUpdated}
      intensity={getPulseIntensity()}
      className={cn(
        "flex flex-col items-center whitespace-nowrap min-w-0 rounded-lg transition-colors",
        compact ? "px-2 py-1" : "px-3 py-2",
        (isActive || hasUpdated) ? "bg-blue-50 dark:bg-blue-900/20" : "",
        className
      )}
    >
      {/* 标签 - 小字号，次级颜色 */}
      <div className={cn(
        "text-xs font-medium mb-1",
        compact ? "mb-0.5" : "mb-1",
        isNorthbound ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
      )}>
        {label}
      </div>

      {/* 点位 - 主视觉字体 */}
      <div className={cn(
        "font-bold mb-1 leading-tight",
        compact ? "text-sm mb-0.5" : "text-lg",
        isNorthbound ? "text-blue-700 dark:text-blue-300" : "text-gray-900 dark:text-gray-100"
      )}>
        {value}
      </div>

      {/* 涨跌幅 - 根据正负值赋予颜色 */}
      <div className={cn(
        "font-medium",
        compact ? "text-xs" : "text-sm"
      )}>
        <ChangeAnimation
          change={change}
          previousChange={previousChange}
          className={cn(
            isPositive ? "text-green-600 dark:text-green-400" :
            isNegative ? "text-red-600 dark:text-red-400" :
            "text-gray-600 dark:text-gray-400"
          )}
        />
      </div>
    </PulseAnimation>
  )
}