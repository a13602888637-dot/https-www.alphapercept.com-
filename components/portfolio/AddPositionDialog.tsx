"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Search, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@clerk/nextjs"

interface AddPositionDialogProps {
  onSuccess: () => void
}

interface SearchResult {
  code: string
  name: string
  market: string
}

export function AddPositionDialog({ onSuccess }: AddPositionDialogProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedStock, setSelectedStock] = useState<SearchResult | null>(null)
  const [quantity, setQuantity] = useState("")
  const [avgCost, setAvgCost] = useState("")
  const [industry, setIndustry] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const { getToken } = useAuth()

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setSearchLoading(true)
    try {
      const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      if (data.success && data.data) {
        setSearchResults(data.data.slice(0, 8))
      }
    } catch {
      // Ignore search errors
    } finally {
      setSearchLoading(false)
    }
  }

  const handleSelectStock = (stock: SearchResult) => {
    setSelectedStock(stock)
    setSearchQuery(stock.name)
    setSearchResults([])
  }

  const handleSubmit = async () => {
    if (!selectedStock) {
      toast({ title: "请选择股票", variant: "destructive" })
      return
    }
    if (!quantity || parseInt(quantity) <= 0) {
      toast({ title: "请输入有效数量", variant: "destructive" })
      return
    }
    if (!avgCost || parseFloat(avgCost) <= 0) {
      toast({ title: "请输入有效成本价", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      const token = await getToken()
      const response = await fetch('/api/portfolio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          stockCode: selectedStock.code,
          stockName: selectedStock.name,
          quantity: parseInt(quantity),
          avgCost: parseFloat(avgCost),
          industry: industry || undefined,
          notes: notes || undefined,
        }),
      })
      const data = await response.json()
      if (data.success) {
        toast({ title: "添加成功", description: data.message || `已添加 ${selectedStock.name}` })
        resetForm()
        setOpen(false)
        onSuccess()
      } else {
        toast({ title: "添加失败", description: data.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "添加失败", description: "网络错误", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setSearchQuery("")
    setSearchResults([])
    setSelectedStock(null)
    setQuantity("")
    setAvgCost("")
    setIndustry("")
    setNotes("")
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          添加持仓
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>添加持仓</DialogTitle>
          <DialogDescription>搜索股票并输入持仓信息</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Stock search */}
          <div className="space-y-2">
            <Label>股票</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="输入股票代码或名称"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
              {searchLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
              )}
            </div>
            {searchResults.length > 0 && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {searchResults.map((stock) => (
                  <button
                    key={stock.code}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm flex justify-between"
                    onClick={() => handleSelectStock(stock)}
                  >
                    <span className="font-medium">{stock.name}</span>
                    <span className="text-gray-500">{stock.code}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedStock && (
              <div className="text-sm text-green-600">
                已选择: {selectedStock.name} ({selectedStock.code})
              </div>
            )}
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label>数量（股）</Label>
            <Input
              type="number"
              placeholder="如: 100"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              step="100"
            />
          </div>

          {/* Average cost */}
          <div className="space-y-2">
            <Label>成本价（元）</Label>
            <Input
              type="number"
              placeholder="如: 15.50"
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
              min="0.01"
              step="0.01"
            />
          </div>

          {/* Industry */}
          <div className="space-y-2">
            <Label>行业（可选）</Label>
            <Input
              placeholder="如: 白酒、新能源"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>备注（可选）</Label>
            <Input
              placeholder="持仓备注"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setOpen(false); resetForm() }}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !selectedStock}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />添加中...</> : "确认添加"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
