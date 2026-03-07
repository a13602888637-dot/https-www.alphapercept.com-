"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Star, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SearchResult } from "./types";
import { toast } from "sonner";

interface SearchResultItemProps {
  result: SearchResult;
  onAddToWatchlist?: (code: string, name: string) => void;
  className?: string;
}

/**
 * 搜索结果单项
 * 显示股票信息、价格、涨跌幅，支持快速添加到自选股和跳转详情
 */
export function SearchResultItem({
  result,
  onAddToWatchlist,
  className,
}: SearchResultItemProps) {
  const router = useRouter();
  const [isAdding, setIsAdding] = React.useState(false);

  // 跳转到个股详情
  const handleClick = () => {
    router.push(`/stocks/${result.code}`);
  };

  // 添加到自选股
  const handleAddToWatchlist = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (result.isInWatchlist) {
      toast.info("已在自选股中");
      return;
    }

    setIsAdding(true);
    try {
      if (onAddToWatchlist) {
        await onAddToWatchlist(result.code, result.name);
      }
    } finally {
      setIsAdding(false);
    }
  };

  // 格式化市场显示
  const formatMarket = (market: string) => {
    switch (market) {
      case "SH":
        return "上证";
      case "SZ":
        return "深证";
      case "US":
        return "美股";
      default:
        return market;
    }
  };

  // 获取市场颜色
  const getMarketColor = (market: string) => {
    switch (market) {
      case "SH":
        return "text-red-600 bg-red-50 border-red-200";
      case "SZ":
        return "text-green-600 bg-green-50 border-green-200";
      case "US":
        return "text-blue-600 bg-blue-50 border-blue-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "flex items-center justify-between hover:bg-muted rounded-lg px-4 py-3 transition-colors cursor-pointer",
        className
      )}
    >
      {/* 左侧：基本信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm truncate">{result.name}</span>
          <Badge
            variant="outline"
            className={cn("text-xs px-1.5 py-0", getMarketColor(result.market))}
          >
            {formatMarket(result.market)}
          </Badge>
          {result.isInWatchlist && (
            <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{result.code}</span>
          {result.industry && (
            <>
              <span>•</span>
              <span className="truncate">{result.industry}</span>
            </>
          )}
        </div>
      </div>

      {/* 右侧：价格和操作 */}
      <div className="flex items-center gap-4 ml-4">
        {/* 价格信息 */}
        {result.currentPrice !== undefined && (
          <div className="text-right">
            <div className="font-medium text-sm">
              {result.market === "US" ? "$" : "¥"}{result.currentPrice.toFixed(2)}
            </div>
            {result.changePercent !== undefined && (
              <div
                className={cn(
                  "text-xs font-medium",
                  result.changePercent > 0
                    ? "text-red-600"
                    : result.changePercent < 0
                    ? "text-green-600"
                    : "text-gray-600"
                )}
              >
                {result.changePercent > 0 ? "+" : ""}
                {result.changePercent.toFixed(2)}%
              </div>
            )}
          </div>
        )}

        {/* 成交量 */}
        {result.volume !== undefined && (
          <div className="text-right w-20">
            <div className="text-xs text-muted-foreground">成交量</div>
            <div className="text-xs font-medium">
              {formatVolume(result.volume)}
            </div>
          </div>
        )}

        {/* 添加按钮 */}
        <Button
          variant={result.isInWatchlist ? "ghost" : "outline"}
          size="sm"
          onClick={handleAddToWatchlist}
          disabled={isAdding || result.isInWatchlist}
          className="h-8 w-8 p-0"
        >
          {result.isInWatchlist ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </div>
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
