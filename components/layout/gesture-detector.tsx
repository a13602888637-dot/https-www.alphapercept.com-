// components/layout/gesture-detector.tsx
"use client";

import { useEffect, useRef, useCallback } from "react";
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

  // 使用useCallback包装事件处理函数，避免每次渲染都创建新函数
  const handleTouchStart = useCallback((e: TouchEvent) => {
    // 只检测左边缘的触摸
    if (e.touches[0].clientX > edgeWidth) return;

    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, [edgeWidth]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
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
      // 调用preventDefault()防止在滑动返回时触发其他默认行为（如链接点击、按钮点击等）
      // 注意：touchend事件监听器使用了{ passive: false }，允许调用preventDefault()
      e.preventDefault();
      router.back();
    }

    // 重置触摸起点
    touchStartX.current = null;
    touchStartY.current = null;
  }, [minSwipeDistance, router]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // touchstart使用passive: true以提高滚动性能，但意味着不能在touchstart中调用preventDefault()
    // touchend使用passive: false以允许在检测到有效滑动时调用preventDefault()
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchEnd]);

  // 这个组件不渲染任何内容
  return null;
}