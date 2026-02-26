"use client"

import * as React from "react"
import { PageLayout } from "@/components/layout/page-layout"
import { useUserSync } from "@/lib/hooks/useUserSync"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { User, Mail, Calendar, Moon, Sun, Monitor, Bell, TrendingUp, AlertCircle, Smartphone } from "lucide-react"
import { useTheme } from "next-themes"
import { Switch } from "@/components/ui/switch"

export default function SettingsPage() {
  const { user, isLoaded } = useUserSync()

  return (
    <PageLayout title="设置">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">设置</h1>
            <p className="text-muted-foreground">管理您的账户偏好和通知设置</p>
          </div>
        <div className="text-sm text-muted-foreground">
          最后更新: {new Date().toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：账户信息 */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                账户信息
              </CardTitle>
              <CardDescription>您的个人资料和账户详情</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoaded && user ? (
                <div className="space-y-4">
                  <div className="flex flex-col items-center text-center">
                    <div className="h-20 w-20 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center mb-4">
                      <span className="text-white font-bold text-2xl">
                        {user.firstName?.[0] || user.username?.[0] || "U"}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-xl">
                        {user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user.username || "用户"}
                      </h3>
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-2">
                        <Mail className="h-4 w-4" />
                        <span>{user.primaryEmailAddress?.emailAddress || "未设置邮箱"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">用户ID</p>
                      <p className="font-mono text-sm truncate bg-muted p-2 rounded">{user.id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">创建时间</p>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {new Date(user.createdAt).toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">账户状态</p>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        <span className="text-sm">活跃</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <button className="w-full py-2 px-4 border rounded-md hover:bg-accent transition-colors">
                      编辑个人资料
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">加载用户信息中...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右侧：设置选项 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 主题设置卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sun className="h-5 w-5" />
                主题设置
              </CardTitle>
              <CardDescription>自定义界面外观和主题</CardDescription>
            </CardHeader>
            <CardContent>
              <ThemeSettings />
            </CardContent>
          </Card>

          {/* 通知设置卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                通知设置
              </CardTitle>
              <CardDescription>管理您的通知偏好和提醒设置</CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationSettings />
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </PageLayout>
  )
}

// 主题设置组件
function ThemeSettings() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="text-center py-8"><p className="text-muted-foreground">加载主题设置中...</p></div>
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-base font-medium">深色模式</div>
            <p className="text-sm text-muted-foreground">
              启用深色主题，适合夜间使用
            </p>
          </div>
          <Switch
            id="dark-mode"
            checked={theme === "dark"}
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-base font-medium">跟随系统</div>
            <p className="text-sm text-muted-foreground">
              自动根据系统设置切换主题
            </p>
          </div>
          <Switch
            id="system-theme"
            checked={theme === "system"}
            onCheckedChange={(checked) => setTheme(checked ? "system" : "light")}
          />
        </div>
      </div>

      <div className="pt-4 border-t">
        <h4 className="font-medium mb-3">主题预览</h4>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setTheme("light")}
            className={`flex flex-col items-center p-3 rounded-lg border transition-all ${
              theme === "light"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                : "border-border hover:bg-accent"
            }`}
          >
            <div className="h-10 w-full rounded-md bg-white border mb-2 flex items-center justify-center">
              <Sun className="h-5 w-5 text-yellow-500" />
            </div>
            <span className="text-sm font-medium">浅色</span>
          </button>

          <button
            onClick={() => setTheme("dark")}
            className={`flex flex-col items-center p-3 rounded-lg border transition-all ${
              theme === "dark"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                : "border-border hover:bg-accent"
            }`}
          >
            <div className="h-10 w-full rounded-md bg-gray-900 border mb-2 flex items-center justify-center">
              <Moon className="h-5 w-5 text-blue-400" />
            </div>
            <span className="text-sm font-medium">深色</span>
          </button>

          <button
            onClick={() => setTheme("system")}
            className={`flex flex-col items-center p-3 rounded-lg border transition-all ${
              theme === "system"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                : "border-border hover:bg-accent"
            }`}
          >
            <div className="h-10 w-full rounded-md bg-gradient-to-r from-white to-gray-900 border mb-2 flex items-center justify-center">
              <Monitor className="h-5 w-5 text-gray-600" />
            </div>
            <span className="text-sm font-medium">系统</span>
          </button>
        </div>
      </div>

      <div className="pt-4 border-t">
        <p className="text-sm text-muted-foreground">
          当前主题: <span className="font-medium capitalize">{theme}</span>
        </p>
      </div>
    </div>
  )
}

// 通知设置组件
function NotificationSettings() {
  const [emailNotifications, setEmailNotifications] = React.useState(true)
  const [priceAlerts, setPriceAlerts] = React.useState(true)
  const [marketUpdates, setMarketUpdates] = React.useState(false)
  const [pushNotifications, setPushNotifications] = React.useState(true)
  const [riskWarnings, setRiskWarnings] = React.useState(true)
  const [strategyRecommendations, setStrategyRecommendations] = React.useState(true)

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div className="text-base font-medium">邮件通知</div>
            </div>
            <p className="text-sm text-muted-foreground">
              接收重要账户更新和系统通知
            </p>
          </div>
          <Switch
            id="email-notifications"
            checked={emailNotifications}
            onCheckedChange={setEmailNotifications}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <div className="text-base font-medium">价格提醒</div>
            </div>
            <p className="text-sm text-muted-foreground">
              自选股达到目标价或止损价时通知
            </p>
          </div>
          <Switch
            id="price-alerts"
            checked={priceAlerts}
            onCheckedChange={setPriceAlerts}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <div className="text-base font-medium">市场动态</div>
            </div>
            <p className="text-sm text-muted-foreground">
              每日市场总结和重要事件提醒
            </p>
          </div>
          <Switch
            id="market-updates"
            checked={marketUpdates}
            onCheckedChange={setMarketUpdates}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <div className="text-base font-medium">推送通知</div>
            </div>
            <p className="text-sm text-muted-foreground">
              在浏览器中接收实时通知
            </p>
          </div>
          <Switch
            id="push-notifications"
            checked={pushNotifications}
            onCheckedChange={setPushNotifications}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <div className="text-base font-medium">风险预警</div>
            </div>
            <p className="text-sm text-muted-foreground">
              高风险股票和陷阱概率提醒
            </p>
          </div>
          <Switch
            id="risk-warnings"
            checked={riskWarnings}
            onCheckedChange={setRiskWarnings}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <div className="text-base font-medium">策略推荐</div>
            </div>
            <p className="text-sm text-muted-foreground">
              AI生成的个性化投资策略提醒
            </p>
          </div>
          <Switch
            id="strategy-recommendations"
            checked={strategyRecommendations}
            onCheckedChange={setStrategyRecommendations}
          />
        </div>
      </div>

      <div className="pt-4 border-t">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">通知频率</h4>
            <p className="text-sm text-muted-foreground">
              设置通知发送的频率
            </p>
          </div>
          <select className="px-3 py-2 rounded-md border bg-background">
            <option value="realtime">实时</option>
            <option value="hourly">每小时</option>
            <option value="daily" selected>每日</option>
            <option value="weekly">每周</option>
          </select>
        </div>
      </div>

      <div className="pt-4 border-t">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">静默时段</h4>
            <p className="text-sm text-muted-foreground">
              设置不接收通知的时间段
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            22:00 - 07:00
          </div>
        </div>
      </div>

      <div className="pt-4 border-t">
        <button className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
          保存通知设置
        </button>
      </div>
    </div>
  )
}