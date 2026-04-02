"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StockSearchInput } from "@/components/watchlist/StockSearchInput";
import {
  Plus,
  RefreshCw,
  X,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

export interface WatchlistItem {
  id: string;
  stockCode: string;
  stockName: string;
  buyPrice: number | null;
  stopLossPrice: number | null;
  targetPrice: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StockPriceData {
  price: number;
  change?: number;
  changePercent?: number;
  high?: number;
  low?: number;
  volume?: number;
  turnover?: number;
  lastUpdate?: string;
  name?: string;
}

export interface StockPriceMap {
  [stockCode: string]: StockPriceData;
}

export type AlertType = "stop-loss-alert" | "target-alert" | "volatility-alert";

export interface NewStockData {
  stockCode: string;
  stockName: string;
  buyPrice: string;
  stopLossPrice: string;
  targetPrice: string;
  notes: string;
}

interface WatchlistStripProps {
  watchlist: WatchlistItem[];
  stockPrices: StockPriceMap;
  alerts: Map<string, AlertType[]>;
  isLoading: boolean;
  selectedStock: string | null;
  onSelectStock: (code: string) => void;
  onAdd: (stock: NewStockData) => Promise<void>;
  onDelete: (id: string, name: string) => Promise<void>;
  onRefresh: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function priceColor(changePercent: number | undefined): string {
  if (!changePercent) return "text-[#8b92a5]";
  if (changePercent > 0) return "text-[#22c55e]";
  if (changePercent < 0) return "text-[#ef4444]";
  return "text-[#8b92a5]";
}

function formatChange(change: number | undefined): string {
  if (change === undefined || change === null) return "0.00";
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}`;
}

function formatChangePercent(pct: number | undefined): string {
  if (pct === undefined || pct === null) return "0.00%";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function getAlertBorderClass(alertTypes: AlertType[] | undefined): string {
  if (!alertTypes || alertTypes.length === 0) return "";
  if (alertTypes.includes("stop-loss-alert")) return "animate-alert-red";
  if (alertTypes.includes("target-alert")) return "animate-alert-green";
  return "";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WatchlistStrip({
  watchlist,
  stockPrices,
  alerts,
  isLoading,
  selectedStock,
  onSelectStock,
  onAdd,
  onDelete,
  onRefresh,
}: WatchlistStripProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newStock, setNewStock] = useState<NewStockData>({
    stockCode: "",
    stockName: "",
    buyPrice: "",
    stopLossPrice: "",
    targetPrice: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---- Stats ----
  const stats = (() => {
    let up = 0;
    let down = 0;
    watchlist.forEach((item) => {
      const pd = stockPrices[item.stockCode];
      if (!pd) return;
      const cp = pd.changePercent ?? 0;
      if (cp > 0) up++;
      else if (cp < 0) down++;
    });
    return { total: watchlist.length, up, down };
  })();

  // ---- Add dialog submit ----
  const handleSubmit = async () => {
    if (!newStock.stockCode || !newStock.stockName) return;
    setIsSubmitting(true);
    try {
      await onAdd(newStock);
      setIsAddDialogOpen(false);
      setNewStock({
        stockCode: "",
        stockName: "",
        buyPrice: "",
        stopLossPrice: "",
        targetPrice: "",
        notes: "",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-shrink-0 border-b border-[#262a36] bg-[#111318]">
      {/* ── HEADER ROW ── */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wide uppercase text-[#8b92a5]">
            自选股
          </span>
          <span className="font-mono text-[11px] text-[#4a5068] bg-[#181b23] px-2 py-0.5 rounded">
            {stats.total} stocks
          </span>
          <span className="text-[10px] text-[#22c55e] flex items-center gap-0.5">
            <TrendingUp className="h-2.5 w-2.5" />
            {stats.up}
          </span>
          <span className="text-[10px] text-[#ef4444] flex items-center gap-0.5">
            <TrendingDown className="h-2.5 w-2.5" />
            {stats.down}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="text-[11px] px-2.5 py-1 rounded border border-[#262a36] bg-[#181b23] text-[#8b92a5] hover:border-[#4a5068] hover:text-[#e2e5eb] transition-colors disabled:opacity-50"
            title="刷新"
          >
            <RefreshCw
              className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
          <button
            onClick={() => setIsAddDialogOpen(true)}
            className="text-[11px] px-2.5 py-1 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 transition-colors flex items-center gap-1"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>
      </div>

      {/* ── CARDS ROW ── */}
      <div
        className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-thin"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "#262a36 transparent",
        }}
      >
        {watchlist.length === 0 && !isLoading && (
          <div className="flex items-center justify-center w-full py-4 text-xs text-[#4a5068]">
            暂无自选股 — 点击 + Add 添加
          </div>
        )}

        {isLoading && watchlist.length === 0 && (
          <div className="flex items-center justify-center w-full py-4 text-xs text-[#4a5068]">
            <RefreshCw className="h-3 w-3 animate-spin mr-2" />
            加载中...
          </div>
        )}

        {watchlist.map((item) => {
          const pd = stockPrices[item.stockCode];
          const isWatch = !item.buyPrice;
          const isActive = selectedStock === item.stockCode;
          const itemAlerts = alerts.get(item.stockCode);
          const alertBorder = getAlertBorderClass(itemAlerts);

          return (
            <div
              key={item.id}
              onClick={() => onSelectStock(item.stockCode)}
              className={[
                "flex-shrink-0 w-[200px] rounded-lg p-2.5 px-3 cursor-pointer transition-all duration-150 relative group",
                // Base style
                isWatch
                  ? "border border-dashed border-[#262a36] bg-[#181b23] opacity-60 hover:opacity-80"
                  : "border border-[#262a36] bg-[#181b23] hover:border-[#4a5068]",
                // Active state
                isActive &&
                  "!border-[#f59e0b] shadow-[0_0_12px_rgba(245,158,11,0.08)]",
                // Alert breathing animation
                alertBorder,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {/* ── Card head: code + name + close ── */}
              <div className="flex items-start justify-between mb-1.5">
                <div className="min-w-0">
                  <div
                    className={`font-mono text-[13px] font-semibold leading-tight ${
                      isWatch ? "text-[#4a5068]" : "text-[#e2e5eb]"
                    }`}
                  >
                    {item.stockCode}
                  </div>
                  <div className="text-[11px] text-[#4a5068] truncate leading-tight">
                    {item.stockName}
                    {isWatch && " \u00B7 监控中"}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item.id, item.stockName);
                  }}
                  className="text-[#4a5068] hover:text-[#ef4444] transition-colors opacity-0 group-hover:opacity-100 -mt-0.5 -mr-0.5 p-0.5"
                  title="删除"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* ── Price + change ── */}
              <div className="mb-1">
                <div
                  className={`font-mono text-base font-semibold leading-tight ${
                    isWatch
                      ? "text-[#8b92a5]"
                      : priceColor(pd?.changePercent)
                  }`}
                >
                  {pd ? pd.price.toFixed(3) : "--"}
                </div>
                {!isWatch && pd ? (
                  <div
                    className={`font-mono text-[12px] leading-tight ${priceColor(
                      pd.changePercent
                    )}`}
                  >
                    {formatChange(pd.change)} ({formatChangePercent(pd.changePercent)})
                  </div>
                ) : isWatch ? (
                  <div className="font-mono text-[12px] text-[#4a5068] leading-tight">
                    监控中
                  </div>
                ) : null}
              </div>

              {/* ── Alert badge ── */}
              {itemAlerts && itemAlerts.length > 0 && (
                <div className="absolute top-2 right-8">
                  <AlertTriangle className="h-3 w-3 text-amber-400 animate-pulse" />
                </div>
              )}

              {/* ── Buy / Stop / Target mini row ── */}
              <div className="flex gap-3 mt-2 pt-2 border-t border-[#262a36] text-[10px] text-[#4a5068]">
                {isWatch ? (
                  <>
                    <div className="flex flex-col gap-px">
                      <span className="uppercase tracking-wider text-[9px]">
                        Buy
                      </span>
                      <span className="font-mono text-[11px] text-[#8b92a5]">
                        --
                      </span>
                    </div>
                    <div className="flex flex-col gap-px">
                      <span className="uppercase tracking-wider text-[9px]">
                        Stop
                      </span>
                      <span className="font-mono text-[11px] text-[#8b92a5]">
                        --
                      </span>
                    </div>
                    <div className="flex flex-col gap-px">
                      <span className="uppercase tracking-wider text-[9px]">
                        Status
                      </span>
                      <span className="font-mono text-[11px] text-[#f59e0b]">
                        WATCH
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-px">
                      <span className="uppercase tracking-wider text-[9px]">
                        Buy
                      </span>
                      <span className="font-mono text-[11px] text-[#8b92a5]">
                        {item.buyPrice?.toFixed(2) ?? "--"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-px">
                      <span className="uppercase tracking-wider text-[9px]">
                        Stop
                      </span>
                      <span className="font-mono text-[11px] text-[#ef4444]">
                        {item.stopLossPrice?.toFixed(2) ?? "--"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-px">
                      <span className="uppercase tracking-wider text-[9px]">
                        Target
                      </span>
                      <span className="font-mono text-[11px] text-[#22c55e]">
                        {item.targetPrice?.toFixed(2) ?? "--"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── ADD STOCK DIALOG ── */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="bg-[#111827] border-gray-700 text-gray-100">
          <DialogHeader>
            <DialogTitle>Add Stock to Watchlist</DialogTitle>
            <DialogDescription className="text-gray-400">
              Search by code or name, then set price levels.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Stock search */}
            <div>
              <label className="text-sm font-medium mb-2 block text-gray-300">
                Search Stock
              </label>
              <StockSearchInput
                onSelect={(stock) => {
                  setNewStock((prev) => ({
                    ...prev,
                    stockCode: stock.code,
                    stockName: stock.name,
                  }));
                }}
                placeholder="Enter code or name..."
              />
            </div>

            {/* Code + Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Code *
                </label>
                <Input
                  value={newStock.stockCode}
                  onChange={(e) =>
                    setNewStock((prev) => ({
                      ...prev,
                      stockCode: e.target.value,
                    }))
                  }
                  placeholder="000001"
                  className="bg-gray-800 border-gray-700 text-gray-100"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Name *
                </label>
                <Input
                  value={newStock.stockName}
                  onChange={(e) =>
                    setNewStock((prev) => ({
                      ...prev,
                      stockName: e.target.value,
                    }))
                  }
                  placeholder="Stock name"
                  className="bg-gray-800 border-gray-700 text-gray-100"
                />
              </div>
            </div>

            {/* Price inputs */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Buy Price
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={newStock.buyPrice}
                  onChange={(e) =>
                    setNewStock((prev) => ({
                      ...prev,
                      buyPrice: e.target.value,
                    }))
                  }
                  placeholder="--"
                  className="bg-gray-800 border-gray-700 text-gray-100"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Stop Loss
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={newStock.stopLossPrice}
                  onChange={(e) =>
                    setNewStock((prev) => ({
                      ...prev,
                      stopLossPrice: e.target.value,
                    }))
                  }
                  placeholder="--"
                  className="bg-gray-800 border-gray-700 text-gray-100"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Target
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={newStock.targetPrice}
                  onChange={(e) =>
                    setNewStock((prev) => ({
                      ...prev,
                      targetPrice: e.target.value,
                    }))
                  }
                  placeholder="--"
                  className="bg-gray-800 border-gray-700 text-gray-100"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Notes</label>
              <Input
                value={newStock.notes}
                onChange={(e) =>
                  setNewStock((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Optional notes..."
                className="bg-gray-800 border-gray-700 text-gray-100"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !newStock.stockCode || !newStock.stockName || isSubmitting
              }
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              {isSubmitting ? "Adding..." : "Add Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── INLINE STYLES for alert breathing animation ── */}
      <style jsx global>{`
        @keyframes alert-breathe-red {
          0%,
          100% {
            border-color: #ef4444;
            box-shadow: 0 0 8px rgba(239, 68, 68, 0.15);
          }
          50% {
            border-color: rgba(239, 68, 68, 0.3);
            box-shadow: 0 0 4px rgba(239, 68, 68, 0.05);
          }
        }
        @keyframes alert-breathe-green {
          0%,
          100% {
            border-color: #22c55e;
            box-shadow: 0 0 8px rgba(34, 197, 94, 0.15);
          }
          50% {
            border-color: rgba(34, 197, 94, 0.3);
            box-shadow: 0 0 4px rgba(34, 197, 94, 0.05);
          }
        }
        .animate-alert-red {
          animation: alert-breathe-red 2s ease-in-out infinite !important;
        }
        .animate-alert-green {
          animation: alert-breathe-green 2s ease-in-out infinite !important;
        }
        .scrollbar-thin::-webkit-scrollbar {
          height: 3px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #262a36;
          border-radius: 3px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
    </div>
  );
}
