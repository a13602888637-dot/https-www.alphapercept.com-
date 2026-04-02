"use client"

import { Badge } from "@/components/ui/badge"
import { Target } from "lucide-react"
import type { AlphaSignal, BoardStats } from "../DabanPanel"

export interface BoardTrackTabProps {
  boardStats: BoardStats | null
  accepted: AlphaSignal[]
  onCancelTrack: (symbol: string) => Promise<void>
  onStatsRefresh: () => void
}

export default function BoardTrackTab({
  boardStats,
  accepted,
  onCancelTrack,
}: BoardTrackTabProps) {
  return (
    <>
      {/* Win Rate Stats Panel — always visible */}
      {boardStats && (
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
              <div className="text-xl font-bold text-white">{boardStats.overall.total}</div>
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
                  <span className={r.nextDayChange == null ? "text-yellow-400" : r.nextDayChange >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {r.nextDayChange == null ? "待跟踪" : `${r.nextDayChange >= 0 ? "+" : ""}${r.nextDayChange.toFixed(2)}%`}
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

      {/* No stats fallback */}
      {!boardStats && (
        <div className="bg-[#0d1117] border border-[#1a2035] rounded-lg py-12 text-center mb-5">
          <Target className="h-8 w-8 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">暂无胜率统计数据</p>
        </div>
      )}

      {/* Accepted Signals List */}
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
                <div className="flex items-center gap-3">
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
                  <button
                    onClick={() => onCancelTrack(signal.symbol)}
                    className="text-gray-600 hover:text-red-400 text-xs transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state for accepted */}
      {accepted.length === 0 && (
        <div className="bg-[#0d1117] border border-[#1a2035] rounded-lg py-12 text-center">
          <p className="text-gray-500 text-sm">
            暂无已接受的打板信号，在其他Tab中接受信号后会显示在这里
          </p>
        </div>
      )}
    </>
  )
}
