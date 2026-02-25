"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MoreVertical, ExternalLink, Trash2, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { WatchlistItem as WatchlistItemType } from "@/lib/store/watchlist-store";
import { CompactWatchlistToggle } from "./WatchlistToggle";
import { ColorTransition, PriceChangeIndicator } from "./ColorTransition";
import { CompactSparkline } from "./WatchlistSparkline";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export interface WatchlistItemProps {
  // 自选股数据
  item: WatchlistItemType;
  // 是否选中
  isSelected?: boolean;
  // 是否显示操作菜单
  showActions?: boolean;
  // 是否显示趋势线
  showSparkline?: boolean;
  // 是否显示价格变化指示器
  showChangeIndicator?: boolean;
  // 是否启用价格跳变动画
  enablePriceAnimation?: boolean;
  // 点击回调
  onClick?: (item: WatchlistItemType) => void;
  // 删除回调
  onDelete?: (stockCode: string) => void;
  // 编辑回调
  onEdit?: (item: WatchlistItemType) => void;
  // 查看详情回调
  onViewDetails?: (item: WatchlistItemType) => void;
  // 自定义类名
  className?: string;
}

/**
 * 自选股列表项组件
 * 极简卡片设计，情绪映射渲染
 */
export function WatchlistItem({
  item,
  isSelected = false,
  showActions = true,
  showSparkline = true,
  showChangeIndicator = true,
  enablePriceAnimation = true,
  onClick,
  onDelete,
  onEdit,
  onViewDetails,
  className,
}: WatchlistItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPriceAnimating, setIsPriceAnimating] = useState(false);
  const previousPriceRef = useRef<number | null>(null);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 提取数据
  const {
    stockCode,
    stockName,
    currentPrice = 0,
    priceChange = 0,
    priceChangePercent = 0,
    sparklineData = [],
    isFavorite,
  } = item;

  // 检测价格变化并触发动画
  useEffect(() => {
    if (!enablePriceAnimation || currentPrice === undefined) return;

    if (previousPriceRef.current !== null && currentPrice !== previousPriceRef.current) {
      const changePercent = Math.abs(
        (currentPrice - previousPriceRef.current) / previousPriceRef.current
      );

      // 如果价格变化超过0.5%，触发动画
      if (changePercent >= 0.005) {
        setIsPriceAnimating(true);

        // 清理之前的定时器
        if (animationTimeoutRef.current) {
          clearTimeout(animationTimeoutRef.current);
        }

        // 设置动画结束定时器
        animationTimeoutRef.current = setTimeout(() => {
          setIsPriceAnimating(false);
        }, 800);
      }
    }

    previousPriceRef.current = currentPrice;

    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [currentPrice, enablePriceAnimation]);

  // 处理点击
  const handleClick = () => {
    onClick?.(item);
  };

  // 处理删除
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && confirm(`确定要删除 ${stockCode} - ${stockName} 吗？`)) {
      onDelete(stockCode);
    }
  };

  // 处理编辑
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(item);
  };

  // 处理查看详情
  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    onViewDetails?.(item);
  };

  // 获取价格颜色
  const getPriceColor = () => {
    if (priceChangePercent > 0) return "emerald";
    if (priceChangePercent < 0) return "rose";
    return "gray";
  };

  // 获取趋势线颜色
  const getSparklineColor = () => {
    if (priceChangePercent > 0) return "up";
    if (priceChangePercent < 0) return "down";
    return "neutral";
  };

  // 格式化价格
  const formatPrice = (price: number) => {
    return `¥${price.toFixed(2)}`;
  };

  // 生成模拟趋势线数据（如果没有提供）
  const getSparklineData = () => {
    if (sparklineData && sparklineData.length > 0) {
      return sparklineData;
    }

    // 生成模拟数据
    const basePrice = currentPrice || 100;
    const dataPoints = 10;
    const data: number[] = [];

    for (let i = 0; i < dataPoints; i++) {
      const volatility = 0.02; // 2%波动
      const randomChange = (Math.random() - 0.5) * 2 * volatility;
      const price = basePrice * (1 + randomChange * (i / dataPoints));
      data.push(price);
    }

    return data;
  };

  const priceColor = getPriceColor();
  const sparklineColor = getSparklineColor();
  const sparklineDataToShow = getSparklineData();

  return (
    <motion.div
      className={cn(
        "group relative rounded-xl border bg-card p-4 transition-all duration-300",
        "hover:shadow-lg hover:border-primary/30",
        isSelected && "border-primary bg-primary/5",
        "cursor-pointer select-none",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* 选中指示器 */}
      {isSelected && (
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-full" />
      )}

      <div className="flex items-center justify-between">
        {/* 左侧：股票信息和Toggle */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Toggle按钮 */}
          <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <CompactWatchlistToggle
              stockCode={stockCode}
              stockName={stockName}
              initialIsFavorite={isFavorite}
            />
          </div>

          {/* 股票信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <h3 className="text-base font-semibold text-foreground truncate">
                {stockCode}
              </h3>
              <span className="text-sm text-muted-foreground truncate">
                {stockName}
              </span>
            </div>

            {/* 价格和变化 */}
            <div className="flex items-center gap-3 mt-1">
              {/* 价格（带动画） */}
              <ColorTransition
                baseColor={`${priceColor}-50`}
                highlightColor={`${priceColor}-100`}
                isActive={isPriceAnimating}
                duration={800}
                animationType="pulse"
                className="px-2 py-1 rounded-md"
              >
                <div className="text-lg font-bold text-foreground">
                  {formatPrice(currentPrice)}
                </div>
              </ColorTransition>

              {/* 价格变化指示器 */}
              {showChangeIndicator && (
                <PriceChangeIndicator
                  change={priceChange}
                  changePercent={priceChangePercent}
                  size="sm"
                  showIcon={true}
                  showAbsolute={false}
                  showPercent={true}
                />
              )}
            </div>
          </div>
        </div>

        {/* 右侧：趋势线和操作菜单 */}
        <div className="flex items-center gap-3">
          {/* 趋势线 */}
          {showSparkline && (
            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <CompactSparkline
                data={sparklineDataToShow}
                width={70}
                height={24}
                color={sparklineColor}
                animate={isPriceAnimating}
                animationDuration={800}
              />
            </div>
          )}

          {/* 操作菜单 */}
          {showActions && (
            <AnimatePresence>
              {(isHovered || isSelected) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={handleViewDetails}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        查看详情
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleEdit}>
                        <Edit2 className="mr-2 h-4 w-4" />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleDelete}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* 悬停时的背景效果 */}
      <motion.div
        className="absolute inset-0 rounded-xl bg-primary/5 opacity-0"
        initial={false}
        animate={{ opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      />
    </motion.div>
  );
}

/**
 * 紧凑版列表项（用于空间有限的地方）
 */
export function CompactWatchlistItem({
  item,
  showSparkline = false,
  showChangeIndicator = false,
  ...props
}: Omit<WatchlistItemProps, "showActions">) {
  return (
    <WatchlistItem
      item={item}
      showActions={false}
      showSparkline={showSparkline}
      showChangeIndicator={showChangeIndicator}
      {...props}
    />
  );
}

/**
 * 增强版列表项（带有更多信息）
 */
export interface EnhancedWatchlistItemProps extends WatchlistItemProps {
  // 是否显示买入成本
  showBuyPrice?: boolean;
  // 是否显示目标价
  showTargetPrice?: boolean;
  // 是否显示止损价
  showStopLossPrice?: boolean;
  // 是否显示盈亏
  showProfitLoss?: boolean;
}

export function EnhancedWatchlistItem({
  item,
  showBuyPrice = true,
  showTargetPrice = true,
  showStopLossPrice = true,
  showProfitLoss = true,
  ...props
}: EnhancedWatchlistItemProps) {
  const {
    buyPrice,
    targetPrice,
    stopLossPrice,
    currentPrice = 0,
  } = item;

  // 计算盈亏
  const calculateProfitLoss = () => {
    if (!buyPrice || !currentPrice) return null;
    return ((currentPrice - buyPrice) / buyPrice) * 100;
  };

  const profitLoss = calculateProfitLoss();

  return (
    <div className="space-y-3">
      <WatchlistItem item={item} {...props} />

      {/* 额外信息 */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        {/* 买入成本 */}
        {showBuyPrice && buyPrice && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">买入成本</span>
            <span className="font-medium">¥{buyPrice.toFixed(2)}</span>
          </div>
        )}

        {/* 目标价 */}
        {showTargetPrice && targetPrice && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">目标价</span>
            <span className="font-medium text-emerald-600">
              ¥{targetPrice.toFixed(2)}
            </span>
          </div>
        )}

        {/* 止损价 */}
        {showStopLossPrice && stopLossPrice && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">止损价</span>
            <span className="font-medium text-rose-600">
              ¥{stopLossPrice.toFixed(2)}
            </span>
          </div>
        )}

        {/* 盈亏 */}
        {showProfitLoss && profitLoss !== null && (
          <div className="flex items-center justify-between col-span-2">
            <span className="text-muted-foreground">当前盈亏</span>
            <span
              className={cn(
                "font-medium",
                profitLoss >= 0 ? "text-emerald-600" : "text-rose-600"
              )}
            >
              {profitLoss >= 0 ? "+" : ""}
              {profitLoss.toFixed(2)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}