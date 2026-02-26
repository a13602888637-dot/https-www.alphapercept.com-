// components/layout/simple-page-layout.tsx
"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isSecondaryPage } from "@/utils/routing";
import { BackNavigation } from "./back-navigation";

interface SimplePageLayoutProps {
  children: ReactNode;
  className?: string;
}

export function SimplePageLayout({
  children,
  className,
}: SimplePageLayoutProps) {
  const pathname = usePathname();
  const shouldShowBackButton = isSecondaryPage(pathname);

  return (
    <div className={cn("min-h-screen", className)}>
      {/* 简化的顶部栏 */}
      {shouldShowBackButton && (
        <div className="sticky top-0 z-40 border-b bg-background p-4">
          <BackNavigation showLabel={false} />
        </div>
      )}

      {/* 主内容 */}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}