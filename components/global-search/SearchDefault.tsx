"use client";

import React from "react";
import { Clock, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SearchHistoryItem, HotStock } from "./types";

interface SearchDefaultProps {
  searchHistory: SearchHistoryItem[];
  hotStocks: HotStock[];
  onHistoryClick: (query: string) => void;
  onHotStockClick: (stock: HotStock) => void;
  onClearHistory: () => void;
  onRemoveHistoryItem: (query: string) => void;
  className?: string;
}

/**
 * 搜索默认界面
 * 显示搜索历史和热门股票推荐
 */
export function SearchDefault({
  searchHistory,
  hotStocks,
  onHistoryClick,
  onHotStockClick,
  onClearHistory,
  onRemoveHistoryItem,
  className,
}: SearchDefaultProps) {
  return (
    <div className={cn("p-4 space-y-6", className)}>
      {/* 搜索历史 */}
      {searchHistory.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>搜索历史</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearHistory}
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              清除全部
            </Button>
          </div>
          <div className="space-y-1">
            {searchHistory.slice(0, 5).map((item) => (
              <div
                key={item.query}
                className="flex items-center justify-between group hover:bg-muted rounded-md px-3 py-2 transition-colors"
              >
                <button
                  onClick={() => onHistoryClick(item.query)}
                  className="flex-1 text-left text-sm"
                >
                  {item.query}
                </button>
                <button
                  onClick={() => onRemoveHistoryItem(item.query)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 热门股票 */}
      {hotStocks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span>热门股票</span>
          </div>
          <div className="space-y-1">
            {hotStocks.slice(0, 10).map((stock) => (
              <button
                key={`${stock.code}-${stock.market}`}
                onClick={() => onHotStockClick(stock)}
                className="w-full flex items-center justify-between hover:bg-muted rounded-md px-3 py-2.5 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-sm">{stock.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {stock.code}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-medium text-sm">
                      ¥{stock.currentPrice.toFixed(2)}
                    </div>
                    <div
                      className={cn(
                        "text-xs font-medium",
                        stock.changePercent > 0
                          ? "text-red-600"
                          : stock.changePercent < 0
                          ? "text-green-600"
                          : "text-gray-600"
                      )}
                    >
                      {stock.changePercent > 0 ? "+" : ""}
                      {stock.changePercent.toFixed(2)}%
                    </div>
                  </div>
                  <div className="w-16 text-right">
                    <div className="text-xs text-muted-foreground">
                      {formatVolume(stock.volume)}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 空状态 */}
      {searchHistory.length === 0 && hotStocks.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          开始搜索股票、策略或新闻
        </div>
      )}
    </div>
  );
}

/**
 * 格式化成交量
 */
function formatVolume(volume: number): string {
  if (volume >= 100000000) {
    return `${(volume / 100000000).toFixed(2)}亿`;
  }
  if (volume >= 10000) {
    return `${(volume / 10000).toFixed(2)}万`;
  }
  return volume.toString();
}
