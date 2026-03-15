"use client"

import { useState, useEffect, useCallback } from "react"
import { IntelligenceFeedList } from "@/components/intelligence-feed/IntelligenceFeedList"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity, Shield, TrendingUp, AlertTriangle, Brain } from "lucide-react"

interface FeedItem {
  id: string
  stockCode: string
  stockName: string
  eventSummary: string
  industryTrend: string
  trapProbability: number
  actionSignal: "BUY" | "HOLD" | "SELL"
  targetPrice: number | null
  stopLoss: number | null
  createdAt: string
}

export default function LiveFeedPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [feeds, setFeeds] = useState<FeedItem[]>([])
  const [activeTab, setActiveTab] = useState("all")

  const fetchFeeds = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/intelligence-feed?limit=50')
      const data = await response.json()
      if (data.success && data.feed) {
        setFeeds(data.feed)
      }
    } catch (error) {
      console.error('获取情报数据失败:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFeeds()
  }, [fetchFeeds])

  // 计算统计数据
  const highRiskCount = feeds.filter(feed => feed.trapProbability > 80).length
  const buySignals = feeds.filter(feed => feed.actionSignal === "BUY").length
  const totalFeeds = feeds.length

  const handleRefresh = () => {
    fetchFeeds()
  }

  // 根据标签筛选数据
  const filteredFeeds = feeds.filter(feed => {
    if (activeTab === "all") return true
    if (activeTab === "highRisk") return feed.trapProbability > 80
    if (activeTab === "buy") return feed.actionSignal === "BUY"
    if (activeTab === "sell") return feed.actionSignal === "SELL"
    return true
  })

  return (
    <div className="space-y-6">
      {/* 页面标题和说明 */}
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">智能情报分析中心</h1>
        <p className="text-gray-600 mb-4">
          基于五大投资流派融合的AI量化分析系统，实时市场情报与智能风险预警，帮助您做出更明智的投资决策。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-blue-800 font-semibold mb-2">
              <Activity className="h-5 w-5" />
              实时情报流
            </div>
            <div className="text-sm text-blue-700">
              • 多源数据融合分析<br/>
              • 实时市场事件监控<br/>
              • 行业趋势智能识别<br/>
              • 风险概率量化评估
            </div>
          </div>

          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 font-semibold mb-2">
              <Shield className="h-5 w-5" />
              风险预警系统
            </div>
            <div className="text-sm text-red-700">
              • 陷阱概率实时计算<br/>
              • 高风险信号突出显示<br/>
              • 止损目标智能推荐<br/>
              • 多维度风险分析
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-purple-800 font-semibold mb-2">
              <Brain className="h-5 w-5" />
              AI决策引擎
            </div>
            <div className="text-sm text-purple-700">
              • 五大投资流派融合<br/>
              • 实时交易信号生成<br/>
              • 逻辑链透明展示<br/>
              • 置信度评分系统
            </div>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{totalFeeds}</div>
              <div className="text-sm text-muted-foreground">今日情报</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-500">{buySignals}</div>
              <div className="text-sm text-muted-foreground">买入信号</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-500">{highRiskCount}</div>
              <div className="text-sm text-muted-foreground">高风险警报</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold">5</div>
              <div className="text-sm text-muted-foreground">投资流派</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 标签导航 */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 mb-6">
              <TabsTrigger value="all" className="flex items-center">
                <Activity className="h-4 w-4 mr-2" />
                全部情报
              </TabsTrigger>
              <TabsTrigger value="highRisk" className="flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                高风险
              </TabsTrigger>
              <TabsTrigger value="buy" className="flex items-center">
                <TrendingUp className="h-4 w-4 mr-2" />
                买入信号
              </TabsTrigger>
              <TabsTrigger value="sell" className="flex items-center">
                <TrendingUp className="h-4 w-4 mr-2" />
                卖出信号
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <IntelligenceFeedList
                feeds={filteredFeeds}
                isLoading={isLoading}
                onRefresh={handleRefresh}
              />
            </TabsContent>

            <TabsContent value="highRisk">
              <IntelligenceFeedList
                feeds={filteredFeeds}
                isLoading={isLoading}
                onRefresh={handleRefresh}
              />
            </TabsContent>

            <TabsContent value="buy">
              <IntelligenceFeedList
                feeds={filteredFeeds}
                isLoading={isLoading}
                onRefresh={handleRefresh}
              />
            </TabsContent>

            <TabsContent value="sell">
              <IntelligenceFeedList
                feeds={filteredFeeds}
                isLoading={isLoading}
                onRefresh={handleRefresh}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 技术说明 */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">系统架构说明</h2>

        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-800 mb-2">1. 数据源与处理</h3>
            <div className="text-sm text-gray-600 pl-4">
              <div className="mb-1">• <strong>多源数据采集</strong>：实时市场数据、财经新闻、社交媒体、研报分析</div>
              <div className="mb-1">• <strong>自然语言处理</strong>：情感分析、事件提取、关系挖掘</div>
              <div className="mb-1">• <strong>数据融合</strong>：多维度信息整合，消除信息孤岛</div>
              <div className="mb-1">• <strong>实时更新</strong>：秒级数据刷新，确保情报时效性</div>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-gray-800 mb-2">2. AI分析引擎</h3>
            <div className="text-sm text-gray-600 pl-4">
              <div className="mb-1">• <strong>五大投资流派融合</strong>：桥水宏观对冲、巴菲特价值投资、索罗斯反身性、佩洛西政策前瞻、中国游资情绪接力</div>
              <div className="mb-1">• <strong>风险量化评估</strong>：陷阱概率计算、风险等级分类</div>
              <div className="mb-1">• <strong>交易信号生成</strong>：买入/卖出/持有建议，目标价格与止损位</div>
              <div className="mb-1">• <strong>逻辑链透明化</strong>：完整推理过程展示，增强决策可信度</div>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-gray-800 mb-2">3. 风险控制体系</h3>
            <div className="text-sm text-gray-600 pl-4">
              <div className="mb-1">• <strong>MA60纪律</strong>：收盘价必须高于60日移动平均线，否则立即止损</div>
              <div className="mb-1">• <strong>MD60纪律</strong>：尊重60日动量方向，顺势而为</div>
              <div className="mb-1">• <strong>仓位控制</strong>：单只股票不超过总资金的20%</div>
              <div className="mb-1">• <strong>风险限额</strong>：最大回撤不超过总资金的5%</div>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-gray-800 mb-2">4. 用户体验优化</h3>
            <div className="text-sm text-gray-600 pl-4">
              <div className="mb-1">• <strong>智能筛选</strong>：按股票、信号类型、风险等级快速过滤</div>
              <div className="mb-1">• <strong>视觉突出</strong>：高风险信号红色高亮显示</div>
              <div className="mb-1">• <strong>实时刷新</strong>：手动刷新与自动更新结合</div>
              <div className="mb-1">• <strong>响应式设计</strong>：适配桌面端与移动端</div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            <strong>使用说明：</strong> 系统自动分析市场情报并生成交易信号。高风险信号（陷阱概率&gt;80%）会以红色高亮显示。
            您可以使用顶部的筛选工具按股票、信号类型或风险等级进行筛选，点击刷新按钮获取最新情报。
          </div>
        </div>
      </div>
    </div>
  );
}