# 统一检索前端集成指南

## 已完成的工作

### 1. 增强的搜索结果组件 (/components/portfolio/search-results.tsx)

新增了支持分组结果的组件:
- `SearchResultGroup` 接口: 定义数据源分组结构
- `GroupedSearchResults` 组件: 渲染分组搜索结果
- 支持多数据源(akshare, mock, external)
- 显示每个数据源的响应时间和错误信息
- 支持更多市场类型(SH, SZ, BJ, US, HK)

### 2. 统一检索自定义 Hook (/lib/hooks/useUnifiedSearch.ts)

提供了简洁的 API 调用接口:
```typescript
const { search, reset, loading, results, error } = useUnifiedSearch()

// 使用方式
search("600519") // 搜索
reset() // 重置状态
```

## 待集成的位置

### 主要集成点 1: StockSearchInput 组件
**文件**: `/components/watchlist/StockSearchInput.tsx`

**当前状态**: 使用本地硬编码的股票数据库

**集成方案**:
```typescript
import { useUnifiedSearch } from '@/lib/hooks/useUnifiedSearch'
import { SearchResultGroup } from '@/components/portfolio/search-results'

export function StockSearchInput({ onSelect, placeholder }: StockSearchInputProps) {
  const { search, results, loading, error } = useUnifiedSearch()

  // 将防抖后的查询发送到统一检索API
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      if (query.trim().length >= 2) {
        search(query)
      }
    }, 300)

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [query, search])

  // 将 results (SearchResultGroup[]) 扁平化为简单列表显示
  const flatResults = results.flatMap(group => group.results)

  // 渲染结果时使用 flatResults
}
```

**替换范围**:
- 移除第 27-52 行的本地 stockDatabase
- 替换第 55-76 行的 searchStocks 函数逻辑
- 使用统一检索 API 替代本地搜索

### 主要集成点 2: WatchlistManager 添加股票对话框
**文件**: `/components/watchlist/WatchlistManager.tsx`

**当前状态**: 使用 StockSearchInput 组件(第 435-444 行)

**集成方案**:
当 StockSearchInput 升级后,此处会自动获益,无需额外修改

### 主要集成点 3: 自选股页面
**文件**: `/app/watchlist/page.tsx`

**当前状态**: 通过 WatchlistManager 间接使用搜索功能

**集成方案**:
无需直接修改,通过组件更新自动获益

## 集成步骤

### 第一阶段: 基础集成 (推荐)
1. 修改 `StockSearchInput.tsx`:
   - 导入 `useUnifiedSearch` hook
   - 移除本地 stockDatabase
   - 使用统一检索 API
   - 保持现有 UI 和交互逻辑

2. 测试场景:
   - 搜索 A 股代码: `600519`
   - 搜索 A 股名称: `茅台`
   - 搜索美股: `AAPL`
   - 无效输入: `xyz123`

### 第二阶段: 高级集成 (可选)
1. 创建新的分组搜索组件:
   ```typescript
   // components/watchlist/GroupedStockSearch.tsx
   import { GroupedSearchResults } from '@/components/portfolio/search-results'
   import { useUnifiedSearch } from '@/lib/hooks/useUnifiedSearch'

   export function GroupedStockSearch() {
     const { search, results, loading } = useUnifiedSearch()
     // 使用 GroupedSearchResults 显示完整的分组信息
   }
   ```

2. 在仪表板或高级搜索页面使用:
   - 显示多数据源结果
   - 展示响应时间对比
   - 提供数据源切换选项

## API 端点

**统一检索 API**: `GET /api/unified-search?query={searchQuery}`

**响应格式**:
```json
{
  "success": true,
  "query": "600519",
  "results": [
    {
      "source": "akshare",
      "results": [
        {
          "code": "600519",
          "name": "贵州茅台",
          "market": "SH"
        }
      ],
      "responseTime": 234
    },
    {
      "source": "mock",
      "results": [...],
      "responseTime": 12
    }
  ],
  "totalResults": 2,
  "timestamp": "2026-03-02T08:53:00Z"
}
```

## 测试清单

### 功能测试
- [ ] A股代码搜索 (600519)
- [ ] A股名称搜索 (茅台, 平安)
- [ ] 美股搜索 (AAPL, TSLA)
- [ ] 港股搜索 (0700.HK)
- [ ] 模糊匹配 (输入部分名称)
- [ ] 无效输入处理
- [ ] 加载状态显示
- [ ] 错误处理

### 性能测试
- [ ] 防抖生效 (300ms)
- [ ] 并发搜索处理
- [ ] 多数据源响应时间对比
- [ ] 降级处理 (AKShare 失败时回退到本地)

### UI/UX 测试
- [ ] 搜索结果正确显示
- [ ] 市场标签颜色正确
- [ ] 点击选择股票功能正常
- [ ] 结果为空时提示正确
- [ ] 移动端响应式布局

## 回滚方案

如果集成后出现问题,可以快速回滚:

1. 恢复 StockSearchInput.tsx 中的本地 stockDatabase
2. 移除 useUnifiedSearch 的导入和使用
3. 保持原有搜索逻辑

原始代码已通过 git 保存,可使用:
```bash
git checkout HEAD -- components/watchlist/StockSearchInput.tsx
```

## 后续优化方向

1. **缓存机制**: 在前端缓存常见搜索结果
2. **搜索历史**: 记录用户搜索历史
3. **热门推荐**: 显示热门股票快捷入口
4. **智能补全**: 实时显示搜索建议
5. **数据源优先级**: 允许用户配置首选数据源

---

**创建时间**: 2026-03-02
**最后更新**: 2026-03-02
**状态**: 待集成
