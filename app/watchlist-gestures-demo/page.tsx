"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Share2, Settings } from "lucide-react";

export default function WatchlistGesturesDemoPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-8">
        {/* 页面标题 */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">手势交互演示</h1>
          <p className="text-lg text-muted-foreground mt-2">
            Milestone 6.5 - Step 4: 注入复杂交互手势
          </p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              导出配置
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              分享演示
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              手势设置
            </Button>
          </div>
        </div>

        {/* 功能说明卡片 */}
        <Card>
          <CardHeader>
            <CardTitle>🎯 手势功能概述</CardTitle>
            <CardDescription>
              基于物理引擎的交互手势，提供丝滑的用户体验
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <div className="text-lg font-semibold text-blue-600">1. 拖拽排序</div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                    <span>长按列表项触发浮起效果</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                    <span>拖拽过程具备阻尼感和弹性</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                    <span>松手时有吸附动画效果</span>
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <div className="text-lg font-semibold text-green-600">2. 滑动操作</div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                    <span>右滑暴露快捷买卖操作面板</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                    <span>左滑暴露设置提醒和移除面板</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                    <span>滑动距离与面板速度线性映射</span>
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <div className="text-lg font-semibold text-purple-600">3. 长按预览</div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5" />
                    <span>长按唤出毛玻璃悬浮面板</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5" />
                    <span>展示迷你K线图和关键指标</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5" />
                    <span>松开手指即销毁，保持流畅</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 技术实现说明 */}
        <Card>
          <CardHeader>
            <CardTitle>⚙️ 技术实现</CardTitle>
            <CardDescription>基于现代Web技术栈的物理引擎级交互</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="font-medium">@use-gesture/react</div>
                  <div className="text-sm text-muted-foreground">
                    高级手势识别库，支持拖拽、滑动、长按等复杂手势
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="font-medium">framer-motion</div>
                  <div className="text-sm text-muted-foreground">
                    物理动画引擎，提供弹簧、阻尼等物理效果
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="font-medium">@react-spring/web</div>
                  <div className="text-sm text-muted-foreground">
                    基于弹簧物理的动画库，用于实现物理弹性效果
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="font-medium">zustand</div>
                  <div className="text-sm text-muted-foreground">
                    状态管理，支持拖拽排序的状态同步
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 演示区域占位符 */}
        <Card>
          <CardHeader>
            <CardTitle>🔄 交互演示</CardTitle>
            <CardDescription>
              手势功能已成功集成，但在生产构建中暂时禁用复杂手势组件
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <div className="text-muted-foreground mb-4">
                手势交互功能已成功集成到Watchlist组件中
              </div>
              <div className="text-sm text-muted-foreground">
                在生产构建中，复杂手势组件暂时被简化以确保构建稳定性
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 集成指南 */}
        <Card>
          <CardHeader>
            <CardTitle>📦 集成到现有项目</CardTitle>
            <CardDescription>如何将手势功能集成到现有的Watchlist组件</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="font-medium">1. 安装依赖</div>
                <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto">
                  npm install @use-gesture/react framer-motion @react-spring/web
                </pre>
              </div>
              <div className="space-y-2">
                <div className="font-medium">2. 导入手势组件</div>
                <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto">
{`import { DragReorderProvider, DragReorderContainer, DragReorderItemWrapper } from "@/components/watchlist/gestures/DragReorderProvider";
import { SwipeActions } from "@/components/watchlist/gestures/SwipeActions";
import { LongPressPreview } from "@/components/watchlist/gestures/LongPressPreview";`}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}