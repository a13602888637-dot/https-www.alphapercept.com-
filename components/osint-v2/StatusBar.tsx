"use client";

import type { OsintContext } from "@/lib/osint/contracts";

function formatTime(value: string | undefined): string {
  if (!value) return "--:--";
  return new Date(value).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export function StatusBar({ context, isRefreshing, error }: { context: OsintContext | null; isRefreshing: boolean; error: string | null }) {
  const ratio = context?.coverage.ratio ?? 0;
  const state = error && !context ? "不可用" : ratio >= 0.8 ? "数据健康" : ratio > 0 ? "部分可用" : "等待数据";
  const stateClass = error && !context ? "text-red-400" : ratio >= 0.8 ? "text-emerald-300" : "text-amber-300";

  return (
    <footer className="flex min-h-7 items-center gap-3 border-t border-[#1F2A3A] bg-[#070B12] px-4 font-mono text-[10px] text-[#718096]">
      <span className={`inline-flex items-center gap-1.5 ${stateClass}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{state}</span>
      <span>Agent 数据接口 v1</span>
      <span>REST 只读</span>
      <span>schema 1.0</span>
      <span>coverage {Math.round(ratio * 100)}%</span>
      {context && context.coverage.stale > 0 && <span className="text-amber-300">stale {context.coverage.stale}</span>}
      <span>{isRefreshing ? "刷新中" : `更新 ${formatTime(context?.generatedAt)}`}</span>
      <span className="ml-auto hidden sm:inline">所有时间均为北京时间（UTC+8）</span>
    </footer>
  );
}
