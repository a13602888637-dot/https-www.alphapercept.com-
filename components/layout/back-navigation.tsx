// components/layout/back-navigation.tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { getBackDestination } from "@/utils/routing";
import { cn } from "@/lib/utils";

interface BackNavigationProps {
  className?: string;
  showLabel?: boolean;
}

export function BackNavigation({ className, showLabel = true }: BackNavigationProps) {
  const router = useRouter();

  const handleBack = () => {
    const destination = getBackDestination();

    if (destination === 'back') {
      router.back();
    } else {
      router.push(destination);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleBack}
      className={cn("flex items-center gap-1", className)}
      aria-label="返回"
    >
      <ChevronLeft className="h-4 w-4" />
      {showLabel && <span>返回</span>}
    </Button>
  );
}