"use client";

import { WatchlistWithGestures } from "@/components/watchlist/gestures/WatchlistWithGestures";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
            <Tabs defaultValue="libraries" className="w-full">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="libraries">依赖库</TabsTrigger>
                <TabsTrigger value="components">组件架构</TabsTrigger>
                <TabsTrigger value="physics">物理模型</TabsTrigger>
              </TabsList>
              <TabsContent value="libraries" className="space-y-4 pt-4">
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
              </TabsContent>
              <TabsContent value="components" className="space-y-4 pt-4">
                <div className="space-y-4">
                  <div>
                    <div className="font-medium">组件架构</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      采用分层架构，每个手势功能独立封装
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">1. useDragReorder.ts</div>
                      <div className="text-xs text-muted-foreground">
                        拖拽排序自定义Hook，处理拖拽逻辑和动画
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">2. useSwipeActions.ts</div>
                      <div className="text-xs text-muted-foreground">
                        滑动操作自定义Hook，处理左右滑动手势
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">3. useLongPressPreview.ts</div>
                      <div className="text-xs text-muted-foreground">
                        长按预览自定义Hook，处理长按手势和预览面板
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">4. physics.ts</div>
                      <div className="text-xs text-muted-foreground">
                        物理工具函数，提供阻尼、弹性、吸附等计算
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="physics" className="space-y-4 pt-4">
                <div className="space-y-4">
                  <div>
                    <div className="font-medium">物理参数配置</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      精心调校的物理参数，确保交互自然流畅
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">阻尼系数</div>
                      <div className="text-xs text-muted-foreground">0.8</div>
                      <div className="text-xs">控制拖拽阻力和惯性</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">弹性系数</div>
                      <div className="text-xs text-muted-foreground">0.3</div>
                      <div className="text-xs">控制回弹强度和速度</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">吸附阈值</div>
                      <div className="text-xs text-muted-foreground">100px</div>
                      <div className="text-xs">自动吸附到目标位置</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">长按时长</div>
                      <div className="text-xs text-muted-foreground">500ms</div>
                      <div className="text-xs">触发预览的按压时间</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">滑动阈值</div>
                      <div className="text-xs text-muted-foreground">80px</div>
                      <div className="text-xs">触发操作的最小滑动距离</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">动画时长</div>
                      <div className="text-xs text-muted-foreground">300ms</div>
                      <div className="text-xs">缓动函数动画持续时间</div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* 主演示区域 */}
        <Card>
          <CardHeader>
            <CardTitle>🔄 交互演示</CardTitle>
            <CardDescription>
              尝试以下手势交互：拖拽排序、滑动操作、长按预览
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WatchlistWithGestures />
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
                  npm install @use-gesture/react
                </pre>
              </div>
              <div className="space-y-2">
                <div className="font-medium">2. 包装现有WatchlistItem</div>
                <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto">
{`// 在现有WatchlistItem外部包裹手势组件
<SwipeActions
  stockCode={item.stockCode}
  stockName={item.stockName}
  onRemove={handleRemove}
  onSetReminder={handleSetReminder}
>
  <LongPressPreview
    stockCode={item.stockCode}
    stockName={item.stockName}
    currentPrice={priceData?.price}
  >
    <YourExistingWatchlistItem {...props} />
  </LongPressPreview>
</SwipeActions>`}
                </pre>
              </div>
              <div className="space-y-2">
                <div className="font-medium">3. 添加拖拽排序容器</div>
                <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto">
{`// 在Watchlist列表容器中使用
<DragReorderProvider items={items} onReorder={handleReorder}>
  <DragReorderContainer>
    {items.map((item, index) => (
      <DragReorderItemWrapper key={item.id} index={index}>
        {/* 包装后的WatchlistItem */}
      </DragReorderItemWrapper>
    ))}
  </DragReorderContainer>
</DragReorderProvider>`}
                </pre>
              </div>
              <div className="space-y-2">
                <div className="font-medium">4. 连接到现有Store</div>
                <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto">
{`// 使用现有的watchlist-store
const reorderItems = useWatchlistStore((state) => state.reorderItems);

const handleReorder = (fromIndex: number, toIndex: number) => {
  // 更新本地状态
  const newOrder = ...;
  // 同步到store
  reorderItems(newOrder);
};`}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 性能提示 */}
        <Card>
          <CardHeader>
            <CardTitle>🚀 性能优化</CardTitle>
            <CardDescription>确保手势交互的流畅性和响应性</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="font-medium">动画优化</div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• 使用will-change属性提示浏览器优化</li>
                  <li>• 避免在动画中修改布局属性</li>
                  <li>• 使用transform和opacity实现动画</li>
                  <li>• 合理使用requestAnimationFrame</li>
                </ul>
              </div>
              <div className="space-y-3">
                <div className="font-medium">手势优化</div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• 使用passive事件监听器提高滚动性能</li>
                  <li>• 合理设置手势识别阈值</li>
                  <li>• 及时清理事件监听器</li>
                  <li>• 使用防抖和节流控制频率</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}