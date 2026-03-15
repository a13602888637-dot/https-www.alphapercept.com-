"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Loader2, TrendingUp } from "lucide-react";

interface StockSearchResult {
  code: string;
  name: string;
  market: string;
}

interface StockSearchInputProps {
  onSelect: (stock: { code: string; name: string }) => void;
  placeholder?: string;
}

export function StockSearchInput({ onSelect, placeholder = "输入股票代码或名称搜索..." }: StockSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const searchStocks = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 1) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setResults(data.data.slice(0, 10));
        setShowResults(data.data.length > 0);
      } else {
        setResults([]);
        setShowResults(false);
      }
    } catch {
      setResults([]);
      setShowResults(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      searchStocks(query);
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query, searchStocks]);

  const handleSelect = (stock: StockSearchResult) => {
    onSelect({ code: stock.code, name: stock.name });
    setQuery(`${stock.code} - ${stock.name}`);
    setShowResults(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          placeholder={placeholder}
          className="pl-10 pr-10"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showResults && results.length > 0 && (
        <Card className="absolute z-50 w-full mt-2 max-h-80 overflow-y-auto shadow-lg">
          <div className="p-2">
            {results.map((stock) => (
              <button
                key={stock.code}
                onClick={() => handleSelect(stock)}
                className="w-full text-left px-3 py-2 hover:bg-muted rounded-md transition-colors flex items-center justify-between group"
              >
                <div>
                  <div className="font-medium">{stock.name}</div>
                  <div className="text-sm text-muted-foreground">{stock.code} · {stock.market}</div>
                </div>
                <TrendingUp className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        </Card>
      )}

      {showResults && query && results.length === 0 && !isSearching && (
        <Card className="absolute z-50 w-full mt-2 shadow-lg">
          <div className="p-4 text-center text-sm text-muted-foreground">
            未找到匹配的股票，请尝试其他关键词
          </div>
        </Card>
      )}
    </div>
  );
}
