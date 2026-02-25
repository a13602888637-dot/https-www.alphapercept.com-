"use client";

import { useState, useRef, useCallback } from "react";
import { useSprings, animated } from "@react-spring/web";
import { useDrag } from "@use-gesture/react";
import { useWatchlistStore } from "@/lib/store/watchlist-store";
import {
  DAMPING_COEFFICIENT,
  SPRING_COEFFICIENT,
  SNAP_THRESHOLD,
  calculateSpring,
  calculateDragScale,
  calculateShadowIntensity,
} from "@/lib/utils/physics";

interface DragReorderItem {
  id: string;
  index: number;
  height: number;
}

interface UseDragReorderOptions {
  items: DragReorderItem[];
  onReorder?: (fromIndex: number, toIndex: number) => void;
  enabled?: boolean;
}

/**
 * 拖拽排序自定义Hook
 * 提供物理引擎级别的拖拽排序功能
 */
export function useDragReorder({
  items,
  onReorder,
  enabled = true,
}: UseDragReorderOptions) {
  const reorderItems = useWatchlistStore((state) => state.reorderItems);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [order, setOrder] = useState<number[]>(items.map((_, i) => i));
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 计算每个项目的位置
  const calculatePositions = useCallback(() => {
    const positions: number[] = [];
    let currentY = 0;

    items.forEach((item, index) => {
      positions[index] = currentY;
      currentY += item.height + 8; // 8px是间距
    });

    return positions;
  }, [items]);

  // 创建弹簧动画
  const [springs, api] = useSprings(
    items.length,
    (index) => ({
      y: calculatePositions()[index],
      scale: 1,
      shadow: 0,
      zIndex: 0,
      immediate: false,
    }),
    [items]
  );

  // 更新项目顺序
  const updateOrder = useCallback(
    (fromIndex: number, toIndex: number) => {
      const newOrder = [...order];
      const [removed] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, removed);
      setOrder(newOrder);

      // 调用外部回调
      if (onReorder) {
        onReorder(fromIndex, toIndex);
      }

      // 更新store中的顺序
      const newItemOrder = newOrder.map((index) => items[index].id);
      reorderItems(newItemOrder);
    },
    [order, items, onReorder, reorderItems]
  );

  // 计算拖拽时的目标位置
  const calculateTargetPosition = useCallback(
    (draggedIndex: number, currentY: number) => {
      const positions = calculatePositions();
      let targetIndex = draggedIndex;

      // 查找应该插入的位置
      for (let i = 0; i < items.length; i++) {
        if (i === draggedIndex) continue;

        const itemCenter = positions[i] + items[i].height / 2;
        if (currentY < itemCenter) {
          targetIndex = i;
          break;
        }
      }

      // 如果拖到最下面，插入到最后
      if (currentY >= positions[positions.length - 1] + items[items.length - 1].height / 2) {
        targetIndex = items.length - 1;
      }

      return targetIndex;
    },
    [items, calculatePositions]
  );

  // 拖拽手势绑定
  const bind = useDrag(
    ({ args: [originalIndex], active, movement: [, my], velocity: [, vy], direction: [, dy], first, last }) => {
      if (!enabled) return;

      const index = order.indexOf(originalIndex);
      const positions = calculatePositions();

      if (first) {
        setDraggingIndex(index);
        // 开始拖拽时，提升z-index
        api.start((i) => {
          if (i === index) {
            return {
              zIndex: 50,
              scale: 1.05,
              shadow: 0.3,
              immediate: true,
            };
          }
          return {};
        });
      }

      if (active) {
        // 拖拽中
        const currentY = positions[index] + my;
        const targetIndex = calculateTargetPosition(index, currentY);

        // 更新被拖拽项目的位置
        api.start((i) => {
          if (i === index) {
            return {
              y: currentY,
              scale: calculateDragScale(Math.abs(my)),
              shadow: calculateShadowIntensity(Math.abs(my)),
              immediate: true,
            };
          }

          // 更新其他项目的位置
          if (targetIndex !== index) {
            const shouldMoveUp = i >= targetIndex && i < index;
            const shouldMoveDown = i <= targetIndex && i > index;

            if (shouldMoveUp) {
              return {
                y: positions[i] + items[index].height + 8,
                immediate: false,
              };
            } else if (shouldMoveDown) {
              return {
                y: positions[i] - items[index].height - 8,
                immediate: false,
              };
            }
          }

          return {
            y: positions[i],
            immediate: false,
          };
        });

        // 如果拖拽到新位置，更新顺序
        if (targetIndex !== index) {
          updateOrder(index, targetIndex);
        }
      } else if (last) {
        // 拖拽结束
        setDraggingIndex(null);
        const finalPositions = calculatePositions();

        // 使用弹簧动画回到最终位置
        api.start((i) => {
          const targetY = finalPositions[i];
          const currentY = springs[i].y.get();

          // 计算惯性
          const inertia = vy * 50; // 速度乘以系数得到惯性位移

          // 使用弹簧动画
          return {
            y: targetY + inertia,
            scale: 1,
            shadow: 0,
            zIndex: 0,
            config: {
              tension: 300,
              friction: 30,
            },
          };
        });

        // 短暂延迟后完全归位
        setTimeout(() => {
          api.start((i) => ({
            y: finalPositions[i],
            immediate: false,
          }));
        }, 300);
      }
    },
    {
      enabled,
      filterTaps: true, // 过滤点击事件
      bounds: containerRef, // 限制在容器内
      rubberband: true, // 启用橡皮筋效果
      from: () => [0, springs[order.indexOf(draggingIndex!)].y.get()],
    }
  );

  // 获取项目绑定函数
  const getItemBind = useCallback(
    (index: number) => {
      return bind(index);
    },
    [bind]
  );

  return {
    springs,
    api,
    containerRef,
    itemRefs,
    draggingIndex,
    order,
    getItemBind,
    calculatePositions,
  };
}

/**
 * 拖拽排序项目组件
 */
export function DragReorderItem({
  index,
  style,
  children,
  bind,
  spring,
}: {
  index: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
  bind: any;
  spring: any;
}) {
  return (
    <animated.div
      {...bind()}
      style={{
        ...style,
        y: spring.y,
        scale: spring.scale,
        boxShadow: spring.shadow.to(
          (s: number) => `0 ${s * 10}px ${s * 20}px rgba(0, 0, 0, ${s * 0.2})`
        ),
        zIndex: spring.zIndex,
        position: "relative",
        touchAction: "none",
        cursor: "grab",
        userSelect: "none",
      }}
      className="active:cursor-grabbing"
    >
      {children}
    </animated.div>
  );
}