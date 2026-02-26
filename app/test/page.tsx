"use client"

import { PageLayout } from "@/components/layout/page-layout"
import { WatchlistToggle, CompactWatchlistToggle, LabeledWatchlistToggle } from "@/components/watchlist/WatchlistToggle"
import { useState } from "react"

const testStocks = [
  { code: "AAPL", name: "苹果公司" },
  { code: "MSFT", name: "微软公司" },
  { code: "GOOGL", name: "谷歌公司" },
  { code: "TSLA", name: "特斯拉公司" },
  { code: "NVDA", name: "英伟达公司" },
]

export default function TestPage() {
  const [events, setEvents] = useState<Array<{ type: string; stockCode: string; timestamp: Date }>>([])

  const handleToggle = (isFavorite: boolean, stockCode: string) => {
    setEvents(prev => [
      ...prev.slice(-9), // 只保留最近10个事件
      { type: isFavorite ? "ADDED" : "REMOVED", stockCode, timestamp: new Date() },
    ])
  }

  const handleStateChange = (state: string, stockCode: string) => {
    console.log(`State changed for ${stockCode}: ${state}`)
  }

  return (
    <PageLayout title="Toggle状态机测试">
      <h1 className="text-3xl font-bold mb-8">Milestone 6.5 - Toggle状态机测试</h1>

      <div className="mb-8 p-6 border rounded-lg bg-card">
        <h2 className="text-xl font-semibold mb-4">关于此测试</h2>
        <p className="text-muted-foreground mb-4">
          此页面测试自选股Toggle状态机与全局Store的实现。点击Toggle按钮会触发乐观UI更新、状态机转换和触觉反馈。
        </p>
        <ul className="list-disc pl-5 space-y-2 text-sm">
          <li><strong>乐观UI</strong>: 点击瞬间按钮状态立即变化（0延迟）</li>
          <li><strong>状态机</strong>: IDLE → OPTIMISTIC_UPDATING → SYNCING → SUCCESS/ROLLBACK_ERROR</li>
          <li><strong>触觉反馈</strong>: 点击时触发设备震动（如果支持）</li>
          <li><strong>视觉反馈</strong>: Pop动画、颜色过渡、成功/错误指示器</li>
          <li><strong>全局状态</strong>: 通过Zustand Store管理，支持跨组件同步</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Toggle组件展示 */}
        <div className="p-6 border rounded-lg">
          <h2 className="text-xl font-semibold mb-6">Toggle组件展示</h2>

          <div className="space-y-8">
            <div>
              <h3 className="font-medium mb-4">标准Toggle (多种样式)</h3>
              <div className="flex flex-wrap items-center gap-4">
                {testStocks.map((stock) => (
                  <div key={stock.code} className="flex flex-col items-center gap-2">
                    <div className="text-sm font-medium">{stock.name}</div>
                    <WatchlistToggle
                      stockCode={stock.code}
                      stockName={stock.name}
                      onToggle={handleToggle}
                      onStateChange={handleStateChange}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-4">紧凑Toggle (用于列表)</h3>
              <div className="flex items-center gap-4">
                {testStocks.slice(0, 3).map((stock) => (
                  <CompactWatchlistToggle
                    key={stock.code}
                    stockCode={stock.code}
                    stockName={stock.name}
                    onToggle={handleToggle}
                    onStateChange={handleStateChange}
                  />
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-4">带标签的Toggle</h3>
              <div className="space-y-4">
                {testStocks.slice(0, 2).map((stock) => (
                  <LabeledWatchlistToggle
                    key={stock.code}
                    stockCode={stock.code}
                    stockName={stock.name}
                    onToggle={handleToggle}
                    onStateChange={handleStateChange}
                  />
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-4">不同变体</h3>
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center gap-2">
                  <div className="text-xs">默认</div>
                  <WatchlistToggle stockCode="TEST1" stockName="测试股票1" variant="default" />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="text-xs">描边</div>
                  <WatchlistToggle stockCode="TEST2" stockName="测试股票2" variant="outline" />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="text-xs">幽灵</div>
                  <WatchlistToggle stockCode="TEST3" stockName="测试股票3" variant="ghost" />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="text-xs">填充</div>
                  <WatchlistToggle stockCode="TEST4" stockName="测试股票4" variant="filled" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 事件日志 */}
        <div className="p-6 border rounded-lg">
          <h2 className="text-xl font-semibold mb-6">事件日志</h2>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">最近操作</span>
              <button
                onClick={() => setEvents([])}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                清空日志
              </button>
            </div>

            {events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无事件，点击上面的Toggle按钮开始测试
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {events.map((event, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded border text-sm ${
                      event.type === "ADDED"
                        ? "border-green-200 bg-green-50"
                        : "border-red-200 bg-red-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${
                          event.type === "ADDED" ? "bg-green-500" : "bg-red-500"
                        }`} />
                        <span className="font-medium">{event.stockCode}</span>
                        <span className="text-muted-foreground">
                          {event.type === "ADDED" ? "已添加到自选股" : "已从自选股移除"}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {event.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 p-4 border rounded bg-muted/30">
            <h3 className="font-medium mb-2">测试说明</h3>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• 点击Toggle按钮触发乐观更新和状态机转换</li>
              <li>• 有10%的概率模拟失败，展示错误状态和重试功能</li>
              <li>• 成功/失败状态会有视觉反馈和短暂提示</li>
              <li>• 状态变化会输出到控制台（F12打开开发者工具）</li>
              <li>• 多次快速点击会排队处理，避免冲突</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-8 p-6 border rounded-lg bg-muted/10">
        <h2 className="text-xl font-semibold mb-4">状态机说明</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="p-4 rounded border text-center">
            <div className="text-lg font-bold text-muted-foreground">IDLE</div>
            <div className="text-sm mt-2">静默状态，等待用户操作</div>
          </div>
          <div className="p-4 rounded border text-center bg-blue-50 border-blue-200">
            <div className="text-lg font-bold text-blue-600">OPTIMISTIC_UPDATING</div>
            <div className="text-sm mt-2">用户点击瞬间，UI立即响应</div>
          </div>
          <div className="p-4 rounded border text-center bg-blue-50 border-blue-200">
            <div className="text-lg font-bold text-blue-600">SYNCING</div>
            <div className="text-sm mt-2">后台同步中，与服务器通信</div>
          </div>
          <div className="p-4 rounded border text-center bg-green-50 border-green-200">
            <div className="text-lg font-bold text-green-600">SUCCESS</div>
            <div className="text-sm mt-2">操作成功，状态确认</div>
          </div>
          <div className="p-4 rounded border text-center bg-red-50 border-red-200">
            <div className="text-lg font-bold text-red-600">ROLLBACK_ERROR</div>
            <div className="text-sm mt-2">操作失败，状态回滚</div>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}