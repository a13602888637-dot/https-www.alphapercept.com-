"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AlphaSignal } from "../DabanPanel"

export interface SignalCardProps {
  signal: AlphaSignal
  isAccepted: boolean
  isLockdown: boolean
  onAccept: (signal: AlphaSignal) => void
  onDismiss: (symbol: string) => void
  onCancelTrack: (symbol: string) => void
}

export default function SignalCard({
  signal,
  isAccepted,
  isLockdown,
  onAccept,
  onDismiss,
  onCancelTrack,
}: SignalCardProps) {
  const isStrongBuy = signal.riskTag === "强烈推荐"
  const isExplosive = signal.riskTag === "爆发打板"
  const isConfirmed = signal.riskTag === "确认上攻"
  const isTrap = signal.riskTag === "疑似诱多"
  const isTrendBreak = signal.riskTag === "趋势突破"
  const isVCP = signal.riskTag === "VCP收敛"
  const isSelloff = signal.riskTag?.startsWith("⚠️")

  const cardBorder = isSelloff
    ? "border-red-500/40 opacity-70"
    : isTrendBreak
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
                isSelloff
                  ? "bg-red-500/20 text-red-400 border border-red-500/40"
                  : isTrendBreak
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
        {signal.reason?.includes("💰流入") && (
          <span className="text-emerald-400 font-medium">💰流入</span>
        )}
        {signal.reason?.includes("🔴流出") && (
          <span className="text-red-400 font-medium">🔴流出</span>
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
        {isAccepted ? (
          <div className="flex-1 flex items-center justify-center gap-3 py-1.5 text-xs bg-emerald-500/5 border border-emerald-500/15 rounded-md">
            <span className="text-emerald-400/70">✓ 已接受 · 跟踪中</span>
            <button
              onClick={() => onCancelTrack(signal.symbol)}
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
              onClick={() => onDismiss(signal.symbol)}
              className="flex-1 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
            >
              忽略
            </Button>
            <Button
              size="sm"
              onClick={() => onAccept(signal)}
              disabled={isLockdown}
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
}
