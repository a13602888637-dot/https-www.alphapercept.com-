"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

export interface ColorTransitionProps {
  // 基础颜色类名
  baseColor: string;
  // 高亮颜色类名
  highlightColor: string;
  // 是否激活高亮
  isActive: boolean;
  // 高亮持续时间（毫秒）
  duration?: number;
  // 动画类型
  animationType?: "pulse" | "flash" | "glow";
  // 自定义类名
  className?: string;
  // 子元素
  children?: React.ReactNode;
  // 点击回调
  onClick?: () => void;
}

/**
 * 色彩过渡动画组件
 * 用于价格跳变时的视觉反馈
 */
export function ColorTransition({
  baseColor,
  highlightColor,
  isActive,
  duration = 800,
  animationType = "pulse",
  className,
  children,
  onClick,
}: ColorTransitionProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 处理动画激活
  useEffect(() => {
    if (isActive && !isAnimating) {
      setIsAnimating(true);

      // 清理之前的定时器
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }

      // 设置动画结束定时器
      animationTimeoutRef.current = setTimeout(() => {
        setIsAnimating(false);
      }, duration);
    }

    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [isActive, duration, isAnimating]);

  // 根据动画类型获取动画配置
  const getAnimationConfig = () => {
    switch (animationType) {
      case "flash":
        return {
          initial: { backgroundColor: `var(--${baseColor})` },
          animate: {
            backgroundColor: [
              `var(--${baseColor})`,
              `var(--${highlightColor})`,
              `var(--${baseColor})`,
            ],
          },
          transition: {
            duration: duration / 1000,
            times: [0, 0.3, 1],
            ease: "easeInOut",
          },
        };
      case "glow":
        return {
          initial: { boxShadow: `0 0 0 0 var(--${highlightColor})` },
          animate: {
            boxShadow: [
              `0 0 0 0 var(--${highlightColor})`,
              `0 0 20px 5px var(--${highlightColor})`,
              `0 0 0 0 var(--${highlightColor})`,
            ],
          },
          transition: {
            duration: duration / 1000,
            times: [0, 0.5, 1],
            ease: "easeInOut",
          },
        };
      case "pulse":
      default:
        return {
          initial: { scale: 1, opacity: 1 },
          animate: {
            scale: [1, 1.02, 1],
            opacity: [1, 0.9, 1],
          },
          transition: {
            duration: duration / 1000,
            times: [0, 0.5, 1],
            ease: "easeInOut",
          },
        };
    }
  };

  const animationConfig = getAnimationConfig();

  return (
    <motion.div
      className={cn(
        "relative transition-colors duration-300",
        `bg-${baseColor}`,
        isAnimating && `bg-${highlightColor}/10`,
        className
      )}
      initial={animationConfig.initial}
      animate={isAnimating ? animationConfig.animate : {}}
      transition={animationConfig.transition}
      onClick={onClick}
    >
      {/* 背景高亮层 */}
      <AnimatePresence>
        {isAnimating && (
          <motion.div
            className={cn(
              "absolute inset-0 rounded-lg",
              `bg-${highlightColor}/20`
            )}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>

      {/* 内容 */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

/**
 * 价格变化指示器组件
 * 显示价格变化的方向和幅度
 */
export interface PriceChangeIndicatorProps {
  // 变化值
  change: number;
  // 变化百分比
  changePercent: number;
  // 是否显示绝对值
  showAbsolute?: boolean;
  // 是否显示百分比
  showPercent?: boolean;
  // 尺寸
  size?: "sm" | "md" | "lg";
  // 是否显示图标
  showIcon?: boolean;
  // 自定义类名
  className?: string;
}

export function PriceChangeIndicator({
  change,
  changePercent,
  showAbsolute = true,
  showPercent = true,
  size = "md",
  showIcon = true,
  className,
}: PriceChangeIndicatorProps) {
  const isPositive = change >= 0;
  const isNegative = change < 0;

  // 获取颜色类名
  const getColorClasses = () => {
    if (isPositive) {
      return {
        text: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-50 dark:bg-emerald-900/20",
        border: "border-emerald-200 dark:border-emerald-800",
        icon: "text-emerald-500",
      };
    } else if (isNegative) {
      return {
        text: "text-rose-600 dark:text-rose-400",
        bg: "bg-rose-50 dark:bg-rose-900/20",
        border: "border-rose-200 dark:border-rose-800",
        icon: "text-rose-500",
      };
    } else {
      return {
        text: "text-gray-600 dark:text-gray-400",
        bg: "bg-gray-50 dark:bg-gray-900/20",
        border: "border-gray-200 dark:border-gray-800",
        icon: "text-gray-500",
      };
    }
  };

  // 获取尺寸类名
  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return "px-2 py-1 text-xs";
      case "lg":
        return "px-3 py-1.5 text-base";
      case "md":
      default:
        return "px-2.5 py-1 text-sm";
    }
  };

  // 格式化数字
  const formatNumber = (num: number, isPercent = false) => {
    const absNum = Math.abs(num);
    const sign = num >= 0 ? "+" : "-";

    if (isPercent) {
      return `${sign}${absNum.toFixed(2)}%`;
    } else {
      return `${sign}¥${absNum.toFixed(2)}`;
    }
  };

  const colors = getColorClasses();
  const sizeClasses = getSizeClasses();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border",
        colors.bg,
        colors.border,
        sizeClasses,
        className
      )}
    >
      {showIcon && (
        <motion.div
          className={colors.icon}
          animate={{
            rotate: isPositive ? [0, 5, 0] : isNegative ? [0, -5, 0] : 0,
          }}
          transition={{ duration: 0.5, repeat: isPositive || isNegative ? 1 : 0 }}
        >
          {isPositive ? "↗" : isNegative ? "↘" : "→"}
        </motion.div>
      )}

      <div className={cn("font-medium", colors.text)}>
        {showAbsolute && (
          <span className="mr-1">{formatNumber(change, false)}</span>
        )}
        {showPercent && (
          <span>{formatNumber(changePercent, true)}</span>
        )}
      </div>
    </div>
  );
}