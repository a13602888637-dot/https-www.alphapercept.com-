"use client"

import { useState } from "react"
import { PageLayout } from "@/components/layout/page-layout"
import { IntelligenceFeedList } from "@/components/intelligence-feed/IntelligenceFeedList"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity, Shield, TrendingUp, AlertTriangle, Brain } from "lucide-react"

// 模拟数据 - 在实际应用中应该从API获取
const mockIntelligenceFeeds = [
  {
    id: "1",
    stockCode: "000001",
    stockName: "平安银行",
    eventSummary: "银行板块整体估值修复，政策面支持金融科技发展，但需关注房地产风险传导",
    industryTrend: "金融科技转型加速，数字化转型成为行业共识",
    trapProbability: 85,
    actionSignal: "BUY" as const,
    targetPrice: 12.5,
    stopLoss: 10.2,
    createdAt: new Date("2026-02-23T09:30:00")
  },
  {
    id: "2",
    stockCode: "600519",
    stockName: "贵州茅台",
    eventSummary: "高端白酒消费复苏，春节销售超预期，但估值已处历史高位",
    industryTrend: "消费升级趋势延续，高端品牌溢价能力增强",
    trapProbability: 65,
    actionSignal: "HOLD" as const,
    targetPrice: 1800,
    stopLoss: 1500,
    createdAt: new Date("2026-02-23T10:15:00")
  },
  {
    id: "3",
    stockCode: "300750",
    stockName: "宁德时代",
    eventSummary: "新能源汽车销量持续增长，但行业竞争加剧，价格战风险上升",
    industryTrend: "动力电池技术迭代加速，固态电池商业化进程加快",
    trapProbability: 92,
    actionSignal: "SELL" as const,
    targetPrice: 180,
    stopLoss: 220,
    createdAt: new Date("2026-02-23T11:45:00")
  },
  {
    id: "4",
    stockCode: "002415",
    stockName: "海康威视",
    eventSummary: "AI+安防应用场景拓展，海外市场恢复增长",
    industryTrend: "人工智能与安防深度融合，智慧城市需求旺盛",
    trapProbability: 45,
    actionSignal: "BUY" as const,
    targetPrice: 38.5,
    stopLoss: 32.0,
    createdAt: new Date("2026-02-23T13:20:00")
  },
  {
    id: "5",
    stockCode: "601318",
    stockName: "中国平安",
    eventSummary: "保险业务结构优化，但投资端受市场波动影响较大",
    industryTrend: "保险科技应用深化，健康险需求快速增长",
    trapProbability: 78,
    actionSignal: "HOLD" as const,
    targetPrice: 48.0,
    stopLoss: 42.5,
    createdAt: new Date("2026-02-23T14:30:00")
  },
  {
    id: "6",
    stockCode: "000858",
    stockName: "五粮液",
    eventSummary: "白酒行业消费升级趋势明显，但渠道库存压力需要关注",
    industryTrend: "高端白酒品牌集中度提升，次高端竞争激烈",
    trapProbability: 55,
    actionSignal: "BUY" as const,
    targetPrice: 165,
    stopLoss: 140,
    createdAt: new Date("2026-02-23T15:45:00")
  }
]

export default function LiveFeedPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [feeds, setFeeds] = useState(mockIntelligenceFeeds)
  const [activeTab, setActiveTab] = useState("all")

  // 计算统计数据
  const highRiskCount = feeds.filter(feed => feed.trapProbability > 80).length
  const buySignals = feeds.filter(feed => feed.actionSignal === "BUY").length
  const totalFeeds = feeds.length

  const handleRefresh = () => {
    setIsLoading(true)
    // 模拟API调用延迟
    setTimeout(() => {
      // 在实际应用中这里应该调用API获取最新数据
      setFeeds([...mockIntelligenceFeeds])
      setIsLoading(false)
    }, 1000)
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
    <PageLayout title="实时市场">
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
    </PageLayout>
  );
}