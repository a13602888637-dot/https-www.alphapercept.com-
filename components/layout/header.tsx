"use client"

import * as React from "react"
import { Bell, User, Menu, TrendingUp, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MarketPulseHeader, MarketPulseMobile } from "@/components/market-pulse/MarketPulseHeader"
import { GlobalSearchBar } from "@/components/global-search"

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
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

          {/* 桌面端市场脉搏 */}
          <div className="hidden lg:block ml-6 flex-1 max-w-2xl">
            <MarketPulseHeader
              compact={true}
              showRefresh={false}
              showStatus={false}
              showUpdateTime={false}
              gradientBackground={false}
              className="py-1"
            />
          </div>
        </div>

        {/* 中间：全局搜索栏 */}
        <div className="flex-1 max-w-2xl mx-4">
          <GlobalSearchBar />
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

      {/* 移动端市场脉搏 */}
      <div className="lg:hidden">
        <MarketPulseMobile />
      </div>
    </header>
  )
}

