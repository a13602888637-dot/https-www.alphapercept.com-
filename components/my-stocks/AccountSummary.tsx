"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Wallet,
  TrendingUp,
  Banknote,
  PieChart,
} from "lucide-react";

interface AccountSummaryProps {
  totalAssets: number;
  totalPnL: number;
  totalPnLPercent: number;
  cashRatio: number;
  maxSingleStockRatio: number;
  loading?: boolean;
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1e8) {
    return `${(value / 1e8).toFixed(2)}亿`;
  }
  if (Math.abs(value) >= 1e4) {
    return `${(value / 1e4).toFixed(2)}万`;
  }
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-[#1a2035] ${className ?? ""}`} />
  );
}

export function AccountSummary({
  totalAssets,
  totalPnL,
  totalPnLPercent,
  cashRatio,
  maxSingleStockRatio,
  loading = false,
}: AccountSummaryProps) {
  const pnlPositive = totalPnL >= 0;
  const cashWarn = cashRatio < 20;
  const stockWarn = maxSingleStockRatio > 40;

  const cards = [
    {
      label: "总资产",
      icon: Wallet,
      iconColor: "text-blue-400",
      render: () => (
        <span className="text-2xl font-bold font-mono tabular-nums text-white">
          <span className="text-base text-gray-400 mr-0.5">¥</span>
          {formatCurrency(totalAssets)}
        </span>
      ),
    },
    {
      label: "总盈亏",
      icon: TrendingUp,
      iconColor: pnlPositive ? "text-green-400" : "text-red-400",
      render: () => (
        <div className="flex items-baseline gap-2">
          <span
            className={`text-2xl font-bold font-mono tabular-nums ${
              pnlPositive ? "text-green-400" : "text-red-400"
            }`}
          >
            {pnlPositive ? "+" : ""}
            {formatCurrency(totalPnL)}
          </span>
          <span
            className={`text-sm font-mono tabular-nums ${
              pnlPositive ? "text-green-400/70" : "text-red-400/70"
            }`}
          >
            {pnlPositive ? "+" : ""}
            {totalPnLPercent.toFixed(2)}%
          </span>
        </div>
      ),
    },
    {
      label: "现金比例",
      icon: Banknote,
      iconColor: cashWarn ? "text-amber-400" : "text-emerald-400",
      render: () => (
        <div className="flex items-baseline gap-2">
          <span
            className={`text-2xl font-bold font-mono tabular-nums ${
              cashWarn ? "text-amber-400" : "text-white"
            }`}
          >
            {cashRatio.toFixed(1)}%
          </span>
          {cashWarn && (
            <span className="text-xs text-amber-400/80">
              低于 20% 警戒线
            </span>
          )}
        </div>
      ),
    },
    {
      label: "最大单股占比",
      icon: PieChart,
      iconColor: stockWarn ? "text-amber-400" : "text-cyan-400",
      render: () => (
        <div className="flex items-baseline gap-2">
          <span
            className={`text-2xl font-bold font-mono tabular-nums ${
              stockWarn ? "text-amber-400" : "text-white"
            }`}
          >
            {maxSingleStockRatio.toFixed(1)}%
          </span>
          {stockWarn && (
            <span className="text-xs text-amber-400/80">
              超过 40% 上限
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.label}
            className="bg-[#0d1117] border-[#1a2035] shadow-none"
          >
            <CardContent className="p-4">
              {loading ? (
                <div className="space-y-3">
                  <SkeletonBlock className="h-4 w-20" />
                  <SkeletonBlock className="h-8 w-28" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon className={`h-4 w-4 ${card.iconColor}`} />
                    <span className="text-xs text-gray-400">{card.label}</span>
                  </div>
                  {card.render()}
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
