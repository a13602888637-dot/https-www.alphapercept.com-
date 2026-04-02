"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useAuth } from "@clerk/nextjs"
import { toast } from "sonner"
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
import ScreenTab from "./tabs/ScreenTab"
import TrendTab from "./tabs/TrendTab"
import LeftSideTab from "./tabs/LeftSideTab"
import BoardTrackTab from "./tabs/BoardTrackTab"

// ── Shared Types (exported for tabs) ──────────────────────────────────────────

export interface PositionAdvice {
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

export interface AlphaSignal {
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

export interface TagStats {
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

export interface BoardStats {
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

export interface DabanSharedProps {
  accepted: AlphaSignal[]
  acceptedSymbols: Set<string>
  dismissed: Set<string>
  boardStats: BoardStats | null
  isSignedIn: boolean | undefined
  getToken: () => Promise<string | null>
  onAccept: (signal: AlphaSignal) => Promise<void>
  onDismiss: (symbol: string) => void
  onCancelTrack: (symbol: string) => Promise<void>
  onStatsRefresh: () => void
}

interface SentimentData {
  premiumRate: number
  chainHeight: number
  lockdown: boolean
}

type TabType = "screen" | "trend" | "leftSide" | "boardTrack"

export default function DabanPanel() {
  const [sentiment] = useState<SentimentData | null>(null)
  const [accepted, setAccepted] = useState<AlphaSignal[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>("screen")
  const [showLogic, setShowLogic] = useState(false)
  const [boardStats, setBoardStats] = useState<BoardStats | null>(null)
  const [screenCount, setScreenCount] = useState(0)
  const [trendCount, setTrendCount] = useState(0)
  const [leftCount, setLeftCount] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const { isSignedIn, getToken } = useAuth()

  // ── Data loaders ──────────────────────────────────────────────────────────

  const loadAccepted = useCallback(async () => {
    try {
      const token = await getToken()
      const res = await fetch("/api/board-track?limit=50", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        if (data.records) {
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
    if (isSignedIn) {
      loadAccepted()
      fetchStats()
    }
    setLoading(false)
  }, [isSignedIn, loadAccepted, fetchStats])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleRefresh = () => {
    setRefreshing(true)
    setRefreshKey((k) => k + 1)
    // The child tab will call its own fetch; we just clear refreshing after a tick
    setTimeout(() => setRefreshing(false), 500)
  }

  const handleAccept = useCallback(async (signal: AlphaSignal) => {
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
        }).then(() => fetchStats()).catch(() => {})
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
  }, [isSignedIn, getToken, fetchStats])

  const handleCancelTrack = useCallback(async (symbol: string) => {
    try {
      const token = await getToken()
      setAccepted((prev) => prev.filter((s) => s.symbol !== symbol))
      await fetch(`/api/board-track?stockCode=${symbol}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      fetchStats()
      toast.success("已取消跟踪")
    } catch {
      toast.error("取消失败")
    }
  }, [getToken, fetchStats])

  const handleDismiss = useCallback((symbol: string) => {
    setDismissed((prev) => new Set(prev).add(symbol))
  }, [])

  const acceptedSymbols = useMemo(() => new Set(accepted.map((s) => s.symbol)), [accepted])
  const isLockdown = sentiment?.lockdown === true

  // ── Shared props for tabs ─────────────────────────────────────────────────

  const sharedProps: DabanSharedProps = useMemo(() => ({
    accepted,
    acceptedSymbols,
    dismissed,
    boardStats,
    isSignedIn,
    getToken,
    onAccept: handleAccept,
    onDismiss: handleDismiss,
    onCancelTrack: handleCancelTrack,
    onStatsRefresh: fetchStats,
  }), [accepted, acceptedSymbols, dismissed, boardStats, isSignedIn, getToken, handleAccept, handleDismiss, handleCancelTrack, fetchStats])

  // ── Auth guard ────────────────────────────────────────────────────────────

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

  return (
    <div className="min-h-full bg-[#0a0e17] text-gray-100">
      <div className="w-full px-4 py-4 sm:px-6 lg:px-8">
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
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-gray-400 hover:text-white hover:bg-white/[0.06]"
            >
              <RefreshCw
                className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`}
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
        <div className="flex items-center gap-1 mb-4 bg-[#0d1117] border border-[#1a2035] rounded-lg p-1 w-fit sticky top-0 z-10">
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
            {screenCount > 0 && (
              <span className="text-[10px] ml-0.5 opacity-70">({screenCount})</span>
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
            {trendCount > 0 && (
              <span className="text-[10px] ml-0.5 opacity-70">({trendCount})</span>
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
            {leftCount > 0 && (
              <span className="text-[10px] ml-0.5 opacity-70">({leftCount})</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("boardTrack")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              activeTab === "boardTrack"
                ? "bg-blue-500/15 text-blue-400"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <Target className="h-3.5 w-3.5" />
            打板跟踪
            {accepted.length > 0 && (
              <span className="text-[10px] ml-0.5 opacity-70">({accepted.length})</span>
            )}
          </button>
        </div>

        {/* Active Tab Content */}
        {activeTab === "screen" && (
          <ScreenTab
            {...sharedProps}
            showLogic={showLogic}
            isLockdown={isLockdown}
            refreshKey={refreshKey}
            onSignalCountChange={setScreenCount}
          />
        )}
        {activeTab === "trend" && (
          <TrendTab
            {...sharedProps}
            isLockdown={isLockdown}
            refreshKey={refreshKey}
            onSignalCountChange={setTrendCount}
          />
        )}
        {activeTab === "leftSide" && (
          <LeftSideTab
            {...sharedProps}
            isLockdown={isLockdown}
            refreshKey={refreshKey}
            onSignalCountChange={setLeftCount}
          />
        )}
        {activeTab === "boardTrack" && (
          <BoardTrackTab
            boardStats={boardStats}
            accepted={accepted}
            onCancelTrack={handleCancelTrack}
            onStatsRefresh={fetchStats}
          />
        )}
      </div>
    </div>
  )
}
