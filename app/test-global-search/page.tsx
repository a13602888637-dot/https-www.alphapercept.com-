"use client";

import { GlobalSearchBar } from "@/components/global-search";

/**
 * 全局搜索功能测试页面
 */
export default function TestGlobalSearchPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* 页面标题 */}
        <div>
          <h1 className="text-3xl font-bold mb-2">全局搜索功能测试</h1>
          <p className="text-muted-foreground">
            测试全局搜索栏的各项功能：搜索、历史记录、热门推荐、添加自选股
          </p>
        </div>

        {/* 功能说明 */}
        <div className="bg-muted rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold">测试项目</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">1.</span>
              <span>
                <strong>基础搜索</strong>：输入股票代码或名称（如"贵州茅台"或"600519"），
                查看搜索结果是否正确显示
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">2.</span>
              <span>
                <strong>防抖功能</strong>：快速输入多个字符，观察是否在停止输入300ms后才发起请求
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">3.</span>
              <span>
                <strong>搜索历史</strong>：清空输入框，查看搜索历史是否保存。
                点击历史记录应重新搜索
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">4.</span>
              <span>
                <strong>热门推荐</strong>：清空输入框，查看是否显示热门股票列表
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">5.</span>
              <span>
                <strong>价格数据</strong>：搜索结果应显示实时价格、涨跌幅、成交量等信息
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">6.</span>
              <span>
                <strong>添加自选股</strong>：点击搜索结果的"+"按钮，应能添加到自选股
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">7.</span>
              <span>
                <strong>跳转详情</strong>：点击搜索结果（非按钮区域），应跳转到个股详情页
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">8.</span>
              <span>
                <strong>清除功能</strong>：点击输入框的"X"按钮，应清空搜索内容
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">9.</span>
              <span>
                <strong>点击外部关闭</strong>：点击搜索面板外部，面板应自动关闭
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">10.</span>
              <span>
                <strong>加载状态</strong>：搜索时应显示加载图标
              </span>
            </li>
          </ul>
        </div>

        {/* 全局搜索栏 */}
        <div className="bg-card rounded-lg border p-8">
          <h2 className="text-xl font-semibold mb-4">搜索栏测试区</h2>
          <GlobalSearchBar />
        </div>

        {/* 技术信息 */}
        <div className="bg-muted rounded-lg p-6 space-y-3">
          <h2 className="text-xl font-semibold">技术细节</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <strong className="block text-muted-foreground mb-1">防抖时间</strong>
              <span>300ms</span>
            </div>
            <div>
              <strong className="block text-muted-foreground mb-1">搜索历史数量</strong>
              <span>最多10条</span>
            </div>
            <div>
              <strong className="block text-muted-foreground mb-1">热门股票数量</strong>
              <span>前10支</span>
            </div>
            <div>
              <strong className="block text-muted-foreground mb-1">存储位置</strong>
              <span>localStorage (search-history)</span>
            </div>
            <div>
              <strong className="block text-muted-foreground mb-1">搜索API</strong>
              <span>/api/stocks/search</span>
            </div>
            <div>
              <strong className="block text-muted-foreground mb-1">价格API</strong>
              <span>/api/stock-prices</span>
            </div>
            <div>
              <strong className="block text-muted-foreground mb-1">热门API</strong>
              <span>/api/stocks/hot</span>
            </div>
            <div>
              <strong className="block text-muted-foreground mb-1">响应式</strong>
              <span>支持桌面端和移动端</span>
            </div>
          </div>
        </div>

        {/* 开发者工具提示 */}
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">开发者工具</h2>
          <p className="text-sm text-muted-foreground mb-3">
            打开浏览器开发者工具（F12）查看：
          </p>
          <ul className="space-y-1 text-sm">
            <li>• <strong>Console</strong>: 查看API请求和错误日志</li>
            <li>• <strong>Network</strong>: 监控API调用频率和响应时间</li>
            <li>• <strong>Application → Local Storage</strong>: 查看搜索历史数据</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
