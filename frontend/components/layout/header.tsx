"use client"

import * as React from "react"
import { Search, Bell, User, Menu, TrendingUp, BarChart3 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const [searchQuery, setSearchQuery] = React.useState("")

  const marketIndicators = [
    { label: "上证指数", value: "3,245.67", change: "+1.23%" },
    { label: "深证成指", value: "10,523.89", change: "+0.89%" },
    { label: "创业板指", value: "2,156.34", change: "+2.15%" },
    { label: "北向资金", value: "+15.2亿", change: "+" },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* 左侧：菜单按钮和品牌 */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="md:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div className="hidden md:block">
              <h1 className="text-lg font-bold">Alpha-Quant-Copilot</h1>
              <p className="text-xs text-muted-foreground">AI量化交易助手</p>
            </div>
          </div>

          {/* 市场指标 */}
          <div className="hidden lg:flex items-center space-x-6 ml-6">
            {marketIndicators.map((indicator, index) => (
              <div key={index} className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">
                  {indicator.label}
                </span>
                <div className="flex items-center">
                  <span className="font-semibold">{indicator.value}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "ml-2 text-xs",
                      indicator.change.startsWith("+")
                        ? "bg-green-500/10 text-green-500"
                        : "bg-red-500/10 text-red-500"
                    )}
                  >
                    {indicator.change}
                  </Badge>
                </div>
                {index < marketIndicators.length - 1 && (
                  <Separator orientation="vertical" className="h-4" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 中间：搜索框 */}
        <div className="flex-1 max-w-2xl mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索股票、策略或新闻..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* 右侧：用户操作 */}
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs flex items-center justify-center text-white">
              5
            </span>
          </Button>

          <Button variant="ghost" size="icon">
            <TrendingUp className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>我的账户</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>个人资料</DropdownMenuItem>
              <DropdownMenuItem>投资组合</DropdownMenuItem>
              <DropdownMenuItem>交易记录</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>设置</DropdownMenuItem>
              <DropdownMenuItem>帮助中心</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-500">
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 移动端市场指标 */}
      <div className="lg:hidden border-t">
        <div className="container px-4 py-2">
          <div className="grid grid-cols-2 gap-2">
            {marketIndicators.map((indicator, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {indicator.label}
                </span>
                <div className="flex items-center">
                  <span className="text-sm font-semibold">{indicator.value}</span>
                  <span
                    className={cn(
                      "ml-1 text-xs",
                      indicator.change.startsWith("+")
                        ? "text-green-500"
                        : "text-red-500"
                    )}
                  >
                    {indicator.change}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </header>
  )
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ")
}