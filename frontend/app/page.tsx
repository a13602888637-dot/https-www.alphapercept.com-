"use client"

import { useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { AlertFeed } from "@/components/live-feed/alert-feed"
import { MA60WarningPanel } from "@/components/live-feed/ma60-warning-panel"
import { StrategyRecommendationPanel } from "@/components/strategy-chat/strategy-recommendation-panel"
import { QAChat } from "@/components/strategy-chat/qa-chat"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3, TrendingUp, AlertTriangle, Brain } from "lucide-react"

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* 移动端侧边栏遮罩 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex">
        {/* 侧边栏 */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-50 w-64 transform border-r bg-background transition-transform duration-300 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
            md:relative md:translate-x-0
          `}
        >
          <Sidebar />
        </aside>

        {/* 主内容区 */}
        <div className="flex-1">
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

          <main className="container px-4 py-6">
            {/* 欢迎横幅 */}
            <Card className="mb-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold mb-2">
                      欢迎使用 Alpha-Quant-Copilot
                    </h1>
                    <p className="text-muted-foreground">
                      基于五大投资流派融合的AI量化交易分析系统，实时市场数据与智能策略推荐
                    </p>
                  </div>
                  <div className="mt-4 md:mt-0 flex items-center space-x-2">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-500">+2.34%</div>
                      <div className="text-sm text-muted-foreground">今日收益</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">15</div>
                      <div className="text-sm text-muted-foreground">活跃策略</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-500">3</div>
                      <div className="text-sm text-muted-foreground">风险警报</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 主要仪表板 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* 左侧：实时警报 */}
              <div className="lg:col-span-2">
                <Tabs defaultValue="alerts" className="w-full">
                  <TabsList className="grid grid-cols-3 mb-4">
                    <TabsTrigger value="alerts" className="flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      实时警报
                    </TabsTrigger>
                    <TabsTrigger value="ma60" className="flex items-center">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      MA60监控
                    </TabsTrigger>
                    <TabsTrigger value="trends" className="flex items-center">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      市场趋势
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="alerts">
                    <AlertFeed />
                  </TabsContent>

                  <TabsContent value="ma60">
                    <MA60WarningPanel />
                  </TabsContent>

                  <TabsContent value="trends">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <BarChart3 className="h-5 w-5 mr-2" />
                          市场趋势分析
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center py-12 text-muted-foreground">
                          市场趋势图表加载中...
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>

              {/* 右侧：AI助手 */}
              <div>
                <QAChat />
              </div>
            </div>

            {/* 策略推荐 */}
            <div className="mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Brain className="h-5 w-5 mr-2" />
                    AI策略推荐
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <StrategyRecommendationPanel />
                </CardContent>
              </Card>
            </div>

            {/* 底部统计 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-500">87.5%</div>
                    <div className="text-sm text-muted-foreground">策略胜率</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold">24/7</div>
                    <div className="text-sm text-muted-foreground">实时监控</div>
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
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold">AI</div>
                    <div className="text-sm text-muted-foreground">智能分析</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>

          <footer className="border-t py-6">
            <div className="container px-4">
              <div className="flex flex-col md:flex-row items-center justify-between">
                <div className="mb-4 md:mb-0">
                  <div className="flex items-center space-x-2">
                    <div className="h-6 w-6 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                      <Brain className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-bold">Alpha-Quant-Copilot</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    © 2026 AI量化交易分析系统
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  数据来源: 实时市场数据 + AI分析引擎
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
