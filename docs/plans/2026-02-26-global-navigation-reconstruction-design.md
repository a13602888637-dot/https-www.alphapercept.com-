# 全局导航场域重构设计文档

## 项目概述
**项目**: Alpha-Quant-Copilot P0级动线阻塞修复 - 第1项
**问题**: 左侧菜单进入二级页面无返回机制（全局导航场域重构）
**日期**: 2026-02-26
**状态**: 设计方案已批准，准备实施

## 问题描述

### 现状分析
当前系统存在严重的P0级动线阻塞问题：从左侧功能清单点击进入任何二级功能页面（如`/live-feed`、`/strategy-recommendation`、`/ai-assistant`等）后，缺失返回键，用户陷入"场域禁锢"，只能刷新浏览器才能返回主工作区。

### 用户旅程断裂点
1. **入口**: 用户点击左侧菜单进入功能页面
2. **禁锢**: 进入后无法返回，UI无返回机制
3. **逃离**: 唯一方法是刷新浏览器，丢失当前状态
4. **影响**: 用户体验断裂，无法正常使用多页面功能

### 根本原因
- 缺乏统一的页面布局容器
- 未实现路由栈管理逻辑
- 移动端手势支持缺失
- 页面层级检测机制未建立

## 架构决策

### 选择方案：统一PageLayout容器方案

#### 决策理由
1. **一致性**: 所有二级页面统一行为，提供一致的用户体验
2. **可维护性**: 集中管理导航逻辑，修改只需调整一个组件
3. **移动端友好**: 天然支持手势返回和响应式设计
4. **渐进增强**: 不影响现有功能，平滑过渡

#### 备选方案考虑
1. **中间件拦截方案**: 逻辑复杂，难以支持移动端手势
2. **高阶组件包装方案**: 组件嵌套过深，需要手动包装每个页面

## 技术实现

### 技术栈利用
- **Next.js 15**: `useRouter`进行路由管理，App Router架构
- **React 19**: 组件化架构，Hooks状态管理
- **@use-gesture/react**: 移动端边缘左滑手势支持
- **Tailwind CSS**: 响应式设计实现
- **TypeScript**: 类型安全保证

### 核心组件设计

#### 1. PageLayout组件 (`components/layout/page-layout.tsx`)
```typescript
interface PageLayoutProps {
  children: React.ReactNode;
  title?: string; // 可选的页面标题
  showBackButton?: boolean; // 强制显示/隐藏返回按钮（默认自动检测）
  backDestination?: string; // 自定义返回目标（默认自动检测）
}
```

**功能特性**:
- 顶部固定导航栏区域
- 动态返回按钮（根据路由层级自动显示/隐藏）
- 页面标题显示区域
- 主内容容器（保持现有样式）

#### 2. BackNavigation组件 (`components/layout/back-navigation.tsx`)
**实现逻辑**:
```typescript
const handleBack = () => {
  // 智能返回逻辑
  if (window.history.length <= 1) {
    // 没有历史记录时返回仪表板
    router.push('/dashboard');
  } else {
    // 有历史记录时返回上一页
    router.back();
  }
};
```

**UI特性**:
- 清晰的`< Back`按钮设计
- 响应式布局（移动端简化显示）
- 触摸反馈效果

#### 3. GestureDetector组件 (`components/layout/gesture-detector.tsx`)
**手势实现**:
```typescript
// 仅监听屏幕左边缘20px区域
const bind = useDrag((state) => {
  if (
    state.direction[0] > 0 && // 向右滑动
    state.distance[0] > 50 && // 滑动距离超过50px
    state.initial[0] < 20 // 起始点在左边缘20px内
  ) {
    router.back();
  }
});
```

### 路由层级检测逻辑

#### 自动检测算法 (`utils/routing.ts`)
```typescript
const isSecondaryPage = (pathname: string): boolean => {
  const baseRoutes = ['/', '/dashboard'];
  const currentPath = pathname.split('/')[1] || '';

  // 排除基础路由
  if (baseRoutes.includes(`/${currentPath}`) || pathname === '/dashboard') {
    return false;
  }

  // 排除API路由和特殊路由
  const excludedPaths = ['api', '_next', 'favicon.ico'];
  if (excludedPaths.includes(currentPath)) {
    return false;
  }

  // 其他路由视为二级页面
  return true;
};
```

#### 需要应用PageLayout的页面
1. `/live-feed` - 实时市场页面
2. `/strategy-recommendation` - 策略推荐页面
3. `/ai-assistant` - AI助手页面
4. `/portfolio` - 投资组合页面
5. `/settings` - 设置页面
6. `/watchlist` - 自选股页面（如果独立存在）

### 数据流设计

#### 状态管理流程
```
用户交互触发
    ↓
路由状态变化（Next.js Router）
    ↓
PageLayout检测路由层级
    ↓
更新返回按钮显示状态
    ↓
用户点击返回或手势滑动
    ↓
触发router.back()或router.push('/dashboard')
    ↓
页面重新渲染，完成返回流程
```

#### 状态同步机制
- **路由状态**: 通过`useRouter()`实时获取
- **历史栈状态**: 通过`window.history.length`检测
- **手势状态**: 独立状态，不与路由状态冲突
- **UI状态**: React状态管理显示/隐藏

## 实施步骤

### 阶段1：基础组件开发（第1天）
1. 创建`utils/routing.ts` - 路由检测工具函数
2. 创建`components/layout/page-layout.tsx` - 主布局组件
3. 创建`components/layout/back-navigation.tsx` - 返回导航组件
4. 创建`components/layout/gesture-detector.tsx` - 手势检测组件

### 阶段2：页面改造（第1-2天）
1. 修改`/live-feed/page.tsx` - 应用PageLayout
2. 修改`/strategy-recommendation/page.tsx` - 应用PageLayout
3. 修改`/ai-assistant/page.tsx` - 应用PageLayout
4. 修改`/portfolio/page.tsx` - 应用PageLayout
5. 修改`/settings/page.tsx` - 应用PageLayout

### 阶段3：测试验证（第2天）
1. 桌面端功能测试 - 返回按钮点击
2. 移动端手势测试 - 边缘左滑返回
3. 路由历史测试 - 无历史时的回退逻辑
4. 响应式测试 - 不同屏幕尺寸适配

### 阶段4：优化迭代（第2-3天）
1. 性能优化 - 按需加载手势库
2. 用户体验优化 - 添加过渡动画
3. 错误处理增强 - 边界情况处理
4. 代码质量检查 - TypeScript类型完善

## 错误处理与边界情况

### 错误场景处理

#### 1. 路由历史为空
```typescript
const handleBack = () => {
  if (typeof window !== 'undefined' && window.history.length <= 1) {
    // 没有浏览历史时返回仪表板
    router.push('/dashboard');
  } else {
    router.back();
  }
};
```

#### 2. 手势冲突处理
- **检测区域限制**: 仅监听屏幕左边缘20px
- **滑动阈值**: 最小滑动距离50px
- **防抖机制**: 防止快速多次触发
- **冲突避免**: 与页面内部滚动操作隔离

#### 3. 移动端适配
- **小屏设备**: 简化按钮样式，增大触摸区域
- **横屏模式**: 调整手势检测区域比例
- **触摸反馈**: 添加视觉反馈效果
- **性能优化**: 按需加载手势检测库

### 性能优化策略

#### 1. 代码分割
```typescript
// 动态导入手势库（仅在移动端需要）
const GestureDetector = dynamic(
  () => import('@/components/layout/gesture-detector'),
  { ssr: false }
);
```

#### 2. 条件加载
- 桌面端：不加载手势检测库
- 移动端：按需加载手势功能
- 生产环境：Tree-shaking优化

#### 3. 缓存策略
- 路由状态缓存在sessionStorage
- 手势检测状态使用useMemo缓存
- 组件使用React.memo避免不必要的重渲染

## 测试策略

### 单元测试
1. **路由检测逻辑测试** (`utils/routing.test.ts`)
   - 测试`isSecondaryPage()`函数
   - 验证各种路由路径的正确分类

2. **返回逻辑测试** (`components/layout/back-navigation.test.tsx`)
   - 测试`handleBack()`函数
   - 验证历史栈为空时的回退逻辑

### 集成测试
1. **页面布局集成测试**
   - 测试PageLayout与子组件的集成
   - 验证返回按钮的显示/隐藏逻辑

2. **路由集成测试**
   - 测试页面间的导航流程
   - 验证返回功能与路由历史的同步

### E2E测试（Cypress）
1. **用户旅程测试**
   - 从仪表板进入二级页面
   - 点击返回按钮回到仪表板
   - 验证状态保持

2. **移动端手势测试**
   - 模拟移动端触摸事件
   - 测试边缘左滑返回功能
   - 验证手势冲突处理

### 手动测试清单
- [ ] 桌面端Chrome：点击返回按钮功能正常
- [ ] 桌面端Firefox：点击返回按钮功能正常
- [ ] 移动端Safari：边缘左滑返回功能正常
- [ ] 移动端Chrome：边缘左滑返回功能正常
- [ ] 路由历史为空：正确返回仪表板
- [ ] 浏览器后退按钮：与系统返回按钮行为一致
- [ ] 响应式设计：各种屏幕尺寸适配正常

## 成功标准

### 功能标准
1. **返回机制可用**: 所有二级页面都有可用的返回按钮
2. **手势支持**: 移动端支持边缘左滑返回
3. **路由逻辑正确**: 返回逻辑智能处理路由历史
4. **状态保持**: 返回后页面状态正确恢复

### 性能标准
1. **加载性能**: PageLayout组件加载时间 < 100ms
2. **手势响应**: 手势检测响应延迟 < 50ms
3. **内存使用**: 手势库按需加载，不增加初始包大小

### 用户体验标准
1. **一致性**: 所有页面返回体验一致
2. **直观性**: 返回按钮位置和样式直观易懂
3. **反馈**: 操作有明确的视觉反馈
4. **无障碍**: 支持键盘导航和屏幕阅读器

## 风险与缓解

### 技术风险
1. **手势库兼容性风险**
   - **影响**: 某些浏览器不支持或行为不一致
   - **缓解**: 渐进增强，基础功能不依赖手势库
   - **回退**: 手势失败时仍可使用按钮返回

2. **路由状态同步风险**
   - **影响**: 返回后状态不同步
   - **缓解**: 使用React Router的严格模式
   - **监控**: 添加路由状态变化日志

### 用户体验风险
1. **手势误触发风险**
   - **影响**: 用户无意滑动导致意外返回
   - **缓解**: 设置合理的滑动阈值和检测区域
   - **优化**: 添加确认提示或撤销功能

2. **移动端性能风险**
   - **影响**: 手势检测影响滚动性能
   - **缓解**: 优化事件监听，使用被动事件
   - **测试**: 在低端设备上进行性能测试

## 后续计划

### 阶段完成标志
1. **代码完成**: 所有组件实现并测试通过
2. **测试完成**: 所有测试用例通过
3. **文档更新**: 更新相关使用文档
4. **部署验证**: 生产环境验证功能正常

### 后续优化项
1. **动画增强**: 添加页面切换过渡动画
2. **高级手势**: 支持更多手势操作（如右滑前进）
3. **历史管理**: 实现路由历史栈可视化
4. **个性化**: 支持用户自定义返回行为

### 监控指标
1. **使用率**: 返回按钮点击率和手势使用率
2. **错误率**: 返回功能失败率
3. **性能指标**: 页面加载时间和响应延迟
4. **用户反馈**: 用户满意度调查

## 附录

### 文件清单
```
components/
├── layout/
│   ├── page-layout.tsx      # 主布局组件
│   ├── back-navigation.tsx  # 返回导航组件
│   └── gesture-detector.tsx # 手势检测组件
└── ...

utils/
└── routing.ts              # 路由检测工具

app/
├── live-feed/
│   └── page.tsx            # 已应用PageLayout
├── strategy-recommendation/
│   └── page.tsx            # 已应用PageLayout
├── ai-assistant/
│   └── page.tsx            # 已应用PageLayout
├── portfolio/
│   └── page.tsx            # 已应用PageLayout
└── settings/
    └── page.tsx            # 已应用PageLayout
```

### 依赖更新
```json
{
  "dependencies": {
    "@use-gesture/react": "^10.3.1"  // 已存在，无需新增
  }
}
```

---
*设计遵循《Vibe Coding 协作协议》第2.1条：代码修改三阶段验证原则*
*实施前必须执行`git commit -m "chore: 重构前基线"`确保可回滚*