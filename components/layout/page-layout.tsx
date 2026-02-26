// components/layout/page-layout.tsx
"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isSecondaryPage } from "@/utils/routing";
import { BackNavigation } from "./back-navigation";
import GestureDetector from "./gesture-detector.client";

interface PageLayoutProps {
  children: ReactNode;
  title?: string;
  showBackButton?: boolean; // 强制显示/隐藏返回按钮
  backDestination?: string; // 自定义返回目标
  className?: string;
  contentClassName?: string;
}

export function PageLayout({
  children,
  title,
  showBackButton,
  backDestination,
  className,
  contentClassName,
}: PageLayoutProps) {
  const pathname = usePathname();

  // 自动检测是否为二级页面
  const isSecondary = isSecondaryPage(pathname);

  // 决定是否显示返回按钮
  const shouldShowBackButton = showBackButton !== undefined
    ? showBackButton
    : isSecondary;

  return (
    <div className={cn("min-h-screen flex flex-col", className)}>
      {/* 移动端手势检测 */}
      <GestureDetector enabled={shouldShowBackButton} />

      {/* 顶部导航栏 */}
      {shouldShowBackButton && (
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center px-4">
            <div className="flex items-center gap-2">
              <BackNavigation />
              {title && (
                <h1 className="text-lg font-semibold ml-2">
                  {title}
                </h1>
              )}
            </div>
          </div>
        </header>
      )}

      {/* 主内容区域 */}
      <main className={cn("flex-1 container px-4 py-6", contentClassName)}>
        {children}
      </main>
    </div>
  );
}