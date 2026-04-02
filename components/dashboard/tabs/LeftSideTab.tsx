"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Loader2, Zap } from "lucide-react"
import SignalCard from "./SignalCard"
import type { DabanSharedProps, AlphaSignal } from "../DabanPanel"

interface LeftSideTabProps extends DabanSharedProps {
  isLockdown: boolean
  refreshKey: number
  onSignalCountChange: (count: number) => void
}

export default function LeftSideTab({
  acceptedSymbols,
  dismissed,
  isLockdown,
  refreshKey,
  onAccept,
  onDismiss,
  onCancelTrack,
  onSignalCountChange,
}: LeftSideTabProps) {
  const [leftSignals, setLeftSignals] = useState<AlphaSignal[]>([])
  const [leftLoading, setLeftLoading] = useState(false)
  const [leftTime, setLeftTime] = useState("")
  const [leftConditions, setLeftConditions] = useState<string[]>([])
  const [hasFetched, setHasFetched] = useState(false)

  const fetchLeftSide = useCallback(async () => {
    setLeftLoading(true)
    try {
      const res = await fetch("/api/strategy-recommendation/left-side")
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      const signals = data.signals ?? []
      setLeftSignals(signals)
      setLeftTime(data.screenTime ?? "")
      setLeftConditions(data.conditions ?? [])
      onSignalCountChange(signals.length)
      setHasFetched(true)
    } catch {
      toast.error("左侧交易扫描失败")
    } finally {
      setLeftLoading(false)
    }
  }, [onSignalCountChange])

  // Lazy load on first mount
  useEffect(() => {
    if (!hasFetched && !leftLoading) {
      fetchLeftSide()
    }
  }, [hasFetched, leftLoading, fetchLeftSide])

  // Refresh trigger from parent
  useEffect(() => {
    if (refreshKey > 0) {
      fetchLeftSide()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const visibleSignals = leftSignals.filter((s) => !dismissed.has(s.symbol))
  const allProcessed = visibleSignals.length === 0 && leftSignals.length > 0

  return (
    <>
      {/* Conditions Bar */}
      {leftConditions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          {leftConditions.map((c) => (
            <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a2035] text-gray-400 border border-[#2a3045]">
              {c}
            </span>
          ))}
          {leftTime && (
            <span className="text-[10px] text-gray-600 ml-2">
              扫描时间: {leftTime}
            </span>
          )}
        </div>
      )}

      {/* Signal Cards Grid */}
      <div className="mb-8">
        {leftLoading ? (
          <div className="bg-[#0d1117] border border-[#1a2035] rounded-lg py-16 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">正在扫描低估值超卖股...</p>
          </div>
        ) : leftSignals.length === 0 ? (
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
