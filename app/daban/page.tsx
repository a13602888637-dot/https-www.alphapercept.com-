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
} from "lucide-react"

interface AlphaSignal {
  symbol: string
  name: string
  currentPrice: number
  changePercent: number
  volumeRatio: number
  reason: string
}

interface SentimentData {
  premiumRate: number
  chainHeight: number
  lockdown: boolean
}

export default function DabanPage() {
  const [signals, setSignals] = useState<AlphaSignal[]>([])
  const [sentiment, setSentiment] = useState<SentimentData | null>(null)
  const [accepted, setAccepted] = useState<AlphaSignal[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { getToken, isSignedIn } = useAuth()

  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch("/api/strategy-recommendation/daily")
      if (!res.ok) throw new Error("Failed to fetch signals")
      const data = await res.json()
      setSignals(data.signals ?? [])
      setSentiment(data.sentiment ?? null)
    } catch {
      toast.error("获取打板信号失败，请稍后重试")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (isSignedIn === undefined) return
    fetchSignals()
  }, [isSignedIn, fetchSignals])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchSignals()
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
          Authorization: `Bearer ${token}`,
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
        toast.success(`已接受: ${signal.name} (${signal.symbol})`)
        setAccepted((prev) => [...prev, signal])
      } else {
        toast.error("添加失败，请重试")
      }
    } catch {
      toast.error("网络错误，请重试")
    }
  }

  const handleDismiss = (symbol: string) => {
    setDismissed((prev) => new Set(prev).add(symbol))
  }

  // Unauthenticated state
  if (isSignedIn === false) {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center">
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

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    )
  }

  const isLockdown = sentiment?.lockdown === true
  const acceptedSymbols = new Set(accepted.map((s) => s.symbol))
  const visibleSignals = signals.filter(
    (s) => !dismissed.has(s.symbol) && !acceptedSymbols.has(s.symbol)
  )
  const allProcessed = visibleSignals.length === 0 && signals.length > 0

  return (
    <div className="min-h-screen bg-[#0a0e17] text-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-400" />
            <h1 className="text-xl font-bold text-white">打板决策流</h1>
            <span className="text-gray-500 text-sm ml-1">Alpha Feed</span>
          </div>
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

        {/* Sentiment Panel */}
        {sentiment && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-[#0d1117] border border-[#1a2035] rounded-lg p-4">
              <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
                <TrendingUp className="h-3.5 w-3.5" />
                连板高度
              </div>
              <div className="text-2xl font-bold text-white">
                {sentiment.chainHeight}
              </div>
            </div>
            <div className="bg-[#0d1117] border border-[#1a2035] rounded-lg p-4">
              <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
                <BarChart3 className="h-3.5 w-3.5" />
                溢价率
              </div>
              <div
                className={`text-2xl font-bold ${
                  sentiment.premiumRate >= 0
                    ? "text-emerald-400"
                    : "text-red-400"
                }`}
              >
                {sentiment.premiumRate.toFixed(1)}%
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

        {/* Signal Cards Grid */}
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-400 mb-3">
            打板信号{" "}
            {signals.length > 0 && (
              <span className="text-gray-600">({signals.length})</span>
            )}
          </h2>

          {signals.length === 0 ? (
            <div className="bg-[#0d1117] border border-[#1a2035] rounded-lg py-16 text-center">
              <Zap className="h-8 w-8 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">
                当前暂无打板信号，等待盘中扫描...
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
                  {/* Header: name + code */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-white font-semibold text-base">
                        {signal.name}
                      </div>
                      <div className="text-gray-500 text-xs">
                        {signal.symbol}
                      </div>
                    </div>
                    <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-xs">
                      首板信号
                    </Badge>
                  </div>

                  {/* Price */}
                  <div className="mb-3">
                    <span className="text-2xl font-bold text-emerald-400">
                      {signal.currentPrice.toFixed(2)}
                    </span>
                    <span className="text-emerald-400 text-sm ml-2">
                      +{signal.changePercent.toFixed(2)}%
                    </span>
                  </div>

                  {/* Metrics row */}
                  <div className="flex gap-4 text-xs text-gray-400 mb-3">
                    <span>
                      量比:{" "}
                      <span className="text-amber-400">
                        {signal.volumeRatio.toFixed(1)}
                      </span>
                    </span>
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
