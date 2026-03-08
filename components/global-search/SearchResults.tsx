"use client";

import React from "react";
import { Loader2, AlertCircle, Shield, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { SearchResult } from "./types";
import { SearchResultItem } from "./SearchResultItem";
import { cn } from "@/lib/utils";

interface SearchResultsProps {
  results: SearchResult[];
  loading: boolean;
  error?: string;
  query: string;
  onAddToWatchlist?: (code: string, name: string) => void;
  className?: string;
}

function IntelligenceResultItem({ result }: { result: SearchResult }) {
  const signalColor =
    result.actionSignal === "BUY" ? "text-green-600" :
    result.actionSignal === "SELL" ? "text-red-600" : "text-yellow-600";
  const SignalIcon =
    result.actionSignal === "BUY" ? TrendingUp :
    result.actionSignal === "SELL" ? TrendingDown : Minus;
  const trapColor =
    (result.trapProbability || 0) > 60 ? "text-red-600" :
    (result.trapProbability || 0) > 30 ? "text-yellow-600" : "text-green-600";

  return (
    <div className="px-3 py-2.5 hover:bg-muted/50 cursor-pointer rounded-md transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className={cn("h-4 w-4 flex-shrink-0", trapColor)} />
          <span className="font-medium text-sm truncate">{result.name}</span>
          <span className="text-xs text-muted-foreground">{result.code}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <SignalIcon className={cn("h-3.5 w-3.5", signalColor)} />
          <span className={cn("text-xs font-medium", signalColor)}>
            {result.actionSignal}
          </span>
        </div>
      </div>
      {result.eventSummary && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 pl-6">
          {result.eventSummary}
        </p>
      )}
      {result.trapProbability !== undefined && (
        <div className="flex items-center gap-2 mt-1 pl-6">
          <span className={cn("text-xs", trapColor)}>
            陷阱概率: {result.trapProbability}%
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * 搜索结果列表
 * 显示搜索结果、加载状态、错误信息
 */
export function SearchResults({
  results,
  loading,
  error,
  query,
  onAddToWatchlist,
  className,
}: SearchResultsProps) {
  // 加载中
  if (loading) {
    return (
      <div className={cn("p-8 text-center", className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">搜索中...</p>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className={cn("p-8 text-center", className)}>
        <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  // 无结果
  if (results.length === 0 && query.trim()) {
    return (
      <div className={cn("p-8 text-center", className)}>
        <p className="text-sm text-muted-foreground">
          未找到匹配的结果
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          试试搜索股票代码、名称或关键词
        </p>
      </div>
    );
  }

  // Separate stock and intelligence results
  const stockResults = results.filter((r) => r.type !== 'intelligence');
  const intelligenceResults = results.filter((r) => r.type === 'intelligence');

  // Group stock results by market category
  const aStockResults = stockResults.filter((r) => r.market === "SH" || r.market === "SZ");
  const usStockResults = stockResults.filter((r) => r.market === "US");
  const otherStockResults = stockResults.filter(
    (r) => r.market !== "SH" && r.market !== "SZ" && r.market !== "US"
  );

  const stockGroups = [
    { label: "A股", results: aStockResults },
    { label: "美股", results: usStockResults },
    { label: "其他", results: otherStockResults },
  ].filter((g) => g.results.length > 0);

  // 显示结果
  return (
    <div className={cn("p-2 space-y-1", className)}>
      {/* 结果计数 */}
      {results.length > 0 && (
        <div className="px-3 py-2 text-xs text-muted-foreground">
          找到 {stockResults.length} 只股票
          {intelligenceResults.length > 0 && `，${intelligenceResults.length} 条情报`}
        </div>
      )}

      {/* 分组结果列表 */}
      <div className="max-h-96 overflow-y-auto">
        {/* Stock results */}
        {stockGroups.map((group) => (
          <div key={group.label}>
            {(stockGroups.length > 1 || intelligenceResults.length > 0) && (
              <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                {group.label} ({group.results.length})
              </div>
            )}
            {group.results.map((result) => (
              <SearchResultItem
                key={`${result.code}-${result.market}`}
                result={result}
                onAddToWatchlist={onAddToWatchlist}
              />
            ))}
          </div>
        ))}

        {/* Intelligence results */}
        {intelligenceResults.length > 0 && (
          <div>
            <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
              智能情报 ({intelligenceResults.length})
            </div>
            {intelligenceResults.map((result) => (
              <IntelligenceResultItem
                key={`intel-${result.intelligenceId || result.code}`}
                result={result}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
