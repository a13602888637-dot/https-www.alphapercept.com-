"use client";

import React, { useCallback } from "react";
import { animated } from "@react-spring/web";
import {
  useLongPressPreview,
  LongPressPreview as LongPressPreviewComponent,
  DefaultPreviewContent,
} from "./useLongPressPreview";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle, Info } from "lucide-react";

interface LongPressPreviewProps {
  children: React.ReactNode;
  stockCode: string;
  stockName: string;
  currentPrice?: number;
  priceChange?: number;
  priceChangePercent?: number;
  sparklineData?: number[];
  buyPrice?: number;
  stopLossPrice?: number;
  targetPrice?: number;
  notes?: string;
  enabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onPreviewOpen?: () => void;
  onPreviewClose?: () => void;
}

/**
 * 长按预览组件
 * 为Watchlist项目提供长按预览功能
 */
export function LongPressPreview({
  children,
  stockCode,
  stockName,
  currentPrice,
  priceChange,
  priceChangePercent,
  sparklineData,
  buyPrice,
  stopLossPrice,
  targetPrice,
  notes,
  enabled = true,
  className = "",
  style,
  onPreviewOpen,
  onPreviewClose,
}: LongPressPreviewProps) {
  // 计算盈亏
  const calculateProfitLoss = useCallback(() => {
    if (!buyPrice || !currentPrice) return null;
    return ((currentPrice - buyPrice) / buyPrice) * 100;
  }, [buyPrice, currentPrice]);

  // 计算目标盈利
  const calculateTargetProfit = useCallback(() => {
    if (!buyPrice || !targetPrice) return null;
    return ((targetPrice - buyPrice) / buyPrice) * 100;
  }, [buyPrice, targetPrice]);

  // 计算止损风险
  const calculateStopLossRisk = useCallback(() => {
    if (!buyPrice || !stopLossPrice) return null;
    return ((buyPrice - stopLossPrice) / buyPrice) * 100;
  }, [buyPrice, stopLossPrice]);

  const profitLoss = calculateProfitLoss();
  const targetProfit = calculateTargetProfit();
  const stopLossRisk = calculateStopLossRisk();

  // 检查是否触及止损
  const isStopLossTriggered = stopLossPrice && currentPrice && currentPrice <= stopLossPrice;

  // 使用长按预览Hook
  const {
    bind,
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
  } = useLongPressPreview({
    enabled,
    onPreviewOpen,
    onPreviewClose,
  });

  // 渲染预览内容
  const renderPreviewContent = () => {
    return (
      <div className="space-y-4">
        {/* 标题和价格 */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xl font-bold">{stockCode}</div>
            <div className="text-sm text-muted-foreground">{stockName}</div>
          </div>
          {currentPrice !== undefined && (
            <div className="text-right">
              <div className="text-2xl font-bold">¥{currentPrice.toFixed(2)}</div>
              {priceChangePercent !== undefined && (
                <div
                  className={`text-sm font-medium flex items-center justify-end gap-1 ${
                    priceChangePercent >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {priceChangePercent >= 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {priceChangePercent >= 0 ? "+" : ""}
                  {priceChangePercent.toFixed(2)}%
                </div>
              )}
            </div>
          )}
        </div>

        {/* 迷你K线图 */}
        {sparklineData && sparklineData.length > 0 && (
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">趋势图</div>
                <Badge
                  variant={
                    sparklineData[sparklineData.length - 1] >= sparklineData[0]
                      ? "default"
                      : "destructive"
                  }
                  className="text-xs"
                >
                  {sparklineData[sparklineData.length - 1] >= sparklineData[0]
                    ? "上涨"
                    : "下跌"}
                </Badge>
              </div>
              <div className="h-16">
                <svg className="w-full h-full" viewBox="0 0 100 50">
                  <polyline
                    points={sparklineData
                      .map((value, index) => {
                        const x = (index / (sparklineData.length - 1)) * 100;
                        const y =
                          50 -
                          ((value - Math.min(...sparklineData)) /
                            (Math.max(...sparklineData) - Math.min(...sparklineData) || 1)) *
                            40;
                        return `${x},${y}`;
                      })
                      .join(" ")}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={
                      sparklineData[sparklineData.length - 1] >= sparklineData[0]
                        ? "text-green-500"
                        : "text-red-500"
                    }
                  />
                </svg>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 关键指标 */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground mb-1">支撑位</div>
              <div className="font-semibold">
                {stopLossPrice ? `¥${stopLossPrice.toFixed(2)}` : "未设置"}
              </div>
              {stopLossRisk && (
                <div className="text-xs text-red-600 mt-1">风险: {stopLossRisk.toFixed(2)}%</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground mb-1">阻力位</div>
              <div className="font-semibold">
                {targetPrice ? `¥${targetPrice.toFixed(2)}` : "未设置"}
              </div>
              {targetProfit && (
                <div className="text-xs text-green-600 mt-1">目标: +{targetProfit.toFixed(2)}%</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 盈亏状态 */}
        {profitLoss !== null && (
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">当前盈亏</div>
                  <div className="text-xs text-muted-foreground">基于买入成本</div>
                </div>
                <Badge
                  variant={profitLoss >= 0 ? "default" : "destructive"}
                  className="text-lg font-bold"
                >
                  {profitLoss >= 0 ? "+" : ""}
                  {profitLoss.toFixed(2)}%
                </Badge>
              </div>
              {buyPrice && (
                <div className="text-xs text-muted-foreground mt-2">
                  成本: ¥{buyPrice.toFixed(2)}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 止损警告 */}
        {isStopLossTriggered && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5" />
                <div className="font-medium">已触及止损价！</div>
              </div>
              <div className="text-sm text-red-600 mt-1">
                当前价格已低于止损价，建议立即处理
              </div>
            </CardContent>
          </Card>
        )}

        {/* 备注 */}
        {notes && (
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-muted-foreground" />
                <div className="text-sm font-medium">备注</div>
              </div>
              <div className="text-sm text-muted-foreground">{notes}</div>
            </CardContent>
          </Card>
        )}

        {/* 操作提示 */}
        <div className="text-center pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            松开手指关闭 • 点击外部取消
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <LongPressPreviewComponent
        bind={bind}
        isPreviewOpen={isPreviewOpen}
        previewPosition={previewPosition}
        previewRef={previewRef}
        spring={{ opacity, scale, blur }}
        previewContent={renderPreviewContent()}
      >
        <div
          ref={containerRef}
          className={`relative ${className} ${isLongPressing ? "opacity-80" : ""}`}
          style={style}
        >
          {children}
          {/* 长按提示 */}
          {!isPreviewOpen && !isLongPressing && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/50 text-white text-xs px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                长按预览
              </div>
            </div>
          )}
        </div>
      </LongPressPreviewComponent>

      {/* 长按指示器 */}
      {isLongPressing && !isPreviewOpen && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 shadow-lg">
            <div className="animate-pulse">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
            长按中...
          </div>
        </div>
      )}
    </>
  );
}

/**
 * 长按预览指示器
 * 显示长按功能提示
 */
export function LongPressPreviewIndicator({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded-full border-2 border-muted-foreground flex items-center justify-center">
          <div className="w-1 h-1 rounded-full bg-muted-foreground" />
        </div>
        <span>长按卡片预览详情</span>
      </div>
    </div>
  );
}

/**
 * 长按预览快捷操作
 * 在预览面板中显示快捷操作按钮
 */
export function LongPressPreviewActions({
  stockCode,
  stockName,
  onQuickAction,
  className = "",
}: {
  stockCode: string;
  stockName: string;
  onQuickAction?: (action: string) => void;
  className?: string;
}) {
  const quickActions = [
    {
      id: "view_details",
      label: "查看详情",
      icon: <Info className="w-4 h-4" />,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      id: "set_alert",
      label: "设置提醒",
      icon: <AlertTriangle className="w-4 h-4" />,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      id: "quick_trade",
      label: "快速交易",
      icon: <TrendingUp className="w-4 h-4" />,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
  ];

  const handleActionClick = (actionId: string) => {
    if (onQuickAction) {
      onQuickAction(actionId);
    }
  };

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      {quickActions.map((action) => (
        <button
          key={action.id}
          className={`flex flex-col items-center justify-center p-3 rounded-lg ${action.bgColor} ${action.color} hover:opacity-90 transition-opacity`}
          onClick={() => handleActionClick(action.id)}
        >
          <div className="mb-1">{action.icon}</div>
          <div className="text-xs font-medium">{action.label}</div>
        </button>
      ))}
    </div>
  );
}