"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Filter, RefreshCw } from "lucide-react";
import { WatchlistCard } from "./WatchlistCard";
import { StockSearchInput } from "./StockSearchInput";
import { toast } from "sonner";

interface WatchlistItem {
  id: string;
  stockCode: string;
  stockName: string;
  buyPrice: number | null;
  stopLossPrice: number | null;
  targetPrice: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StockPriceData {
  price: number;
  change?: number;
  changePercent?: number;
  high?: number;
  low?: number;
  volume?: number;
  turnover?: number;
  lastUpdate?: string;
  name?: string;
}

interface StockPriceMap {
  [stockCode: string]: StockPriceData;
}

export function WatchlistManager() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [stockPrices, setStockPrices] = useState<StockPriceMap>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newStock, setNewStock] = useState({
    stockCode: "",
    stockName: "",
    buyPrice: "",
    stopLossPrice: "",
    targetPrice: "",
    notes: "",
  });

  // Fetch watchlist
  const fetchWatchlist = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/watchlist");

      if (!response.ok) {
        let errorMessage = "加载自选股失败";
        if (response.status === 401) {
          errorMessage = "请先登录以访问自选股功能";
        } else if (response.status === 500) {
          errorMessage = "服务器错误，请稍后重试";
        }

        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // 如果无法解析JSON错误信息，使用默认错误信息
        }

        throw new Error(`${errorMessage} (状态码: ${response.status})`);
      }

      const data = await response.json();
      if (data.success) {
        setWatchlist(data.watchlist);

        // Fetch current prices for stocks in watchlist
        fetchStockPrices(data.watchlist);
      } else {
        throw new Error(data.error || "加载自选股失败");
      }
    } catch (error) {
      console.error("Error fetching watchlist:", error);
      toast.error(error instanceof Error ? error.message : "加载自选股失败");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch real-time stock prices from market data API
  const fetchStockPrices = async (items: WatchlistItem[]) => {
    if (items.length === 0) {
      setStockPrices({});
      return;
    }

    try {
      const symbols = items.map(item => item.stockCode).join(",");
      const response = await fetch(`/api/stock-prices?symbols=${encodeURIComponent(symbols)}`);

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.prices) {
        const prices: StockPriceMap = {};
        items.forEach(item => {
          const priceData = data.prices[item.stockCode];
          if (priceData && priceData.price) {
            prices[item.stockCode] = {
              price: priceData.price,
              change: priceData.change,
              changePercent: priceData.changePercent,
              high: priceData.high,
              low: priceData.low,
              volume: priceData.volume,
              turnover: priceData.turnover,
              lastUpdate: priceData.lastUpdate,
              name: priceData.name
            };
          } else {
            // Fallback to buy price or default if API fails for this stock
            prices[item.stockCode] = {
              price: item.buyPrice || 0,
              change: 0,
              changePercent: 0,
              lastUpdate: new Date().toISOString()
            };
          }
        });
        setStockPrices(prices);
      } else {
        throw new Error(data.error || "Failed to fetch stock prices");
      }
    } catch (error) {
      console.error("Error fetching stock prices:", error);
      toast.error("获取实时价格失败，使用默认价格");

      // Fallback to buy prices or defaults
      const prices: StockPriceMap = {};
      items.forEach(item => {
        prices[item.stockCode] = {
          price: item.buyPrice || 0,
          change: 0,
          changePercent: 0,
          lastUpdate: new Date().toISOString()
        };
      });
      setStockPrices(prices);
    }
  };

  // Add stock to watchlist
  const handleAddStock = async () => {
    if (!newStock.stockCode || !newStock.stockName) {
      toast.error("请输入股票代码和名称");
      return;
    }

    // 显示加载提示
    const loadingToast = toast.loading("正在添加到自选股...");

    try {
      console.log("[WatchlistManager] 开始添加股票:", newStock);

      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stockCode: newStock.stockCode,
          stockName: newStock.stockName,
          buyPrice: newStock.buyPrice || null,
          stopLossPrice: newStock.stopLossPrice || null,
          targetPrice: newStock.targetPrice || null,
          notes: newStock.notes || null,
        }),
      });

      console.log("[WatchlistManager] API响应状态:", response.status);

      if (!response.ok) {
        let errorMessage = "添加股票失败";
        if (response.status === 401) {
          errorMessage = "❌ 请先登录以添加自选股";
          console.error("[WatchlistManager] 认证失败: 用户未登录");
        } else if (response.status === 409) {
          errorMessage = "⚠️ 该股票已在自选股中";
        } else if (response.status === 400) {
          errorMessage = "❌ 股票代码和名称不能为空";
        } else if (response.status === 500) {
          errorMessage = "❌ 服务器错误，请稍后重试";
        }

        try {
          const errorData = await response.json();
          console.error("[WatchlistManager] 错误详情:", errorData);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
          if (errorData.details) {
            errorMessage += `\n详情: ${errorData.details}`;
          }
        } catch (e) {
          console.error("[WatchlistManager] 无法解析错误响应:", e);
        }

        toast.dismiss(loadingToast);
        throw new Error(`${errorMessage} (状态码: ${response.status})`);
      }

      const data = await response.json();
      console.log("[WatchlistManager] API响应数据:", data);

      if (data.success) {
        toast.dismiss(loadingToast);
        toast.success(`✅ ${newStock.stockName} (${newStock.stockCode}) 已添加到自选股`);
        setIsAddDialogOpen(false);
        setNewStock({
          stockCode: "",
          stockName: "",
          buyPrice: "",
          stopLossPrice: "",
          targetPrice: "",
          notes: "",
        });
        fetchWatchlist();
      } else {
        toast.dismiss(loadingToast);
        throw new Error(data.error || "添加股票失败");
      }
    } catch (error) {
      console.error("[WatchlistManager] 添加失败:", error);
      toast.dismiss(loadingToast);
      toast.error(error instanceof Error ? error.message : "添加股票失败");
    }
  };

  // Update watchlist item
  const handleUpdateItem = async (id: string, data: Partial<WatchlistItem>) => {
    try {
      const response = await fetch("/api/watchlist", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, ...data }),
      });

      if (!response.ok) throw new Error("Failed to update item");

      const result = await response.json();
      if (result.success) {
        setWatchlist(prev =>
          prev.map(item => (item.id === id ? { ...item, ...result.item } : item))
        );
      }
    } catch (error) {
      console.error("Error updating item:", error);
      throw error;
    }
  };

  // Delete watchlist item
  const handleDeleteItem = async (id: string) => {
    try {
      const response = await fetch(`/api/watchlist?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete item");

      const result = await response.json();
      if (result.success) {
        setWatchlist(prev => prev.filter(item => item.id !== id));
        // Remove from prices
        const itemToDelete = watchlist.find(item => item.id === id);
        if (itemToDelete) {
          setStockPrices(prev => {
            const newPrices = { ...prev };
            delete newPrices[itemToDelete.stockCode];
            return newPrices;
          });
        }
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      throw error;
    }
  };

  // Filter watchlist based on search query
  const filteredWatchlist = watchlist.filter(item =>
    item.stockCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.stockName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Calculate search statistics
  const searchStats = {
    total: watchlist.length,
    filtered: filteredWatchlist.length,
    searchActive: searchQuery.length > 0,
  };

  // Calculate summary statistics
  const calculateSummary = () => {
    const itemsWithBuyPrice = watchlist.filter(item => item.buyPrice !== null);
    const itemsWithTarget = watchlist.filter(item => item.targetPrice !== null);
    const itemsWithStopLoss = watchlist.filter(item => item.stopLossPrice !== null);

    const totalInvested = itemsWithBuyPrice.reduce((sum, item) => sum + (item.buyPrice || 0), 0);
    const avgTargetProfit = itemsWithTarget.length > 0
      ? itemsWithTarget.reduce((sum, item) => {
          const profit = ((item.targetPrice! - item.buyPrice!) / item.buyPrice!) * 100;
          return sum + profit;
        }, 0) / itemsWithTarget.length
      : 0;

    return {
      totalStocks: watchlist.length,
      totalInvested,
      avgTargetProfit,
      itemsWithStopLoss: itemsWithStopLoss.length,
    };
  };

  const summary = calculateSummary();

  useEffect(() => {
    fetchWatchlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only fetch on mount

  // Separate effect for price updates
  useEffect(() => {
    if (watchlist.length === 0) return;

    // Initial price fetch
    fetchStockPrices(watchlist);

    // Set up interval to refresh prices every 30 seconds
    const intervalId = setInterval(() => {
      fetchStockPrices(watchlist);
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist.length]); // Re-run when watchlist length changes

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>自选股管理</CardTitle>
          <CardDescription>正在加载您的自选股...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-40 space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">请稍候...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>自选股管理</CardTitle>
              <CardDescription>
                管理您的自选股票，设置买入成本、止损价和目标价
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={fetchWatchlist}
                disabled={isLoading}
                title="刷新自选股"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    添加股票
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>添加自选股</DialogTitle>
                  <DialogDescription>
                    搜索股票代码或名称快速添加
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">搜索股票</label>
                    <StockSearchInput
                      onSelect={(stock) => {
                        setNewStock({
                          ...newStock,
                          stockCode: stock.code,
                          stockName: stock.name
                        });
                      }}
                      placeholder="输入股票代码或名称搜索（如：000001 或 平安银行）"
                    />
                    {!newStock.stockCode && (
                      <p className="text-xs text-muted-foreground mt-1">
                        💡 请先在上方搜索框中搜索并选择股票
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">股票代码 *</label>
                      <Input
                        value={newStock.stockCode}
                        onChange={(e) => setNewStock({ ...newStock, stockCode: e.target.value })}
                        placeholder="如：000001"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">股票名称 *</label>
                      <Input
                        value={newStock.stockName}
                        onChange={(e) => setNewStock({ ...newStock, stockName: e.target.value })}
                        placeholder="如：平安银行"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">买入成本</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newStock.buyPrice}
                        onChange={(e) => setNewStock({ ...newStock, buyPrice: e.target.value })}
                        placeholder="可选"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">止损价</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newStock.stopLossPrice}
                        onChange={(e) => setNewStock({ ...newStock, stopLossPrice: e.target.value })}
                        placeholder="可选"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">目标价</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newStock.targetPrice}
                        onChange={(e) => setNewStock({ ...newStock, targetPrice: e.target.value })}
                        placeholder="可选"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">备注</label>
                    <Input
                      value={newStock.notes}
                      onChange={(e) => setNewStock({ ...newStock, notes: e.target.value })}
                      placeholder="添加备注..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    取消
                  </Button>
                  <Button
                    onClick={handleAddStock}
                    disabled={!newStock.stockCode || !newStock.stockName}
                  >
                    添加
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{summary.totalStocks}</div>
                  <div className="text-sm text-muted-foreground">自选股票</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">
                    ¥{summary.totalInvested.toFixed(2)}
                  </div>
                  <div className="text-sm text-muted-foreground">总投资额</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-green-600">
                    {summary.avgTargetProfit.toFixed(2)}%
                  </div>
                  <div className="text-sm text-muted-foreground">平均目标盈利</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{summary.itemsWithStopLoss}</div>
                  <div className="text-sm text-muted-foreground">设置止损</div>
                </CardContent>
              </Card>
            </div>

            {/* Search and Filter */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索股票代码、名称或备注..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                )}
              </div>
              <Button variant="outline" size="icon" onClick={() => setSearchQuery("")} disabled={!searchQuery}>
                <Filter className="h-4 w-4" />
              </Button>
            </div>

            {/* Search Stats */}
            {searchStats.searchActive && (
              <div className="text-sm text-muted-foreground">
                找到 {searchStats.filtered} 个结果（共 {searchStats.total} 个自选股）
              </div>
            )}

            {/* Watchlist Items */}
            {filteredWatchlist.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-muted-foreground mb-4">
                  {searchQuery ? "未找到匹配的股票" : "暂无自选股票"}
                </div>
                {!searchQuery && (
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    添加第一只股票
                  </Button>
                )}
                {searchQuery && (
                  <Button variant="outline" onClick={() => setSearchQuery("")} className="mt-2">
                    清除搜索
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredWatchlist.map((item) => (
                  <WatchlistCard
                    key={item.id}
                    item={item}
                    onUpdate={handleUpdateItem}
                    onDelete={handleDeleteItem}
                    priceData={stockPrices[item.stockCode]}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}