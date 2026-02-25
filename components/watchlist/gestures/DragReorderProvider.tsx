"use client";

import React, { createContext, useContext, useRef, ReactNode } from "react";
import { useSprings, animated } from "@react-spring/web";
import { useDragReorder, DragReorderItem } from "./useDragReorder";

interface DragReorderContextType {
  items: DragReorderItem[];
  springs: any[];
  containerRef: React.RefObject<HTMLDivElement>;
  itemRefs: React.RefObject<(HTMLDivElement | null)[]>;
  draggingIndex: number | null;
  order: number[];
  getItemBind: (index: number) => any;
}

const DragReorderContext = createContext<DragReorderContextType | undefined>(undefined);

interface DragReorderProviderProps {
  children: ReactNode;
  items: DragReorderItem[];
  onReorder?: (fromIndex: number, toIndex: number) => void;
  enabled?: boolean;
}

/**
 * 拖拽排序上下文提供者
 * 为Watchlist列表提供拖拽排序功能
 */
export function DragReorderProvider({
  children,
  items,
  onReorder,
  enabled = true,
}: DragReorderProviderProps) {
  const {
    springs,
    containerRef,
    itemRefs,
    draggingIndex,
    order,
    getItemBind,
  } = useDragReorder({
    items,
    onReorder,
    enabled,
  });

  return (
    <DragReorderContext.Provider
      value={{
        items,
        springs,
        containerRef,
        itemRefs,
        draggingIndex,
        order,
        getItemBind,
      }}
    >
      {children}
    </DragReorderContext.Provider>
  );
}

/**
 * 使用拖拽排序上下文
 */
export function useDragReorderContext() {
  const context = useContext(DragReorderContext);
  if (!context) {
    throw new Error("useDragReorderContext must be used within DragReorderProvider");
  }
  return context;
}

/**
 * 拖拽排序容器组件
 */
export function DragReorderContainer({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { containerRef } = useDragReorderContext();

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

/**
 * 拖拽排序项目包装器
 */
export function DragReorderItemWrapper({
  index,
  children,
  className = "",
  style,
}: {
  index: number;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { springs, getItemBind, draggingIndex } = useDragReorderContext();
  const bind = getItemBind(index);
  const spring = springs[index];

  const isDragging = draggingIndex === index;

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
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
      }}
      className={`transition-all duration-200 ${className} ${
        isDragging ? "opacity-90" : "opacity-100"
      }`}
    >
      {children}
    </animated.div>
  );
}

/**
 * 拖拽排序占位符
 * 用于显示拖拽时的空位
 */
export function DragReorderPlaceholder({
  index,
  height,
  className = "",
}: {
  index: number;
  height: number;
  className?: string;
}) {
  const { springs } = useDragReorderContext();
  const spring = springs[index];

  return (
    <animated.div
      style={{
        height: `${height}px`,
        y: spring.y,
        opacity: spring.shadow.to((s: number) => 1 - s * 2),
      }}
      className={`bg-muted/30 rounded-lg border-2 border-dashed border-muted ${className}`}
    />
  );
}

/**
 * 拖拽排序指示器
 * 显示当前拖拽状态
 */
export function DragReorderIndicator() {
  const { draggingIndex } = useDragReorderContext();

  if (draggingIndex === null) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
        <div className="animate-pulse">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </div>
        <span className="text-sm font-medium">拖拽调整顺序</span>
      </div>
    </div>
  );
}

/**
 * 拖拽排序辅助线
 * 显示拖拽时的参考线
 */
export function DragReorderGuide({
  index,
  isAbove = false,
}: {
  index: number;
  isAbove?: boolean;
}) {
  const { springs } = useDragReorderContext();
  const spring = springs[index];

  return (
    <animated.div
      style={{
        y: spring.y.to((y: number) => y + (isAbove ? -4 : 0)),
      }}
      className="absolute left-0 right-0 h-0.5 bg-primary z-40"
    />
  );
}