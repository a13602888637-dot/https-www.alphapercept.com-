"use client"

import { useState, useEffect, useCallback } from "react"
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { IntelligenceFeedListWithAPI } from "@/components/intelligence-feed/IntelligenceFeedListWithAPI"
import { StrategyRecommendationPanel } from "@/components/strategy-chat/strategy-recommendation-panel"
import { QAChat } from "@/components/strategy-chat/qa-chat"
import { WatchlistManager } from "@/components/watchlist/WatchlistManager"
import { UserDashboard } from "@/components/user/UserDashboard"
import MarketTrendAnalysis from "@/components/market-trends/MarketTrendAnalysis"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { TrendingUp, Brain, Activity, Shield, Zap, Star, LogIn, User } from "lucide-react"
import { useUserSync } from "@/lib/hooks/useUserSync"

interface FeedStats {
  highRiskCount: number;
  buySignals: number;
  totalFeeds: number;
}

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("intelligence")
  const [stats, setStats] = useState<FeedStats>({ highRiskCount: 0, buySignals: 0, totalFeeds: 0 })

  // Sync user data
  const { user } = useUserSync()

  // 从API获取统计数据
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/intelligence-feed?limit=50")
      if (!response.ok) return
      const data = await response.json()
      if (data.success && data.feed) {
        const feeds = data.feed
        setStats({
          highRiskCount: feeds.filter((f: any) => f.trapProbability > 80).length,
          buySignals: feeds.filter((f: any) => f.actionSignal === "BUY").length,
          totalFeeds: feeds.length,
        })
      }
    } catch (error) {
      console.error("Error fetching feed stats:", error)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

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
                      <SignedIn>
                        欢迎回来，{user?.firstName || "交易员"}！
                      </SignedIn>
                      <SignedOut>
                        智能情报分析中心
                      </SignedOut>
                    </h1>
                    <p className="text-muted-foreground">
                      基于五大投资流派融合的AI量化分析系统，实时市场情报与智能风险预警
                    </p>
                  </div>
                  <div className="mt-4 md:mt-0 flex items-center space-x-4">
                    <SignedIn>
                      <div className="flex items-center space-x-2">
                        <UserButton afterSignOutUrl="/" />
                        <div className="text-sm text-muted-foreground">
                          {user?.primaryEmailAddress?.emailAddress}
                        </div>
                      </div>
                    </SignedIn>
                    <SignedOut>
                      <SignInButton mode="modal">
                        <Button variant="outline">
                          <LogIn className="h-4 w-4 mr-2" />
                          登录以解锁完整功能
                        </Button>
                      </SignInButton>
                    </SignedOut>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-500">{stats.buySignals}</div>
                      <div className="text-sm text-muted-foreground">买入信号</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{stats.totalFeeds}</div>
                      <div className="text-sm text-muted-foreground">今日情报</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-500">{stats.highRiskCount}</div>
                      <div className="text-sm text-muted-foreground">高风险警报</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 主要仪表板 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* 左侧：智能情报流 */}
              <div className="lg:col-span-2">
                <Tabs defaultValue="intelligence" className="w-full" value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid grid-cols-5 mb-4">
                    <TabsTrigger value="intelligence" className="flex items-center">
                      <Activity className="h-4 w-4 mr-2" />
                      智能情报流
                    </TabsTrigger>
                    <TabsTrigger value="warnings" className="flex items-center">
                      <Shield className="h-4 w-4 mr-2" />
                      风险预警
                    </TabsTrigger>
                    <TabsTrigger value="watchlist" className="flex items-center">
                      <Star className="h-4 w-4 mr-2" />
                      自选股
                    </TabsTrigger>
                    <TabsTrigger value="profile" className="flex items-center">
                      <User className="h-4 w-4 mr-2" />
                      个人中心
                    </TabsTrigger>
                    <TabsTrigger value="trends" className="flex items-center">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      市场趋势
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="intelligence">
                    <IntelligenceFeedListWithAPI
                      autoRefresh={true}
                      refreshInterval={60000} // 1 minute
                    />
                  </TabsContent>

                  <TabsContent value="warnings">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <Shield className="h-5 w-5 mr-2" />
                          风险预警中心
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <IntelligenceFeedListWithAPI
                          filter="high_risk"
                          autoRefresh={true}
                          refreshInterval={120000}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="watchlist">
                    <SignedIn>
                      <WatchlistManager />
                    </SignedIn>
                    <SignedOut>
                      <Card>
                        <CardContent className="pt-12 pb-12">
                          <div className="text-center">
                            <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-semibold mb-2">登录以管理自选股</h3>
                            <p className="text-muted-foreground mb-6">
                              登录后您可以添加自选股票，设置买入成本、止损价和目标价，实时跟踪投资组合
                            </p>
                            <SignInButton mode="modal">
                              <Button>
                                <LogIn className="h-4 w-4 mr-2" />
                                立即登录
                              </Button>
                            </SignInButton>
                          </div>
                        </CardContent>
                      </Card>
                    </SignedOut>
                  </TabsContent>

                  <TabsContent value="profile">
                    <SignedIn>
                      <UserDashboard />
                    </SignedIn>
                    <SignedOut>
                      <Card>
                        <CardContent className="pt-12 pb-12">
                          <div className="text-center">
                            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-semibold mb-2">登录以访问个人中心</h3>
                            <p className="text-muted-foreground mb-6">
                              登录后您可以查看个人资料、统计数据和管理账户设置
                            </p>
                            <SignInButton mode="modal">
                              <Button>
                                <LogIn className="h-4 w-4 mr-2" />
                                立即登录
                              </Button>
                            </SignInButton>
                          </div>
                        </CardContent>
                      </Card>
                    </SignedOut>
                  </TabsContent>

                  <TabsContent value="trends">
                    <MarketTrendAnalysis />
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
                    <Zap className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                    <div className="text-3xl font-bold">5</div>
                    <div className="text-sm text-muted-foreground">投资流派融合</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Activity className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <div className="text-3xl font-bold">24/7</div>
                    <div className="text-sm text-muted-foreground">实时监控</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Shield className="h-8 w-8 text-red-500 mx-auto mb-2" />
                    <div className="text-3xl font-bold">{stats.highRiskCount}</div>
                    <div className="text-sm text-muted-foreground">风险预警</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Brain className="h-8 w-8 text-purple-500 mx-auto mb-2" />
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
