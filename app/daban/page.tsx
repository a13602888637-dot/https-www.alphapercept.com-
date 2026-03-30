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
  AlertTriangle,
} from "lucide-react"

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
}

interface SentimentData {
  premiumRate: number
  chainHeight: number
  lockdown: boolean
}

type TabType = "alpha" | "screen"

export default function DabanPage() {
  const [signals, setSignals] = useState<AlphaSignal[]>([])
  const [screenSignals, setScreenSignals] = useState<AlphaSignal[]>([])
  const [sentiment, setSentiment] = useState<SentimentData | null>(null)
  const [accepted, setAccepted] = useState<AlphaSignal[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [screenLoading, setScreenLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>("screen")
  const [screenTime, setScreenTime] = useState("")
  const [screenConditions, setScreenConditions] = useState<string[]>([])
  const { isSignedIn } = useAuth()

  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch("/api/strategy-recommendation/daily")
      if (!res.ok) throw new Error("Failed to fetch signals")
      const data = await res.json()
      setSignals(data.signals ?? [])
      setSentiment(data.sentiment ?? null)
    } catch {
      // silently fail for alpha feed
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

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

  useEffect(() => {
    if (isSignedIn === undefined) return
    fetchSignals()
    fetchScreen()
  }, [isSignedIn, fetchSignals, fetchScreen])

  const handleRefresh = () => {
    setRefreshing(true)
    if (activeTab === "alpha") {
      fetchSignals()
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
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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
        toast.success(`已接受: ${signal.name} (${signal.symbol})`)
        setAccepted((prev) => [...prev, signal])
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

  const currentSignals = activeTab === "alpha" ? signals : screenSignals
  const visibleSignals = currentSignals.filter(
    (s) => !dismissed.has(s.symbol) && !acceptedSymbols.has(s.symbol)
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
            onClick={() => setActiveTab("alpha")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              activeTab === "alpha"
                ? "bg-amber-500/15 text-amber-400"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            涨幅扫描
            {signals.length > 0 && (
              <span className="text-[10px] ml-0.5 opacity-70">({signals.length})</span>
            )}
          </button>
        </div>

        {/* Screen Conditions Bar */}
        {activeTab === "screen" && screenConditions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            {screenConditions.map((c) => (
              <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a2035] text-gray-400 border border-[#2a3045]">
                {c}
              </span>
            ))}
            {screenTime && (
              <span className="text-[10px] text-gray-600 ml-2">
                扫描时间: {screenTime}
              </span>
            )}
          </div>
        )}

        {/* Signal Cards Grid */}
        <div className="mb-8">
          {screenLoading && activeTab === "screen" ? (
            <div className="bg-[#0d1117] border border-[#1a2035] rounded-lg py-16 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-gray-500 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">正在扫描全A股...</p>
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
              {visibleSignals.map((signal) => (
                <div
                  key={signal.symbol}
                  className="bg-[#0d1117] border border-[#1a2035] rounded-lg p-4 hover:border-[#2a3045] transition-colors"
                >
                  {/* Header: name + code + risk tag */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold text-base">
                          {signal.name}
                        </span>
                        {signal.riskTag && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            signal.riskTag === "疑似诱多"
                              ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                              : signal.riskTag === "高风险追板"
                                ? "bg-red-500/15 text-red-400"
                                : "bg-blue-500/15 text-blue-400"
                          }`}>
                            <AlertTriangle className="h-2.5 w-2.5 inline mr-0.5" />
                            {signal.riskTag}
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
                  <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                    {signal.reason}
                  </p>

                  {/* Action buttons */}
                  <div className="flex gap-2">
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
                      className="flex-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
                    >
                      接受
                    </Button>
                  </div>
                </div>
              ))}
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
                    <span className="text-emerald-400 text-sm">
                      ¥{signal.currentPrice.toFixed(2)}
                    </span>
                    <Badge className="text-yellow-400 border-yellow-400/30 text-xs bg-transparent">
                      T+1锁定
                    </Badge>
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
