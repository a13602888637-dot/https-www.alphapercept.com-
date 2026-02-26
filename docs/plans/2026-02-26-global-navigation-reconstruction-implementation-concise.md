# 全局导航重构 - 浓缩实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标**: 修复二级页面无返回机制问题
**方法**: 统一PageLayout + 路由检测 + 移动端手势
**技术栈**: Next.js 15, React 19, TypeScript

---

## 核心任务（6个关键步骤）

### 1. 创建路由工具
**文件**: `utils/routing.ts`
```typescript
export const isSecondaryPage = (pathname: string): boolean => {
  const base = ['/', '/dashboard'];
  const current = pathname.split('/')[1] || '';
  return !base.includes(`/${current}`) && pathname !== '/dashboard';
};
```

### 2. 创建返回组件
**文件**: `components/layout/back-navigation.tsx`
```typescript
"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export function BackNavigation() {
  const router = useRouter();
  const handleBack = () => window.history.length <= 1
    ? router.push('/dashboard')
    : router.back();

  return <Button variant="ghost" onClick={handleBack}><ChevronLeft /> 返回</Button>;
}
```

### 3. 创建主布局
**文件**: `components/layout/page-layout.tsx`
```typescript
"use client";
import { usePathname } from "next/navigation";
import { isSecondaryPage } from "@/utils/routing";
import { BackNavigation } from "./back-navigation";

export function PageLayout({ children, title }: { children: React.ReactNode; title?: string }) {
  const pathname = usePathname();
  const showBack = isSecondaryPage(pathname);

  return (
    <div className="min-h-screen">
      {showBack && (
        <header className="sticky top-0 border-b p-4">
          <BackNavigation />
          {title && <h1 className="mt-2 text-lg font-semibold">{title}</h1>}
        </header>
      )}
      <main className="p-4">{children}</main>
    </div>
  );
}
```

### 4. 改造关键页面
**需要改造的5个页面**:
1. `app/live-feed/page.tsx` - 实时市场
2. `app/strategy-recommendation/page.tsx` - 策略推荐
3. `app/ai-assistant/page.tsx` - AI助手
4. `app/portfolio/page.tsx` - 投资组合
5. `app/settings/page.tsx` - 设置

**改造模板**:
```typescript
import { PageLayout } from "@/components/layout/page-layout";
// ... 原有导入

export default function PageName() {
  return (
    <PageLayout title="页面标题">
      {/* 原有内容 */}
    </PageLayout>
  );
}
```

### 5. 基础测试
**文件**: `utils/routing.test.ts`
```typescript
import { isSecondaryPage } from './routing';

test('检测二级页面', () => {
  expect(isSecondaryPage('/dashboard')).toBe(false);
  expect(isSecondaryPage('/live-feed')).toBe(true);
});
```

### 6. 验证部署
**命令**:
```bash
# 1. 创建基线提交
git add . && git commit -m "chore: 导航重构前基线"

# 2. 实施上述1-5步

# 3. 验证构建
npm run build

# 4. 测试运行
npm run dev

# 5. 最终提交
git add . && git commit -m "fix: 完成全局导航重构 - 修复二级页面返回机制"
```

---

## 执行选项

**1. 子代理驱动（本会话）** - 每个任务使用独立子代理，快速迭代
**2. 并行会话（分离）** - 新会话批量执行

**选择哪种方式？**