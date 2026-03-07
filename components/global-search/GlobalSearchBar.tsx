"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SearchResult, HotStock } from "./types";
import { SearchResults } from "./SearchResults";
import { SearchDefault } from "./SearchDefault";
import { useSearchHistory } from "./useSearchHistory";
import { useWatchlistStore } from "@/lib/store";
import { toast } from "sonner";

interface GlobalSearchBarProps {
  className?: string;
}

/**
 * 全局搜索栏组件
 *
 * 功能：
 * - Spotlight风格下拉面板
 * - 300ms防抖搜索
 * - 实时价格数据展示
 * - 快速添加到自选股
 * - 搜索历史管理
 * - 热门股票推荐
 */
export function GlobalSearchBar({ className }: GlobalSearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [isOpen, setIsOpen] = useState(false);
  const [hotStocks, setHotStocks] = useState<HotStock[]>([]);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  const { history, addToHistory, removeFromHistory, clearHistory } =
    useSearchHistory();
  const watchlistStore = useWatchlistStore();

  // 获取热门股票（涨幅榜前10）
  const fetchHotStocks = useCallback(async () => {
    try {
      const response = await fetch("/api/stocks/hot");
      if (!response.ok) {
        throw new Error("Failed to fetch hot stocks");
      }

      const data = await response.json();
      if (data.success && data.data) {
        setHotStocks(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch hot stocks:", error);
      // 失败时使用空数组
      setHotStocks([]);
    }
  }, []);

  // 初始化时获取热门股票
  useEffect(() => {
    fetchHotStocks();
  }, [fetchHotStocks]);

  // 执行搜索
  const performSearch = useCallback(
    async (searchQuery: string) => {
      const trimmedQuery = searchQuery.trim();

      if (!trimmedQuery) {
        setResults([]);
        setError(undefined);
        return;
      }

      setLoading(true);
      setError(undefined);

      try {
        // 1. 调用统一检索API（支持A股+美股）
        const searchResponse = await fetch(
          `/api/unified-search?q=${encodeURIComponent(trimmedQuery)}&limit=15`
        );

        if (!searchResponse.ok) {
          throw new Error(`搜索请求失败: ${searchResponse.status}`);
        }

        const searchData = await searchResponse.json();

        if (!searchData.success) {
          throw new Error(searchData.error || "搜索失败");
        }

        const groups = searchData.data || [];

        // Flatten grouped results into a single list
        const allAssets: any[] = [];
        for (const group of groups) {
          for (const asset of group.results || []) {
            allAssets.push({ ...asset, marketLabel: group.label });
          }
        }

        if (allAssets.length === 0) {
          setResults([]);
          setLoading(false);
          return;
        }

        // 2. 获取价格数据
        const symbols = allAssets.map((s: any) => s.symbol).join(",");
        const pricesResponse = await fetch(
          `/api/stock-prices?symbols=${symbols}`
        );

        let pricesData: any = {};
        if (pricesResponse.ok) {
          const pricesJson = await pricesResponse.json();
          if (pricesJson.success) {
            pricesData = pricesJson.prices || {};
          }
        }

        // 3. 检查是否在自选股中
        const watchlistItems = watchlistStore.getFavoriteItems();
        const watchlistCodes = new Set(
          watchlistItems.map((item) => item.stockCode)
        );

        // 4. 合并数据
        const enrichedResults: SearchResult[] = allAssets.map((asset: any) => {
          const priceInfo = pricesData[asset.symbol];
          // Map market type to display label
          const marketDisplay = asset.market === "cn_stock" || asset.market === "cn_index"
            ? (asset.exchange === "SSE" ? "SH" : "SZ")
            : asset.market === "us_stock" || asset.market === "us_index" || asset.market === "us_etf"
            ? "US"
            : asset.market?.toUpperCase() || "OTHER";
          return {
            code: asset.symbol,
            name: asset.name,
            market: marketDisplay,
            currentPrice: priceInfo?.price,
            change: priceInfo?.change,
            changePercent: priceInfo?.changePercent,
            volume: priceInfo?.volume,
            turnover: priceInfo?.turnover,
            industry: asset.metadata?.industry,
            isInWatchlist: watchlistCodes.has(asset.symbol),
          };
        });

        setResults(enrichedResults);
        addToHistory(trimmedQuery);
      } catch (err) {
        console.error("Search error:", err);
        setError(
          err instanceof Error ? err.message : "搜索失败，请稍后重试"
        );
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [addToHistory, watchlistStore]
  );

  // 防抖处理
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);

      // 清除之前的定时器
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // 设置新的防抖定时器（300ms）
      debounceTimerRef.current = setTimeout(() => {
        performSearch(value);
      }, 300);
    },
    [performSearch]
  );

  // 清除搜索
  const handleClear = useCallback(() => {
    setQuery("");
    setResults([]);
    setError(undefined);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  // 点击历史记录
  const handleHistoryClick = useCallback(
    (historyQuery: string) => {
      setQuery(historyQuery);
      performSearch(historyQuery);
    },
    [performSearch]
  );

  // 点击热门股票
  const handleHotStockClick = useCallback(
    (stock: HotStock) => {
      setQuery(stock.name);
      performSearch(stock.name);
    },
    [performSearch]
  );

  // 添加到自选股
  const handleAddToWatchlist = useCallback(
    async (code: string, name: string) => {
      try {
        await watchlistStore.addItemOptimistic({
          stockCode: code,
          stockName: name,
        });
        toast.success(`已添加 ${name} 到自选股`);

        // 更新结果中的自选股状态
        setResults((prev) =>
          prev.map((r) =>
            r.code === code ? { ...r, isInWatchlist: true } : r
          )
        );
      } catch (error) {
        console.error("Failed to add to watchlist:", error);
        toast.error("添加失败，请重试");
      }
    },
    [watchlistStore]
  );

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const showResults = isOpen && query.trim().length > 0;
  const showDefault = isOpen && query.trim().length === 0;

  return (
    <div ref={searchContainerRef} className={cn("relative", className)}>
      {/* 搜索输入框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜索股票、策略或新闻..."
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          className="pl-9 pr-10"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="清除搜索"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {loading && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Spotlight风格下拉面板 */}
      {(showResults || showDefault) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-lg shadow-lg z-50 overflow-hidden">
          {showDefault && (
            <SearchDefault
              searchHistory={history}
              hotStocks={hotStocks}
              onHistoryClick={handleHistoryClick}
              onHotStockClick={handleHotStockClick}
              onClearHistory={clearHistory}
              onRemoveHistoryItem={removeFromHistory}
            />
          )}

          {showResults && (
            <SearchResults
              results={results}
              loading={loading}
              error={error}
              query={query}
              onAddToWatchlist={handleAddToWatchlist}
            />
          )}
        </div>
      )}
    </div>
  );
}
