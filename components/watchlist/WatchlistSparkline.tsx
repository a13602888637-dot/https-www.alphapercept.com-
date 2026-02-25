"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface WatchlistSparklineProps {
  // 数据点数组
  data: number[];
  // 宽度
  width?: number;
  // 高度
  height?: number;
  // 线条颜色（上涨/下跌）
  color?: "up" | "down" | "neutral" | "custom";
  // 自定义颜色
  customColor?: string;
  // 是否显示动画
  animate?: boolean;
  // 动画持续时间（毫秒）
  animationDuration?: number;
  // 是否显示填充
  showFill?: boolean;
  // 填充不透明度
  fillOpacity?: number;
  // 线条宽度
  strokeWidth?: number;
  // 是否显示点
  showPoints?: boolean;
  // 点半径
  pointRadius?: number;
  // 自定义类名
  className?: string;
  // 点击回调
  onClick?: () => void;
}

/**
 * 微型趋势线组件
 * 使用SVG绘制，支持动态数据更新
 */
export function WatchlistSparkline({
  data: initialData,
  width = 80,
  height = 30,
  color = "neutral",
  customColor,
  animate = true,
  animationDuration = 1000,
  showFill = true,
  fillOpacity = 0.1,
  strokeWidth = 1.5,
  showPoints = false,
  pointRadius = 1.5,
  className,
  onClick,
}: WatchlistSparklineProps) {
  const [data, setData] = useState<number[]>(initialData);
  const [isAnimating, setIsAnimating] = useState(false);
  const previousDataRef = useRef<number[]>(initialData);
  const svgRef = useRef<SVGSVGElement>(null);

  // 数据更新效果
  useEffect(() => {
    if (JSON.stringify(initialData) !== JSON.stringify(previousDataRef.current)) {
      setData(initialData);
      previousDataRef.current = initialData;

      if (animate) {
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), animationDuration);
      }
    }
  }, [initialData, animate, animationDuration]);

  // 获取颜色
  const getColor = () => {
    if (customColor) return customColor;

    switch (color) {
      case "up":
        return "#10B981"; // Emerald-500
      case "down":
        return "#EF4444"; // Red-500
      case "neutral":
        return "#6B7280"; // Gray-500
      default:
        return "#6B7280";
    }
  };

  // 计算SVG路径
  const calculatePath = (dataPoints: number[]): string => {
    if (dataPoints.length < 2) return "";

    const points = dataPoints;
    const minValue = Math.min(...points);
    const maxValue = Math.max(...points);
    const valueRange = maxValue - minValue || 1;

    const xStep = width / (points.length - 1);
    const yScale = height / valueRange;

    let path = `M 0 ${height - (points[0] - minValue) * yScale}`;

    for (let i = 1; i < points.length; i++) {
      const x = i * xStep;
      const y = height - (points[i] - minValue) * yScale;
      path += ` L ${x} ${y}`;
    }

    return path;
  };

  // 计算填充路径
  const calculateFillPath = (dataPoints: number[]): string => {
    if (dataPoints.length < 2) return "";

    const linePath = calculatePath(dataPoints);
    const points = dataPoints;
    const minValue = Math.min(...points);
    const maxValue = Math.max(...points);
    const valueRange = maxValue - minValue || 1;

    const lastX = width;
    const lastY = height - (points[points.length - 1] - minValue) * (height / valueRange);

    return `${linePath} L ${lastX} ${height} L 0 ${height} Z`;
  };

  // 计算数据点
  const calculatePoints = (dataPoints: number[]) => {
    if (dataPoints.length < 2) return [];

    const points = dataPoints;
    const minValue = Math.min(...points);
    const maxValue = Math.max(...points);
    const valueRange = maxValue - minValue || 1;

    const xStep = width / (points.length - 1);
    const yScale = height / valueRange;

    return points.map((value, index) => ({
      x: index * xStep,
      y: height - (value - minValue) * yScale,
      value,
    }));
  };

  // 计算趋势方向
  const calculateTrend = (dataPoints: number[]): "up" | "down" | "flat" => {
    if (dataPoints.length < 2) return "flat";

    const first = dataPoints[0];
    const last = dataPoints[dataPoints.length - 1];
    const change = last - first;
    const changePercent = (change / Math.abs(first)) * 100;

    if (changePercent > 0.5) return "up";
    if (changePercent < -0.5) return "down";
    return "flat";
  };

  const lineColor = getColor();
  const linePath = calculatePath(data);
  const fillPath = showFill ? calculateFillPath(data) : "";
  const points = showPoints ? calculatePoints(data) : [];
  const trend = calculateTrend(data);

  // 动画变体
  const lineVariants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: {
        pathLength: {
          duration: animationDuration / 1000,
          ease: "easeInOut",
        },
        opacity: { duration: 0.3 },
      },
    },
  };

  const fillVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: fillOpacity,
      transition: {
        duration: animationDuration / 1000,
        ease: "easeInOut",
      },
    },
  };

  return (
    <div
      className={cn("relative inline-block", className)}
      onClick={onClick}
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        {/* 填充区域 */}
        {showFill && fillPath && (
          <motion.path
            d={fillPath}
            fill={lineColor}
            initial="hidden"
            animate={isAnimating ? "visible" : { opacity: fillOpacity }}
            variants={fillVariants}
          />
        )}

        {/* 趋势线 */}
        {linePath && (
          <motion.path
            d={linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial="hidden"
            animate={isAnimating ? "visible" : { pathLength: 1, opacity: 1 }}
            variants={lineVariants}
          />
        )}

        {/* 数据点 */}
        {showPoints &&
          points.map((point, index) => (
            <motion.circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={pointRadius}
              fill={lineColor}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: isAnimating ? 1 : 0.8,
                opacity: isAnimating ? 1 : 0.7,
              }}
              transition={{
                delay: (index * animationDuration) / (points.length * 1000),
                duration: 0.3,
              }}
            />
          ))}
      </svg>

      {/* 趋势指示器 */}
      <div className="absolute -top-1 -right-1">
        <motion.div
          className={cn(
            "w-2 h-2 rounded-full",
            trend === "up" && "bg-emerald-500",
            trend === "down" && "bg-rose-500",
            trend === "flat" && "bg-gray-500"
          )}
          animate={{
            scale: isAnimating ? [1, 1.2, 1] : 1,
          }}
          transition={{
            duration: 0.5,
            repeat: isAnimating ? Infinity : 0,
          }}
        />
      </div>
    </div>
  );
}

/**
 * 简化的趋势线组件（用于列表项等空间有限的地方）
 */
export function CompactSparkline({
  data,
  width = 60,
  height = 20,
  color = "neutral",
  ...props
}: Omit<WatchlistSparklineProps, "showFill" | "showPoints" | "strokeWidth">) {
  return (
    <WatchlistSparkline
      data={data}
      width={width}
      height={height}
      color={color}
      showFill={false}
      showPoints={false}
      strokeWidth={1}
      {...props}
    />
  );
}

/**
 * 增强的趋势线组件（带有统计信息）
 */
export interface EnhancedSparklineProps extends WatchlistSparklineProps {
  // 是否显示统计信息
  showStats?: boolean;
  // 统计信息位置
  statsPosition?: "top" | "bottom" | "left" | "right";
}

export function EnhancedSparkline({
  data,
  showStats = true,
  statsPosition = "bottom",
  ...props
}: EnhancedSparklineProps) {
  const calculateStats = () => {
    if (data.length < 2) {
      return { change: 0, changePercent: 0, trend: "flat" as const };
    }

    const first = data[0];
    const last = data[data.length - 1];
    const change = last - first;
    const changePercent = (change / Math.abs(first)) * 100;

    let trend: "up" | "down" | "flat" = "flat";
    if (changePercent > 0.5) trend = "up";
    if (changePercent < -0.5) trend = "down";

    return {
      change,
      changePercent: Math.abs(changePercent),
      trend,
      isPositive: change >= 0,
    };
  };

  const stats = calculateStats();

  // 获取统计信息容器类名
  const getStatsContainerClasses = () => {
    switch (statsPosition) {
      case "top":
        return "flex-col-reverse items-center";
      case "bottom":
        return "flex-col items-center";
      case "left":
        return "flex-row-reverse items-center";
      case "right":
      default:
        return "flex-row items-center";
    }
  };

  // 获取统计信息文本类名
  const getStatsTextClasses = () => {
    if (stats.isPositive) {
      return "text-emerald-600 dark:text-emerald-400";
    } else if (stats.change < 0) {
      return "text-rose-600 dark:text-rose-400";
    } else {
      return "text-gray-600 dark:text-gray-400";
    }
  };

  return (
    <div className={cn("inline-flex gap-2", getStatsContainerClasses())}>
      <WatchlistSparkline data={data} {...props} />

      {showStats && data.length >= 2 && (
        <div className={cn("text-xs font-medium", getStatsTextClasses())}>
          {stats.isPositive ? "+" : "-"}
          {stats.changePercent.toFixed(1)}%
        </div>
      )}
    </div>
  );
}