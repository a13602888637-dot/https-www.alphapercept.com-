"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MarketIndexCardProps {
  name: string;
  code: string;
  price: number;
  change: number;
  changePercent: number;
  isLoading?: boolean;
}

export function MarketIndexCard({
  name,
  code,
  price,
  change,
  changePercent,
  isLoading,
}: MarketIndexCardProps) {
  const isUp = change >= 0;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-20 mb-3" />
        <div className="h-8 bg-slate-700 rounded w-32 mb-2" />
        <div className="h-4 bg-slate-700 rounded w-24" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border p-4 transition-all duration-300",
        isUp
          ? "border-red-500/30 bg-gradient-to-br from-red-950/40 to-slate-800/50"
          : "border-green-500/30 bg-gradient-to-br from-green-950/40 to-slate-800/50"
      )}
    >
      {/* Breathing glow animation */}
      <div
        className={cn(
          "absolute inset-0 opacity-20 animate-pulse",
          isUp
            ? "bg-gradient-to-br from-red-500/10 to-transparent"
            : "bg-gradient-to-br from-green-500/10 to-transparent"
        )}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-300">{name}</span>
          <span className="text-xs text-slate-500">{code}</span>
        </div>

        <div className="text-2xl font-bold text-white mb-1">
          {price.toLocaleString("zh-CN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>

        <div
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium",
            isUp ? "text-red-400" : "text-green-400"
          )}
        >
          {isUp ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          <span>
            {isUp ? "+" : ""}
            {change.toFixed(2)}
          </span>
          <span>
            ({isUp ? "+" : ""}
            {changePercent.toFixed(2)}%)
          </span>
        </div>
      </div>
    </div>
  );
}
