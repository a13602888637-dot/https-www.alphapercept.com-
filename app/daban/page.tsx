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
  const [showLogic, setShowLogic] = useState(false)
  const [boardStats, setBoardStats] = useState<BoardStats | null>(null)
  const [showStats, setShowStats] = useState(false)
  const { isSignedIn, getToken } = useAuth()

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
    fetchSignals()
    fetchScreen()
    if (isSignedIn) fetchStats()
  }, [isSignedIn, fetchSignals, fetchScreen, fetchStats])

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
        // 同时加入自选股（忽略 409 重复）
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
          }),
        }).then((r) => {
          if (r.ok) {
            toast.success(`已接受并加入自选股: ${signal.name}`)
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

        {/* Logic Whitebox Panel */}
        {showLogic && (
          <div className="bg-[#0d1117] border border-[#1a2035] rounded-lg p-4 mb-5 text-xs space-y-3">
            <h3 className="text-gray-300 font-medium text-sm mb-2">选股逻辑清单（白盒化）</h3>

            <div className="space-y-2">
              <div className="text-gray-400 font-medium">一、基础筛选</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-gray-500 pl-3">
                <span>涨跌幅 &gt; 3%</span>
                <span>流通市值 &gt; 50亿</span>
                <span>量比 &gt; 1.5（放量确认）</span>
                <span>换手率 5%~10%（活跃度）</span>
                <span>排除 ST / *ST / 退市股</span>
                <span>排除 920 新股板块</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-gray-400 font-medium">二、技术面验证</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-gray-500 pl-3">
                <span>价格 &gt; MA5 &gt; MA10 &gt; MA20（多头排列）</span>
                <span>价格 &gt; VWAP（均价线上方）</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-amber-400/80 font-medium">三、疑似诱多检测 ⚠️</div>
              <div className="space-y-1 text-gray-500 pl-3">
                <div>尾盘急拉：开盘涨幅&lt;1%，但尾盘贡献&gt;60%涨幅</div>
                <div>振幅异常：振幅&gt;涨幅×2.5 且 &gt;5%</div>
                <div>盘中破昨收：最低价跌破昨收，但收盘涨&gt;3%</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-emerald-400/80 font-medium">四、确认上攻 ✅</div>
              <div className="space-y-1 text-gray-500 pl-3">
                <div>量比≥2.0（显著放量）</div>
                <div>换手率 3~8%（活跃不过度）</div>
                <div>开盘涨幅≥0.5%（不是低开拉升）</div>
                <div>最低价不跌破昨收（无恐慌抛压）</div>
                <div>振幅&lt;涨幅×2（走势平稳）</div>
                <div>价格 &gt; MA5 &gt; MA10 &gt; MA20（严格多头排列）</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-purple-400/80 font-medium">五、爆发打板 ⚡</div>
              <div className="space-y-1 text-gray-500 pl-3">
                <div>涨幅≥9%（涨停级别）</div>
                <div>流通市值 50~300亿（游资偏好中盘）</div>
                <div>量比≥2.5（资金集中涌入）</div>
                <div>最低价不跌破昨收（封板力度强）</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-amber-300 font-medium">六、强烈推荐 🔥 = 确认上攻 ∩ 爆发打板</div>
              <div className="text-gray-500 pl-3">同时满足第四、五条所有条件</div>
            </div>

            <div className="space-y-2">
              <div className="text-gray-400 font-medium">七、综合评分（0-100）</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-gray-500 pl-3">
                <span>涨幅贡献 0~25分</span>
                <span>量比贡献 0~20分</span>
                <span>换手率适中度 0~15分</span>
                <span>开盘强度 0~15分</span>
                <span>均线多头排列 0~15分</span>
                <span>走势平稳度 0~10分</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-cyan-400/80 font-medium">八、仓位管理</div>
              <div className="space-y-1 text-gray-500 pl-3">
                <div>基础仓位: 🔥强烈推荐15% / ⚡爆发打板10% / ✅确认上攻8% / 高风险5%</div>
                <div>情绪系数: 溢价率&gt;3%→×1.2 / 0~3%→×1.0 / -2~0%→×0.5 / &lt;-2%→×0</div>
                <div>胜率系数: &gt;60%→×1.2 / 50-60%→×1.0 / 40-50%→×0.7 / &lt;40%或样本&lt;10→×0.5</div>
                <div>硬上限: 单股不超过总资金20%</div>
                <div className="text-gray-600">公式: 仓位 = 基础 × 情绪系数 × 胜率系数（cap 20%）</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-pink-400/80 font-medium">九、止盈止损（按市场环境动态调整）</div>
              <div className="space-y-1 text-gray-500 pl-3">
                <div className="text-gray-400">市场判定: 溢价率&gt;2%+连板≥4=牛市 / 溢价率&lt;-1%或连板≤1=熊市 / 其他=震荡</div>
                <div>止损线（牛/震荡/熊）: 🔥-7/-5/-3% · ⚡-5/-3/-2% · ✅-6/-4/-3% · 高风险-3/-2/-1.5%</div>
                <div>高点回撤离场: 🔥-5/-3/-2% · ⚡-3/-2/-1.5% · ✅-4/-3/-2%</div>
                <div className="text-gray-400">不设硬性最大持有天数，未触发止损/回撤线可继续持有</div>
              </div>
              <div className="space-y-1 text-gray-500 pl-3 border-l-2 border-[#1a2035] ml-1">
                <div>🔥连板预期: 高开&gt;3%持有追踪 / 0~3%卖半仓 / 低开止损</div>
                <div>⚡快进快出: 高开&gt;5%竞价卖 / 0~5%半小时内卖 / 低开止损</div>
                <div>✅趋势跟踪: 持有追踪回撤离场 / 跌破MA5次日卖 / 破止损线止损</div>
                <div>高风险: 30分钟内卖 / 再封涨停例外持有 / 严格止损</div>
              </div>
            </div>

            <div className="border-t border-[#1a2035] pt-2 text-gray-600">
              排序：🔥强烈推荐 &gt; ⚡爆发打板 &gt; ✅确认上攻 &gt; 普通 &gt; ⚠️疑似诱多 · 同级按评分降序
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
              {visibleSignals.map((signal) => {
                const isStrongBuy = signal.riskTag === "强烈推荐"
                const isExplosive = signal.riskTag === "爆发打板"
                const isConfirmed = signal.riskTag === "确认上攻"
                const isTrap = signal.riskTag === "疑似诱多"
                const cardBorder = isStrongBuy
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
                            isStrongBuy
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
                            {isStrongBuy ? "🔥" : isExplosive ? "⚡" : isConfirmed ? "✅" : isTrap ? "⚠️" : ""}
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
                  {signal.advice && signal.advice.suggestedPosition > 0 && (
                    <div className="bg-[#0a0e17] rounded-md px-3 py-2 mb-3 space-y-1.5">
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
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a2035] text-gray-400">
                          {signal.advice.strategyLabel}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">止损</span>
                          <span className="text-red-400 font-mono">{signal.advice.stopLoss}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">回撤</span>
                          <span className="text-orange-400 font-mono">{signal.advice.drawdownExit}%</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-600 leading-relaxed">
                        {signal.advice.takeProfitStrategy}
                      </p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    {acceptedSymbols.has(signal.symbol) ? (
                      <div className="flex-1 text-center py-1.5 text-xs text-emerald-400/70 bg-emerald-500/5 border border-emerald-500/15 rounded-md">
                        ✓ 已接受 · 跟踪中
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
