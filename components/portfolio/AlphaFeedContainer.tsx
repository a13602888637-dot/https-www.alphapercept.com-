"use client"

import { useState, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useAuth } from "@clerk/nextjs"
import { useToast } from "@/hooks/use-toast"
import { AlphaFeedCard, type AlphaSignal } from "./AlphaFeedCard"
import { Shield, Loader2 } from "lucide-react"

interface SentimentData {
  chainHeight: number
  premiumRate: number
  lockdown: boolean
}

interface AlphaFeedResponse {
  signals: AlphaSignal[]
  sentiment: SentimentData
}

interface AlphaFeedContainerProps {
  onPositionAdded?: () => void
}

export function AlphaFeedContainer({ onPositionAdded }: AlphaFeedContainerProps) {
  const [signals, setSignals] = useState<AlphaSignal[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [sentiment, setSentiment] = useState<SentimentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { getToken, isSignedIn } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (isSignedIn === undefined) return

    const fetchSignals = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch("/api/strategy-recommendation/daily")
        if (!res.ok) throw new Error("Failed to fetch signals")
        const data: AlphaFeedResponse = await res.json()
        setSignals(data.signals ?? [])
        setSentiment(data.sentiment ?? null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchSignals()
  }, [isSignedIn])

  const handleAccept = async (signal: AlphaSignal) => {
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
        toast({ title: `已加入模拟盘: ${signal.name}` })
        onPositionAdded?.()
      }
    } catch {
      toast({ title: "添加失败，请重试" })
    }
    setCurrentIndex((prev) => prev + 1)
  }

  const handleReject = () => {
    setCurrentIndex((prev) => prev + 1)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 text-zinc-500 text-sm">{error}</div>
    )
  }

  const isLockdown = sentiment?.lockdown === true
  const visibleSignals = signals.slice(currentIndex, currentIndex + 3)
  const allDone = currentIndex >= signals.length

  return (
    <div>
      {/* Header */}
      <h2 className="text-lg font-semibold text-zinc-100 mb-3">Alpha Feed</h2>

      {/* Sentiment bar */}
      {sentiment && (
        <div className={`flex items-center gap-4 text-sm mb-4 rounded-lg px-4 py-2 border ${
          isLockdown
            ? "bg-red-500/5 border-red-500/20 text-zinc-500"
            : "bg-white/[0.03] border-white/[0.06] text-zinc-400"
        }`}>
          <span>连板高度: {sentiment.chainHeight}</span>
          <span>溢价率: {sentiment.premiumRate.toFixed(1)}%</span>
          {isLockdown && (
            <span className="flex items-center gap-1 text-red-400 ml-auto font-medium">
              <Shield className="h-4 w-4" />
              情绪冰点 — 空仓防守
            </span>
          )}
        </div>
      )}

      {/* Card stack */}
      {allDone ? (
        <div className="text-center py-16 text-zinc-500 text-sm">
          今日信号已处理完毕
        </div>
      ) : (
        <div className="relative h-[340px] w-full max-w-sm mx-auto">
          <AnimatePresence>
            {visibleSignals.map((signal, i) => (
              <motion.div
                key={`${signal.symbol}-${currentIndex + i}`}
                className="absolute inset-0"
                style={{
                  zIndex: 3 - i,
                  scale: 1 - i * 0.05,
                  y: i * 8,
                }}
                initial={{ scale: 1 - i * 0.05, y: i * 8 }}
                animate={{ scale: 1 - i * 0.05, y: i * 8 }}
              >
                {i === 0 ? (
                  <AlphaFeedCard
                    signal={signal}
                    onAccept={handleAccept}
                    onReject={() => handleReject()}
                    disabled={isLockdown}
                  />
                ) : (
                  <div className="h-full rounded-xl border border-white/[0.06] bg-white/[0.03] p-6 opacity-60">
                    <h3 className="text-lg font-semibold text-zinc-100">{signal.name}</h3>
                    <span className="text-sm text-zinc-500">{signal.symbol}</span>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
