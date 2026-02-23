"use client"

import { useState, useEffect } from "react"
import { IntelligenceFeedCard } from "./IntelligenceFeedCard"
import { WarningCard } from "./WarningCard"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Search, Filter, AlertTriangle, RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface IntelligenceFeedItem {
  id: string
  stockCode: string
  stockName: string
  eventSummary: string
  industryTrend: string
  trapProbability: number
  actionSignal: "BUY" | "SELL" | "HOLD"
  targetPrice?: number
  stopLoss?: number
  logicChain?: any
  createdAt: Date
  isUserSpecific?: boolean
}

interface IntelligenceFeedListWithAPIProps {
  initialFeeds?: IntelligenceFeedItem[]
  autoRefresh?: boolean
  refreshInterval?: number
}

export function IntelligenceFeedListWithAPI({
  initialFeeds = [],
  autoRefresh = false,
  refreshInterval = 30000 // 30 seconds
}: IntelligenceFeedListWithAPIProps) {
  const [feeds, setFeeds] = useState<IntelligenceFeedItem[]>(initialFeeds)
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [signalFilter, setSignalFilter] = useState<string>("ALL")
  const [riskFilter, setRiskFilter] = useState<string>("ALL")

  // 分离高风险警告和普通情报
  const highRiskFeeds = feeds.filter(feed => feed.trapProbability > 80)
  const normalFeeds = feeds.filter(feed => feed.trapProbability <= 80)

  // 应用筛选
  const filteredHighRiskFeeds = highRiskFeeds.filter(feed => {
    const matchesSearch =
      feed.stockCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feed.stockName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feed.eventSummary.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesSignal = signalFilter === "ALL" || feed.actionSignal === signalFilter
    const matchesRisk = riskFilter === "ALL" ||
      (riskFilter === "HIGH" && feed.trapProbability > 80) ||
      (riskFilter === "MEDIUM" && feed.trapProbability > 60 && feed.trapProbability <= 80) ||
      (riskFilter === "LOW" && feed.trapProbability <= 60)

    return matchesSearch && matchesSignal && matchesRisk
  })

  const filteredNormalFeeds = normalFeeds.filter(feed => {
    const matchesSearch =
      feed.stockCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feed.stockName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feed.eventSummary.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesSignal = signalFilter === "ALL" || feed.actionSignal === signalFilter
    const matchesRisk = riskFilter === "ALL" ||
      (riskFilter === "HIGH" && feed.trapProbability > 80) ||
      (riskFilter === "MEDIUM" && feed.trapProbability > 60 && feed.trapProbability <= 80) ||
      (riskFilter === "LOW" && feed.trapProbability <= 60)

    return matchesSearch && matchesSignal && matchesRisk
  })

  const fetchIntelligenceFeed = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/intelligence-feed?limit=20")
      if (!response.ok) throw new Error("Failed to fetch intelligence feed")

      const data = await response.json()
      if (data.success) {
        const formattedFeeds = data.feed.map((item: any) => ({
          id: item.id,
          stockCode: item.stockCode,
          stockName: item.stockName,
          eventSummary: item.eventSummary,
          industryTrend: item.industryTrend,
          trapProbability: item.trapProbability,
          actionSignal: item.actionSignal,
          targetPrice: item.targetPrice,
          stopLoss: item.stopLoss,
          logicChain: item.logicChain,
          createdAt: new Date(item.createdAt),
          isUserSpecific: item.isUserSpecific,
        }))
        setFeeds(formattedFeeds)
        toast.success("情报数据已更新")
      }
    } catch (error) {
      console.error("Error fetching intelligence feed:", error)
      toast.error("加载情报数据失败")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = () => {
    fetchIntelligenceFeed()
  }

  const handleViewDetails = (feedId: string) => {
    console.log("View details for feed:", feedId)
    // 这里可以添加查看详细信息的逻辑
  }

  // Initial fetch
  useEffect(() => {
    fetchIntelligenceFeed()
  }, [])

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchIntelligenceFeed()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval])

  return (
    <div className="space-y-6">
      {/* 筛选工具栏 */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="搜索股票代码、名称或事件..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Select value={signalFilter} onValueChange={setSignalFilter}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="信号类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">所有信号</SelectItem>
                <SelectItem value="BUY">买入信号</SelectItem>
                <SelectItem value="SELL">卖出信号</SelectItem>
                <SelectItem value="HOLD">持有信号</SelectItem>
              </SelectContent>
            </Select>

            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-[140px]">
                <AlertTriangle className="h-4 w-4 mr-2" />
                <SelectValue placeholder="风险等级" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">所有风险</SelectItem>
                <SelectItem value="HIGH">高风险</SelectItem>
                <SelectItem value="MEDIUM">中风险</SelectItem>
                <SelectItem value="LOW">低风险</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              刷新
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <div className="text-sm text-muted-foreground">
            共 {feeds.length} 条情报，其中{" "}
            <span className="font-semibold text-red-600">{highRiskFeeds.length}</span> 条高风险警告
          </div>
          {feeds.some(feed => feed.isUserSpecific) && (
            <div className="text-sm text-blue-600">
              <span className="font-semibold">
                {feeds.filter(feed => feed.isUserSpecific).length}
              </span> 条个性化情报
            </div>
          )}
        </div>
      </div>

      {/* 高风险警告区域 */}
      {filteredHighRiskFeeds.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h3 className="text-lg font-semibold text-red-700">高风险警告</h3>
            <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
              {filteredHighRiskFeeds.length} 条
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredHighRiskFeeds.map((feed) => (
              <WarningCard
                key={feed.id}
                {...feed}
                onViewDetails={() => handleViewDetails(feed.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 普通情报区域 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">智能情报流</h3>
          <div className="text-sm text-muted-foreground">
            显示 {filteredNormalFeeds.length} 条情报
          </div>
        </div>

        {filteredNormalFeeds.length > 0 ? (
          <div className="space-y-4">
            {filteredNormalFeeds.map((feed) => (
              <IntelligenceFeedCard key={feed.id} {...feed} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            {isLoading ? (
              <div className="flex flex-col items-center gap-2">
                <RefreshCw className="h-8 w-8 animate-spin" />
                <p>加载情报数据中...</p>
              </div>
            ) : (
              <div>
                <p>未找到匹配的情报</p>
                <p className="text-sm mt-1">尝试调整筛选条件或搜索关键词</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}