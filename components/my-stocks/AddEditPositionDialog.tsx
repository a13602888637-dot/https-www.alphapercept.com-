"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Search, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PositionData {
  stockCode: string;
  stockName: string;
  quantity: number;
  avgCost: number;
  industry?: string;
}

interface SearchResult {
  code: string;
  name: string;
  market: string;
}

interface AddEditPositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: {
    stockCode: string;
    stockName: string;
    quantity: number;
    avgCost: number;
  } | null;
  onSave: (data: PositionData) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddEditPositionDialog({
  open,
  onOpenChange,
  editData,
  onSave,
}: AddEditPositionDialogProps) {
  const isEdit = !!editData;

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [selectedStock, setSelectedStock] = useState<{
    code: string;
    name: string;
  } | null>(null);
  const [quantity, setQuantity] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [saving, setSaving] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset form when dialog opens/closes or editData changes
  useEffect(() => {
    if (open) {
      if (editData) {
        setSelectedStock({
          code: editData.stockCode,
          name: editData.stockName,
        });
        setQuantity(String(editData.quantity));
        setAvgCost(String(editData.avgCost));
        setSearchQuery("");
        setSearchResults([]);
      } else {
        setSelectedStock(null);
        setQuantity("");
        setAvgCost("");
        setSearchQuery("");
        setSearchResults([]);
      }
      setShowDropdown(false);
      setSaving(false);
    }
  }, [open, editData]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Search stocks with debounce
  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!value.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/stocks/search?q=${encodeURIComponent(value.trim())}`
        );
        const data = await res.json();
        if (data.success && data.data) {
          setSearchResults(data.data);
          setShowDropdown(data.data.length > 0);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  function handleSelectStock(stock: SearchResult) {
    setSelectedStock({ code: stock.code, name: stock.name });
    setSearchQuery("");
    setSearchResults([]);
    setShowDropdown(false);
  }

  async function handleSave() {
    if (!selectedStock) return;
    const qty = Number(quantity);
    const cost = Number(avgCost);
    if (!qty || qty <= 0 || !cost || cost <= 0) return;

    setSaving(true);
    try {
      await onSave({
        stockCode: selectedStock.code,
        stockName: selectedStock.name,
        quantity: qty,
        avgCost: cost,
      });
    } catch {
      // error handled by parent
    } finally {
      setSaving(false);
    }
  }

  const canSave =
    !!selectedStock && Number(quantity) > 0 && Number(avgCost) > 0 && !saving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0d1117] border-[#1a2035] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">
            {isEdit ? "编辑持仓" : "添加持仓"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Stock selection / display */}
          <div className="space-y-2">
            <Label className="text-gray-400 text-xs">股票</Label>
            {isEdit ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#1a2035] border border-[#2a3045]">
                <span className="text-white text-sm font-medium">
                  {selectedStock?.name}
                </span>
                <span className="text-gray-500 text-xs font-mono">
                  {selectedStock?.code}
                </span>
              </div>
            ) : (
              <div className="relative" ref={dropdownRef}>
                {selectedStock ? (
                  <div className="flex items-center justify-between px-3 py-2 rounded-md bg-[#1a2035] border border-[#2a3045]">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium">
                        {selectedStock.name}
                      </span>
                      <span className="text-gray-500 text-xs font-mono">
                        {selectedStock.code}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-gray-400 hover:text-white h-6 px-2"
                      onClick={() => setSelectedStock(null)}
                    >
                      更换
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                      <Input
                        placeholder="输入股票代码或名称搜索..."
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-9 bg-[#1a2035] border-[#2a3045] text-white placeholder:text-gray-600 text-sm"
                        autoFocus
                      />
                      {searching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 animate-spin" />
                      )}
                    </div>
                    {showDropdown && searchResults.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md bg-[#0d1117] border border-[#1a2035] shadow-lg">
                        {searchResults.map((stock) => (
                          <button
                            key={stock.code}
                            type="button"
                            className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[#1a2035] transition-colors"
                            onClick={() => handleSelectStock(stock)}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-white text-sm">
                                {stock.name}
                              </span>
                              <span className="text-gray-500 text-xs font-mono">
                                {stock.code}
                              </span>
                            </div>
                            <span className="text-xs text-gray-600">
                              {stock.market}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label className="text-gray-400 text-xs">买入数量 (股)</Label>
            <Input
              type="number"
              step={100}
              min={1}
              placeholder="例如 1000"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="bg-[#1a2035] border-[#2a3045] text-white placeholder:text-gray-600 text-sm font-mono"
            />
          </div>

          {/* Average cost */}
          <div className="space-y-2">
            <Label className="text-gray-400 text-xs">买入均价 (元)</Label>
            <Input
              type="number"
              step={0.01}
              min={0.01}
              placeholder="例如 18.50"
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
              className="bg-[#1a2035] border-[#2a3045] text-white placeholder:text-gray-600 text-sm font-mono"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-gray-400 hover:text-white"
          >
            取消
          </Button>
          <Button
            size="sm"
            disabled={!canSave}
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving && <Loader2 className="size-3 mr-1 animate-spin" />}
            {isEdit ? "保存修改" : "确认添加"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
