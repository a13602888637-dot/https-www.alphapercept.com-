"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Trash2,
  Radar,
  PackageOpen,
  Star,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Position {
  stockCode: string;
  stockName: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  profitLoss: number;
  profitLossPercent: number;
  weight: number;
}

interface TriggerItem {
  id: string;
  stockCode: string;
  stockName: string;
  currentPrice: number;
  triggerLow: number;
  triggerHigh: number;
  triggered: boolean;
  direction: "above" | "below" | "in_range";
  logic: string;
}

interface PositionTableProps {
  positions: Position[];
  triggers: TriggerItem[];
  loading?: boolean;
  onDeleteTrigger?: (id: string) => void;
  // Watchlist integration
  watchlistCodes?: Set<string>;
  onAddToWatchlist?: (stockCode: string, stockName: string) => void;
  onRemoveFromWatchlist?: (stockCode: string) => void;
  // Cash & reverse repo summary rows
  cashBalance?: number;
  reverseRepo?: number;
  totalAssets?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(v: number): string {
  return v.toFixed(2);
}

function WeightBar({ weight }: { weight: number }) {
  const warn = weight > 40;
  const clampedWidth = Math.min(weight, 100);
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 h-1.5 rounded-full bg-[#1a2035] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            warn ? "bg-amber-400" : "bg-cyan-500/70"
          }`}
          style={{ width: `${clampedWidth}%` }}
        />
      </div>
      <span
        className={`text-xs font-mono tabular-nums ${
          warn ? "text-amber-400" : "text-gray-400"
        }`}
      >
        {weight.toFixed(1)}%
      </span>
    </div>
  );
}

function StatusBadge({
  triggered,
  direction,
}: {
  triggered: boolean;
  direction: TriggerItem["direction"];
}) {
  if (triggered) {
    return (
      <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs">
        已触发
      </Badge>
    );
  }
  if (direction === "above") {
    return (
      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">
        高于区间
      </Badge>
    );
  }
  if (direction === "below") {
    return (
      <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs">
        低于区间
      </Badge>
    );
  }
  return (
    <Badge className="bg-gray-500/15 text-gray-400 border-gray-500/30 text-xs">
      未触发
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Skeleton helpers
// ---------------------------------------------------------------------------

function SkeletonTableRow() {
  return (
    <tr>
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-3 py-2.5">
          <div className="h-4 rounded bg-[#1a2035] animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

function SkeletonTriggerRow() {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="h-4 w-20 rounded bg-[#1a2035] animate-pulse" />
      <div className="h-4 w-16 rounded bg-[#1a2035] animate-pulse" />
      <div className="flex-1" />
      <div className="h-5 w-14 rounded bg-[#1a2035] animate-pulse" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

function EmptyPositions() {
  return (
    <tr>
      <td colSpan={7} className="py-10 text-center">
        <PackageOpen className="h-8 w-8 text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500">暂无持仓记录</p>
        <p className="text-xs text-gray-600 mt-1">
          在 Portfolio 页面添加持仓后数据将展示在这里
        </p>
      </td>
    </tr>
  );
}

function EmptyTriggers() {
  return (
    <div className="flex flex-col items-center py-8">
      <Radar className="h-8 w-8 text-gray-600 mb-2" />
      <p className="text-sm text-gray-500">暂无监控标的</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PositionTable({
  positions,
  triggers,
  loading = false,
  onDeleteTrigger,
  watchlistCodes,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  cashBalance,
  reverseRepo,
  totalAssets,
}: PositionTableProps) {
  return (
    <Card className="bg-[#0d1117] border-[#1a2035] shadow-none col-span-1 md:col-span-2">
      {/* ---- Positions ---- */}
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-cyan-400" />
          <CardTitle className="text-base font-semibold text-white">
            持仓列表
          </CardTitle>
          {!loading && (
            <span className="text-xs text-gray-500 ml-1">
              {positions.length} 只
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a2035] text-gray-500 text-xs">
              <th className="text-left px-3 py-2 font-medium">股票</th>
              <th className="text-right px-3 py-2 font-medium">股数</th>
              <th className="text-right px-3 py-2 font-medium">成本</th>
              <th className="text-right px-3 py-2 font-medium">现价</th>
              <th className="text-right px-3 py-2 font-medium">盈亏%</th>
              <th className="text-right px-3 py-2 font-medium">占比</th>
              <th className="text-center px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a2035]/60">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <SkeletonTableRow key={i} />
              ))
            ) : positions.length === 0 ? (
              <EmptyPositions />
            ) : (
              positions.map((pos) => {
                const positive = pos.profitLossPercent >= 0;
                return (
                  <tr
                    key={pos.stockCode}
                    className="hover:bg-[#0a1020] transition-colors"
                  >
                    {/* Stock info */}
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col">
                        <span className="text-white text-sm font-medium leading-tight">
                          {pos.stockName}
                        </span>
                        <span className="text-[11px] text-gray-500 font-mono">
                          {pos.stockCode}
                        </span>
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="text-right px-3 py-2.5 text-gray-300 font-mono tabular-nums">
                      {pos.quantity.toLocaleString()}
                    </td>

                    {/* Cost */}
                    <td className="text-right px-3 py-2.5 text-gray-300 font-mono tabular-nums">
                      {formatPrice(pos.avgCost)}
                    </td>

                    {/* Current price */}
                    <td className="text-right px-3 py-2.5 text-white font-mono tabular-nums">
                      {formatPrice(pos.currentPrice)}
                    </td>

                    {/* P&L percent */}
                    <td
                      className={`text-right px-3 py-2.5 font-mono tabular-nums font-medium ${
                        positive ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {positive ? "+" : ""}
                      {pos.profitLossPercent.toFixed(2)}%
                    </td>

                    {/* Weight */}
                    <td className="px-3 py-2.5">
                      <WeightBar weight={pos.weight} />
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2.5 text-center">
                      {watchlistCodes?.has(pos.stockCode) ? (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                          onClick={() =>
                            onRemoveFromWatchlist?.(pos.stockCode)
                          }
                        >
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-gray-500 hover:text-amber-400 hover:bg-amber-500/10"
                          onClick={() =>
                            onAddToWatchlist?.(pos.stockCode, pos.stockName)
                          }
                        >
                          <Star className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}

            {/* ---- Cash & Reverse Repo summary rows ---- */}
            {!loading && positions.length > 0 && totalAssets && totalAssets > 0 && (
              <>
                {(cashBalance ?? 0) > 0 && (
                  <tr className="text-gray-500">
                    <td className="px-3 py-2.5">
                      <span className="text-sm font-medium">现金</span>
                    </td>
                    <td className="text-right px-3 py-2.5">&mdash;</td>
                    <td className="text-right px-3 py-2.5">&mdash;</td>
                    <td className="text-right px-3 py-2.5">&mdash;</td>
                    <td className="text-right px-3 py-2.5">&mdash;</td>
                    <td className="px-3 py-2.5">
                      <WeightBar
                        weight={((cashBalance ?? 0) / totalAssets) * 100}
                      />
                    </td>
                    <td className="px-3 py-2.5">&mdash;</td>
                  </tr>
                )}
                {(reverseRepo ?? 0) > 0 && (
                  <tr className="text-gray-500">
                    <td className="px-3 py-2.5">
                      <span className="text-sm font-medium">国债逆回购</span>
                    </td>
                    <td className="text-right px-3 py-2.5">&mdash;</td>
                    <td className="text-right px-3 py-2.5">&mdash;</td>
                    <td className="text-right px-3 py-2.5">&mdash;</td>
                    <td className="text-right px-3 py-2.5">&mdash;</td>
                    <td className="px-3 py-2.5">
                      <WeightBar
                        weight={((reverseRepo ?? 0) / totalAssets) * 100}
                      />
                    </td>
                    <td className="px-3 py-2.5">&mdash;</td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>

        {/* ---- Trigger / Monitor Section ---- */}
        <div className="mt-6 pt-4 border-t border-[#1a2035]">
          <div className="flex items-center gap-2 mb-3">
            <Radar className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-semibold text-white">监控清单</span>
            {!loading && triggers.length > 0 && (
              <span className="text-xs text-gray-500">
                {triggers.length} 只
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-1">
              {Array.from({ length: 2 }).map((_, i) => (
                <SkeletonTriggerRow key={i} />
              ))}
            </div>
          ) : triggers.length === 0 ? (
            <EmptyTriggers />
          ) : (
            <div className="divide-y divide-[#1a2035]/60">
              {triggers.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 py-2.5 hover:bg-[#0a1020] transition-colors rounded px-2 -mx-2"
                >
                  {/* Stock info */}
                  <div className="min-w-[80px]">
                    <span className="text-sm text-white font-medium">
                      {t.stockName}
                    </span>
                    <span className="text-[11px] text-gray-500 font-mono ml-1.5">
                      {t.stockCode}
                    </span>
                  </div>

                  {/* Current price */}
                  <span className="text-sm font-mono tabular-nums text-white min-w-[60px] text-right">
                    {formatPrice(t.currentPrice)}
                  </span>

                  {/* Trigger range */}
                  <span className="text-xs font-mono tabular-nums text-green-400/80">
                    {formatPrice(t.triggerLow)} ~ {formatPrice(t.triggerHigh)}
                  </span>

                  {/* Logic */}
                  <span className="text-[11px] text-gray-500 hidden sm:inline truncate max-w-[140px]">
                    {t.logic}
                  </span>

                  <div className="flex-1" />

                  {/* Status */}
                  <StatusBadge
                    triggered={t.triggered}
                    direction={t.direction}
                  />

                  {/* Delete */}
                  {onDeleteTrigger && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-gray-500 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                      onClick={() => onDeleteTrigger(t.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
