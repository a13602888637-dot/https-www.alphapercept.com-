"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

  // 股票代码库（常用A股）
  const stockDatabase: StockSearchResult[] = [
    { code: "000001", name: "平安银行", market: "深圳" },
    { code: "000002", name: "万科A", market: "深圳" },
    { code: "000063", name: "中兴通讯", market: "深圳" },
    { code: "000333", name: "美的集团", market: "深圳" },
    { code: "000651", name: "格力电器", market: "深圳" },
    { code: "000858", name: "五粮液", market: "深圳" },
    { code: "002415", name: "海康威视", market: "深圳" },
    { code: "002594", name: "比亚迪", market: "深圳" },
    { code: "300059", name: "东方财富", market: "深圳" },
    { code: "300750", name: "宁德时代", market: "深圳" },
    { code: "600000", name: "浦发银行", market: "上海" },
    { code: "600036", name: "招商银行", market: "上海" },
    { code: "600104", name: "上汽集团", market: "上海" },
    { code: "600276", name: "恒瑞医药", market: "上海" },
    { code: "600519", name: "贵州茅台", market: "上海" },
    { code: "600887", name: "伊利股份", market: "上海" },
    { code: "600900", name: "长江电力", market: "上海" },
    { code: "601012", name: "隆基绿能", market: "上海" },
    { code: "601318", name: "中国平安", market: "上海" },
    { code: "601857", name: "中国石油", market: "上海" },
    { code: "601888", name: "中国中免", market: "上海" },
    { code: "603259", name: "药明康德", market: "上海" },
    { code: "688981", name: "中芯国际", market: "科创板" },
  ];

  // 搜索函数
  const searchStocks = useCallback((searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);

    // 模拟搜索延迟
    setTimeout(() => {
      const filtered = stockDatabase.filter(stock =>
        stock.code.includes(searchQuery) ||
        stock.name.includes(searchQuery.toUpperCase()) ||
        stock.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

      setResults(filtered.slice(0, 10)); // 最多显示10个结果
      setShowResults(filtered.length > 0);
      setIsSearching(false);
    }, 200);
  }, []);

  // 防抖搜索
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
