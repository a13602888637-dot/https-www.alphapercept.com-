"use client"

import { useState } from "react"
import { PageLayout } from "@/components/layout/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Brain, TrendingUp, Shield, Zap, Target, BarChart3, Clock, Star, AlertTriangle, CheckCircle } from "lucide-react"

// 模拟策略数据
const mockStrategies = [
  {
    id: "1",
    name: "宏观对冲策略",
    description: "基于经济周期与市场预期错配，捕捉宏观政策变化带来的投资机会",
    confidence: 92,
    riskLevel: "中等",
    expectedReturn: "15-25%",
    timeHorizon: "6-12个月",
    recommendedStocks: ["000001", "601318", "600036"],
    keyFactors: ["PMI数据", "利率政策", "通胀预期"],
    lastUpdated: "2026-02-23 14:30",
  },
  {
    id: "2",
    name: "价值防守策略",
    description: "安全边际优先，筛选财务健康、估值合理的优质公司，远离市场泡沫",
    confidence: 88,
    riskLevel: "低",
    expectedReturn: "10-18%",
    timeHorizon: "12-24个月",
    recommendedStocks: ["600519", "000858", "002415"],
    keyFactors: ["ROE > 12%", "毛利率 > 25%", "负债率 < 60%"],
    lastUpdated: "2026-02-23 13:45",
  },
  {
    id: "3",
    name: "情绪接力策略",
    description: "感知市场情绪周期，把握资金流向，参与强势板块的情绪接力",
    confidence: 85,
    riskLevel: "高",
    expectedReturn: "20-40%",
    timeHorizon: "1-3个月",
    recommendedStocks: ["300750", "002230", "300059"],
    keyFactors: ["涨停数量", "连板高度", "资金净流入"],
    lastUpdated: "2026-02-23 12:15",
  },
  {
    id: "4",
    name: "事件驱动策略",
    description: "捕捉突发新闻和政策变化带来的预期差，快速响应市场机会",
    confidence: 90,
    riskLevel: "中等",
    expectedReturn: "12-22%",
    timeHorizon: "1-6个月",
    recommendedStocks: ["601888", "600276", "000333"],
    keyFactors: ["政策发布", "技术突破", "供需变化"],
    lastUpdated: "2026-02-23 11:30",
  },
  {
    id: "5",
    name: "反人性破解策略",
    description: "识别市场中的诱多、洗盘、龙头衰竭模式，逆向操作获取超额收益",
    confidence: 87,
    riskLevel: "高",
    expectedReturn: "18-35%",
    timeHorizon: "3-9个月",
    recommendedStocks: ["000002", "600887", "002594"],
    keyFactors: ["诱多识别", "洗盘识别", "衰竭预警"],
    lastUpdated: "2026-02-23 10:45",
  },
]

// 模拟用户偏好
const userPreferences = {
  riskTolerance: "中等",
  investmentHorizon: "6-12个月",
  preferredStrategies: ["价值防守", "宏观对冲"],
  excludedIndustries: ["房地产", "煤炭"],
  maxPositionSize: "20%",
}

export default function StrategyRecommendationPage() {
  const [activeTab, setActiveTab] = useState("all")
  const [selectedStrategy, setSelectedStrategy] = useState(mockStrategies[0])

  // 根据用户偏好筛选策略
  const filteredStrategies = mockStrategies.filter(strategy => {
    if (activeTab === "all") return true
    if (activeTab === "highConfidence") return strategy.confidence >= 90
    if (activeTab === "lowRisk") return strategy.riskLevel === "低"
    if (activeTab === "userMatch") {
      return userPreferences.preferredStrategies.some(pref =>
        strategy.name.includes(pref)
      )
    }
    return true
  })

  const handleApplyStrategy = (strategyId: string) => {
    const strategy = mockStrategies.find(s => s.id === strategyId)
    if (strategy) {
      alert(`已应用策略：${strategy.name}\n\n系统将根据此策略为您生成具体的投资建议。`)
    }
  }

  return (
    <PageLayout title="AI策略推荐中心">
      <div className="space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI策略推荐中心</h1>
          <p className="text-muted-foreground mt-2">
            基于五大投资流派融合的智能策略推荐系统，为您量身定制投资方案
          </p>
        </div>

      {/* 用户偏好卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="h-5 w-5 mr-2" />
            您的投资偏好
          </CardTitle>
          <CardDescription>系统根据您的偏好筛选最适合的策略</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">风险承受能力</div>
              <Badge variant="outline" className="text-blue-600 border-blue-200">
                {userPreferences.riskTolerance}
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">投资期限</div>
              <Badge variant="outline" className="text-green-600 border-green-200">
                {userPreferences.investmentHorizon}
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">单股最大仓位</div>
              <Badge variant="outline" className="text-purple-600 border-purple-200">
                {userPreferences.maxPositionSize}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 策略筛选和展示 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：策略列表 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>推荐策略列表</CardTitle>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 mr-1" />
                  最后更新: 今日 15:00
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-4 mb-6">
                  <TabsTrigger value="all">全部策略</TabsTrigger>
                  <TabsTrigger value="highConfidence">高置信度</TabsTrigger>
                  <TabsTrigger value="lowRisk">低风险</TabsTrigger>
                  <TabsTrigger value="userMatch">匹配偏好</TabsTrigger>
                </TabsList>

                <div className="space-y-4">
                  {filteredStrategies.map((strategy) => (
                    <Card key={strategy.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="pt-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-lg font-semibold">{strategy.name}</h3>
                              <Badge className={
                                strategy.riskLevel === "低" ? "bg-green-100 text-green-800" :
                                strategy.riskLevel === "中等" ? "bg-yellow-100 text-yellow-800" :
                                "bg-red-100 text-red-800"
                              }>
                                {strategy.riskLevel}风险
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">
                              {strategy.description}
                            </p>
                            <div className="flex flex-wrap gap-2 mb-3">
                              <div className="flex items-center text-sm">
                                <Brain className="h-4 w-4 mr-1 text-blue-500" />
                                <span className="font-medium">置信度: {strategy.confidence}%</span>
                              </div>
                              <div className="flex items-center text-sm">
                                <TrendingUp className="h-4 w-4 mr-1 text-green-500" />
                                <span>预期收益: {strategy.expectedReturn}</span>
                              </div>
                              <div className="flex items-center text-sm">
                                <Clock className="h-4 w-4 mr-1 text-gray-500" />
                                <span>投资期限: {strategy.timeHorizon}</span>
                              </div>
                            </div>
                            <div className="text-sm">
                              <span className="font-medium">关键因素: </span>
                              {strategy.keyFactors.join(", ")}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button
                              onClick={() => setSelectedStrategy(strategy)}
                              variant="outline"
                            >
                              查看详情
                            </Button>
                            <Button
                              onClick={() => handleApplyStrategy(strategy.id)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              应用策略
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：策略详情 */}
        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Brain className="h-5 w-5 mr-2" />
                策略详情
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">{selectedStrategy.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedStrategy.description}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">置信度</span>
                  <div className="flex items-center">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden mr-2">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${selectedStrategy.confidence}%` }}
                      />
                    </div>
                    <span className="font-medium">{selectedStrategy.confidence}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm">风险等级</span>
                  <Badge className={
                    selectedStrategy.riskLevel === "低" ? "bg-green-100 text-green-800" :
                    selectedStrategy.riskLevel === "中等" ? "bg-yellow-100 text-yellow-800" :
                    "bg-red-100 text-red-800"
                  }>
                    {selectedStrategy.riskLevel}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm">预期收益</span>
                  <span className="font-medium text-green-600">{selectedStrategy.expectedReturn}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm">投资期限</span>
                  <span>{selectedStrategy.timeHorizon}</span>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2 flex items-center">
                  <Star className="h-4 w-4 mr-1" />
                  推荐股票
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedStrategy.recommendedStocks.map((stock) => (
                    <Badge key={stock} variant="secondary">
                      {stock}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  关键因素
                </h4>
                <ul className="space-y-1 text-sm">
                  {selectedStrategy.keyFactors.map((factor, index) => (
                    <li key={index} className="flex items-center">
                      <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  最后更新: {selectedStrategy.lastUpdated}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 策略统计 */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-sm">策略统计</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">总策略数</span>
                  <span className="font-medium">{mockStrategies.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">高置信度策略</span>
                  <span className="font-medium text-green-600">
                    {mockStrategies.filter(s => s.confidence >= 90).length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">低风险策略</span>
                  <span className="font-medium text-blue-600">
                    {mockStrategies.filter(s => s.riskLevel === "低").length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">匹配您偏好</span>
                  <span className="font-medium text-purple-600">
                    {mockStrategies.filter(s =>
                      userPreferences.preferredStrategies.some(pref =>
                        s.name.includes(pref)
                      )
                    ).length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 策略执行说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="h-5 w-5 mr-2" />
            策略执行说明
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="font-medium flex items-center">
                  <Shield className="h-4 w-4 mr-2 text-blue-500" />
                  风险控制
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 严格遵守MA60止损纪律</li>
                  <li>• 单只股票仓位不超过20%</li>
                  <li>• 最大回撤控制在5%以内</li>
                </ul>
              </div>
              <div className="space-y-2">
                <div className="font-medium flex items-center">
                  <BarChart3 className="h-4 w-4 mr-2 text-green-500" />
                  执行要点
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 策略应用后系统自动监控</li>
                  <li>• 每日收盘后生成执行报告</li>
                  <li>• 关键信号实时推送提醒</li>
                </ul>
              </div>
              <div className="space-y-2">
                <div className="font-medium flex items-center">
                  <Target className="h-4 w-4 mr-2 text-purple-500" />
                  优化建议
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 定期评估策略表现</li>
                  <li>• 根据市场环境调整策略</li>
                  <li>• 保持投资纪律一致性</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </PageLayout>
  )
}