# 全局搜索模块

完整的全局搜索功能实现，支持搜索历史、热门推荐、实时价格展示和快速添加到自选股。

## 功能特性

### 1. 核心功能
- ✅ Spotlight风格的下拉面板
- ✅ 300ms防抖搜索，减少API调用
- ✅ 实时价格数据展示（价格、涨跌幅、成交量）
- ✅ 快速添加到自选股按钮
- ✅ 点击跳转到个股详情页
- ✅ 搜索历史管理（localStorage持久化）
- ✅ 热门股票推荐（涨幅榜前10）

### 2. 数据流程

```
用户输入
  ↓ (300ms防抖)
调用 /api/stocks/search?q={query}
  ↓
获取股票列表
  ↓
并行调用 /api/stock-prices?symbols={codes}
  ↓
合并搜索结果和价格数据
  ↓
检查是否在自选股中
  ↓
渲染结果列表
```

### 3. 搜索历史管理

- **存储位置**: `localStorage`
- **键名**: `search-history`
- **最大数量**: 10条
- **去重逻辑**: 新搜索的关键词移到最前
- **功能**:
  - 点击历史记录重新搜索
  - 单独删除历史项
  - 清除全部历史

### 4. 热门股票

- **数据源**: `/api/stocks/hot`
- **更新频率**: 组件挂载时获取
- **展示数量**: 前10支涨幅榜股票
- **显示信息**: 股票名称、代码、价格、涨跌幅、成交量

## 组件结构

```
components/global-search/
├── types.ts                 # TypeScript类型定义
├── GlobalSearchBar.tsx      # 主搜索栏组件
├── SearchResults.tsx        # 搜索结果列表
├── SearchDefault.tsx        # 默认界面（历史+热门）
├── SearchResultItem.tsx     # 单个搜索结果项
├── useSearchHistory.ts      # 搜索历史Hook
├── index.ts                 # 统一导出
└── README.md               # 本文档
```

## 使用方法

### 基本使用

```tsx
import { GlobalSearchBar } from "@/components/global-search";

export function MyComponent() {
  return (
    <div>
      <GlobalSearchBar />
    </div>
  );
}
```

### 已集成位置

全局搜索栏已集成到主布局的顶部导航栏中：

- **文件**: `components/layout/header.tsx`
- **位置**: 导航栏中央区域
- **响应式**: 自适应桌面端和移动端

## API依赖

### 1. 股票搜索API

**端点**: `GET /api/stocks/search?q={query}`

**响应格式**:
```json
{
  "success": true,
  "data": [
    {
      "code": "600519",
      "name": "贵州茅台",
      "market": "SH"
    }
  ]
}
```

### 2. 股票价格API

**端点**: `GET /api/stock-prices?symbols={codes}`

**响应格式**:
```json
{
  "success": true,
  "prices": {
    "600519": {
      "price": 1680.00,
      "change": 20.50,
      "changePercent": 2.35,
      "volume": 1234567,
      "turnover": 8765432100
    }
  }
}
```

### 3. 热门股票API

**端点**: `GET /api/stocks/hot`

**响应格式**:
```json
{
  "success": true,
  "data": [
    {
      "code": "600519",
      "name": "贵州茅台",
      "market": "SH",
      "changePercent": 3.52,
      "currentPrice": 1680.0,
      "volume": 1234567,
      "industry": "白酒"
    }
  ]
}
```

## 自定义配置

### 修改防抖时间

在 `GlobalSearchBar.tsx` 中修改防抖延迟：

```tsx
const timer = setTimeout(() => {
  performSearch(value);
}, 300); // 修改这个值（毫秒）
```

### 修改历史记录数量

在 `useSearchHistory.ts` 中修改最大历史数量：

```tsx
const MAX_HISTORY_ITEMS = 10; // 修改这个值
```

### 修改热门股票数量

在 `SearchDefault.tsx` 中修改显示数量：

```tsx
{hotStocks.slice(0, 10).map((stock) => (
  // 修改 slice 的参数
))}
```

## 移动端优化

### 响应式设计
- 搜索面板在小屏幕上自适应宽度
- 触摸友好的点击区域
- 滚动优化（最大高度限制）

### 性能优化
- 防抖减少API调用
- 点击外部自动关闭面板
- 组件卸载时清理定时器

## 扩展功能（未来）

- [ ] 搜索建议（输入时显示联想）
- [ ] 支持搜索新闻和策略
- [ ] 搜索结果排序选项
- [ ] 高级过滤（行业、市值等）
- [ ] 键盘快捷键支持（Cmd+K）
- [ ] 搜索分析（统计常搜股票）

## 故障排除

### 搜索无结果

1. 检查 `/api/stocks/search` API是否正常
2. 查看浏览器控制台是否有错误
3. 确认输入的股票代码或名称正确

### 价格数据不显示

1. 检查 `/api/stock-prices` API是否正常
2. 确认股票代码格式正确
3. 查看是否有API限流

### 热门股票不显示

1. 检查 `/api/stocks/hot` API是否正常
2. 查看浏览器控制台错误日志
3. 确认API返回数据格式正确

### 搜索历史丢失

1. 检查浏览器是否支持localStorage
2. 确认没有清除浏览器缓存
3. 查看是否有localStorage存储限制

## 更新日志

### v1.0.0 (2026-02-28)
- ✅ 初始版本发布
- ✅ 完整的搜索功能
- ✅ 搜索历史管理
- ✅ 热门股票推荐
- ✅ 实时价格展示
- ✅ 自选股集成
- ✅ 移动端优化

## 许可证

MIT
