"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, Loader2, Search } from "lucide-react"

export interface StockResult {
  code: string
  name: string
  market: string
}

interface SearchResultsProps {
  results: StockResult[]
  onAdd: (stock: StockResult) => void
  loading?: boolean
  emptyMessage?: string
}

export function SearchResults({
  results,
  onAdd,
  loading = false,
  emptyMessage = "搜索股票代码或名称"
}: SearchResultsProps) {
  // 格式化市场显示
  const formatMarket = (market: string) => {
    switch (market) {
      case "SH":
        return "上证"
      case "SZ":
        return "深证"
      default:
        return market
    }
  }

  // 获取市场颜色
  const getMarketColor = (market: string) => {
    switch (market) {
      case "SH":
        return "text-red-600 bg-red-50 border-red-200"
      case "SZ":
        return "text-green-600 bg-green-50 border-green-200"
      default:
        return "text-gray-600 bg-gray-50 border-gray-200"
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
            <p className="text-gray-500">搜索中...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="text-gray-400 mb-2">
              <Search className="h-12 w-12" />
            </div>
            <p className="text-gray-500">{emptyMessage}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-3">
          {results.map((stock) => (
            <div
              key={`${stock.code}-${stock.market}`}
              className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{stock.name}</h3>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getMarketColor(stock.market)}`}
                      >
                        {formatMarket(stock.market)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{stock.code}</p>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAdd(stock)}
                className="ml-4"
              >
                <Plus className="h-4 w-4 mr-2" />
                添加
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

