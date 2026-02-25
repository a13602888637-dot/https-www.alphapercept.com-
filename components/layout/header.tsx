"use client"

import * as React from "react"
import { Search, Bell, User, Menu, TrendingUp, BarChart3, Loader2, X } from "lucide-react"
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
import { MarketPulseHeader, MarketPulseMobile } from "@/components/market-pulse/MarketPulseHeader"
import { cn } from "@/lib/utils"

interface HeaderProps {
  onMenuClick?: () => void
}

// 股票搜索结果接口
interface StockSearchResult {
  code: string
  name: string
  market: string
}

export function Header({ onMenuClick }: HeaderProps) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<StockSearchResult[]>([])
  const [searchLoading, setSearchLoading] = React.useState(false)
  const [showSearchResults, setShowSearchResults] = React.useState(false)
  const [searchDebounceTimer, setSearchDebounceTimer] = React.useState<NodeJS.Timeout | null>(null)

  // 搜索股票函数
  const searchStocks = React.useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    setSearchLoading(true)
    try {
      const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`)

      if (!response.ok) {
        throw new Error(`搜索请求失败: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        setSearchResults(data.data)
        setShowSearchResults(true)
      } else {
        setSearchResults([])
        setShowSearchResults(false)
      }
    } catch (error) {
      console.error("搜索股票失败:", error)
      setSearchResults([])
      setShowSearchResults(false)
    } finally {
      setSearchLoading(false)
    }
  }, [])

  // 防抖处理搜索输入
  const handleSearchChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)

    // 清除之前的定时器
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer)
    }

    // 设置新的防抖定时器
    const timer = setTimeout(() => {
      searchStocks(value)
    }, 300) // 300ms防抖

    setSearchDebounceTimer(timer)
  }, [searchDebounceTimer, searchStocks])

  // 清除搜索
  const handleClearSearch = React.useCallback(() => {
    setSearchQuery("")
    setSearchResults([])
    setShowSearchResults(false)

    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer)
      setSearchDebounceTimer(null)
    }
  }, [searchDebounceTimer])

  // 选择搜索结果
  const handleSelectResult = React.useCallback((result: StockSearchResult) => {
    // 这里可以跳转到股票详情页或执行其他操作
    console.log("选择股票:", result)
    setSearchQuery("")
    setSearchResults([])
    setShowSearchResults(false)

    // 示例：跳转到股票详情页
    // window.location.href = `/stock/${result.code}`
  }, [])


  // 点击外部关闭搜索结果
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.search-container')) {
        setShowSearchResults(false)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [])

  // 格式化市场显示
  const formatMarket = (market: string) => {
    switch (market) {
      case "SH":
        return "上证"
      case "SZ":
        return "深证"
      default:
        return market
    }
  }

  // 获取市场颜色
  const getMarketColor = (market: string) => {
    switch (market) {
      case "SH":
        return "text-red-600 bg-red-50 border-red-200"
      case "SZ":
        return "text-green-600 bg-green-50 border-green-200"
      default:
        return "text-gray-600 bg-gray-50 border-gray-200"
    }
  }

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

          {/* 桌面端市场脉搏 */}
          <div className="hidden lg:block ml-6 flex-1 max-w-2xl">
            <MarketPulseHeader
              compact={true}
              showRefresh={false}
              showStatus={false}
              showUpdateTime={false}
              gradientBackground={false}
              className="py-1"
            />
          </div>
        </div>

        {/* 中间：搜索框 */}
        <div className="flex-1 max-w-2xl mx-4 search-container">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索股票、策略或新闻..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-9 pr-10"
              onFocus={() => {
                if (searchQuery.trim() && searchResults.length > 0) {
                  setShowSearchResults(true)
                }
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="清除搜索"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {searchLoading && (
              <div className="absolute right-10 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* 搜索结果下拉框 */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                <div className="p-2">
                  <div className="text-xs text-muted-foreground px-3 py-2">
                    找到 {searchResults.length} 个结果
                  </div>
                  {searchResults.map((result) => (
                    <button
                      key={`${result.code}-${result.market}`}
                      className="w-full text-left px-3 py-2 hover:bg-muted rounded-md flex items-center justify-between transition-colors"
                      onClick={() => handleSelectResult(result)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{result.name}</span>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getMarketColor(result.market)}`}
                          >
                            {formatMarket(result.market)}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">{result.code}</div>
                      </div>
                      <Search className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 无结果提示 */}
            {showSearchResults && searchQuery.trim() && !searchLoading && searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 p-4">
                <div className="text-center text-muted-foreground">
                  未找到匹配的股票
                </div>
              </div>
            )}
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

      {/* 移动端市场脉搏 */}
      <div className="lg:hidden">
        <MarketPulseMobile />
      </div>
    </header>
  )
}

