"use client";

import React, { useState, useCallback } from "react";
import { animated } from "@react-spring/web";
import { useSwipeActions, defaultSwipeActions, SwipeActions as SwipeActionsComponent } from "./useSwipeActions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SwipeActionsProps {
  children: React.ReactNode;
  stockCode: string;
  stockName: string;
  onRemove?: (stockCode: string) => void;
  onSetReminder?: (stockCode: string, stockName: string) => void;
  onBuy?: (stockCode: string, stockName: string) => void;
  onSell?: (stockCode: string, stockName: string) => void;
  onAnalyze?: (stockCode: string, stockName: string) => void;
  enabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 滑动操作组件
 * 为Watchlist项目提供左右滑动操作功能
 */
export function SwipeActions({
  children,
  stockCode,
  stockName,
  onRemove,
  onSetReminder,
  onBuy,
  onSell,
  onAnalyze,
  enabled = true,
  className = "",
  style,
}: SwipeActionsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 处理移除操作
  const handleRemove = useCallback(() => {
    if (onRemove) {
      onRemove(stockCode);
      toast.success(`已移除 ${stockName} (${stockCode})`);
    }
  }, [stockCode, stockName, onRemove]);

  // 处理设置提醒操作
  const handleSetReminder = useCallback(() => {
    if (onSetReminder) {
      onSetReminder(stockCode, stockName);
      toast.success(`已为 ${stockName} 设置价格提醒`);
    }
  }, [stockCode, stockName, onSetReminder]);

  // 处理买入操作
  const handleBuy = useCallback(() => {
    if (onBuy) {
      onBuy(stockCode, stockName);
      toast.success(`准备买入 ${stockName} (${stockCode})`);
    }
  }, [stockCode, stockName, onBuy]);

  // 处理卖出操作
  const handleSell = useCallback(() => {
    if (onSell) {
      onSell(stockCode, stockName);
      toast.success(`准备卖出 ${stockName} (${stockCode})`);
    }
  }, [stockCode, stockName, onSell]);

  // 处理分析操作
  const handleAnalyze = useCallback(() => {
    if (onAnalyze) {
      onAnalyze(stockCode, stockName);
      toast.success(`正在分析 ${stockName} (${stockCode})`);
    }
  }, [stockCode, stockName, onAnalyze]);

  // 配置滑动操作
  const leftActions = [
    {
      ...defaultSwipeActions.left[0],
      onAction: handleRemove,
    },
    {
      ...defaultSwipeActions.left[1],
      onAction: handleSetReminder,
    },
  ];

  const rightActions = [
    {
      ...defaultSwipeActions.right[0],
      onAction: handleBuy,
    },
    {
      ...defaultSwipeActions.right[1],
      onAction: handleSell,
    },
    {
      ...defaultSwipeActions.right[2],
      onAction: handleAnalyze,
    },
  ];

  // 使用滑动操作Hook
  const {
    bind,
    x,
    opacity,
    isSwiping,
    swipeDirection,
    activeAction,
    getBackgroundColor,
    getActionLabel,
    getActionIcon,
    cancelSwipe,
  } = useSwipeActions({
    leftActions,
    rightActions,
    enabled,
    onSwipeStart: () => setIsExpanded(true),
    onSwipeEnd: () => setIsExpanded(false),
  });

  // 渲染背景操作面板
  const renderBackgroundContent = () => {
    if (!isSwiping || !swipeDirection) return null;

    const backgroundColor = getBackgroundColor();
    const actionLabel = getActionLabel();
    const actionIcon = getActionIcon();

    return (
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ backgroundColor }}
      >
        <div className="flex flex-col items-center justify-center text-white p-4">
          {actionIcon && <div className="mb-2">{actionIcon}</div>}
          <div className="text-lg font-semibold">{actionLabel}</div>
          <div className="text-sm opacity-90 mt-1">松开手指执行</div>
        </div>
      </div>
    );
  };

  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`} style={style}>
      {/* 滑动操作组件 */}
      <SwipeActionsComponent
        bind={bind}
        spring={{ x, opacity }}
        backgroundContent={renderBackgroundContent()}
      >
        {children}
      </SwipeActionsComponent>

      {/* 滑动提示 */}
      {!isSwiping && !isExpanded && (
        <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
          <div className="flex items-center gap-2 text-muted-foreground">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-xs">左滑操作</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-xs">右滑操作</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      )}

      {/* 取消按钮（当滑动时显示） */}
      {isSwiping && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 z-10"
          onClick={cancelSwipe}
        >
          取消
        </Button>
      )}
    </div>
  );
}

/**
 * 滑动操作面板组件
 * 显示所有可用的滑动操作
 */
export function SwipeActionsPanel({
  stockCode,
  stockName,
  onAction,
  className = "",
}: {
  stockCode: string;
  stockName: string;
  onAction?: (actionId: string) => void;
  className?: string;
}) {
  const allActions = [
    ...defaultSwipeActions.left,
    ...defaultSwipeActions.right,
  ];

  const handleActionClick = useCallback(
    (actionId: string) => {
      if (onAction) {
        onAction(actionId);
      }

      // 显示操作反馈
      const action = allActions.find((a) => a.id === actionId);
      if (action) {
        toast.success(`${action.label} ${stockName} (${stockCode})`);
      }
    },
    [stockCode, stockName, onAction, allActions]
  );

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      {allActions.map((action) => (
        <Button
          key={action.id}
          variant="outline"
          className="flex flex-col items-center justify-center h-20"
          style={{ backgroundColor: action.backgroundColor, color: action.color }}
          onClick={() => handleActionClick(action.id)}
        >
          <div className="mb-1">{action.icon}</div>
          <div className="text-xs font-medium">{action.label}</div>
        </Button>
      ))}
    </div>
  );
}

/**
 * 滑动操作指示器
 * 显示当前可用的滑动操作
 */
export function SwipeActionsIndicator({
  direction = "both",
  className = "",
}: {
  direction?: "left" | "right" | "both";
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between px-2 py-1 bg-muted/30 rounded-lg ${className}`}>
      {(direction === "left" || direction === "both") && (
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-xs text-muted-foreground">左滑: 移除/提醒</span>
        </div>
      )}
      {(direction === "right" || direction === "both") && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">右滑: 交易/分析</span>
          <div className="w-2 h-2 rounded-full bg-green-500" />
        </div>
      )}
    </div>
  );
}