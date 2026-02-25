"use client";

import { useState, useRef, useCallback } from "react";
import { useSpring, animated } from "@react-spring/web";
import { useDrag } from "@use-gesture/react";
import {
  calculateSwipeProgress,
  calculateSwipeOpacity,
  SNAP_THRESHOLD,
} from "@/lib/utils/physics";

interface SwipeAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  backgroundColor: string;
  onAction: () => void;
}

interface UseSwipeActionsOptions {
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  enabled?: boolean;
  swipeThreshold?: number;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
}

/**
 * 滑动操作自定义Hook
 * 提供左右滑动显示操作面板的功能
 */
export function useSwipeActions({
  leftActions = [],
  rightActions = [],
  enabled = true,
  swipeThreshold = 80,
  onSwipeStart,
  onSwipeEnd,
}: UseSwipeActionsOptions) {
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 弹簧动画
  const [{ x, opacity }, api] = useSpring(() => ({
    x: 0,
    opacity: 0,
    config: { tension: 300, friction: 30 },
  }));

  // 计算滑动进度
  const calculateProgress = useCallback(
    (distance: number) => {
      return calculateSwipeProgress(distance, swipeThreshold);
    },
    [swipeThreshold]
  );

  // 计算背景透明度
  const calculateBackgroundOpacity = useCallback((progress: number) => {
    return calculateSwipeOpacity(progress);
  }, []);

  // 获取当前方向的操作
  const getCurrentActions = useCallback(
    (direction: "left" | "right") => {
      return direction === "left" ? leftActions : rightActions;
    },
    [leftActions, rightActions]
  );

  // 根据滑动距离选择操作
  const selectAction = useCallback(
    (distance: number, direction: "left" | "right") => {
      const actions = getCurrentActions(direction);
      if (actions.length === 0) return null;

      const progress = calculateProgress(Math.abs(distance));
      const actionIndex = Math.floor(progress * actions.length);
      return actions[Math.min(actionIndex, actions.length - 1)].id;
    },
    [getCurrentActions, calculateProgress]
  );

  // 执行操作
  const executeAction = useCallback(
    (actionId: string) => {
      const allActions = [...leftActions, ...rightActions];
      const action = allActions.find((a) => a.id === actionId);
      if (action) {
        action.onAction();
      }
    },
    [leftActions, rightActions]
  );

  // 滑动手势绑定
  const bind = useDrag(
    ({ active, movement: [mx], velocity: [vx], direction: [dx], first, last, cancel }) => {
      if (!enabled) return;

      const isLeftSwipe = dx < 0;
      const isRightSwipe = dx > 0;
      const direction = isLeftSwipe ? "left" : "right";
      const actions = getCurrentActions(direction);

      if (first) {
        setIsSwiping(true);
        setSwipeDirection(direction);
        if (onSwipeStart) onSwipeStart();
      }

      if (active) {
        // 滑动中
        const progress = calculateProgress(Math.abs(mx));
        const opacity = calculateBackgroundOpacity(progress);
        const actionId = selectAction(mx, direction);

        setActiveAction(actionId);

        // 更新动画
        api.start({
          x: mx,
          opacity,
          immediate: true,
        });

        // 如果滑动距离超过阈值，显示确认提示
        if (Math.abs(mx) > swipeThreshold * 1.5) {
          // 可以在这里添加触觉反馈
          if (typeof window !== "undefined" && navigator.vibrate) {
            navigator.vibrate(20);
          }
        }
      } else if (last) {
        // 滑动结束
        setIsSwiping(false);
        if (onSwipeEnd) onSwipeEnd();

        const shouldTriggerAction = Math.abs(mx) > swipeThreshold && vx > 0.5;

        if (shouldTriggerAction && activeAction) {
          // 触发操作
          executeAction(activeAction);

          // 滑动到完全展开然后关闭
          const targetX = direction === "left" ? -swipeThreshold * 1.5 : swipeThreshold * 1.5;
          api.start({
            x: targetX,
            opacity: 1,
            immediate: false,
            onRest: () => {
              // 延迟后复位
              setTimeout(() => {
                api.start({
                  x: 0,
                  opacity: 0,
                  immediate: false,
                });
                setActiveAction(null);
                setSwipeDirection(null);
              }, 300);
            },
          });
        } else {
          // 复位
          api.start({
            x: 0,
            opacity: 0,
            immediate: false,
          });
          setActiveAction(null);
          setSwipeDirection(null);
        }
      }
    },
    {
      enabled,
      axis: "x", // 只允许水平滑动
      bounds: containerRef,
      rubberband: true,
      filterTaps: true,
      from: () => [x.get(), 0],
    }
  );

  // 获取背景颜色
  const getBackgroundColor = useCallback(() => {
    if (!activeAction || !swipeDirection) return "transparent";

    const actions = getCurrentActions(swipeDirection);
    const action = actions.find((a) => a.id === activeAction);
    return action?.backgroundColor || "transparent";
  }, [activeAction, swipeDirection, getCurrentActions]);

  // 获取操作标签
  const getActionLabel = useCallback(() => {
    if (!activeAction || !swipeDirection) return "";

    const actions = getCurrentActions(swipeDirection);
    const action = actions.find((a) => a.id === activeAction);
    return action?.label || "";
  }, [activeAction, swipeDirection, getCurrentActions]);

  // 获取操作图标
  const getActionIcon = useCallback(() => {
    if (!activeAction || !swipeDirection) return null;

    const actions = getCurrentActions(swipeDirection);
    const action = actions.find((a) => a.id === activeAction);
    return action?.icon || null;
  }, [activeAction, swipeDirection, getCurrentActions]);

  // 取消滑动
  const cancelSwipe = useCallback(() => {
    api.start({
      x: 0,
      opacity: 0,
      immediate: false,
    });
    setIsSwiping(false);
    setActiveAction(null);
    setSwipeDirection(null);
  }, [api]);

  return {
    bind,
    x,
    opacity,
    isSwiping,
    swipeDirection,
    activeAction,
    containerRef,
    getBackgroundColor,
    getActionLabel,
    getActionIcon,
    cancelSwipe,
    calculateProgress,
  };
}

/**
 * 滑动操作组件
 */
export function SwipeActions({
  children,
  style,
  bind,
  spring,
  backgroundContent,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  bind: any;
  spring: { x: any; opacity: any };
  backgroundContent?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden" style={style}>
      {/* 背景操作面板 */}
      <animated.div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          opacity: spring.opacity,
          transform: spring.x.to((x) => `translateX(${x > 0 ? "0" : "100%"})`),
        }}
      >
        {backgroundContent}
      </animated.div>

      {/* 前景内容 */}
      <animated.div
        {...bind()}
        style={{
          ...style,
          transform: spring.x.to((x) => `translateX(${x}px)`),
          position: "relative",
          touchAction: "pan-y",
          cursor: "grab",
          userSelect: "none",
        }}
        className="active:cursor-grabbing bg-background"
      >
        {children}
      </animated.div>
    </div>
  );
}

/**
 * 默认滑动操作配置
 */
export const defaultSwipeActions = {
  left: [
    {
      id: "remove",
      label: "移除",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      color: "white",
      backgroundColor: "rgb(239, 68, 68)", // red-500
    },
    {
      id: "set_reminder",
      label: "设置提醒",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
      color: "white",
      backgroundColor: "rgb(59, 130, 246)", // blue-500
    },
  ],
  right: [
    {
      id: "buy",
      label: "买入",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: "white",
      backgroundColor: "rgb(34, 197, 94)", // green-500
    },
    {
      id: "sell",
      label: "卖出",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h5m-5 0v-6m0 6l-6-6m6 6l6-6" />
        </svg>
      ),
      color: "white",
      backgroundColor: "rgb(234, 88, 12)", // orange-500
    },
    {
      id: "analyze",
      label: "分析",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: "white",
      backgroundColor: "rgb(168, 85, 247)", // purple-500
    },
  ],
};