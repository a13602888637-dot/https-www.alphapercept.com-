# 功能修复与部署实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复用户提出的五个关键问题：左侧菜单跳转、自选股功能、Vercel部署、设置页面、股票搜索

**Architecture:** 分阶段实施，先修复基础功能，再优化搜索和部署，使用现有技术栈保持一致性

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Clerk, shadcn/ui, 新浪/腾讯财经API

---

## 第一阶段：基础功能修复

### Task 1: 检查现有仪表板侧边栏

**Files:**
- Read: `components/dashboard-shell.tsx`
- Read: `components/ui/sidebar.tsx` (如果存在)

**Step 1: 查看当前侧边栏结构**

打开文件查看现有导航配置，了解当前有哪些菜单项。

**Step 2: 确认首页路由**

检查`app/dashboard/page.tsx`和`app/page.tsx`，确定正确的首页路由。

**Step 3: 记录需要修改的位置**

在计划文档中标记需要添加首页链接的位置。

### Task 2: 添加首页导航链接

**Files:**
- Modify: `components/dashboard-shell.tsx`

**Step 1: 导入Home图标**

```typescript
import { Home } from 'lucide-react'
```

**Step 2: 在导航配置中添加首页项**

找到导航配置数组，添加：
```typescript
{
  name: "首页",
  href: "/dashboard",
  icon: Home,
}
```

**Step 3: 验证修改**

启动开发服务器，检查侧边栏是否显示首页链接。

### Task 3: 添加Logo点击功能

**Files:**
- Modify: `components/dashboard-shell.tsx`

**Step 1: 导入Link组件**

```typescript
import Link from 'next/link'
```

**Step 2: 找到Logo位置**

在侧边栏顶部找到Logo或标题元素。

**Step 3: 包装为Link**

```typescript
<Link href="/dashboard" className="flex items-center gap-2">
  <div className="h-8 w-8 bg-blue-600 rounded-lg" />
  <span className="text-lg font-bold">Alpha-Quant</span>
</Link>
```

**Step 4: 测试功能**

点击Logo应跳转到仪表板首页。

### Task 4: 创建设置页面基础结构

**Files:**
- Create: `app/settings/page.tsx`
- Create: `app/settings/layout.tsx`

**Step 1: 创建布局文件**

```typescript
// app/settings/layout.tsx
import { DashboardShell } from '@/components/dashboard-shell'

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardShell>{children}</DashboardShell>
}
```

**Step 2: 创建页面文件**

```typescript
// app/settings/page.tsx
export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">设置</h1>
        <p className="text-muted-foreground">
          管理您的账户偏好和通知设置
        </p>
      </div>
      {/* 设置内容将在后续任务中添加 */}
    </div>
  )
}
```

**Step 3: 测试页面访问**

访问`http://localhost:3000/settings`，应显示设置页面而不是404。

### Task 5: 添加Clerk用户信息显示

**Files:**
- Modify: `app/settings/page.tsx`

**Step 1: 导入Clerk hooks**

```typescript
import { useUser } from '@clerk/nextjs'
```

**Step 2: 添加用户信息组件**

```typescript
function UserProfileSection() {
  const { user } = useUser()

  if (!user) return null

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">账户信息</h2>
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-slate-700 flex items-center justify-center">
          {user.firstName?.charAt(0) || user.emailAddresses[0]?.emailAddress?.charAt(0)}
        </div>
        <div>
          <p className="font-medium">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-sm text-muted-foreground">
            {user.emailAddresses[0]?.emailAddress}
          </p>
        </div>
      </div>
    </div>
  )
}
```

**Step 3: 集成到页面**

将组件添加到设置页面中。

---

## 第二阶段：自选股功能修复

### Task 6: 检查现有自选股页面

**Files:**
- Read: `app/portfolio/page.tsx`
- Read: `components/portfolio/*` (如果存在)

**Step 1: 分析当前结构**

查看自选股页面的现有组件和状态管理。

**Step 2: 检查数据源集成**

查看是否已集成新浪/腾讯财经API。

### Task 7: 创建股票搜索组件

**Files:**
- Create: `components/portfolio/stock-search.tsx`

**Step 1: 创建组件基础结构**

```typescript
// components/portfolio/stock-search.tsx
'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface StockSearchProps {
  onSearch: (query: string) => void
}

export function StockSearch({ onSearch }: StockSearchProps) {
  const [query, setQuery] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      onSearch(query.trim())
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜索股票代码或名称..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      <Button type="submit">搜索</Button>
    </form>
  )
}
```

**Step 2: 添加防抖功能**

```typescript
import { useState, useEffect } from 'react'

// 在组件内部添加
useEffect(() => {
  const timer = setTimeout(() => {
    if (query.trim()) {
      onSearch(query.trim())
    }
  }, 300)

  return () => clearTimeout(timer)
}, [query, onSearch])
```

### Task 8: 集成腾讯财经搜索API

**Files:**
- Read: `skills/data_crawler.ts`
- Modify: `app/portfolio/page.tsx`

**Step 1: 检查现有数据抓取函数**

查看`data_crawler.ts`中是否有股票搜索功能。

**Step 2: 创建搜索API路由**

```typescript
// app/api/stocks/search/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: '缺少搜索参数' }, { status: 400 })
  }

  try {
    // 这里调用腾讯财经搜索API
    // 暂时返回模拟数据
    const mockResults = [
      { code: '000001', name: '平安银行', market: 'SZ' },
      { code: '600000', name: '浦发银行', market: 'SH' },
    ].filter(stock =>
      stock.code.includes(query) ||
      stock.name.includes(query)
    )

    return NextResponse.json({ results: mockResults })
  } catch (error) {
    return NextResponse.json({ error: '搜索失败' }, { status: 500 })
  }
}
```

### Task 9: 创建搜索结果组件

**Files:**
- Create: `components/portfolio/search-results.tsx`

**Step 1: 创建组件**

```typescript
// components/portfolio/search-results.tsx
'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface StockResult {
  code: string
  name: string
  market: string
}

interface SearchResultsProps {
  results: StockResult[]
  onAdd: (stock: StockResult) => void
  loading?: boolean
}

export function SearchResults({ results, onAdd, loading }: SearchResultsProps) {
  if (loading) {
    return <div className="text-center py-8">搜索中...</div>
  }

  if (results.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">未找到匹配的股票</div>
  }

  return (
    <div className="space-y-2">
      {results.map((stock) => (
        <Card key={`${stock.market}${stock.code}`}>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{stock.name}</p>
              <p className="text-sm text-muted-foreground">
                {stock.code} ({stock.market})
              </p>
            </div>
            <Button size="sm" onClick={() => onAdd(stock)}>
              添加
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

### Task 10: 集成搜索功能到自选股页面

**Files:**
- Modify: `app/portfolio/page.tsx`

**Step 1: 导入组件和状态**

```typescript
'use client'

import { useState } from 'react'
import { StockSearch } from '@/components/portfolio/stock-search'
import { SearchResults } from '@/components/portfolio/search-results'

interface StockItem {
  code: string
  name: string
  market: string
  addedAt: Date
}

export default function PortfolioPage() {
  const [searchResults, setSearchResults] = useState<StockItem[]>([])
  const [watchlist, setWatchlist] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(false)

  const handleSearch = async (query: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      setSearchResults(data.results || [])
    } catch (error) {
      console.error('搜索失败:', error)
      setSearchResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleAddToWatchlist = (stock: StockItem) => {
    if (!watchlist.find(s => s.code === stock.code && s.market === stock.market)) {
      setWatchlist([...watchlist, { ...stock, addedAt: new Date() }])
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">自选股</h1>
        <p className="text-muted-foreground">管理您关注的股票</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">添加股票</h2>
          <StockSearch onSearch={handleSearch} />
          <SearchResults
            results={searchResults}
            onAdd={handleAddToWatchlist}
            loading={loading}
          />
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">我的自选股</h2>
          {/* 自选股列表将在后续任务中添加 */}
        </div>
      </div>
    </div>
  )
}
```

---

## 第三阶段：Vercel部署

### Task 11: 安装和配置Vercel CLI

**Files:**
- N/A (命令行操作)

**Step 1: 安装Vercel CLI**

```bash
npm i -g vercel
```

**Step 2: 验证安装**

```bash
vercel --version
```

**Step 3: 登录Vercel**

```bash
vercel login
```
使用用户提供的Google账号登录。

### Task 12: 链接项目到Vercel

**Step 1: 初始化Vercel项目**

```bash
vercel link
```

**Step 2: 选择配置**
- 选择"Link to existing project"
- 创建新项目：`alpha-quant-copilot`
- 选择框架：Next.js
- 输出目录：`.next`

**Step 3: 验证配置**

检查生成的`.vercel/project.json`文件。

### Task 13: 配置环境变量

**Step 1: 准备环境变量文件**

复制`.env.local`中的关键变量。

**Step 2: 在Vercel中设置环境变量**

```bash
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
vercel env add CLERK_SECRET_KEY
vercel env add NEXT_PUBLIC_APP_URL
```

**Step 3: 验证环境变量**

```bash
vercel env ls
```

### Task 14: 测试部署

**Step 1: 预览部署**

```bash
vercel
```

**Step 2: 访问预览URL**

检查功能是否正常工作。

**Step 3: 生产部署**

```bash
vercel --prod
```

---

## 第四阶段：设置页面完善

### Task 15: 添加主题切换功能

**Files:**
- Modify: `app/settings/page.tsx`

**Step 1: 导入主题相关组件**

```typescript
import { useTheme } from 'next-themes'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
```

**Step 2: 创建主题切换组件**

```typescript
function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex items-center justify-between">
      <div>
        <Label htmlFor="theme-toggle">深色模式</Label>
        <p className="text-sm text-muted-foreground">
          切换界面主题颜色
        </p>
      </div>
      <Switch
        id="theme-toggle"
        checked={theme === 'dark'}
        onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
      />
    </div>
  )
}
```

### Task 16: 添加通知设置

**Step 1: 创建通知设置组件**

```typescript
function NotificationSettings() {
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [priceAlerts, setPriceAlerts] = useState(true)

  return (
    <div className="space-y-4">
      <h3 className="font-medium">通知设置</h3>

      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="email-notifications">邮件通知</Label>
          <p className="text-sm text-muted-foreground">
            接收系统通知和更新
          </p>
        </div>
        <Switch
          id="email-notifications"
          checked={emailNotifications}
          onCheckedChange={setEmailNotifications}
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="price-alerts">价格提醒</Label>
          <p className="text-sm text-muted-foreground">
            自选股价格变动提醒
          </p>
        </div>
        <Switch
          id="price-alerts"
          checked={priceAlerts}
          onCheckedChange={setPriceAlerts}
        />
      </div>
    </div>
  )
}
```

### Task 17: 完善设置页面布局

**Step 1: 使用卡片组件组织内容**

```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// 在页面中使用
<Card>
  <CardHeader>
    <CardTitle>主题设置</CardTitle>
    <CardDescription>自定义界面外观</CardDescription>
  </CardHeader>
  <CardContent>
    <ThemeToggle />
  </CardContent>
</Card>
```

---

## 第五阶段：测试和验证

### Task 18: 测试左侧菜单功能

**Step 1: 测试首页链接**

点击侧边栏的"首页"链接，应跳转到仪表板。

**Step 2: 测试Logo点击**

点击Logo，应跳转到仪表板。

**Step 3: 测试移动端响应**

检查移动端侧边栏是否正常工作。

### Task 19: 测试自选股功能

**Step 1: 测试股票搜索**

输入股票代码"000001"或名称"平安银行"，应显示搜索结果。

**Step 2: 测试添加股票**

点击"添加"按钮，股票应出现在自选股列表中。

**Step 3: 测试重复添加**

尝试添加已存在的股票，应不会重复添加。

### Task 20: 测试设置页面

**Step 1: 测试页面访问**

未登录用户访问`/settings`应重定向到登录页。

**Step 2: 测试主题切换**

切换深色/浅色模式，界面应相应变化。

**Step 3: 测试通知设置**

切换通知开关，状态应正确保存。

### Task 21: 验证Vercel部署

**Step 1: 访问生产环境**

打开Vercel提供的生产URL。

**Step 2: 测试核心功能**

- 登录/注册
- 自选股添加
- 设置页面
- 实时数据

**Step 3: 检查环境变量**

确保所有环境变量在生产环境正确配置。

---

## 实施说明

### 并行执行建议
根据用户要求，可以使用子代理并行处理以下任务组：

1. **UI修复组** (Task 1-5, 15-17)
   - 左侧菜单优化
   - 设置页面创建
   - 主题和通知设置

2. **功能开发组** (Task 6-10)
   - 自选股搜索功能
   - 股票搜索API
   - 组件集成

3. **部署组** (Task 11-14, 21)
   - Vercel配置
   - 环境变量设置
   - 生产部署验证

### 测试策略
- 每个任务完成后立即测试相关功能
- 使用开发服务器进行本地测试
- 生产环境部署后进行端到端测试

### 提交策略
- 每个功能模块完成后提交
- 使用描述性的提交信息
- 保持提交历史清晰可读

---

**计划完成时间**：预计4-6小时（并行执行可缩短至2-3小时）
**风险点**：新浪/腾讯API稳定性、Vercel环境变量配置、Clerk生产环境集成
**成功标准**：所有五个问题得到解决，生产环境功能正常