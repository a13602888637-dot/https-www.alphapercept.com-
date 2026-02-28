"use client"

import * as React from "react"
import {
  BarChart3,
  Bell,
  Brain,
  Home,
  MessageSquare,
  Settings,
  TrendingUp,
  Users,
  Wallet,
  Zap,
  Star,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "./theme-toggle"

const navItems = [
  {
    title: "首页",
    icon: Home,
    href: "/dashboard",
  },
  {
    title: "自选股",
    icon: Star,
    href: "/watchlist",
  },
  {
    title: "实时市场",
    icon: BarChart3,
    href: "/live-feed",
  },
  {
    title: "策略推荐",
    icon: Brain,
    href: "/strategy-recommendation",
  },
  {
    title: "AI助手",
    icon: MessageSquare,
    href: "/ai-assistant",
  },
  {
    title: "投资组合",
    icon: Wallet,
    href: "/portfolio",
  },
  {
    title: "设置",
    icon: Settings,
    href: "/settings",
  },
]

const quickActions = [
  {
    title: "快速分析",
    icon: Zap,
    description: "一键市场扫描",
    onClick: () => window.location.href = "/dashboard",
  },
  {
    title: "趋势预测",
    icon: TrendingUp,
    description: "明日走势预测",
    onClick: () => window.location.href = "/dashboard",
  },
]

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className={cn("pb-12", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <Link href="/dashboard" className="flex items-center space-x-2 px-4 mb-6">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Alpha-Quant</h2>
              <p className="text-xs text-muted-foreground">AI量化助手</p>
            </div>
          </Link>

          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
              return (
                <Link href={item.href} key={item.title}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className="w-full justify-start"
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.title}
                  </Button>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="px-3 py-2">
          <div className="px-4 mb-2">
            <h3 className="text-sm font-semibold">快速操作</h3>
          </div>
          <div className="space-y-1">
            {quickActions.map((action) => (
              <Button
                key={action.title}
                variant="outline"
                className="w-full justify-start h-auto py-3"
                onClick={action.onClick}
              >
                <div className="flex items-center">
                  <action.icon className="mr-2 h-4 w-4" />
                  <div className="text-left">
                    <div className="font-medium">{action.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {action.description}
                    </div>
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </div>

        <div className="px-3 py-2">
          <div className="px-4 mb-2">
            <h3 className="text-sm font-semibold">系统状态</h3>
          </div>
          <div className="space-y-2 px-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">数据更新</span>
              <span className="font-medium text-green-500">实时</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">AI模型</span>
              <span className="font-medium">DeepSeek</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">连接状态</span>
              <span className="font-medium text-green-500">正常</span>
            </div>
          </div>
        </div>

        <div className="px-3 py-2">
          <div className="flex items-center justify-between px-4">
            <ThemeToggle />
            <Button variant="outline" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}