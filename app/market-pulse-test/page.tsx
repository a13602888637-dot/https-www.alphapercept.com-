"use client"

import { MarketPulseHeader, MarketPulseMobile } from "@/components/market-pulse/MarketPulseHeader"
import { MarketIndicator } from "@/components/market-pulse/MarketIndicator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default function MarketPulseTestPage() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">市场脉搏组件测试</h1>
        <p className="text-gray-600 dark:text-gray-400">
          测试市场脉搏UI场域重构的各种组件变体
        </p>
      </div>

      {/* 完整版市场脉搏头部 */}
      <Card>
        <CardHeader>
          <CardTitle>完整版市场脉搏头部</CardTitle>
          <CardDescription>包含刷新按钮、市场状态、四个指数和更新时间</CardDescription>
        </CardHeader>
        <CardContent>
          <MarketPulseHeader />
        </CardContent>
      </Card>

      {/* 紧凑版市场脉搏头部 */}
      <Card>
        <CardHeader>
          <CardTitle>紧凑版市场脉搏头部</CardTitle>
          <CardDescription>适合集成到现有Header中的紧凑版本</CardDescription>
        </CardHeader>
        <CardContent>
          <MarketPulseHeader
            compact={true}
            showRefresh={false}
            showStatus={false}
            showUpdateTime={false}
            gradientBackground={false}
          />
        </CardContent>
      </Card>

      {/* 移动端优化版本 */}
      <Card>
        <CardHeader>
          <CardTitle>移动端优化版本</CardTitle>
          <CardDescription>2x2网格布局，适合移动端显示</CardDescription>
        </CardHeader>
        <CardContent>
          <MarketPulseMobile />
        </CardContent>
      </Card>

      <Separator />

      {/* 单个指数指示器示例 */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">单个指数指示器示例</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">上证指数</CardTitle>
            </CardHeader>
            <CardContent>
              <MarketIndicator
                label="上证指数"
                value="3,245.67"
                change="+1.23%"
                rawChange={1.23}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">深证成指</CardTitle>
            </CardHeader>
            <CardContent>
              <MarketIndicator
                label="深证成指"
                value="10,523.89"
                change="-0.45%"
                rawChange={-0.45}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">创业板指</CardTitle>
            </CardHeader>
            <CardContent>
              <MarketIndicator
                label="创业板指"
                value="2,156.34"
                change="+2.15%"
                rawChange={2.15}
                isActive={true}
                pulseIntensity="high"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">北向资金</CardTitle>
            </CardHeader>
            <CardContent>
              <MarketIndicator
                label="北向资金"
                value="+15.2亿"
                change="+"
                compact={true}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 加载状态示例 */}
      <Card>
        <CardHeader>
          <CardTitle>加载状态</CardTitle>
          <CardDescription>数据加载时的骨架屏效果</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-row items-center justify-between gap-x-4">
            {[1, 2, 3, 4].map((i) => (
              <MarketIndicator
                key={i}
                label={`指数${i}`}
                value="加载中"
                change="--"
                isLoading={true}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 错误状态示例 */}
      <Card>
        <CardHeader>
          <CardTitle>错误状态</CardTitle>
          <CardDescription>数据获取失败时的降级显示</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-row items-center justify-between gap-x-4">
            <MarketIndicator
              label="上证指数"
              value="--"
              change="--"
              error="数据获取失败"
            />
            <MarketIndicator
              label="深证成指"
              value="--"
              change="--"
              error="数据获取失败"
            />
            <MarketIndicator
              label="创业板指"
              value="--"
              change="--"
              error="数据获取失败"
            />
            <MarketIndicator
              label="北向资金"
              value="--"
              change="--"
              error="数据获取失败"
            />
          </div>
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card className="bg-blue-50 dark:bg-blue-900/20">
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
          <CardDescription>市场脉搏组件集成指南</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">核心特性</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li><strong>弹性容器</strong>：使用Flexbox强制水平排列，拒绝被动换行</li>
              <li><strong>信息降噪</strong>：标签使用小字号和次级颜色，降低视觉权重</li>
              <li><strong>防御性设计</strong>：whitespace-nowrap确保数据变长不破坏布局</li>
              <li><strong>能量脉冲反馈</strong>：数据更新时提供视觉反馈动画</li>
              <li><strong>响应式设计</strong>：桌面端单行显示，移动端2x2网格布局</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">集成方式</h3>
            <div className="text-sm space-y-2">
              <p><strong>1. 主布局顶部集成：</strong></p>
              <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs overflow-x-auto">
{`import { MarketPulseHeader } from "@/components/market-pulse/MarketPulseHeader"

// 在布局顶部添加
<MarketPulseHeader />`}
              </pre>

              <p><strong>2. 现有Header中集成（紧凑版）：</strong></p>
              <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs overflow-x-auto">
{`<MarketPulseHeader
  compact={true}
  showRefresh={false}
  showStatus={false}
  showUpdateTime={false}
  gradientBackground={false}
/>`}
              </pre>

              <p><strong>3. 移动端集成：</strong></p>
              <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs overflow-x-auto">
{`import { MarketPulseMobile } from "@/components/market-pulse/MarketPulseHeader"

// 在移动端布局中添加
<MarketPulseMobile />`}
              </pre>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">数据Hook</h3>
            <p className="text-sm">
              使用 <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">useMarketPulse</code> Hook 可以获取市场指数数据，支持自动刷新和错误处理。
            </p>
            <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs overflow-x-auto">
{`import { useMarketPulse } from "@/hooks/useMarketPulse"

function MyComponent() {
  const {
    indicators,
    isLoading,
    error,
    lastUpdateTime,
    marketStatus,
    refresh
  } = useMarketPulse(30000) // 30秒刷新间隔

  // 使用数据...
}`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}