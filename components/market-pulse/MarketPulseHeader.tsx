"use client"

import { RefreshCw, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { MarketIndicator } from './MarketIndicator'
import { useMarketPulse } from '@/hooks/useMarketPulse'

export interface MarketPulseHeaderProps {
  className?: string
  compact?: boolean
  showRefresh?: boolean
  showStatus?: boolean
  showUpdateTime?: boolean
  gradientBackground?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
}

export function MarketPulseHeader({
  className,
  compact = false,
  showRefresh = true,
  showStatus = true,
  showUpdateTime = true,
  gradientBackground = true,
  autoRefresh = true,
  refreshInterval = 30000
}: MarketPulseHeaderProps) {
  const {
    indicators,
    isLoading,
    error,
    lastUpdateTime,
    marketStatus,
    refresh
  } = useMarketPulse(autoRefresh ? refreshInterval : 0)

  // 处理刷新按钮点击
  const handleRefresh = async () => {
    await refresh()
  }

  // 获取市场状态颜色
  const getStatusColor = () => {
    return marketStatus === 'open'
      ? 'text-green-600 dark:text-green-400'
      : 'text-gray-500 dark:text-gray-400'
  }

  // 获取市场状态文本
  const getStatusText = () => {
    return marketStatus === 'open' ? '交易中' : '休市(昨收)'
  }

  return (
    <div className={cn(
      "flex flex-row items-center justify-between",
      gradientBackground
        ? "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10"
        : "bg-background",
      "border-b dark:border-gray-800",
      compact ? "px-3 py-2" : "px-4 py-3",
      className
    )}>
      {/* 左侧：刷新按钮和市场状态 */}
      <div className="flex items-center space-x-3">
        {showRefresh && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
            className={cn(
              "h-7 w-7",
              compact ? "h-6 w-6" : "h-7 w-7"
            )}
            title="刷新数据"
          >
            <RefreshCw className={cn(
              compact ? "h-3 w-3" : "h-4 w-4",
              isLoading ? "animate-spin" : ""
            )} />
          </Button>
        )}

        {showStatus && (
          <div className="flex items-center space-x-1.5">
            <div className={cn(
              "h-2 w-2 rounded-full",
              marketStatus === 'open'
                ? "bg-green-500 animate-pulse"
                : "bg-gray-400"
            )} />
            <span className={cn(
              "text-xs font-medium",
              getStatusColor(),
              compact ? "text-xs" : "text-sm"
            )}>
              {getStatusText()}
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-center space-x-1 text-amber-600 dark:text-amber-400">
            <AlertCircle className={compact ? "h-3 w-3" : "h-4 w-4"} />
            <span className={compact ? "text-xs" : "text-sm"}>数据异常</span>
          </div>
        )}
      </div>

      {/* 中间：四个指数均匀分布 */}
      <div className={cn(
        "flex flex-row items-center justify-between flex-1",
        compact ? "gap-x-2 mx-2" : "gap-x-4 mx-4"
      )}>
        {indicators.map((indicator, index) => (
          <MarketIndicator
            key={`${indicator.label}-${index}`}
            label={indicator.label}
            value={indicator.value}
            change={indicator.change}
            rawChange={indicator.rawChange}
            isLoading={isLoading}
            error={indicator.error}
            compact={compact}
            className="flex-1"
          />
        ))}
      </div>

      {/* 右侧：更新时间 */}
      {showUpdateTime && lastUpdateTime && !isLoading && (
        <div className={cn(
          "text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap",
          compact ? "text-xs" : "text-sm"
        )}>
          更新: {lastUpdateTime}
        </div>
      )}
    </div>
  )
}

// 移动端优化的市场脉搏组件
export function MarketPulseMobile({
  className,
  showRefresh = true,
  showStatus = true
}: Omit<MarketPulseHeaderProps, 'compact'>) {
  const {
    indicators,
    isLoading,
    error,
    lastUpdateTime,
    marketStatus,
    refresh
  } = useMarketPulse(30000)

  const handleRefresh = async () => {
    await refresh()
  }

  return (
    <div className={cn(
      "flex flex-col space-y-2 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border-b dark:border-gray-800",
      className
    )}>
      {/* 顶部控制栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {showRefresh && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-6 w-6"
              title="刷新数据"
            >
              <RefreshCw className={cn(
                "h-3 w-3",
                isLoading ? "animate-spin" : ""
              )} />
            </Button>
          )}

          {showStatus && (
            <div className="flex items-center space-x-1">
              <div className={cn(
                "h-2 w-2 rounded-full",
                marketStatus === 'open'
                  ? "bg-green-500 animate-pulse"
                  : "bg-gray-400"
              )} />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {marketStatus === 'open' ? '交易中' : '休市(昨收)'}
              </span>
            </div>
          )}
        </div>

        {lastUpdateTime && !isLoading && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            更新: {lastUpdateTime}
          </div>
        )}
      </div>

      {/* 2x2网格布局 */}
      <div className="grid grid-cols-2 gap-2">
        {indicators.map((indicator, index) => (
          <MarketIndicator
            key={`${indicator.label}-${index}`}
            label={indicator.label}
            value={indicator.value}
            change={indicator.change}
            rawChange={indicator.rawChange}
            isLoading={isLoading}
            error={indicator.error}
            compact={true}
          />
        ))}
      </div>

      {error && (
        <div className="flex items-center justify-center space-x-1 text-amber-600 dark:text-amber-400 text-xs">
          <AlertCircle className="h-3 w-3" />
          <span>数据获取异常，显示缓存数据</span>
        </div>
      )}
    </div>
  )
}