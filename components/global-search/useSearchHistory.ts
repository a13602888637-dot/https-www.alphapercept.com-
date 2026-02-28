"use client";

import { useState, useEffect, useCallback } from "react";
import { SearchHistoryItem } from "./types";

const STORAGE_KEY = "search-history";
const MAX_HISTORY_ITEMS = 10;

/**
 * 搜索历史管理 Hook
 * 使用 localStorage 持久化搜索历史
 */
export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);

  // 从 localStorage 加载历史记录
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SearchHistoryItem[];
        setHistory(parsed);
      }
    } catch (error) {
      console.error("Failed to load search history:", error);
    }
  }, []);

  // 保存到 localStorage
  const saveToStorage = useCallback((items: SearchHistoryItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error("Failed to save search history:", error);
    }
  }, []);

  // 添加搜索记录
  const addToHistory = useCallback(
    (query: string) => {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) return;

      setHistory((prev) => {
        // 移除已存在的相同查询
        const filtered = prev.filter((item) => item.query !== trimmedQuery);

        // 添加到开头
        const newHistory = [
          { query: trimmedQuery, timestamp: Date.now() },
          ...filtered,
        ].slice(0, MAX_HISTORY_ITEMS);

        saveToStorage(newHistory);
        return newHistory;
      });
    },
    [saveToStorage]
  );

  // 删除单条记录
  const removeFromHistory = useCallback(
    (query: string) => {
      setHistory((prev) => {
        const filtered = prev.filter((item) => item.query !== query);
        saveToStorage(filtered);
        return filtered;
      });
    },
    [saveToStorage]
  );

  // 清空历史记录
  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear search history:", error);
    }
  }, []);

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
  };
}
