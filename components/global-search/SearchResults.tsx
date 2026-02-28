"use client";

import React from "react";
import { Loader2, AlertCircle } from "lucide-react";
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
          未找到匹配的股票
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          试试搜索股票代码或名称
        </p>
      </div>
    );
  }

  // 显示结果
  return (
    <div className={cn("p-2 space-y-1", className)}>
      {/* 结果计数 */}
      {results.length > 0 && (
        <div className="px-3 py-2 text-xs text-muted-foreground">
          找到 {results.length} 个结果
        </div>
      )}

      {/* 结果列表 */}
      <div className="max-h-96 overflow-y-auto">
        {results.map((result) => (
          <SearchResultItem
            key={`${result.code}-${result.market}`}
            result={result}
            onAddToWatchlist={onAddToWatchlist}
          />
        ))}
      </div>
    </div>
  );
}
