"use client"

import * as React from "react"
import { Search, Bell, User, Menu, TrendingUp, BarChart3, RefreshCw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { fetchMarketIndicators, MarketIndicator, isMarketOpen } from "@/lib/market-indicators"

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [marketIndicators, setMarketIndicators] = React.useState<MarketIndicator[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [lastUpdateTime, setLastUpdateTime] = React.useState<string>("")
  const [marketStatus, setMarketStatus] = React.useState<"open" | "closed">("closed")

  // Fetch market indicators
  const fetchIndicators = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const indicators = await fetchMarketIndicators()
      setMarketIndicators(indicators)
      setLastUpdateTime(new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }))
      setMarketStatus(isMarketOpen() ? "open" : "closed")
    } catch (error) {
      console.error("Failed to fetch market indicators:", error)
      // Use mock data as fallback
      const mockIndicators = [
        { label: "上证指数", value: "3,245.67", change: "+1.23%" },
        { label: "深证成指", value: "10,523.89", change: "+0.89%" },
        { label: "创业板指", value: "2,156.34", change: "+2.15%" },
        { label: "北向资金", value: "+15.2亿", change: "+" },
      ]
      setMarketIndicators(mockIndicators)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial fetch
  React.useEffect(() => {
    fetchIndicators()
  }, [fetchIndicators])

  // Auto-refresh every 30 seconds when market is open
  React.useEffect(() => {
    if (marketStatus === "open") {
      const intervalId = setInterval(() => {
        fetchIndicators()
      }, 30000) // 30 seconds

      return () => clearInterval(intervalId)
    }
  }, [marketStatus, fetchIndicators])

  // Manual refresh function
  const handleRefresh = React.useCallback(() => {
    fetchIndicators()
  }, [fetchIndicators])

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* 左侧：菜单按钮和品牌 */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="md:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div className="hidden md:block">
              <h1 className="text-lg font-bold">Alpha-Quant-Copilot</h1>
              <p className="text-xs text-muted-foreground">AI量化交易助手</p>
            </div>
          </div>

          {/* 市场指标 */}
          <div className="hidden lg:flex items-center space-x-4 ml-6">
            {/* 刷新按钮 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-8 w-8"
              title="刷新数据"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>

            {/* 市场状态指示器 */}
            <div className="flex items-center space-x-1">
              <div className={`h-2 w-2 rounded-full ${marketStatus === "open" ? "bg-green-500" : "bg-gray-400"}`} />
              <span className="text-xs text-muted-foreground">
                {marketStatus === "open" ? "交易中" : "休市"}
              </span>
            </div>

            {/* 指标数据 */}
            <div className="flex items-center space-x-6">
              {isLoading ? (
                // 加载状态
                <div className="flex items-center space-x-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                      <div className="h-6 w-12 bg-muted rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : (
                // 正常显示
                marketIndicators.map((indicator, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">
                      {indicator.label}
                    </span>
                    <div className="flex items-center">
                      <span className={`font-semibold ${indicator.error ? "text-muted-foreground" : ""}`}>
                        {indicator.error ? "--" : indicator.value}
                      </span>
                      {!indicator.error && indicator.change && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "ml-2 text-xs",
                            indicator.change.startsWith("+")
                              ? "bg-green-500/10 text-green-500"
                              : indicator.change.startsWith("-")
                              ? "bg-red-500/10 text-red-500"
                              : "bg-gray-500/10 text-gray-500"
                          )}
                        >
                          {indicator.change}
                        </Badge>
                      )}
                    </div>
                    {index < marketIndicators.length - 1 && (
                      <Separator orientation="vertical" className="h-4" />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* 最后更新时间 */}
            {lastUpdateTime && !isLoading && (
              <div className="text-xs text-muted-foreground">
                更新: {lastUpdateTime}
              </div>
            )}
          </div>
        </div>

        {/* 中间：搜索框 */}
        <div className="flex-1 max-w-2xl mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索股票、策略或新闻..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* 右侧：用户操作 */}
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs flex items-center justify-center text-white">
              5
            </span>
          </Button>

          <Button variant="ghost" size="icon">
            <TrendingUp className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>我的账户</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>个人资料</DropdownMenuItem>
              <DropdownMenuItem>投资组合</DropdownMenuItem>
              <DropdownMenuItem>交易记录</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>设置</DropdownMenuItem>
              <DropdownMenuItem>帮助中心</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-500">
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 移动端市场指标 */}
      <div className="lg:hidden border-t">
        <div className="container px-4 py-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={isLoading}
                className="h-6 w-6"
                title="刷新数据"
              >
                <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              <div className="flex items-center space-x-1">
                <div className={`h-2 w-2 rounded-full ${marketStatus === "open" ? "bg-green-500" : "bg-gray-400"}`} />
                <span className="text-xs text-muted-foreground">
                  {marketStatus === "open" ? "交易中" : "休市"}
                </span>
              </div>
            </div>
            {lastUpdateTime && !isLoading && (
              <div className="text-xs text-muted-foreground">
                更新: {lastUpdateTime}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {isLoading ? (
              // 加载状态
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="h-3 w-12 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                </div>
              ))
            ) : (
              // 正常显示
              marketIndicators.map((indicator, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {indicator.label}
                  </span>
                  <div className="flex items-center">
                    <span className={`text-sm font-semibold ${indicator.error ? "text-muted-foreground" : ""}`}>
                      {indicator.error ? "--" : indicator.value}
                    </span>
                    {!indicator.error && indicator.change && (
                      <span
                        className={cn(
                          "ml-1 text-xs",
                          indicator.change.startsWith("+")
                            ? "text-green-500"
                            : indicator.change.startsWith("-")
                            ? "text-red-500"
                            : "text-gray-500"
                        )}
                      >
                        {indicator.change}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ")
}