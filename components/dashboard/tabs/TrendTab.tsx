"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Loader2, Zap } from "lucide-react"
import SignalCard from "./SignalCard"
import type { DabanSharedProps, AlphaSignal } from "../DabanPanel"

interface MacroStatus {
  sector: string
  macro: string
  price: number | null
  ma20: number | null
  bullish: boolean
  reason: string
}

interface TrendTabProps extends DabanSharedProps {
  isLockdown: boolean
  refreshKey: number
  onSignalCountChange: (count: number) => void
}

export default function TrendTab({
  acceptedSymbols,
  dismissed,
  isLockdown,
  refreshKey,
  onAccept,
  onDismiss,
  onCancelTrack,
  onSignalCountChange,
}: TrendTabProps) {
  const [trendSignals, setTrendSignals] = useState<AlphaSignal[]>([])
  const [trendLoading, setTrendLoading] = useState(false)
  const [trendTime, setTrendTime] = useState("")
  const [trendConditions, setTrendConditions] = useState<string[]>([])
  const [macroStatus, setMacroStatus] = useState<MacroStatus[]>([])
  const [hasFetched, setHasFetched] = useState(false)

  const fetchTrend = useCallback(async () => {
    setTrendLoading(true)
    try {
      const res = await fetch("/api/strategy-recommendation/trend")
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      const signals = (data.signals ?? []).map((s: Record<string, unknown>) => ({
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
          drawdownExit: (s.advice as Record<string, unknown>).drawdownExit as number ?? 0,
          strategyLabel: (s.advice as Record<string, unknown>).strategyLabel as string,
          positionSource: "fixed" as const,
        } : undefined,
      }))
      setTrendSignals(signals)
      setTrendTime(data.screenTime ?? "")
      setTrendConditions(data.conditions ?? [])
      setMacroStatus(data.macroStatus ?? [])
      onSignalCountChange(signals.length)
      setHasFetched(true)
    } catch {
      toast.error("趋势扫描失败")
    } finally {
      setTrendLoading(false)
    }
  }, [onSignalCountChange])

  // Lazy load on first mount
  useEffect(() => {
    if (!hasFetched && !trendLoading) {
      fetchTrend()
    }
  }, [hasFetched, trendLoading, fetchTrend])

  // Refresh trigger from parent
  useEffect(() => {
    if (refreshKey > 0) {
      fetchTrend()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const visibleSignals = trendSignals.filter((s) => !dismissed.has(s.symbol))
  const allProcessed = visibleSignals.length === 0 && trendSignals.length > 0

  return (
    <>
      {/* Macro Status Panel */}
      {macroStatus.length > 0 && (
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
      {trendConditions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          {trendConditions.map((c) => (
            <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a2035] text-gray-400 border border-[#2a3045]">
              {c}
            </span>
          ))}
          {trendTime && (
            <span className="text-[10px] text-gray-600 ml-2">
              扫描时间: {trendTime}
            </span>
          )}
        </div>
      )}

      {/* Signal Cards Grid */}
      <div className="mb-8">
        {trendLoading ? (
          <div className="bg-[#0d1117] border border-[#1a2035] rounded-lg py-16 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">正在扫描宏观趋势标的...</p>
          </div>
        ) : trendSignals.length === 0 ? (
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
              <SignalCard
                key={signal.symbol}
                signal={signal}
                isAccepted={acceptedSymbols.has(signal.symbol)}
                isLockdown={isLockdown}
                onAccept={onAccept}
                onDismiss={onDismiss}
                onCancelTrack={onCancelTrack}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
