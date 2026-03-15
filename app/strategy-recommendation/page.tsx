"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Brain, TrendingUp, Shield, Zap, Target, BarChart3, Clock, Star, AlertTriangle, CheckCircle, Loader2, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Strategy {
  id: string
  name: string
  description: string
  confidence: number
  riskLevel: string
  expectedReturn: string
  timeHorizon: string
  recommendedStocks: string[]
  keyFactors: string[]
  lastUpdated: string
}

interface UserPreferences {
  riskTolerance: string
  investmentHorizon: string
  preferredStrategies: string[]
  excludedIndustries: string[]
  maxPositionSize: string
}

export default function StrategyRecommendationPage() {
  const [activeTab, setActiveTab] = useState("all")
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null)
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    riskTolerance: "中等",
    investmentHorizon: "6-12个月",
    preferredStrategies: ["价值防守", "宏观对冲"],
    excludedIndustries: [],
    maxPositionSize: "20%",
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isApplying, setIsApplying] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchStrategies = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/strategy-recommendation')
      const data = await response.json()
      if (data.success && data.strategies) {
        setStrategies(data.strategies)
        if (data.strategies.length > 0 && !selectedStrategy) {
          setSelectedStrategy(data.strategies[0])
        }
        if (data.userPreferences) {
          setUserPreferences(data.userPreferences)
        }
      }
    } catch (error) {
      console.error('获取策略推荐失败:', error)
      toast({ title: "获取策略失败", description: "请稍后重试", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [toast, selectedStrategy])

  useEffect(() => {
    fetchStrategies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredStrategies = strategies.filter(strategy => {
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

  const handleApplyStrategy = async (strategyId: string) => {
    const strategy = strategies.find(s => s.id === strategyId)
    if (!strategy) return

    setIsApplying(strategyId)
    try {
      const response = await fetch('/api/strategy-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId, strategyName: strategy.name }),
      })
      const data = await response.json()
      if (data.success) {
        toast({ title: "策略已应用", description: `已成功应用策略: ${strategy.name}` })
      } else {
        toast({ title: "应用失败", description: data.error || "请稍后重试", variant: "destructive" })
      }
    } catch (error) {
      console.error('应用策略失败:', error)
      toast({ title: "应用失败", description: "网络错误，请稍后重试", variant: "destructive" })
    } finally {
      setIsApplying(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI策略推荐中心</h1>
          <p className="text-muted-foreground mt-2">
            基于五大投资流派融合的智能策略推荐系统，为您量身定制投资方案
          </p>
        </div>
        <Button variant="outline" onClick={fetchStrategies} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          刷新策略
        </Button>
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

      {/* Loading state */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
              <p className="text-muted-foreground">AI正在分析市场环境并生成策略推荐...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* 策略筛选和展示 */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：策略列表 */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>推荐策略列表</CardTitle>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 mr-1" />
                    AI实时生成
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
                    {filteredStrategies.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        当前筛选条件下暂无策略
                      </div>
                    ) : (
                      filteredStrategies.map((strategy) => (
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
                                  disabled={isApplying === strategy.id}
                                >
                                  {isApplying === strategy.id ? (
                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />应用中...</>
                                  ) : (
                                    "应用策略"
                                  )}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* 右侧：策略详情 */}
          <div>
            {selectedStrategy && (
              <>
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
                        {selectedStrategy.recommendedStocks.length > 0 ? (
                          selectedStrategy.recommendedStocks.map((stock) => (
                            <Badge key={stock} variant="secondary">
                              {stock}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">暂无具体推荐</span>
                        )}
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
                        <span className="font-medium">{strategies.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">高置信度策略</span>
                        <span className="font-medium text-green-600">
                          {strategies.filter(s => s.confidence >= 90).length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">低风险策略</span>
                        <span className="font-medium text-blue-600">
                          {strategies.filter(s => s.riskLevel === "低").length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">匹配您偏好</span>
                        <span className="font-medium text-purple-600">
                          {strategies.filter(s =>
                            userPreferences.preferredStrategies.some(pref =>
                              s.name.includes(pref)
                            )
                          ).length}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      )}

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
                  <li>- 严格遵守MA60止损纪律</li>
                  <li>- 单只股票仓位不超过20%</li>
                  <li>- 最大回撤控制在5%以内</li>
                </ul>
              </div>
              <div className="space-y-2">
                <div className="font-medium flex items-center">
                  <BarChart3 className="h-4 w-4 mr-2 text-green-500" />
                  执行要点
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>- 策略应用后系统自动监控</li>
                  <li>- 每日收盘后生成执行报告</li>
                  <li>- 关键信号实时推送提醒</li>
                </ul>
              </div>
              <div className="space-y-2">
                <div className="font-medium flex items-center">
                  <Target className="h-4 w-4 mr-2 text-purple-500" />
                  优化建议
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>- 定期评估策略表现</li>
                  <li>- 根据市场环境调整策略</li>
                  <li>- 保持投资纪律一致性</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
