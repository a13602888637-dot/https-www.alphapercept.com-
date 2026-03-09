"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, BarChart3, Gem, Percent, DollarSign } from "lucide-react";
import React from "react";

interface MacroMetricCardProps {
  name: string;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  category: string;
  isLoading?: boolean;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  index: BarChart3,
  commodity: Gem,
  rate: Percent,
  fx: DollarSign,
};

export const MacroMetricCard = React.memo(function MacroMetricCard({
  name,
  symbol,
  price,
  change,
  changePercent,
  category,
  isLoading,
}: MacroMetricCardProps) {
  const isUp = change >= 0;
  const Icon = CATEGORY_ICONS[category] || BarChart3;

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-3 animate-pulse">
        <div className="h-3 bg-slate-700 rounded w-16 mb-2" />
        <div className="h-6 bg-slate-700 rounded w-24 mb-1" />
        <div className="h-3 bg-slate-700 rounded w-20" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border p-3 transition-all duration-300",
        isUp
          ? "border-red-500/20 bg-gradient-to-br from-red-950/30 to-slate-800/50"
          : "border-green-500/20 bg-gradient-to-br from-green-950/30 to-slate-800/50"
      )}
    >
      <div
        className={cn(
          "absolute inset-0 opacity-15 animate-pulse",
          isUp ? "bg-gradient-to-br from-red-500/10 to-transparent" : "bg-gradient-to-br from-green-500/10 to-transparent"
        )}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-slate-400 truncate">{name}</span>
          <Icon className={cn("h-3 w-3", isUp ? "text-red-400/60" : "text-green-400/60")} />
        </div>
        <div className="text-lg font-bold text-white leading-tight">
          {price.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className={cn("flex items-center gap-1 text-xs font-medium mt-0.5", isUp ? "text-red-400" : "text-green-400")}>
          {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          <span>{isUp ? "+" : ""}{changePercent.toFixed(2)}%</span>
        </div>
      </div>
    </div>
  );
});
