// components/layout/gesture-detector.tsx
"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface GestureDetectorProps {
  enabled?: boolean;
  edgeWidth?: number;
  minSwipeDistance?: number;
}

export function GestureDetector({
  enabled = true,
  edgeWidth = 20,
  minSwipeDistance = 50,
}: GestureDetectorProps) {
  const router = useRouter();
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleTouchStart = (e: TouchEvent) => {
      // 只检测左边缘的触摸
      if (e.touches[0].clientX > edgeWidth) return;

      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;

      const deltaX = touchEndX - touchStartX.current;
      const deltaY = touchEndY - touchStartY.current;

      // 检查是否为水平滑动（垂直移动小于水平移动的一半）
      if (Math.abs(deltaY) > Math.abs(deltaX) * 0.5) return;

      // 检查滑动距离和方向
      if (deltaX > minSwipeDistance) {
        // 从左向右滑动，触发返回
        e.preventDefault();
        router.back();
      }

      // 重置触摸起点
      touchStartX.current = null;
      touchStartY.current = null;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, edgeWidth, minSwipeDistance, router]);

  // 这个组件不渲染任何内容
  return null;
}