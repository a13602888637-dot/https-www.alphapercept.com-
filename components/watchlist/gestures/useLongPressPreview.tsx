"use client";

import React from 'react';
import { useState, useRef, useCallback, useEffect } from "react";
import { useSpring, animated } from "@react-spring/web";
import { useGesture } from "@use-gesture/react";
import { LONG_PRESS_DURATION } from "@/lib/utils/physics";

interface LongPressPreviewOptions {
  enabled?: boolean;
  duration?: number;
  onPreviewOpen?: () => void;
  onPreviewClose?: () => void;
  previewContent?: React.ReactNode;
}

/**
 * 长按预览自定义Hook
 * 提供长按唤出毛玻璃预览面板的功能
 */
export function useLongPressPreview({
  enabled = true,
  duration = LONG_PRESS_DURATION,
  onPreviewOpen,
  onPreviewClose,
  previewContent,
}: LongPressPreviewOptions) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const [isLongPressing, setIsLongPressing] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // 弹簧动画
  const [{ opacity, scale, blur }, api] = useSpring(() => ({
    opacity: 0,
    scale: 0.9,
    blur: 10,
    config: { tension: 300, friction: 30 },
  }));

  // 开始长按计时
  const startLongPressTimer = useCallback(
    (clientX: number, clientY: number) => {
      if (!enabled || longPressTimerRef.current) return;

      longPressTimerRef.current = setTimeout(() => {
        setIsLongPressing(true);
        openPreview(clientX, clientY);
      }, duration);
    },
    [enabled, duration]
  );

  // 取消长按计时
  const cancelLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsLongPressing(false);
  }, []);

  // 打开预览
  const openPreview = useCallback(
    (clientX: number, clientY: number) => {
      if (!enabled) return;

      // 计算预览位置（确保在视口内）
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const previewWidth = 320; // 预览面板宽度
      const previewHeight = 400; // 预览面板高度

      let x = clientX;
      let y = clientY;

      // 调整位置避免超出视口
      if (x + previewWidth > viewportWidth) {
        x = viewportWidth - previewWidth - 20;
      }
      if (y + previewHeight > viewportHeight) {
        y = viewportHeight - previewHeight - 20;
      }
      if (x < 20) x = 20;
      if (y < 20) y = 20;

      setPreviewPosition({ x, y });
      setIsPreviewOpen(true);

      // 动画效果
      api.start({
        opacity: 1,
        scale: 1,
        blur: 0,
        immediate: false,
      });

      if (onPreviewOpen) onPreviewOpen();

      // 触觉反馈
      if (typeof window !== "undefined" && navigator.vibrate) {
        navigator.vibrate(50);
      }
    },
    [enabled, api, onPreviewOpen]
  );

  // 关闭预览
  const closePreview = useCallback(() => {
    cancelLongPressTimer();

    if (!isPreviewOpen) return;

    // 动画效果
    api.start({
      opacity: 0,
      scale: 0.9,
      blur: 10,
      immediate: false,
      onRest: () => {
        setIsPreviewOpen(false);
      },
    });

    if (onPreviewClose) onPreviewClose();
  }, [isPreviewOpen, api, cancelLongPressTimer, onPreviewClose]);

  // 手势绑定
  const bind = useGesture(
    {
      onPointerDown: ({ event }) => {
        if (!enabled) return;
        event.preventDefault();
        const { clientX, clientY } = event as PointerEvent;
        startLongPressTimer(clientX, clientY);
      },
      onPointerUp: () => {
        cancelLongPressTimer();
        if (!isLongPressing) {
          closePreview();
        }
      },
      onPointerCancel: () => {
        cancelLongPressTimer();
        closePreview();
      },
      onPointerMove: ({ event }) => {
        if (!enabled || !isPreviewOpen) return;

        // 如果预览已打开，移动时更新位置
        const { clientX, clientY } = event as PointerEvent;
        setPreviewPosition({ x: clientX, y: clientY });
      },
    },
    {
      enabled,
    }
  );

  // 点击外部关闭预览
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isPreviewOpen &&
        previewRef.current &&
        !previewRef.current.contains(event.target as Node) &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closePreview();
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (isPreviewOpen && event.key === "Escape") {
        closePreview();
      }
    };

    if (isPreviewOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscapeKey);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isPreviewOpen, closePreview]);

  // 清理计时器
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // 获取绑定函数
  const getBind = useCallback(() => {
    return bind();
  }, [bind]);

  return {
    bind: getBind,
    isPreviewOpen,
    isLongPressing,
    previewPosition,
    containerRef,
    previewRef,
    opacity,
    scale,
    blur,
    openPreview,
    closePreview,
    startLongPressTimer,
    cancelLongPressTimer,
  };
}

/**
 * 长按预览组件
 */
export function LongPressPreview({
  children,
  style,
  bind,
  isPreviewOpen,
  previewPosition,
  previewRef,
  spring,
  previewContent,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  bind: any;
  isPreviewOpen: boolean;
  previewPosition: { x: number; y: number };
  previewRef: React.RefObject<HTMLDivElement>;
  spring: { opacity: any; scale: any; blur: any };
  previewContent?: React.ReactNode;
}) {
  return (
    <>
      <div ref={previewRef} style={style} {...bind()}>
        {children}
      </div>

      {/* 预览面板 */}
      {isPreviewOpen && (
        <animated.div
          ref={previewRef}
          className="fixed z-50 rounded-xl shadow-2xl overflow-hidden"
          style={{
            left: previewPosition.x,
            top: previewPosition.y,
            opacity: spring.opacity,
            transform: spring.scale.to((s) => `scale(${s})`),
            backdropFilter: spring.blur.to((b) => `blur(${b}px)`),
            width: "320px",
            maxWidth: "90vw",
            maxHeight: "80vh",
          }}
        >
          {/* 毛玻璃背景 */}
          <div className="absolute inset-0 bg-white/80 backdrop-blur-md" />

          {/* 内容 */}
          <div className="relative p-4">
            {previewContent || (
              <div className="text-center py-8">
                <div className="text-lg font-semibold mb-2">股票预览</div>
                <div className="text-sm text-muted-foreground">
                  长按查看详细信息
                </div>
              </div>
            )}
          </div>

          {/* 关闭提示 */}
          <div className="absolute bottom-2 left-0 right-0 text-center">
            <div className="text-xs text-muted-foreground bg-black/10 inline-block px-2 py-1 rounded-full">
              松开手指关闭
            </div>
          </div>
        </animated.div>
      )}
    </>
  );
}

/**
 * 默认预览内容组件
 */
export function DefaultPreviewContent({
  stockCode,
  stockName,
  currentPrice,
  priceChange,
  priceChangePercent,
  sparklineData,
}: {
  stockCode: string;
  stockName: string;
  currentPrice?: number;
  priceChange?: number;
  priceChangePercent?: number;
  sparklineData?: number[];
}) {
  return (
    <div className="space-y-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-bold">{stockCode}</div>
          <div className="text-sm text-muted-foreground">{stockName}</div>
        </div>
        {currentPrice !== undefined && (
          <div className="text-right">
            <div className="text-xl font-bold">¥{currentPrice.toFixed(2)}</div>
            {priceChangePercent !== undefined && (
              <div
                className={`text-sm font-medium ${
                  priceChangePercent >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {priceChangePercent >= 0 ? "+" : ""}
                {priceChangePercent.toFixed(2)}%
              </div>
            )}
          </div>
        )}
      </div>

      {/* 迷你K线图占位 */}
      {sparklineData && sparklineData.length > 0 && (
        <div className="h-24 bg-muted/30 rounded-lg p-2">
          <div className="text-xs text-muted-foreground mb-1">趋势图</div>
          <div className="h-16 relative">
            {/* 简单的趋势线 */}
            <svg className="w-full h-full" viewBox="0 0 100 50">
              <polyline
                points={sparklineData
                  .map((value, index) => {
                    const x = (index / (sparklineData.length - 1)) * 100;
                    const y = 50 - ((value - Math.min(...sparklineData)) /
                      (Math.max(...sparklineData) - Math.min(...sparklineData) || 1)) * 40;
                    return `${x},${y}`;
                  })
                  .join(" ")}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className={
                  sparklineData[sparklineData.length - 1] >= sparklineData[0]
                    ? "text-green-500"
                    : "text-red-500"
                }
              />
            </svg>
          </div>
        </div>
      )}

      {/* 关键指标 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/20 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">支撑位</div>
          <div className="font-semibold">¥--.--</div>
        </div>
        <div className="bg-muted/20 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">阻力位</div>
          <div className="font-semibold">¥--.--</div>
        </div>
      </div>

      {/* 最新资讯占位 */}
      <div className="border-t pt-3">
        <div className="text-sm font-medium mb-2">最新动态</div>
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="truncate">• 暂无最新资讯</div>
          <div className="truncate">• 点击查看详细分析</div>
        </div>
      </div>
    </div>
  );
}