"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { StockSearch } from "@/components/portfolio/stock-search"
import { SearchResults, StockResult } from "@/components/portfolio/search-results"
import { SignInButton, useAuth } from "@clerk/nextjs"
import { useToast } from "@/hooks/use-toast"
import { AddPositionDialog } from "@/components/portfolio/AddPositionDialog"
import { AlphaFeedContainer } from "@/components/portfolio/AlphaFeedContainer"
import { StopLossConfig, type StopLossMethod, SL_DEFAULT_PARAMS } from "@/components/portfolio/StopLossConfig"
import { TakeProfitConfig, type TakeProfitMethod, TP_DEFAULT_PARAMS } from "@/components/portfolio/TakeProfitConfig"
import {
  Wallet,
  TrendingUp,
  BarChart3,
  Eye,
  EyeOff,
  Search,
  DollarSign,
  Calendar,
  Star,
  AlertTriangle,
  Brain,
  Zap,
  Loader2,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  Shield,
  Target,
  ChevronUp,
  RefreshCw,
  Settings2
} from "lucide-react"

// 自选股接口定义
interface WatchlistItem {
  id: string
  stockCode: string
  stockName: string
  buyPrice: number | null
  stopLossPrice: number | null
  targetPrice: number | null
  notes: string | null
  stopLossMethod: string | null
  stopLossParams: Record<string, number> | null
  takeProfitMethod: string | null
  takeProfitParams: Record<string, number> | null
  highWaterMark: number | null
  computeStatus: string | null
  dataFrequency: string | null
  cachedAtr: number | null
  lastComputedAt: string | null
  createdAt: Date
  updatedAt: Date
}

// 投资组合数据
interface PortfolioItem {
  id: string
  stockCode: string
  stockName: string
  industry: string | null
  quantity: number
  avgCost: number
  currentPrice: number
  marketValue: number
  profitLoss: number
  profitLossPercent: number
  weight: number
  change: number
  changePercent: number
  status: string
  notes: string | null
  tradeType?: string
  tradeStatus?: string
}

interface PortfolioSummary {
  totalMarketValue: number
  totalCost: number
  totalProfitLoss: number
  totalProfitLossPercent: number
  positionCount: number
}

// AI分析结果接口
interface AiAnalysisItem {
  id: string
  stockCode: string
  stockName: string
  buyPrice: number | null
  stopLossPrice: number | null
  targetPrice: number | null
  notes: string | null
  currentPrice: number
  analysis: {
    eventSummary: string
    industryTrend: string
    trapProbability: number
    actionSignal: "BUY" | "SELL" | "HOLD"
    targetPrice: number | null
    stopLoss: number | null
    logicChain: any
    createdAt: string
  } | null
  warningLevel: 'high' | 'medium' | 'low'
}

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState("overview")
  const [showValues, setShowValues] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [addingStock, setAddingStock] = useState<string | null>(null)
  const { toast } = useToast()
  const { isSignedIn, getToken } = useAuth()

  // 自选股相关状态
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [searchResults, setSearchResults] = useState<StockResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showWatchlist, setShowWatchlist] = useState(false)
  const [watchlistLoading, setWatchlistLoading] = useState(false)

  // SL/TP 编辑状态
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const [editingSLTP, setEditingSLTP] = useState<Record<string, {
    slMethod: StopLossMethod
    slParams: Record<string, number>
    tpMethod: TakeProfitMethod
    tpParams: Record<string, number>
    buyPrice: string
  }>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [recalculating, setRecalculating] = useState(false)

  // AI深度推演相关状态
  const [aiAnalysis, setAiAnalysis] = useState<any[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)

  // 真实投资组合
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary>({
    totalMarketValue: 0, totalCost: 0, totalProfitLoss: 0, totalProfitLossPercent: 0, positionCount: 0,
  })
  const [portfolioLoading, setPortfolioLoading] = useState(false)

  // 加载投资组合
  const loadPortfolio = useCallback(async () => {
    setPortfolioLoading(true)
    try {
      const token = await getToken()
      const response = await fetch('/api/portfolio', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setPortfolio(data.portfolio)
          setPortfolioSummary(data.summary)
        }
      }
    } catch (error) {
      console.error('加载投资组合失败:', error)
    } finally {
      setPortfolioLoading(false)
    }
  }, [getToken])

  // 删除持仓
  const handleDeletePosition = async (id: string, stockName: string) => {
    if (!window.confirm(`确定要删除 ${stockName} 的持仓吗？`)) return
    try {
      const token = await getToken()
      const response = await fetch(`/api/portfolio?id=${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.ok) {
        toast({ title: "删除成功", description: `已删除 ${stockName}` })
        loadPortfolio()
      }
    } catch {
      toast({ title: "删除失败", variant: "destructive" })
    }
  }

  // 初始加载投资组合
  useEffect(() => {
    if (!showWatchlist && isSignedIn) {
      loadPortfolio()
    }
  }, [showWatchlist, isSignedIn, loadPortfolio])

  // 加载自选股数据
  const loadWatchlist = useCallback(async () => {
    setWatchlistLoading(true)
    try {
      const response = await fetch('/api/watchlist')

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("请先登录以查看自选股")
        }
        throw new Error(`获取自选股失败: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        setWatchlist(data.watchlist)
        setError(null) // 清除之前的错误
      } else {
        console.error("获取自选股失败:", data.error)
        setError(data.error || "获取自选股失败")
      }
    } catch (error) {
      console.error("加载自选股失败:", error)
      setError(error instanceof Error ? error.message : "加载自选股失败")
    } finally {
      setWatchlistLoading(false)
    }
  }, [])

  // 初始化加载自选股
  useEffect(() => {
    if (showWatchlist) {
      loadWatchlist()
    }
  }, [showWatchlist, loadWatchlist])

  // AI深度推演分析
  const handleAiAnalysis = async () => {
    if (watchlist.length === 0) {
      setAiError("请先添加自选股")
      return
    }

    setAiLoading(true)
    setAiError(null)
    setShowAnalysis(true)

    try {
      const response = await fetch('/api/analyze-watchlist', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '分析失败')
      }

      if (data.success && data.analysis) {
        setAiAnalysis(data.analysis)
        // 显示成功提示
        toast({
          title: "分析完成",
          description: `成功分析 ${data.analysis.length} 只股票，保存了 ${data.savedCount || 0} 条记录`,
          variant: "default",
        })
      } else {
        setAiError(data.message || '分析结果为空')
      }
    } catch (error) {
      console.error('AI分析失败:', error)
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      setAiError(errorMessage)
      // 显示错误提示
      toast({
        title: "分析失败",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setAiLoading(false)
    }
  }

  // 展开/编辑 SL/TP 配置
  const handleExpandItem = (item: WatchlistItem) => {
    if (expandedItemId === item.id) {
      setExpandedItemId(null)
      return
    }
    setExpandedItemId(item.id)
    if (!editingSLTP[item.id]) {
      setEditingSLTP(prev => ({
        ...prev,
        [item.id]: {
          slMethod: (item.stopLossMethod as StopLossMethod) || "atr",
          slParams: (item.stopLossParams as Record<string, number>) || SL_DEFAULT_PARAMS.atr,
          tpMethod: (item.takeProfitMethod as TakeProfitMethod) || "trailing",
          tpParams: (item.takeProfitParams as Record<string, number>) || TP_DEFAULT_PARAMS.trailing,
          buyPrice: item.buyPrice?.toString() || "",
        }
      }))
    }
  }

  // 保存 SL/TP 配置
  const handleSaveSLTP = async (itemId: string) => {
    const edit = editingSLTP[itemId]
    if (!edit) return
    setSavingId(itemId)
    try {
      const buyPrice = parseFloat(edit.buyPrice) || null
      const response = await fetch('/api/watchlist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: itemId,
          buyPrice,
          stopLossMethod: edit.slMethod,
          stopLossParams: edit.slParams,
          takeProfitMethod: edit.tpMethod,
          takeProfitParams: edit.tpParams,
          highWaterMark: buyPrice,
        })
      })
      if (!response.ok) throw new Error("保存失败")
      toast({ title: "保存成功", description: "止盈止损配置已更新" })
      // Trigger recalculation for this item
      await handleRecalculate([itemId])
      await loadWatchlist()
    } catch (err) {
      toast({ title: "保存失败", description: err instanceof Error ? err.message : "未知错误", variant: "destructive" })
    } finally {
      setSavingId(null)
    }
  }

  // 批量重算 SL/TP
  const handleRecalculate = async (ids?: string[]) => {
    setRecalculating(true)
    try {
      const response = await fetch('/api/watchlist/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids ? { ids } : {}),
      })
      if (!response.ok) throw new Error("重算失败")
      const data = await response.json()
      if (data.success) {
        await loadWatchlist()
        if (!ids) {
          toast({ title: "重算完成", description: `已更新 ${data.recalculated} 项` })
        }
      }
    } catch (err) {
      if (!ids) {
        toast({ title: "重算失败", description: err instanceof Error ? err.message : "未知错误", variant: "destructive" })
      }
    } finally {
      setRecalculating(false)
    }
  }

  // 定时重算（5分钟间隔）
  useEffect(() => {
    if (!showWatchlist || watchlist.length === 0) return
    const hasConfigured = watchlist.some(item => item.stopLossMethod || item.takeProfitMethod)
    if (!hasConfigured) return
    const interval = setInterval(() => {
      handleRecalculate()
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWatchlist, watchlist.length])

  // 搜索股票
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      setError(null)
      return
    }

    setSearchLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (data.success) {
        setSearchResults(data.data)
      } else {
        console.error("搜索失败:", data.error)
        setSearchResults([])
        setError(data.error || "搜索失败")
      }
    } catch (error) {
      console.error("搜索请求失败:", error)
      setSearchResults([])
      setError(error instanceof Error ? error.message : "搜索请求失败")
    } finally {
      setSearchLoading(false)
    }
  }

  // 直接添加股票（按回车或失去焦点时调用）
  const handleDirectAdd = async (query: string) => {
    if (!query.trim()) {
      return
    }

    // 检查是否已登录
    if (!isSignedIn) {
      toast({
        title: "请先登录",
        description: "登录后即可添加自选股",
        variant: "destructive",
      })
      return
    }

    // 先搜索股票
    setSearchLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (data.success && data.data.length > 0) {
        // 找到匹配的股票，取第一个结果
        const stock = data.data[0]

        // 检查是否已在自选股中
        const exists = watchlist.some(item =>
          item.stockCode === stock.code
        )

        if (exists) {
          toast({
            title: "股票已在自选股中",
            description: `股票 ${stock.name} (${stock.code}) 已在您的自选股列表中`,
            variant: "destructive",
          })
          return
        }

        // 添加到自选股
        await handleAddToWatchlist(stock)
      } else {
        toast({
          title: "未找到股票",
          description: `未找到股票代码或名称: ${query}`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("直接添加失败:", error)
      const errorMessage = error instanceof Error ? error.message : "添加失败"

      toast({
        title: "添加失败",
        description: errorMessage,
        variant: "destructive",
      })

      setError(errorMessage)
    } finally {
      setSearchLoading(false)
    }
  }

  // 添加股票到自选股
  const handleAddToWatchlist = async (stock: StockResult) => {
    // 检查是否已登录
    if (!isSignedIn) {
      toast({
        title: "请先登录",
        description: "登录后即可添加自选股",
        variant: "destructive",
      })
      return
    }

    const exists = watchlist.some(item =>
      item.stockCode === stock.code
    )

    if (exists) {
      toast({
        title: "股票已在自选股中",
        description: `股票 ${stock.name} (${stock.code}) 已在您的自选股列表中`,
        variant: "destructive",
      })
      return
    }

    setAddingStock(stock.code)
    try {
      const response = await fetch('/api/watchlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stockCode: stock.code,
          stockName: stock.name,
          buyPrice: null,
          stopLossPrice: null,
          targetPrice: null,
          notes: null
        })
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("请先登录以添加自选股")
        }
        const data = await response.json()
        throw new Error(data.error || `添加失败: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        // 重新加载自选股列表
        await loadWatchlist()
        setSearchResults([])
        setError(null) // 清除之前的错误

        // 显示成功Toast通知
        toast({
          title: "添加成功",
          description: `已成功添加 ${stock.name} (${stock.code}) 到自选股`,
          variant: "default",
        })
      } else {
        throw new Error(data.error || "添加失败")
      }
    } catch (error) {
      console.error("添加自选股失败:", error)
      const errorMessage = error instanceof Error ? error.message : "添加自选股失败"

      toast({
        title: "添加失败",
        description: errorMessage,
        variant: "destructive",
      })

      // 同时显示在错误区域（可选）
      setError(errorMessage)
    } finally {
      setAddingStock(null)
    }
  }

  // 从自选股中移除股票
  const handleRemoveFromWatchlist = async (id: string) => {
    // 检查是否已登录
    if (!isSignedIn) {
      toast({
        title: "请先登录",
        description: "登录后即可管理自选股",
        variant: "destructive",
      })
      return
    }

    // 使用自定义确认对话框而不是原生的confirm
    const itemToRemove = watchlist.find(item => item.id === id)
    if (!itemToRemove) return

    // 创建自定义确认对话框
    const userConfirmed = window.confirm(`确定要从自选股中移除 ${itemToRemove.stockName} (${itemToRemove.stockCode}) 吗？`)
    if (!userConfirmed) {
      return
    }

    try {
      const response = await fetch(`/api/watchlist?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("请先登录以管理自选股")
        }
        const data = await response.json()
        throw new Error(data.error || `移除失败: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        // 重新加载自选股列表
        await loadWatchlist()

        toast({
          title: "移除成功",
          description: `已从自选股中移除 ${itemToRemove.stockName} (${itemToRemove.stockCode})`,
          variant: "default",
        })
      } else {
        throw new Error(data.error || "移除失败")
      }
    } catch (error) {
      console.error("移除自选股失败:", error)
      const errorMessage = error instanceof Error ? error.message : "移除自选股失败"

      toast({
        title: "移除失败",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
            <Wallet className="h-8 w-8 mr-3 text-blue-500" />
            投资组合管理
          </h1>
          <p className="text-muted-foreground mt-2">
            实时跟踪您的投资组合表现，智能分析持仓结构与风险
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => setShowWatchlist(!showWatchlist)}>
            {showWatchlist ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showWatchlist ? "返回投资组合" : "查看自选股"}
          </Button>
          <Button variant="outline" onClick={() => setShowValues(!showValues)}>
            {showValues ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showValues ? "隐藏金额" : "显示金额"}
          </Button>
        </div>
      </div>

      {/* 错误显示 */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center text-red-600">
                <AlertCircle className="h-5 w-5 mr-2" />
                <span>{error}</span>
              </div>
              {error.includes("请先登录") && (
                <div className="flex items-center gap-2">
                  <SignInButton mode="modal">
                    <Button variant="default" size="sm">
                      立即登录
                    </Button>
                  </SignInButton>
                  <span className="text-sm text-gray-600">登录后即可使用自选股功能</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 自选股搜索和显示 */}
      {showWatchlist ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Star className="h-5 w-5 mr-2 text-yellow-500" />
                自选股管理
              </CardTitle>
              <CardDescription>
                添加和管理您关注的股票，实时跟踪价格变化
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* 搜索组件 */}
                <div>
                  <h3 className="text-sm font-medium mb-3">搜索股票</h3>
                  <div className="space-y-2">
                    <StockSearch
                      onSearch={handleSearch}
                      onEnter={handleDirectAdd}
                      onBlur={handleDirectAdd}
                      placeholder="输入股票代码或名称，按回车或点击空白处自动添加"
                    />
                    <p className="text-xs text-gray-500">
                      提示：输入股票代码（如600519）或名称（如贵州茅台），按回车键或点击空白处即可自动添加到自选股
                    </p>
                  </div>
                </div>

                {/* 搜索结果 */}
                <div>
                  <h3 className="text-sm font-medium mb-3">搜索结果</h3>
                  <SearchResults
                    results={searchResults}
                    onAdd={handleAddToWatchlist}
                    loading={searchLoading}
                    addingStock={addingStock}
                    emptyMessage={searchLoading ? "搜索中..." : "输入股票代码或名称开始搜索"}
                  />
                </div>

                {/* 自选股列表 */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium">我的自选股 ({watchlist.length})</h3>
                    <div className="flex items-center gap-2">
                      {watchlist.length > 0 && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRecalculate()}
                            disabled={recalculating}
                          >
                            {recalculating ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4 mr-1" />
                            )}
                            重算SL/TP
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={handleAiAnalysis}
                            disabled={aiLoading}
                            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                          >
                            {aiLoading ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                分析中...
                              </>
                            ) : (
                              <>
                                <Zap className="h-4 w-4 mr-2" />
                                ⚡️ AI深度推演
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              // 检查是否已登录
                              if (!isSignedIn) {
                                toast({
                                  title: "请先登录",
                                  description: "登录后即可管理自选股",
                                  variant: "destructive",
                                })
                                return
                              }

                              // 使用自定义确认对话框
                              const userConfirmed = window.confirm(`确定要清空所有 ${watchlist.length} 个自选股吗？此操作不可撤销。`)
                              if (!userConfirmed) {
                                return
                              }

                              try {
                                // 逐个删除所有自选股
                                for (const item of watchlist) {
                                  const response = await fetch(`/api/watchlist?id=${item.id}`, {
                                    method: 'DELETE',
                                  })

                                  if (!response.ok) {
                                    if (response.status === 401) {
                                      throw new Error("请先登录以管理自选股")
                                    }
                                    const data = await response.json()
                                    throw new Error(data.error || `删除失败: ${response.status}`)
                                  }
                                }

                                // 重新加载自选股列表
                                await loadWatchlist()

                                toast({
                                  title: "清空成功",
                                  description: `已清空所有 ${watchlist.length} 个自选股`,
                                  variant: "default",
                                })
                              } catch (error) {
                                console.error("清空自选股失败:", error)
                                const errorMessage = error instanceof Error ? error.message : "清空自选股失败"

                                toast({
                                  title: "清空失败",
                                  description: errorMessage,
                                  variant: "destructive",
                                })
                              }
                            }}
                          >
                            清空全部
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {watchlistLoading ? (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex flex-col items-center justify-center py-8">
                          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
                          <p className="text-gray-500">加载自选股中...</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : watchlist.length === 0 ? (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex flex-col items-center justify-center py-8">
                          <Star className="h-12 w-12 text-gray-300 mb-4" />
                          <p className="text-gray-500 mb-4">暂无自选股</p>
                          <p className="text-sm text-gray-400 text-center">
                            使用上方搜索框添加您关注的股票
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="space-y-2">
                          {watchlist.map((item) => {
                            const market = item.stockCode.startsWith('6') ? 'SH' :
                                          item.stockCode.startsWith('0') || item.stockCode.startsWith('3') ? 'SZ' : 'Unknown';
                            const isExpanded = expandedItemId === item.id
                            const edit = editingSLTP[item.id]
                            const statusColors: Record<string, string> = {
                              live: "text-emerald-500",
                              low_freq: "text-amber-500",
                              cached: "text-blue-500",
                              awaiting_data: "text-red-500",
                            }
                            const statusLabels: Record<string, string> = {
                              live: "LIVE",
                              low_freq: "低频推演",
                              cached: "缓存",
                              awaiting_data: "数据等待",
                            }

                            return (
                              <div key={item.id} className="border rounded-lg overflow-hidden">
                                {/* Main row */}
                                <div className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h3 className="font-semibold text-gray-900 truncate">{item.stockName}</h3>
                                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full border shrink-0 ${
                                        market === "SH" ? "text-red-600 bg-red-50 border-red-200" :
                                        market === "SZ" ? "text-green-600 bg-green-50 border-green-200" :
                                        "text-gray-600 bg-gray-50 border-gray-200"
                                      }`}>
                                        {market === "SH" ? "沪" : market === "SZ" ? "深" : "其他"}
                                      </span>
                                      <span className="text-xs text-gray-400">{item.stockCode}</span>
                                      {item.computeStatus && (
                                        <span className={`text-[10px] font-mono ${statusColors[item.computeStatus] || "text-gray-400"}`}>
                                          [{statusLabels[item.computeStatus] || item.computeStatus}]
                                        </span>
                                      )}
                                    </div>
                                    {/* SL/TP summary row */}
                                    <div className="flex items-center gap-3 text-xs">
                                      {item.buyPrice != null && (
                                        <span className="text-gray-500">买入: ¥{item.buyPrice.toFixed(2)}</span>
                                      )}
                                      {item.stopLossPrice != null && (
                                        <span className="text-red-500 flex items-center gap-0.5">
                                          <Shield className="h-3 w-3" />
                                          止损: ¥{item.stopLossPrice.toFixed(2)}
                                          {item.stopLossMethod && <span className="text-gray-400 ml-0.5">({
                                            item.stopLossMethod === "atr" ? "ATR" :
                                            item.stopLossMethod === "chandelier" ? "吊灯" :
                                            item.stopLossMethod === "ma" ? "均线" : "固定"
                                          })</span>}
                                        </span>
                                      )}
                                      {item.targetPrice != null && (
                                        <span className="text-emerald-500 flex items-center gap-0.5">
                                          <Target className="h-3 w-3" />
                                          止盈: ¥{item.targetPrice.toFixed(2)}
                                          {item.takeProfitMethod && <span className="text-gray-400 ml-0.5">({
                                            item.takeProfitMethod === "trailing" ? "追踪" :
                                            item.takeProfitMethod === "atr_multiple" ? "ATR" : "固定"
                                          })</span>}
                                        </span>
                                      )}
                                      {!item.stopLossPrice && !item.targetPrice && !item.buyPrice && (
                                        <span className="text-gray-400 italic">未配置止盈止损</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0 ml-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 p-0"
                                      onClick={() => handleExpandItem(item)}
                                      title="配置止盈止损"
                                    >
                                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => handleRemoveFromWatchlist(item.id)}
                                      title="移除"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>

                                {/* Expanded SL/TP config panel */}
                                {isExpanded && edit && (
                                  <div className="border-t bg-gray-50/50 p-4 space-y-4">
                                    {/* Buy price input */}
                                    <div className="flex items-center gap-2">
                                      <label className="text-xs text-gray-500 w-16 shrink-0">买入价</label>
                                      <Input
                                        type="number"
                                        value={edit.buyPrice}
                                        onChange={(e) => setEditingSLTP(prev => ({
                                          ...prev,
                                          [item.id]: { ...prev[item.id], buyPrice: e.target.value }
                                        }))}
                                        placeholder="输入买入价"
                                        className="h-7 text-xs max-w-[140px]"
                                        min={0}
                                        step={0.01}
                                      />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {/* Stop Loss Config */}
                                      <div className="border rounded-lg p-3 bg-white">
                                        <StopLossConfig
                                          method={edit.slMethod}
                                          params={edit.slParams}
                                          buyPrice={parseFloat(edit.buyPrice) || null}
                                          computedPrice={item.stopLossPrice}
                                          computeStatus={item.computeStatus}
                                          dataFrequency={item.dataFrequency}
                                          onMethodChange={(m) => setEditingSLTP(prev => ({
                                            ...prev,
                                            [item.id]: { ...prev[item.id], slMethod: m, slParams: SL_DEFAULT_PARAMS[m] }
                                          }))}
                                          onParamsChange={(p) => setEditingSLTP(prev => ({
                                            ...prev,
                                            [item.id]: { ...prev[item.id], slParams: p }
                                          }))}
                                        />
                                      </div>

                                      {/* Take Profit Config */}
                                      <div className="border rounded-lg p-3 bg-white">
                                        <TakeProfitConfig
                                          method={edit.tpMethod}
                                          params={edit.tpParams}
                                          buyPrice={parseFloat(edit.buyPrice) || null}
                                          computedPrice={item.targetPrice}
                                          computeStatus={item.computeStatus}
                                          highWaterMark={item.highWaterMark}
                                          onMethodChange={(m) => setEditingSLTP(prev => ({
                                            ...prev,
                                            [item.id]: { ...prev[item.id], tpMethod: m, tpParams: TP_DEFAULT_PARAMS[m] }
                                          }))}
                                          onParamsChange={(p) => setEditingSLTP(prev => ({
                                            ...prev,
                                            [item.id]: { ...prev[item.id], tpParams: p }
                                          }))}
                                        />
                                      </div>
                                    </div>

                                    {/* Save button */}
                                    <div className="flex items-center justify-between pt-2">
                                      <div className="text-[10px] text-gray-400">
                                        {item.lastComputedAt && `上次计算: ${new Date(item.lastComputedAt).toLocaleString()}`}
                                        {item.dataFrequency && item.dataFrequency !== "daily" && ` · ${item.dataFrequency === "weekly" ? "周线数据" : "月线数据"}`}
                                      </div>
                                      <Button
                                        size="sm"
                                        onClick={() => handleSaveSLTP(item.id)}
                                        disabled={savingId === item.id || !edit.buyPrice}
                                      >
                                        {savingId === item.id ? (
                                          <><Loader2 className="h-3 w-3 mr-1 animate-spin" />保存中...</>
                                        ) : (
                                          "保存并计算"
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* AI深度推演结果 */}
                {showAnalysis && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium flex items-center gap-2">
                        <Brain className="h-4 w-4 text-purple-600" />
                        AI深度推演结果
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAnalysis(false)}
                      >
                        隐藏
                      </Button>
                    </div>

                    {aiError ? (
                      <Card className="border-red-200 bg-red-50">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <AlertCircle className="h-5 w-5 text-red-600" />
                            <div>
                              <p className="text-red-800 font-medium">分析失败</p>
                              <p className="text-red-600 text-sm">{aiError}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ) : aiLoading ? (
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex flex-col items-center justify-center py-8">
                            <Loader2 className="h-8 w-8 text-purple-600 animate-spin mb-4" />
                            <p className="text-gray-600">AI正在深度分析您的自选股...</p>
                            <p className="text-sm text-gray-400 mt-2">基于CLAUDE.md策略规则进行推演</p>
                          </div>
                        </CardContent>
                      </Card>
                    ) : aiAnalysis.length === 0 ? (
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex flex-col items-center justify-center py-8">
                            <Brain className="h-12 w-12 text-gray-300 mb-4" />
                            <p className="text-gray-500 mb-4">暂无分析结果</p>
                            <p className="text-sm text-gray-400 text-center">
                              点击上方的"⚡️ AI深度推演"按钮开始分析
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-4">
                        {aiAnalysis.map((item: AiAnalysisItem) => (
                          <Card
                            key={item.id}
                            className={`hover:shadow-md transition-shadow ${
                              item.warningLevel === 'high' ? 'border-red-200 bg-red-50' :
                              item.warningLevel === 'medium' ? 'border-yellow-200 bg-yellow-50' :
                              'border-gray-200'
                            }`}
                          >
                            <CardContent className="pt-6">
                              <div className="space-y-4">
                                {/* 股票基本信息 */}
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <h3 className="font-semibold text-gray-900">{item.stockName}</h3>
                                      <span className="text-sm text-gray-500">{item.stockCode}</span>
                                      {item.warningLevel === 'high' && (
                                        <Badge variant="destructive" className="ml-2">
                                          <AlertTriangle className="h-3 w-3 mr-1" />
                                          高风险警告
                                        </Badge>
                                      )}
                                      {item.warningLevel === 'medium' && (
                                        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                                          <AlertTriangle className="h-3 w-3 mr-1" />
                                          中等风险
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                      {item.currentPrice > 0 && (
                                        <span className="font-medium">现价: ¥{item.currentPrice.toFixed(2)}</span>
                                      )}
                                      {item.buyPrice && (
                                        <span>买入价: ¥{item.buyPrice.toFixed(2)}</span>
                                      )}
                                      {item.targetPrice && (
                                        <span>目标价: ¥{item.targetPrice.toFixed(2)}</span>
                                      )}
                                      {item.stopLossPrice && (
                                        <span>止损价: ¥{item.stopLossPrice.toFixed(2)}</span>
                                      )}
                                    </div>
                                  </div>
                                  {item.analysis && (
                                    <div className="text-right">
                                      <div className={`text-lg font-bold ${
                                        item.analysis.actionSignal === 'BUY' ? 'text-green-600' :
                                        item.analysis.actionSignal === 'SELL' ? 'text-red-600' :
                                        'text-gray-600'
                                      }`}>
                                        {item.analysis.actionSignal === 'BUY' ? '买入' :
                                         item.analysis.actionSignal === 'SELL' ? '卖出' : '持有'}
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        陷阱概率: {item.analysis.trapProbability}%
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* AI分析详情 */}
                                {item.analysis && (
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-1">事件摘要</h4>
                                        <p className="text-sm text-gray-600">{item.analysis.eventSummary}</p>
                                      </div>
                                      <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-1">行业趋势</h4>
                                        <p className="text-sm text-gray-600">{item.analysis.industryTrend}</p>
                                      </div>
                                    </div>

                                    {/* 逻辑链摘要 */}
                                    {item.analysis.logicChain && (
                                      <div className="bg-gray-50 p-3 rounded-lg">
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">分析逻辑链</h4>
                                        <div className="space-y-2">
                                          {item.analysis.logicChain.macro_analysis && (
                                            <div className="flex items-start gap-2">
                                              <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
                                              <span className="text-sm text-gray-600">
                                                <span className="font-medium">宏观分析:</span> {item.analysis.logicChain.macro_analysis}
                                              </span>
                                            </div>
                                          )}
                                          {item.analysis.logicChain.value_assessment && (
                                            <div className="flex items-start gap-2">
                                              <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5"></div>
                                              <span className="text-sm text-gray-600">
                                                <span className="font-medium">价值评估:</span> {item.analysis.logicChain.value_assessment}
                                              </span>
                                            </div>
                                          )}
                                          {item.analysis.logicChain.anti_humanity_check && (
                                            <div className="flex items-start gap-2">
                                              <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5"></div>
                                              <span className="text-sm text-gray-600">
                                                <span className="font-medium">反人性检查:</span> {item.analysis.logicChain.anti_humanity_check}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* 交易建议 */}
                                    {item.analysis.targetPrice && item.analysis.stopLoss && (
                                      <div className="flex items-center justify-between pt-3 border-t">
                                        <div>
                                          <h4 className="text-sm font-medium text-gray-700 mb-1">交易建议</h4>
                                          <div className="flex items-center gap-4 text-sm">
                                            <span className="text-green-600">
                                              <ThumbsUp className="h-3 w-3 inline mr-1" />
                                              目标价: ¥{item.analysis.targetPrice.toFixed(2)}
                                            </span>
                                            <span className="text-red-600">
                                              <ThumbsDown className="h-3 w-3 inline mr-1" />
                                              止损价: ¥{item.analysis.stopLoss.toFixed(2)}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          分析时间: {new Date(item.analysis.createdAt).toLocaleString()}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div>
          {/* 投资组合概览 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <DollarSign className="h-5 w-5 text-blue-500 mr-2" />
                    <span className="text-sm text-muted-foreground">总市值</span>
                  </div>
                  <div className="text-3xl font-bold">
                    {showValues ? `¥${portfolioSummary.totalMarketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "******"}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <TrendingUp className="h-5 w-5 text-green-500 mr-2" />
                    <span className="text-sm text-muted-foreground">总盈亏</span>
                  </div>
                  <div className={`text-3xl font-bold ${portfolioSummary.totalProfitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {showValues ? `${portfolioSummary.totalProfitLoss >= 0 ? '+' : ''}¥${portfolioSummary.totalProfitLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "******"}
                  </div>
                  {showValues && (
                    <div className={`text-sm mt-1 ${portfolioSummary.totalProfitLossPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {portfolioSummary.totalProfitLossPercent >= 0 ? '+' : ''}{portfolioSummary.totalProfitLossPercent.toFixed(2)}%
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <BarChart3 className="h-5 w-5 text-purple-500 mr-2" />
                    <span className="text-sm text-muted-foreground">持仓数量</span>
                  </div>
                  <div className="text-3xl font-bold">{portfolioSummary.positionCount}</div>
                  <div className="text-sm text-muted-foreground mt-1">只股票</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Calendar className="h-5 w-5 text-yellow-500 mr-2" />
                    <span className="text-sm text-muted-foreground">总成本</span>
                  </div>
                  <div className="text-3xl font-bold">
                    {showValues ? `¥${portfolioSummary.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "******"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 持仓列表 */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>持仓明细</CardTitle>
                  <CardDescription>实时跟踪您的股票持仓</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="搜索股票..."
                      className="pl-9 w-full md:w-48"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <AddPositionDialog onSuccess={loadPortfolio} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-6">
                  <TabsTrigger value="overview">全部持仓</TabsTrigger>
                  <TabsTrigger value="gainers">盈利持仓</TabsTrigger>
                  <TabsTrigger value="losers">亏损持仓</TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                  {portfolioLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    </div>
                  ) : portfolio.length === 0 ? (
                    <div className="text-center py-12">
                      <Wallet className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">暂无持仓</p>
                      <p className="text-sm text-gray-400">点击右上角"添加持仓"按钮开始管理您的投资组合</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {portfolio
                        .filter(item => {
                          if (activeTab === "gainers") return item.profitLoss > 0
                          if (activeTab === "losers") return item.profitLoss < 0
                          return true
                        })
                        .filter(item => {
                          if (!searchTerm) return true
                          return item.stockName.includes(searchTerm) || item.stockCode.includes(searchTerm)
                        })
                        .map((item) => (
                        <Card key={item.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="pt-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-3">
                                    <div>
                                      <h3 className="font-semibold">
                                        {item.stockName}
                                        {item.tradeType === "LIMIT_UP_PAPER" && (
                                          <Badge variant="outline" className="ml-2 text-orange-400 border-orange-400/50 text-xs">
                                            打板
                                          </Badge>
                                        )}
                                        {item.tradeStatus === "T_LOCKED" && (
                                          <Badge variant="outline" className="ml-2 text-yellow-400 border-yellow-400/50 text-xs">
                                            T+1
                                          </Badge>
                                        )}
                                      </h3>
                                      <div className="text-sm text-muted-foreground">
                                        {item.stockCode}{item.industry ? ` · ${item.industry}` : ''}
                                      </div>
                                    </div>
                                    <Badge className={
                                      item.status === "HOLD" ? "bg-blue-100 text-blue-800" :
                                      item.status === "ADD" ? "bg-green-100 text-green-800" :
                                      item.status === "REDUCE" ? "bg-yellow-100 text-yellow-800" :
                                      "bg-gray-100 text-gray-800"
                                    }>
                                      {item.status === "HOLD" ? "持有" : item.status === "ADD" ? "加仓" : item.status === "REDUCE" ? "减仓" : item.status}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="text-right">
                                      <div className={`text-lg font-bold ${item.profitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {showValues ? `¥${item.marketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "******"}
                                      </div>
                                      <div className={`text-sm ${item.profitLossPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {item.profitLossPercent >= 0 ? '+' : ''}{item.profitLossPercent.toFixed(2)}%
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-500 hover:text-red-700"
                                      onClick={() => handleDeletePosition(item.id, item.stockName)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <div className="text-muted-foreground">持仓数量</div>
                                    <div className="font-medium">{item.quantity.toLocaleString()} 股</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">成本价</div>
                                    <div className="font-medium">¥{item.avgCost.toFixed(2)}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">现价</div>
                                    <div className="font-medium">¥{item.currentPrice.toFixed(2)}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">持仓权重</div>
                                    <div className="flex items-center">
                                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden mr-2">
                                        <div
                                          className="h-full bg-blue-500 rounded-full"
                                          style={{ width: `${item.weight}%` }}
                                        />
                                      </div>
                                      <span className="font-medium">{item.weight.toFixed(1)}%</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alpha Feed - 打板决策流 */}
      <div className="mt-8">
        <AlphaFeedContainer onPositionAdded={() => loadPortfolio()} />
      </div>
    </div>
  )
}