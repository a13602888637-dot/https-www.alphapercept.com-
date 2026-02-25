# 市场脉搏组件库

市场脉搏（大盘指数）UI场域重构组件库，解决前端容器对动态数据流的"承载力"不足问题，提供优雅的信息密度管理。

## 问题诊断

原有市场指数显示存在强制换行问题，本质上是前端容器对动态数据流的"承载力"不足，导致信息密度失衡，视觉呈现上产生了混乱的"能量结块"。

## 解决方案

### 1. 重塑弹性容器（Flexbox）
- 在顶层容器中强制水平排列，拒绝被动换行
- 使用flex-row, justify-between和gap-x来均匀分布四大指数（上证、深证、创业板、北向）

### 2. 信息降噪与层级分明
- 标签（如"上证指数"）：使用较小的字号和次级颜色（如灰色），降低视觉权重
- 点位与涨跌幅：绑定在一个纵向的子容器中（flex-col），点位使用主视觉字体，涨跌幅依据正负值赋予红绿色彩，并保持紧凑

### 3. 防御性设计
- 对数据容器增加whitespace-nowrap属性，确保即使数据变长（如成交量变大）也不会破坏整体的单行横向结构
- 超出部分可使用优雅的溢出隐藏或微缩（text-ellipsis）

### 4. 能量脉冲视觉反馈
- 当指数数据更新时，提供视觉反馈（轻微的高亮或脉冲动画）
- 涨跌幅变化较大时，有更明显的视觉提示

## 组件列表

### 1. `MarketPulseHeader` - 市场脉搏头部组件
完整功能的市场脉搏显示，包含刷新按钮、市场状态、四个指数和更新时间。

**Props:**
- `compact?: boolean` - 紧凑模式
- `showRefresh?: boolean` - 是否显示刷新按钮
- `showStatus?: boolean` - 是否显示市场状态
- `showUpdateTime?: boolean` - 是否显示更新时间
- `gradientBackground?: boolean` - 是否使用渐变背景
- `autoRefresh?: boolean` - 是否自动刷新
- `refreshInterval?: number` - 刷新间隔（毫秒）

### 2. `MarketPulseMobile` - 移动端优化组件
2x2网格布局，适合移动端显示。

### 3. `MarketIndicator` - 单个指数指示器组件
显示单个市场指数的标签、点位和涨跌幅。

**Props:**
- `label: string` - 指数标签（如"上证指数"）
- `value: string` - 点位值
- `change: string` - 涨跌幅
- `rawChange?: number` - 原始涨跌幅数值（用于确定动画强度）
- `isLoading?: boolean` - 加载状态
- `error?: string` - 错误信息
- `isActive?: boolean` - 是否激活脉冲动画
- `pulseIntensity?: 'low' | 'medium' | 'high'` - 脉冲强度
- `compact?: boolean` - 紧凑模式

### 4. `PulseAnimation` - 脉冲动画组件
提供数据更新时的视觉反馈动画。

### 5. `useMarketPulse` - 市场脉搏数据Hook
获取市场指数数据的React Hook，支持自动刷新和错误处理。

## 使用示例

### 集成到主布局顶部
```tsx
import { MarketPulseHeader } from "@/components/market-pulse/MarketPulseHeader"

function Layout() {
  return (
    <>
      <MarketPulseHeader />
      {/* 其他内容 */}
    </>
  )
}
```

### 集成到现有Header中（紧凑版）
```tsx
<MarketPulseHeader
  compact={true}
  showRefresh={false}
  showStatus={false}
  showUpdateTime={false}
  gradientBackground={false}
/>
```

### 移动端集成
```tsx
import { MarketPulseMobile } from "@/components/market-pulse/MarketPulseHeader"

function MobileLayout() {
  return (
    <>
      <MarketPulseMobile />
      {/* 其他内容 */}
    </>
  )
}
```

### 使用数据Hook
```tsx
import { useMarketPulse } from "@/hooks/useMarketPulse"

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
}
```

## 设计规范

### 容器样式
```css
<div className="flex flex-row items-center justify-between gap-x-4 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
  {/* 四个指数均匀分布 */}
</div>
```

### 单个指数样式
```css
<div className="flex flex-col items-center whitespace-nowrap min-w-0">
  <div className="text-xs text-gray-500">{label}</div>
  <div className="text-lg font-bold">{value}</div>
  <div className={`text-sm font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
    {change >= 0 ? '+' : ''}{change}%
  </div>
</div>
```

### 动画效果
- 数据更新时：bg-blue-100脉冲然后渐变回原色
- 涨跌幅较大时：更明显的颜色强调

## 响应式设计

### 桌面端
- 单行水平排列四个指数
- 显示完整控制元素（刷新按钮、状态、更新时间）

### 移动端
- 2x2网格布局
- 适当缩小字体，保持可读性
- 简化控制元素

### 超小屏幕
- 考虑隐藏北向资金或使用图标替代
- 进一步缩小字体

## 测试页面

访问 `/market-pulse-test` 查看所有组件的演示和示例。

## 技术依赖

- React 19
- TypeScript
- Tailwind CSS
- Framer Motion（动画）
- 现有 `market-indicators.ts` 数据服务

## 文件结构

```
components/market-pulse/
├── MarketPulseHeader.tsx    # 市场脉搏头部组件
├── MarketIndicator.tsx      # 单个指数指示器组件
├── PulseAnimation.tsx       # 脉冲动画组件
└── README.md               # 本文档

hooks/
└── useMarketPulse.ts       # 市场脉搏数据Hook
```

## 更新日志

### v1.0.0 (2026-02-24)
- 初始版本发布
- 实现市场脉搏UI场域重构
- 解决强制换行问题
- 添加脉冲动画反馈
- 支持响应式设计