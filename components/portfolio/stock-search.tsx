"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

interface StockSearchProps {
  onSearch: (query: string) => void
  placeholder?: string
  debounceMs?: number
}

export function StockSearch({
  onSearch,
  placeholder = "搜索股票代码或名称...",
  debounceMs = 300
}: StockSearchProps) {
  const [query, setQuery] = useState("")
  const [isTyping, setIsTyping] = useState(false)

  // 防抖处理
  useEffect(() => {
    if (query.trim() === "") {
      onSearch("")
      setIsTyping(false)
      return
    }

    setIsTyping(true)
    const timer = setTimeout(() => {
      onSearch(query.trim())
      setIsTyping(false)
    }, debounceMs)

    return () => {
      clearTimeout(timer)
    }
  }, [query, onSearch, debounceMs])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
  }, [])

  const handleClear = useCallback(() => {
    setQuery("")
    onSearch("")
  }, [onSearch])

  return (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
      <Input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={handleChange}
        className="pl-9 pr-10"
      />
      {query && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label="清除搜索"
        >
          ×
        </button>
      )}
      {isTyping && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
        </div>
      )}
    </div>
  )
}