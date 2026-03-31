"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@clerk/nextjs"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  RefreshCw,
  Shield,
  Zap,
  TrendingUp,
  BarChart3,
  LogIn,
  Filter,
  ChevronDown,
  Target,
} from "lucide-react"

interface PositionAdvice {
  suggestedPosition: number
  stopLoss: number
  takeProfitStrategy: string
  drawdownExit: number
  strategyLabel: string
  kellyRaw?: number
  winRate?: number
  profitLossRatio?: number
  sampleSize?: number
  positionSource: "kelly" | "fixed"
}

interface AlphaSignal {
  symbol: string
  name: string
  currentPrice: number
  changePercent: number
  volumeRatio: number
  turnoverRate?: number
  circulatingMarketCap?: number
  reason: string
  riskTag?: string
  signalScore?: number
  advice?: PositionAdvice
}

interface SentimentData {
  premiumRate: number
  chainHeight: number
  lockdown: boolean
}

interface TagStats {
  tag: string
  total: number
  tracked: number
  wins: number
  losses: number
  winRate: number
  avgReturn: number
  maxReturn: number
  maxLoss: number
}

interface BoardStats {
  overall: TagStats
  byTag: TagStats[]
  recentTracked: Array<{
    stockCode: string
    stockName: string
    signalTag: string
    entryPrice: number
    nextDayChange: number
    entryDate: string
  }>
  pendingCount: number
}

interface MacroStatus {
  sector: string
  macro: string
  price: number | null
  ma20: number | null
  bullish: boolean
  reason: string
}

type TabType = "screen" | "trend" | "leftSide"

export default function DabanPage() {
  const [screenSignals, setScreenSignals] = useState<AlphaSignal[]>([])
  const [sentiment] = useState<SentimentData | null>(null)
  const [accepted, setAccepted] = useState<AlphaSignal[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [screenLoading, setScreenLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>("screen")
  const [screenTime, setScreenTime] = useState("")
  const [screenConditions, setScreenConditions] = useState<string[]>([])
  const [trendSignals, setTrendSignals] = useState<AlphaSignal[]>([])
  const [trendLoading, setTrendLoading] = useState(false)
  const [trendTime, setTrendTime] = useState("")
  const [trendConditions, setTrendConditions] = useState<string[]>([])
  const [macroStatus, setMacroStatus] = useState<MacroStatus[]>([])
  const [leftSignals, setLeftSignals] = useState<AlphaSignal[]>([])
  const [leftLoading, setLeftLoading] = useState(false)
  const [leftTime, setLeftTime] = useState("")
  const [leftConditions, setLeftConditions] = useState<string[]>([])
  const [showLogic, setShowLogic] = useState(false)
  const [boardStats, setBoardStats] = useState<BoardStats | null>(null)
  const [showStats, setShowStats] = useState(false)
  const { isSignedIn, getToken } = useAuth()

  const fetchScreen = useCallback(async () => {
    setScreenLoading(true)
    try {
      const res = await fetch("/api/strategy-recommendation/screen")
      if (!res.ok) throw new Error("Failed to fetch screen")
      const data = await res.json()
      setScreenSignals(data.signals ?? [])
      setScreenTime(data.screenTime ?? "")
      setScreenConditions(data.conditions ?? [])
    } catch {
      toast.error("选股扫描失败")
    } finally {
      setScreenLoading(false)
    }
  }, [])

  const fetchTrend = useCallback(async () => {
    setTrendLoading(true)
    try {
      const res = await fetch("/api/strategy-recommendation/trend")
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setTrendSignals((data.signals ?? []).map((s: Record<string, unknown>) => ({
        symbol: s.symbol as string,
        name: s.name as string,
        currentPrice: s.currentPrice as number,
        changePercent: s.changePercent as number,
        volumeRatio: s.volumeRatio as number,
        turnoverRate: s.turnoverRate as number,
        circulatingMarketCap: s.circulatingMarketCap as number,
        reason: s.reason as string,
        riskTag: s.signalTag as string,
        signalScore: s.signalScore as number,
        advice: s.advice ? {
          suggestedPosition: (s.advice as Record<string, unknown>).suggestedPosition as number,
          stopLoss: (s.advice as Record<string, unknown>).stopLoss as number,
          takeProfitStrategy: (s.advice as Record<string, unknown>).takeProfitStrategy as string,
          drawdownExit: 0,
          strategyLabel: (s.advice as Record<string, unknown>).strategyLabel as string,
          positionSource: "fixed" as const,
        } : undefined,
      })))
      setTrendTime(data.screenTime ?? "")
      setTrendConditions(data.conditions ?? [])
      setMacroStatus(data.macroStatus ?? [])
    } catch {
      toast.error("趋势扫描失败")
    } finally {
      setTrendLoading(false)
    }
  }, [])

  const fetchLeftSide = useCallback(async () => {
    setLeftLoading(true)
    try {
      const res = await fetch("/api/strategy-recommendation/left-side")
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setLeftSignals(data.signals ?? [])
      setLeftTime(data.screenTime ?? "")
      setLeftConditions(data.conditions ?? [])
    } catch {
      toast.error("左侧交易扫描失败")
    } finally {
      setLeftLoading(false)
    }
  }, [])

  // 从数据库加载已接受的跟踪记录（持久化）
  const loadAccepted = useCallback(async () => {
    try {
      const token = await getToken()
      const res = await fetch("/api/board-track?limit=50", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        if (data.records) {
          // 加载最近7天的记录（包括pending和tracked状态）
          const sevenDaysAgo = new Date()
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
          const cutoff = sevenDaysAgo.toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" })
          const todayRecords = data.records.filter(
            (r: { entryDate: string; trackStatus: string }) =>
              r.trackStatus !== "failed" && r.entryDate >= cutoff
          )
          setAccepted(todayRecords.map((r: { stockCode: string; stockName: string; entryPrice: number; signalScore?: number; trackStatus: string; nextDayChange?: number; entryDate: string }) => ({
            symbol: r.stockCode,
            name: r.stockName,
            currentPrice: r.entryPrice,
            changePercent: r.nextDayChange ?? 0,
            volumeRatio: 0,
            reason: r.trackStatus === "tracked" ? `${r.entryDate} 次日${(r.nextDayChange ?? 0) >= 0 ? "+" : ""}${(r.nextDayChange ?? 0).toFixed(2)}%` : `${r.entryDate} 待跟踪`,
          })))
        }
      }
    } catch {
      // silently fail
    }
  }, [getToken])

  const fetchStats = useCallback(async () => {
    try {
      const token = await getToken()
      const res = await fetch("/api/board-track/stats", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success) setBoardStats(data)
      }
    } catch {
      // silently fail
    }
  }, [getToken])

  useEffect(() => {
    if (isSignedIn === undefined) return
    fetchScreen()
    if (isSignedIn) {
      loadAccepted()
      fetchStats()
    }
    setLoading(false)
  }, [isSignedIn, fetchScreen, loadAccepted, fetchStats])

  // 趋势/左侧交易: 切换到Tab时才加载（较慢的API）
  useEffect(() => {
    if (activeTab === "trend" && trendSignals.length === 0 && !trendLoading) {
      fetchTrend()
    }
    if (activeTab === "leftSide" && leftSignals.length === 0 && !leftLoading) {
      fetchLeftSide()
    }
  }, [activeTab, trendSignals.length, trendLoading, fetchTrend, leftSignals.length, leftLoading, fetchLeftSide])

  const handleRefresh = () => {
    setRefreshing(true)
    if (activeTab === "trend") {
      fetchTrend().finally(() => setRefreshing(false))
    } else if (activeTab === "leftSide") {
      fetchLeftSide().finally(() => setRefreshing(false))
    } else {
      fetchScreen()
      setRefreshing(false)
    }
  }

  const handleAccept = async (signal: AlphaSignal) => {
    if (!isSignedIn) {
      toast.error("请先登录")
      return
    }
    try {
      const token = await getToken()
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          stockCode: signal.symbol,
          stockName: signal.name,
          quantity: 100,
          avgCost: signal.currentPrice,
          tradeType: "LIMIT_UP_PAPER",
          tradeStatus: "T_LOCKED",
        }),
      })
      if (res.ok) {
        setAccepted((prev) => [...prev, signal])
        // 同时加入自选股（带默认止盈止损配置）+ 自动recalculate
        fetch("/api/watchlist", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            stockCode: signal.symbol,
            stockName: signal.name,
            buyPrice: signal.currentPrice,
            stopLossMethod: "fixed",
            stopLossParams: { fixedPrice: signal.currentPrice * 0.95 },
            takeProfitMethod: "atr_multiple",
            takeProfitParams: { atrMultiple: 3, atrPeriod: 14 },
          }),
        }).then(async (r) => {
          if (r.ok) {
            const data = await r.json()
            toast.success(`已接受并加入自选股: ${signal.name}（自动计算止盈止损）`)
            // 自动触发止盈止损计算
            if (data.item?.id) {
              fetch("/api/watchlist/recalculate", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ ids: [data.item.id] }),
              }).then(async (recalcRes) => {
                if (recalcRes.ok) {
                  const recalcData = await recalcRes.json()
                  const result = recalcData.results?.[0]
                  if (result?.stopLossPrice && result?.targetPrice) {
                    toast.success(
                      `${signal.name} 止损¥${Number(result.stopLossPrice).toFixed(2)} 止盈¥${Number(result.targetPrice).toFixed(2)}`,
                      { duration: 5000 }
                    )
                  }
                }
              }).catch(() => {})
            }
          } else if (r.status === 409) {
            toast.success(`已接受: ${signal.name}（自选股中已存在）`)
          } else {
            toast.success(`已接受: ${signal.name}`)
          }
        }).catch(() => {
          toast.success(`已接受: ${signal.name}`)
        })
        // 保存打板跟踪记录
        fetch("/api/board-track", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            stockCode: signal.symbol,
            stockName: signal.name,
            entryPrice: signal.currentPrice,
            signalTag: signal.riskTag || "未分类",
            signalScore: signal.signalScore || 0,
          }),
        }).catch(() => {})
      } else {
        const errData = await res.json().catch(() => ({}))
        const msg = errData.error || `HTTP ${res.status}`
        if (res.status === 401) {
          toast.error("请先登录后再操作")
        } else if (res.status === 404) {
          toast.error("用户未同步，请重新登录")
        } else {
          toast.error(`添加失败: ${msg}`)
        }
      }
    } catch {
      toast.error("网络错误，请重试")
    }
  }

  const handleCancelTrack = async (symbol: string) => {
    try {
      const token = await getToken()
      // 从accepted列表中找到并移除
      setAccepted((prev) => prev.filter((s) => s.symbol !== symbol))
      // 删除BoardTrack记录（按stockCode查最近的pending记录）
      const res = await fetch("/api/board-track?" + new URLSearchParams({ limit: "50" }), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        const record = data.records?.find((r: { stockCode: string }) => r.stockCode === symbol)
        if (record) {
          await fetch(`/api/board-track?id=${record.id}`, {
            method: "DELETE",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          })
        }
      }
      toast.success("已取消跟踪")
    } catch {
      toast.error("取消失败")
    }
  }

  const handleDismiss = (symbol: string) => {
    setDismissed((prev) => new Set(prev).add(symbol))
  }

  // Unauthenticated — still allow viewing, just disable accept
  if (isSignedIn === false) {
    return (
      <div className="min-h-full bg-[#0a0e17] flex items-center justify-center">
        <div className="text-center">
          <LogIn className="h-10 w-10 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 text-sm mb-2">请先登录以使用打板决策流</p>
          <a
            href="/sign-in"
            className="text-blue-400 hover:text-blue-300 text-sm underline"
          >
            前往登录
          </a>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-full bg-[#0a0e17] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    )
  }

  const isLockdown = sentiment?.lockdown === true
  const acceptedSymbols = new Set(accepted.map((s) => s.symbol))

  const currentSignals = activeTab === "trend" ? trendSignals : activeTab === "leftSide" ? leftSignals : screenSignals
  const visibleSignals = currentSignals.filter(
    (s) => !dismissed.has(s.symbol)
  )
  const allProcessed = visibleSignals.length === 0 && currentSignals.length > 0

  return (
    <div className="min-h-full bg-[#0a0e17] text-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-400" />
            <h1 className="text-xl font-bold text-white">打板决策流</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLogic(!showLogic)}
              className={`text-xs ${showLogic ? "text-amber-400 bg-amber-500/10" : "text-gray-400 hover:text-white hover:bg-white/[0.06]"}`}
            >
              <ChevronDown className={`h-3.5 w-3.5 mr-1 transition-transform ${showLogic ? "rotate-180" : ""}`} />
              逻辑白盒
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowStats(!showStats); if (!boardStats) fetchStats() }}
              className={`text-xs ${showStats ? "text-emerald-400 bg-emerald-500/10" : "text-gray-400 hover:text-white hover:bg-white/[0.06]"}`}
            >
              <Target className="h-3.5 w-3.5 mr-1" />
              胜率跟踪{boardStats?.overall.tracked ? ` (${boardStats.overall.tracked})` : ""}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing || screenLoading}
              className="text-gray-400 hover:text-white hover:bg-white/[0.06]"
            >
              <RefreshCw
                className={`h-4 w-4 mr-1.5 ${refreshing || screenLoading ? "animate-spin" : ""}`}
              />
              刷新
            </Button>
          </div>
        </div>

        {/* Sentiment Panel */}
        {sentiment && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-[#0d1117] border border-[#1a2035] rounded-lg p-4">
              <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
                <TrendingUp className="h-3.5 w-3.5" />
                连板高度
              </div>
              <div className="text-2xl font-bold text-white">
                {sentiment.chainHeight || "--"}
              </div>
              <div className="text-[10px] text-gray-600 mt-1">
                当前最高连板天数
              </div>
            </div>
            <div className="bg-[#0d1117] border border-[#1a2035] rounded-lg p-4">
              <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
                <BarChart3 className="h-3.5 w-3.5" />
                昨日涨停溢价率
              </div>
              <div
                className={`text-2xl font-bold ${
                  sentiment.premiumRate > 0
                    ? "text-emerald-400"
                    : sentiment.premiumRate < 0
                      ? "text-red-400"
                      : "text-gray-400"
                }`}
              >
                {sentiment.premiumRate !== 0 ? `${sentiment.premiumRate.toFixed(1)}%` : "--"}
              </div>
              <div className="text-[10px] text-gray-600 mt-1">
                昨涨停股今开均价偏离
              </div>
            </div>
            <div className="bg-[#0d1117] border border-[#1a2035] rounded-lg p-4">
              <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
                <Shield className="h-3.5 w-3.5" />
                情绪状态
              </div>
              <div
                className={`text-2xl font-bold ${
                  isLockdown ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {isLockdown ? "冰点" : "正常"}
              </div>
              <div className="text-[10px] text-gray-600 mt-1">
                {isLockdown ? "溢价率为负，空仓防守" : "溢价率正常，可操作"}
              </div>
            </div>
          </div>
        )}

        {/* Lockdown Banner */}
        {isLockdown && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-5 flex items-center gap-2">
            <Shield className="h-4 w-4 text-red-400 flex-shrink-0" />
            <span className="text-red-400 text-sm font-medium">
              情绪冰点 -- 空仓防守，今日不参与打板
            </span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 mb-4 bg-[#0d1117] border border-[#1a2035] rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab("screen")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              activeTab === "screen"
                ? "bg-amber-500/15 text-amber-400"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            条件选股
            {screenSignals.length > 0 && (
              <span className="text-[10px] ml-0.5 opacity-70">({screenSignals.length})</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("trend")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              activeTab === "trend"
                ? "bg-cyan-500/15 text-cyan-400"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            趋势跟踪
            {trendSignals.length > 0 && (
              <span className="text-[10px] ml-0.5 opacity-70">({trendSignals.length})</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("leftSide")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              activeTab === "leftSide"
                ? "bg-emerald-500/15 text-emerald-400"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            左侧交易
            {leftSignals.length > 0 && (
              <span className="text-[10px] ml-0.5 opacity-70">({leftSignals.length})</span>
            )}
          </button>
        </div>

        {/* Conditions Bar */}
        {/* Macro Status Panel (趋势Tab) */}
        {activeTab === "trend" && macroStatus.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
            {macroStatus.map((m) => (
              <div key={m.sector} className={`bg-[#0d1117] border rounded-lg px-3 py-2 ${m.bullish ? "border-emerald-500/20" : "border-red-500/20"}`}>
                <div className="text-[10px] text-gray-500">{m.macro}</div>
                <div className={`text-sm font-bold ${m.bullish ? "text-emerald-400" : "text-red-400"}`}>
                  {m.sector} {m.bullish ? "✓" : "✗"}
                </div>
                <div className="text-[9px] text-gray-600 truncate">{m.reason}</div>
              </div>
            ))}
          </div>
        )}

        {/* Conditions Bar */}
        {(() => {
          const conds = activeTab === "leftSide" ? leftConditions : activeTab === "trend" ? trendConditions : screenConditions
          const time = activeTab === "leftSide" ? leftTime : activeTab === "trend" ? trendTime : screenTime
          return conds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 mb-4">
              {conds.map((c) => (
                <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a2035] text-gray-400 border border-[#2a3045]">
                  {c}
                </span>
              ))}
              {time && (
                <span className="text-[10px] text-gray-600 ml-2">
                  扫描时间: {time}
                </span>
              )}
            </div>
          ) : null
        })()}

        {/* Logic Whitebox Panel */}
        {showLogic && (
          <div className="bg-[#0d1117] border border-[#1a2035] rounded-lg p-4 mb-5 text-xs space-y-3">
            <h3 className="text-gray-300 font-medium text-sm mb-2">完整逻辑清单（白盒化）</h3>

            {/* 一、数据源 */}
            <div className="space-y-2">
              <div className="text-gray-400 font-medium">一、数据源与扫描范围</div>
              <div className="space-y-1 text-gray-500 pl-3">
                <div>行情数据: 东方财富推送API（push2.eastmoney.com）</div>
                <div>扫描范围: 全A股（沪主板+深主板+创业板+科创板+中小板）</div>
                <div>候选池: 按涨幅降序取前200只 → 过滤后取前30只查MA → 最终输出≤20只</div>
                <div>K线/均线: 东方财富K线API，取最近20日收盘价计算MA5/MA10/MA20</div>
                <div>涨停池: 东方财富涨停池API（getTopicZTPool），计算溢价率和连板高度</div>
              </div>
            </div>

            {/* 二、基础筛选 */}
            <div className="space-y-2">
              <div className="text-gray-400 font-medium">二、基础筛选（交易时段）</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-gray-500 pl-3">
                <span>涨跌幅 &gt; 3%</span>
                <span>流通市值 &gt; 50亿</span>
                <span>量比 &gt; 1.5（放量确认）</span>
                <span>换手率 3%~15%（活跃度）</span>
                <span>排除 ST / *ST / 退市股</span>
                <span>排除 920 新股板块</span>
                <span>排除涨停封死（现价≥昨收×1.097，买不到）</span>
                <span>价格 &gt; 0（有效数据）</span>
              </div>
            </div>

            {/* 三、非交易时段 */}
            <div className="space-y-2">
              <div className="text-gray-400 font-medium">三、非交易时段降级规则</div>
              <div className="space-y-1 text-gray-500 pl-3">
                <div>判定: 有效股票数 &lt; 10 或涨跌幅全为0 → 进入非交易时段模式</div>
                <div>放宽: 涨跌幅≥2%（交易时段3%）、市值≥30亿（交易时段50亿）</div>
                <div>跳过: MA多头排列验证、VWAP验证均跳过</div>
                <div>兜底: 无信号时自动读取数据库缓存（最近交易日结果）</div>
              </div>
            </div>

            {/* 四、技术面验证 */}
            <div className="space-y-2">
              <div className="text-gray-400 font-medium">四、技术面验证（仅交易时段）</div>
              <div className="space-y-1 text-gray-500 pl-3">
                <div>多头排列: 价格 &gt; MA5 &gt; MA10 &gt; MA20（MA数据可用时）</div>
                <div>VWAP: 价格 &gt; 成交额÷成交量÷100（均价线上方 = 买方力量强）</div>
              </div>
            </div>

            {/* 五、诱多检测 */}
            <div className="space-y-2">
              <div className="text-amber-400/80 font-medium">五、疑似诱多检测 ⚠️</div>
              <div className="space-y-1 text-gray-500 pl-3">
                <div>尾盘急拉: 开盘涨幅&lt;1%，但尾盘贡献&gt;涨幅的60%</div>
                <div>振幅异常: 振幅 &gt; 涨幅×2.5 且 振幅 &gt; 5%</div>
                <div>盘中破昨收: 最低价 &lt; 昨收，但收盘涨 &gt; 3%</div>
                <div>炸板回落: 最高价触及涨停(≥昨收×1.097)但现价回落&gt;3%</div>
                <div className="text-yellow-500/60">触发任一条 → 标记"疑似诱多" + 评分扣30分</div>
              </div>
            </div>

            {/* 六、确认上攻 */}
            <div className="space-y-2">
              <div className="text-emerald-400/80 font-medium">六、确认上攻 ✅（全部满足）</div>
              <div className="space-y-1 text-gray-500 pl-3">
                <div>非诱多（未触发第五条任何规则）</div>
                <div>量比 ≥ 2.0（显著放量）</div>
                <div>换手率 3%~8%（活跃但不过度换手）</div>
                <div>开盘涨幅 ≥ 1%（开盘即强势，低开拉升次日回落概率高）</div>
                <div>最低价 ≥ 昨收（全天未跌破昨收 = 无恐慌抛压）</div>
                <div>振幅 &lt; 涨幅×1.8（走势更平稳）</div>
                <div>价格 &gt; MA5 &gt; MA10 &gt; MA20（严格多头排列，MA可用时）</div>
              </div>
            </div>

            {/* 七、爆发打板 */}
            <div className="space-y-2">
              <div className="text-purple-400/80 font-medium">七、爆发打板 ⚡（全部满足）</div>
              <div className="space-y-1 text-gray-500 pl-3">
                <div>非诱多（未触发第五条任何规则）</div>
                <div>涨幅 ≥ 9.5%（接近涨停，9%太松易误判）</div>
                <div>流通市值 50~300亿（游资偏好中盘股）</div>
                <div>量比 ≥ 2.5（资金集中涌入）</div>
                <div>最低价 ≥ 昨收（封板力度强）</div>
                <div>开盘涨幅 ≥ 1%（排除低开拉板）</div>
                <div>现价 ≥ 昨收×1.095（确认封板未炸）</div>
              </div>
            </div>

            {/* 八、强烈推荐 */}
            <div className="space-y-2">
              <div className="text-amber-300 font-medium">八、强烈推荐 🔥 = 确认上攻 ∩ 爆发打板</div>
              <div className="text-gray-500 pl-3">同时满足第六条和第七条的全部条件</div>
            </div>

            {/* 九、综合评分 */}
            <div className="space-y-2">
              <div className="text-gray-400 font-medium">九、综合评分（0-100分）</div>
              <div className="space-y-1 text-gray-500 pl-3">
                <div>涨幅: min(25, 涨幅% × 2.5) → 0~25分</div>
                <div>量比: min(20, 量比 × 5) → 0~20分</div>
                <div>换手率: 以5.5%为最佳，偏离越大扣越多 → 0~15分</div>
                <div>开盘强度: min(15, 开盘涨幅% × 5) → 0~15分</div>
                <div>均线排列: 严格多头+15 / 部分多头+8 / 否则+0 → 0~15分</div>
                <div>走势平稳: 振幅&lt;涨幅×1.5→+10 / &lt;×2→+5 / 否则+0 → 0~10分</div>
                <div className="text-yellow-500/60">疑似诱多: 总分扣30分（最低0分）</div>
              </div>
            </div>

            {/* 十、情绪面板 & 冰点锁定 */}
            <div className="space-y-2">
              <div className="text-red-400/80 font-medium">十、情绪面板 & 冰点锁定</div>
              <div className="space-y-1 text-gray-500 pl-3">
                <div>溢价率 = 昨日涨停股今日开盘均价偏离昨收的百分比</div>
                <div>连板高度 = 涨停池中最大连续涨停天数</div>
                <div>冰点锁定: 溢价率 &lt; 0 → 清空全部信号，显示"空仓防守"横幅</div>
                <div className="text-red-400/60">冰点期间所有信号卡片变灰且不可操作</div>
              </div>
            </div>

            {/* 十一、市场环境判定 */}
            <div className="space-y-2">
              <div className="text-cyan-400/80 font-medium">十一、市场环境自动判定</div>
              <div className="space-y-1 text-gray-500 pl-3">
                <div>牛市: 溢价率 &gt; 2% 且 连板高度 ≥ 4</div>
                <div>熊市: 溢价率 &lt; -1% 或 连板高度 ≤ 1</div>
                <div>震荡市: 其他情况</div>
                <div className="text-gray-600">市场环境影响: 止损线宽度、回撤离场线、仓位情绪系数</div>
              </div>
            </div>

            {/* 十二、仓位管理 */}
            <div className="space-y-2">
              <div className="text-cyan-400/80 font-medium">十二、仓位管理</div>
              <div className="space-y-1 text-gray-500 pl-3">
                <div>基础仓位: 🔥15% / ⚡10% / ✅8% / 高风险5% / ⚠️诱多0%</div>
                <div>情绪系数: 溢价率&gt;3%→×1.2 / 0~3%→×1.0 / -2~0%→×0.5 / &lt;-2%→×0</div>
                <div>胜率系数: &gt;60%→×1.2 / 50-60%→×1.0 / 40-50%→×0.7 / &lt;40%或样本&lt;10→×0.5</div>
                <div>硬上限: 单股不超过总资金20%，结果保留1位小数</div>
                <div className="text-gray-600">公式: 仓位 = min(20, 基础 × 情绪系数 × 胜率系数)</div>
                <div className="text-gray-600">胜率数据来源: BoardTrack 数据库中该信号类型的历史跟踪记录</div>
              </div>
            </div>

            {/* 十三、止盈止损 */}
            <div className="space-y-2">
              <div className="text-pink-400/80 font-medium">十三、止盈止损策略（按市场环境动态调整）</div>
              <div className="space-y-1 text-gray-500 pl-3">
                <div>止损线（牛/震荡/熊）:</div>
                <div className="pl-3">🔥 -7% / -5% / -3%</div>
                <div className="pl-3">⚡ -5% / -3% / -2%</div>
                <div className="pl-3">✅ -6% / -4% / -3%</div>
                <div className="pl-3">高风险 -3% / -2% / -1.5%</div>
                <div>高点回撤离场线（牛/震荡/熊）:</div>
                <div className="pl-3">🔥 -5% / -3% / -2%</div>
                <div className="pl-3">⚡ -3% / -2% / -1.5%</div>
                <div className="pl-3">✅ -4% / -3% / -2%</div>
                <div className="pl-3">高风险 -2% / -1.5% / -1%</div>
                <div className="text-gray-400">不设硬性最大持有天数，未触发止损/回撤线可继续持有</div>
              </div>
              <div className="space-y-1 text-gray-500 pl-3 border-l-2 border-[#1a2035] ml-1">
                <div className="text-gray-400">按信号类型的止盈策略:</div>
                <div>🔥连板预期: 高开&gt;3%持有追踪 / 0~3%卖半仓锁利 / 低开触发止损线离场</div>
                <div>⚡快进快出: 高开&gt;5%集合竞价直接卖出 / 0~5%开盘30分钟内卖 / 低开立即止损</div>
                <div>✅趋势跟踪: 持有追踪回撤离场 / 跌破MA5次日开盘卖 / 破止损线止损</div>
                <div>高风险: 开盘30分钟内卖出 / 再封涨停例外可持有到次日 / 严格止损</div>
              </div>
            </div>

            {/* 十四、排序规则 */}
            <div className="space-y-2">
              <div className="text-gray-400 font-medium">十四、排序与输出</div>
              <div className="space-y-1 text-gray-500 pl-3">
                <div>优先级: 🔥强烈推荐 &gt; ⚡爆发打板 &gt; ✅确认上攻 &gt; 普通 &gt; ⚠️疑似诱多</div>
                <div>同级排序: 按综合评分降序</div>
                <div>条件选股Tab: 最多输出20只信号</div>
                <div>涨幅扫描Tab: 扫描30只蓝筹标的，最多输出12只，标签: 强势冲板(≥8.5%) / 加速上攻(≥5%) / 异动关注(&lt;5%) / 盘后回顾(非交易时段)</div>
              </div>
            </div>

            {/* 十五、接受联动 */}
            <div className="space-y-2">
              <div className="text-blue-400/80 font-medium">十五、接受操作联动流程</div>
              <div className="space-y-1 text-gray-500 pl-3">
                <div>1. 写入投资组合: 数量100股，类型LIMIT_UP_PAPER，状态T+1锁定</div>
                <div>2. 加入自选股: 附带买入价，重复(409)不报错</div>
                <div>3. 保存跟踪记录: 记录入场价、信号标签、评分 → 等待Cron次日跟踪</div>
                <div>卡片状态: 接受后显示"✓ 已接受 · 跟踪中"，忽略后本次会话隐藏</div>
              </div>
            </div>

            {/* 十六、胜率跟踪闭环 */}
            <div className="space-y-2">
              <div className="text-green-400/80 font-medium">十六、胜率跟踪闭环</div>
              <div className="space-y-1 text-gray-500 pl-3">
                <div>Cron: 每交易日15:30 CST自动执行，批量查询（每50只一批）</div>
                <div>计算: 次日收益% = (次日收盘价 - 入场价) / 入场价 × 100</div>
                <div>状态流转: pending → tracked（获取到数据） / failed（3天无数据）</div>
                <div>统计维度: 按信号标签分组 → 胜率、平均收益、最大收益、最大亏损</div>
                <div className="text-green-400/60">闭环: 历史胜率 → 反哺Kelly公式的胜率和盈亏比</div>
              </div>
            </div>

            {/* 十七、Kelly公式仓位引擎 */}
            <div className="space-y-2">
              <div className="text-orange-400/80 font-medium">十七、Kelly公式仓位引擎（替代固定仓位表）</div>
              <div className="space-y-1 text-gray-500 pl-3">
                <div>公式: f = (b×p - q) / b</div>
                <div className="pl-3">p = 胜率, q = 1-p, b = 盈亏比(平均盈利%/平均亏损%)</div>
                <div>使用半凯利: 建议仓位 = min(20%, f/2 × 100%)</div>
                <div>Kelly≤0: 建议仓位0%，显示"数学不支持买入"</div>
                <div>降级: 样本&lt;20条 → 使用固定仓位表(15/10/8/5%)</div>
                <div>数据源: BoardTrack数据库中该signalTag的已跟踪记录</div>
                <div className="text-orange-400/60">意义: 胜率40%+盈亏比1.5时Kelly=0，数学告诉你不应该下注</div>
              </div>
            </div>

            {/* 十八、游资微观结构加分 */}
            <div className="space-y-2">
              <div className="text-violet-400/80 font-medium">十八、游资微观结构加分（打板增强）</div>
              <div className="space-y-1 text-gray-500 pl-3">
                <div>游资偏好市值: 30~80亿→+10分，80~150亿→+3分（最易拉升区间）</div>
                <div>资金强势攻入: 量比&gt;3 且 涨幅&gt;5%→+5分</div>
                <div>板块效应: 同代码前缀≥3只异动→"板块共振"+8分</div>
                <div>孤军深入: 同前缀仅1只→-5分（无板块呼应）</div>
              </div>
              <div className="space-y-1 text-gray-600 pl-3 border-l-2 border-[#1a2035] ml-1">
                <div>未来迭代（数据源限制暂不可行）:</div>
                <div>· 基金持仓占比过滤（需天天基金API）</div>
                <div>· 股性活跃度-60日涨停次数（需扩展K线查询）</div>
                <div>· 内外盘比精确值（需腾讯L2数据）</div>
                <div>· NLP新闻词频爆发检测（需DeepSeek+新闻源）</div>
                <div>· HMM隐马尔可夫状态检测（需Python ML服务）</div>
              </div>
            </div>

            {/* 十九、左侧交易引擎 */}
            <div className="space-y-2">
              <div className="text-emerald-400/80 font-medium">十九、左侧交易引擎（独立Tab）</div>
              <div className="space-y-1 text-gray-500 pl-3">
                <div className="text-gray-400">Layer 1 — 价值底座（硬过滤）:</div>
                <div className="pl-3">PE(TTM) 5~25 + PB &lt; 3.0 + 流通市值 &gt; 100亿 + 排除ST</div>
                <div className="text-gray-400">Layer 2 — 技术面超卖检测（≥2项确认）:</div>
                <div className="pl-3">地量: 20日均量 &lt; 120日均量×40%</div>
                <div className="pl-3">RSI(14) &lt; 30（极度超卖）</div>
                <div className="pl-3">偏离250日均线 &gt; -20%（绝对超跌）</div>
                <div className="pl-3">MACD底背离: 价格新低但柱状体缩短</div>
                <div className="text-gray-400">Layer 3 — 反转触发器（≥2项确认）:</div>
                <div className="pl-3">RSI拐头: 从&lt;35区域连续2日上升</div>
                <div className="pl-3">量能回暖: 5日均量 &gt; 10日均量（地量后放量）</div>
                <div className="pl-3">站上MA5: 收盘价 &gt; 5日均线</div>
              </div>
              <div className="space-y-1 text-gray-500 pl-3">
                <div className="text-gray-400">信号标签:</div>
                <div className="pl-3">🌱反转萌芽 = L1+L2+L3 / 💎价值洼地 = L1+L2 / 👁观察等待 = 仅L1</div>
                <div className="text-gray-400">左侧仓位策略（与打板不同）:</div>
                <div className="pl-3">反转萌芽8% / 价值洼地5% / 止损-12% / 回撤-8%</div>
                <div className="pl-3">目标: +30% 或 回到250日均线上方</div>
                <div className="pl-3">DCA: 每跌5%可加仓，单股累计≤15%</div>
              </div>
            </div>

            <div className="border-t border-[#1a2035] pt-2 text-[10px] text-gray-600 space-y-1">
              <div>数据源: 东方财富推送API + K线API + technicalindicators库 + BoardTrack数据库</div>
              <div>限制: 无Level-2盘口、无财报API(ROE/FCF)、无NLP、无基金持仓 — 用近似指标替代</div>
            </div>
          </div>
        )}

        {/* Win Rate Stats Panel */}
        {showStats && boardStats && (
          <div className="bg-[#0d1117] border border-[#1a2035] rounded-lg p-4 mb-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-gray-300 font-medium text-sm flex items-center gap-1.5">
                <Target className="h-4 w-4 text-amber-400" />
                打板胜率跟踪
              </h3>
              {boardStats.pendingCount > 0 && (
                <span className="text-[10px] text-gray-500">
                  {boardStats.pendingCount} 只待跟踪
                </span>
              )}
            </div>

            {/* Overall stats */}
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <div className="text-xl font-bold text-white">{boardStats.overall.tracked}</div>
                <div className="text-[10px] text-gray-500">已跟踪</div>
              </div>
              <div className="text-center">
                <div className={`text-xl font-bold ${boardStats.overall.winRate >= 50 ? "text-emerald-400" : "text-red-400"}`}>
                  {boardStats.overall.winRate}%
                </div>
                <div className="text-[10px] text-gray-500">总胜率</div>
              </div>
              <div className="text-center">
                <div className={`text-xl font-bold ${boardStats.overall.avgReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {boardStats.overall.avgReturn >= 0 ? "+" : ""}{boardStats.overall.avgReturn}%
                </div>
                <div className="text-[10px] text-gray-500">平均收益</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-white">
                  {boardStats.overall.wins}<span className="text-gray-600">/</span>{boardStats.overall.losses}
                </div>
                <div className="text-[10px] text-gray-500">胜/负</div>
              </div>
            </div>

            {/* By tag breakdown */}
            {boardStats.byTag.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">按信号类型</div>
                {boardStats.byTag.map((t) => (
                  <div key={t.tag} className="flex items-center justify-between text-xs py-1.5 border-b border-[#1a2035] last:border-0">
                    <span className={`font-medium ${
                      t.tag === "强烈推荐" ? "text-amber-300" :
                      t.tag === "爆发打板" ? "text-purple-300" :
                      t.tag === "确认上攻" ? "text-emerald-300" :
                      t.tag === "疑似诱多" ? "text-yellow-400" :
                      "text-gray-400"
                    }`}>
                      {t.tag}
                    </span>
                    <div className="flex items-center gap-4 text-gray-400">
                      <span>{t.tracked}次</span>
                      <span className={t.winRate >= 50 ? "text-emerald-400" : "text-red-400"}>
                        胜率{t.winRate}%
                      </span>
                      <span className={t.avgReturn >= 0 ? "text-emerald-400" : "text-red-400"}>
                        均收{t.avgReturn >= 0 ? "+" : ""}{t.avgReturn}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recent tracked */}
            {boardStats.recentTracked.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">最近跟踪</div>
                {boardStats.recentTracked.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 text-gray-400">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-300">{r.stockName}</span>
                      <span className="text-gray-600">{r.entryDate}</span>
                    </div>
                    <span className={r.nextDayChange >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {r.nextDayChange >= 0 ? "+" : ""}{r.nextDayChange.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            {boardStats.overall.tracked === 0 && (
              <div className="text-center py-4 text-gray-500 text-xs">
                暂无跟踪数据，接受打板信号后次日自动跟踪
              </div>
            )}
          </div>
        )}

        {/* Signal Cards Grid */}
        <div className="mb-8">
          {((screenLoading && activeTab === "screen") || (leftLoading && activeTab === "leftSide") || (trendLoading && activeTab === "trend")) ? (
            <div className="bg-[#0d1117] border border-[#1a2035] rounded-lg py-16 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-gray-500 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">
                {activeTab === "trend" ? "正在扫描宏观趋势标的..." : activeTab === "leftSide" ? "正在扫描低估值超卖股..." : "正在扫描全A股..."}
              </p>
            </div>
          ) : currentSignals.length === 0 ? (
            <div className="bg-[#0d1117] border border-[#1a2035] rounded-lg py-16 text-center">
              <Zap className="h-8 w-8 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">
                {activeTab === "screen"
                  ? "当前无符合条件的股票（非交易时段数据可能不完整）"
                  : "当前暂无打板信号，等待盘中扫描..."}
              </p>
            </div>
          ) : allProcessed ? (
            <div className="bg-[#0d1117] border border-[#1a2035] rounded-lg py-16 text-center">
              <p className="text-gray-500 text-sm">今日信号已处理完毕</p>
            </div>
          ) : (
            <div
              className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${
                isLockdown ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              {visibleSignals.map((signal) => {
                const isStrongBuy = signal.riskTag === "强烈推荐"
                const isExplosive = signal.riskTag === "爆发打板"
                const isConfirmed = signal.riskTag === "确认上攻"
                const isTrap = signal.riskTag === "疑似诱多"
                const isTrendBreak = signal.riskTag === "趋势突破"
                const isVCP = signal.riskTag === "VCP收敛"
                const cardBorder = isTrendBreak
                  ? "border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                  : isVCP
                    ? "border-cyan-500/30"
                    : isStrongBuy
                      ? "border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                      : isExplosive
                        ? "border-purple-500/40"
                        : isConfirmed
                          ? "border-emerald-500/30"
                          : isTrap
                            ? "border-yellow-500/30 opacity-60"
                            : "border-[#1a2035]"

                return (
                <div
                  key={signal.symbol}
                  className={`bg-[#0d1117] border rounded-lg p-4 hover:border-[#2a3045] transition-colors ${cardBorder}`}
                >
                  {/* Header: name + code + risk tag */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold text-base">
                          {signal.name}
                        </span>
                        {signal.riskTag && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            isTrendBreak
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                              : isVCP
                                ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/25"
                                : signal.riskTag === "放量异动"
                                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                  : signal.riskTag === "Stage2观察"
                                    ? "bg-gray-500/15 text-gray-400"
                                    : isStrongBuy
                                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                      : isExplosive
                                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                        : isConfirmed
                                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                          : isTrap
                                            ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                                            : signal.riskTag === "高风险追板"
                                              ? "bg-red-500/15 text-red-400"
                                              : "bg-blue-500/15 text-blue-400"
                          }`}>
                            {isTrendBreak ? "🏔️" : isVCP ? "🔋" : signal.riskTag === "放量异动" ? "📊" : isStrongBuy ? "🔥" : isExplosive ? "⚡" : isConfirmed ? "✅" : isTrap ? "⚠️" : ""}
                            {signal.riskTag}
                          </span>
                        )}
                        {signal.signalScore != null && signal.signalScore > 0 && (
                          <span className={`text-[10px] px-1 py-0.5 rounded font-mono ${
                            signal.signalScore >= 80 ? "text-amber-400" :
                            signal.signalScore >= 60 ? "text-emerald-400" :
                            "text-gray-500"
                          }`}>
                            {signal.signalScore}分
                          </span>
                        )}
                      </div>
                      <div className="text-gray-500 text-xs">
                        {signal.symbol}
                      </div>
                    </div>
                    <Badge className={`text-xs ${
                      signal.changePercent >= 8.5
                        ? "bg-red-500/10 text-red-400 border-red-500/20"
                        : signal.changePercent >= 5
                          ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                          : signal.changePercent >= 3
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    }`}>
                      {signal.changePercent >= 8.5 ? "强势冲板" : signal.changePercent >= 5 ? "加速上攻" : signal.changePercent >= 3 ? "异动关注" : "盘后回顾"}
                    </Badge>
                  </div>

                  {/* Price */}
                  <div className="mb-3">
                    <span className={`text-2xl font-bold ${signal.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {signal.currentPrice.toFixed(2)}
                    </span>
                    <span className={`text-sm ml-2 ${signal.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {signal.changePercent >= 0 ? "+" : ""}{signal.changePercent.toFixed(2)}%
                    </span>
                  </div>

                  {/* Metrics row */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 mb-3">
                    {signal.volumeRatio > 0 && (
                      <span>
                        量比: <span className="text-amber-400">{signal.volumeRatio.toFixed(1)}</span>
                      </span>
                    )}
                    {signal.turnoverRate !== undefined && signal.turnoverRate > 0 && (
                      <span>
                        换手: <span className="text-cyan-400">{signal.turnoverRate.toFixed(1)}%</span>
                      </span>
                    )}
                    {signal.circulatingMarketCap !== undefined && signal.circulatingMarketCap > 0 && (
                      <span>
                        流通: <span className="text-gray-300">{signal.circulatingMarketCap.toFixed(0)}亿</span>
                      </span>
                    )}
                  </div>

                  {/* Reason */}
                  <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                    {signal.reason}
                  </p>

                  {/* Position & Strategy Advice */}
                  {signal.advice && (
                    <div className="bg-[#0a0e17] rounded-md px-3 py-2 mb-3 space-y-1.5">
                      {signal.advice.suggestedPosition > 0 ? (
                        <>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">仓位</span>
                              <span className={`font-bold ${
                                signal.advice.suggestedPosition >= 12 ? "text-amber-400" :
                                signal.advice.suggestedPosition >= 8 ? "text-emerald-400" :
                                "text-gray-300"
                              }`}>
                                {signal.advice.suggestedPosition}%
                              </span>
                              <span className="text-[9px] text-gray-600">
                                ({signal.advice.positionSource === "kelly" ? "Kelly" : "固定"})
                              </span>
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a2035] text-gray-400">
                              {signal.advice.strategyLabel}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-red-400 font-mono text-[10px]">损{signal.advice.stopLoss}%</span>
                              <span className="text-orange-400 font-mono text-[10px]">撤{signal.advice.drawdownExit}%</span>
                            </div>
                          </div>
                          {signal.advice.positionSource === "kelly" && signal.advice.winRate != null && (
                            <div className="flex items-center gap-3 text-[10px] text-gray-600">
                              <span>胜率{signal.advice.winRate}%</span>
                              <span>盈亏比{signal.advice.profitLossRatio}</span>
                              <span>Kelly={signal.advice.kellyRaw}</span>
                              <span>样本{signal.advice.sampleSize}</span>
                            </div>
                          )}
                          <p className="text-[10px] text-gray-600 leading-relaxed">
                            {signal.advice.takeProfitStrategy}
                          </p>
                        </>
                      ) : (
                        <div className="text-[10px] text-red-400/70 text-center py-1">
                          {signal.advice.positionSource === "kelly"
                            ? `Kelly≤0 (胜率${signal.advice.winRate ?? "?"}% 盈亏比${signal.advice.profitLossRatio ?? "?"}) — 数学不支持买入`
                            : "不建议参与"}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    {acceptedSymbols.has(signal.symbol) ? (
                      <div className="flex-1 flex items-center justify-center gap-3 py-1.5 text-xs bg-emerald-500/5 border border-emerald-500/15 rounded-md">
                        <span className="text-emerald-400/70">✓ 已接受 · 跟踪中</span>
                        <button
                          onClick={() => handleCancelTrack(signal.symbol)}
                          className="text-gray-500 hover:text-red-400 transition-colors underline"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDismiss(signal.symbol)}
                          className="flex-1 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                        >
                          忽略
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAccept(signal)}
                          className={`flex-1 border ${
                            isStrongBuy
                              ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border-amber-500/30"
                              : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20"
                          }`}
                        >
                          {isStrongBuy ? "🔥 立即接受" : "接受"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Accepted Section */}
        {accepted.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-gray-400 mb-3">
              已接受的打板{" "}
              <span className="text-gray-600">({accepted.length})</span>
            </h2>
            <div className="bg-[#0d1117] border border-[#1a2035] rounded-lg">
              {accepted.map((signal) => (
                <div
                  key={signal.symbol}
                  className="flex items-center justify-between px-4 py-3 border-b border-[#1a2035] last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-white font-medium">
                      {signal.name}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {signal.symbol}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-400 text-xs">
                      入场¥{signal.currentPrice.toFixed(2)}
                    </span>
                    {signal.reason ? (
                      <span className={`text-xs ${signal.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {signal.reason}
                      </span>
                    ) : (
                      <Badge className="text-yellow-400 border-yellow-400/30 text-xs bg-transparent">
                        待跟踪
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
