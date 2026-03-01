"use client"

import * as React from "react"
import { Bell, Menu, TrendingUp, BarChart3 } from "lucide-react"
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
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
          <SignedIn>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs flex items-center justify-center text-white">
                5
              </span>
            </Button>

            <Button variant="ghost" size="icon">
              <TrendingUp className="h-5 w-5" />
            </Button>

            {/* 使用Clerk的UserButton组件，内置登出功能 */}
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "h-9 w-9",
                },
              }}
            />
          </SignedIn>

          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="outline">
                登录
              </Button>
            </SignInButton>
          </SignedOut>
        </div>
      </div>

      {/* 移动端市场脉搏 */}
      <div className="lg:hidden">
        <MarketPulseMobile />
      </div>
    </header>
  )
}

