"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StockSearchInput } from "@/components/watchlist/StockSearchInput";
import { QAChat, DashboardContext } from "@/components/strategy-chat/qa-chat";
import { AICandidatesPanel } from "@/components/dashboard/AICandidatesPanel";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Radar,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  RefreshCw,
  Brain,
  X,
  LogIn,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

type AlertType = "stop-loss-alert" | "target-alert" | "volatility-alert";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TradingCommandCenter() {
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();
  const { isLoaded } = useUser();

  // Data state
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [stockPrices, setStockPrices] = useState<StockPriceMap>({});
  const [isLoading, setIsLoading] = useState(true);

  // Alert state
  const [alerts, setAlerts] = useState<Map<string, AlertType[]>>(new Map());
  const firedNotifications = useRef<Set<string>>(new Set());

  // News headlines for AI context
  const [newsHeadlines, setNewsHeadlines] = useState<string[]>([]);

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newStock, setNewStock] = useState({
    stockCode: "",
    stockName: "",
    buyPrice: "",
    stopLossPrice: "",
    targetPrice: "",
    notes: "",
  });

  // -------------------------------------------------------------------
  // Browser notification permission
  // -------------------------------------------------------------------
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  // -------------------------------------------------------------------
  // Fetch watchlist
  // -------------------------------------------------------------------
  const fetchWatchlist = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getToken();
      const response = await fetch("/api/watchlist", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch watchlist");
      }

      const data = await response.json();
      if (data.success) {
        setWatchlist(data.watchlist);
      }
    } catch (error) {
      console.error("Error fetching watchlist:", error);
      toast.error("Failed to load watchlist");
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  // -------------------------------------------------------------------
  // Fetch stock prices
  // -------------------------------------------------------------------
  const fetchStockPrices = useCallback(
    async (items: WatchlistItem[]) => {
      if (items.length === 0) {
        setStockPrices({});
        return;
      }

      try {
        const symbols = items.map((i) => i.stockCode).join(",");
        const response = await fetch(
          `/api/stock-prices?symbols=${encodeURIComponent(symbols)}`
        );

        if (!response.ok) throw new Error("Price fetch failed");

        const data = await response.json();

        if (data.success && data.prices) {
          const prices: StockPriceMap = {};
          items.forEach((item) => {
            const pd = data.prices[item.stockCode];
            if (pd && pd.price) {
              prices[item.stockCode] = {
                price: pd.price,
                change: pd.change,
                changePercent: pd.changePercent,
                high: pd.high,
                low: pd.low,
                volume: pd.volume,
                turnover: pd.turnover,
                lastUpdate: pd.lastUpdate,
                name: pd.name,
              };
            } else {
              prices[item.stockCode] = {
                price: item.buyPrice || 0,
                change: 0,
                changePercent: 0,
              };
            }
          });
          setStockPrices(prices);

          // Detect alerts
          detectAlerts(items, prices);
        }
      } catch (error) {
        console.error("Error fetching stock prices:", error);
        // Fallback
        const prices: StockPriceMap = {};
        items.forEach((item) => {
          prices[item.stockCode] = {
            price: item.buyPrice || 0,
            change: 0,
            changePercent: 0,
          };
        });
        setStockPrices(prices);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // -------------------------------------------------------------------
  // Alert detection & browser notification
  // -------------------------------------------------------------------
  const detectAlerts = useCallback(
    (items: WatchlistItem[], prices: StockPriceMap) => {
      const newAlerts = new Map<string, AlertType[]>();

      items.forEach((item) => {
        const pd = prices[item.stockCode];
        if (!pd) return;

        const itemAlerts: AlertType[] = [];

        if (
          item.stopLossPrice &&
          pd.price > 0 &&
          pd.price <= item.stopLossPrice
        ) {
          itemAlerts.push("stop-loss-alert");
        }

        if (item.targetPrice && pd.price > 0 && pd.price >= item.targetPrice) {
          itemAlerts.push("target-alert");
        }

        if (pd.changePercent && Math.abs(pd.changePercent) > 5) {
          itemAlerts.push("volatility-alert");
        }

        if (itemAlerts.length > 0) {
          newAlerts.set(item.stockCode, itemAlerts);

          // Browser notification (fire once per session per stock+type)
          itemAlerts.forEach((alertType) => {
            const key = `${item.stockCode}-${alertType}`;
            if (!firedNotifications.current.has(key)) {
              firedNotifications.current.add(key);
              sendNotification(item.stockName, pd.price, alertType);
            }
          });
        }
      });

      setAlerts(newAlerts);
    },
    []
  );

  const sendNotification = (
    stockName: string,
    price: number,
    alertType: AlertType
  ) => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    )
      return;

    const labels: Record<AlertType, string> = {
      "stop-loss-alert": "stop-loss level",
      "target-alert": "target price",
      "volatility-alert": "high volatility (>5%)",
    };

    new Notification(`Alert: ${stockName}`, {
      body: `Price ${price.toFixed(2)} hit ${labels[alertType]}`,
    });
  };

  // -------------------------------------------------------------------
  // Initial load + price polling (15s)
  // -------------------------------------------------------------------
  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  useEffect(() => {
    if (watchlist.length === 0) return;

    fetchStockPrices(watchlist);

    const interval = setInterval(() => {
      fetchStockPrices(watchlist);
    }, 15000);

    return () => clearInterval(interval);
  }, [watchlist.length, fetchStockPrices, watchlist]);

  // -------------------------------------------------------------------
  // Fetch news headlines for AI context
  // -------------------------------------------------------------------
  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch("/api/news-feed");
        if (!res.ok) return;
        const data = await res.json();
        if (data.news && Array.isArray(data.news)) {
          setNewsHeadlines(
            data.news.slice(0, 5).map((n: { title?: string; headline?: string }) => n.title || n.headline || "")
          );
        }
      } catch {
        // non-critical
      }
    };
    fetchNews();
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // -------------------------------------------------------------------
  // Build dashboard context for AI assistant
  // -------------------------------------------------------------------
  const dashboardContext: DashboardContext = useMemo(() => {
    const ctx: DashboardContext = {};

    // Watchlist with prices
    if (watchlist.length > 0) {
      ctx.watchlist = watchlist.map((item) => {
        const pd = stockPrices[item.stockCode];
        return {
          stockCode: item.stockCode,
          stockName: item.stockName,
          price: pd?.price ?? 0,
          changePercent: pd?.changePercent ?? 0,
          buyPrice: item.buyPrice,
          stopLossPrice: item.stopLossPrice,
          targetPrice: item.targetPrice,
        };
      });
    }

    // News
    if (newsHeadlines.length > 0) {
      ctx.newsHeadlines = newsHeadlines;
    }

    return ctx;
  }, [watchlist, stockPrices, newsHeadlines]);

  // -------------------------------------------------------------------
  // Add stock handler
  // -------------------------------------------------------------------
  const handleAddStock = async () => {
    if (!newStock.stockCode || !newStock.stockName) {
      toast.error("Please enter stock code and name");
      return;
    }

    try {
      const token = await getToken();
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to add stock");
      }

      const data = await response.json();
      if (data.success) {
        toast.success(
          `${newStock.stockName} (${newStock.stockCode}) added to watchlist`
        );
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
      }
    } catch (error) {
      console.error("Error adding stock:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to add stock"
      );
    }
  };

  // -------------------------------------------------------------------
  // Delete stock handler
  // -------------------------------------------------------------------
  const handleDeleteStock = async (id: string, stockName: string) => {
    try {
      const token = await getToken();
      const response = await fetch(`/api/watchlist?id=${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to delete");
      const result = await response.json();
      if (result.success) {
        setWatchlist((prev) => prev.filter((item) => item.id !== id));
        toast.success(`${stockName} removed from watchlist`);
      }
    } catch (error) {
      console.error("Error deleting stock:", error);
      toast.error("Failed to remove stock");
    }
  };

  // -------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------
  const filteredWatchlist = watchlist.filter(
    (item) =>
      item.stockCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.stockName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = (() => {
    let up = 0;
    let down = 0;
    let flat = 0;
    let alertCount = 0;

    watchlist.forEach((item) => {
      const pd = stockPrices[item.stockCode];
      if (!pd) {
        flat++;
        return;
      }
      const cp = pd.changePercent ?? 0;
      if (cp > 0) up++;
      else if (cp < 0) down++;
      else flat++;
    });

    alerts.forEach((a) => {
      alertCount += a.length;
    });

    return { total: watchlist.length, up, down, flat, alertCount };
  })();

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div className="h-full overflow-hidden bg-[#0a0e17] text-gray-100 flex flex-col">
      {/* ============================================================= */}
      {/* COMMAND BAR                                                    */}
      {/* ============================================================= */}
      <header className="flex-shrink-0 border-b border-gray-800 px-4 py-2 flex items-center gap-4">
        {/* Branding */}
        <div className="flex items-center gap-2 mr-4 flex-shrink-0">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Brain className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight hidden sm:inline">
            Alpha-Quant
          </span>
        </div>

        {/* Stats chips */}
        <div className="flex items-center gap-3 text-xs font-mono flex-shrink-0">
          <span className="bg-gray-800/80 px-2.5 py-1 rounded-md">
            {stats.total} stocks
          </span>
          <span className="bg-green-900/40 text-green-400 px-2.5 py-1 rounded-md flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {stats.up}
          </span>
          <span className="bg-red-900/40 text-red-400 px-2.5 py-1 rounded-md flex items-center gap-1">
            <TrendingDown className="h-3 w-3" />
            {stats.down}
          </span>
          <span className="bg-gray-800/80 text-gray-400 px-2.5 py-1 rounded-md flex items-center gap-1">
            <Minus className="h-3 w-3" />
            {stats.flat}
          </span>
          {stats.alertCount > 0 && (
            <span className="bg-amber-900/40 text-amber-400 px-2.5 py-1 rounded-md flex items-center gap-1 animate-pulse">
              <AlertTriangle className="h-3 w-3" />
              {stats.alertCount}
            </span>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search */}
        <div className="relative w-48 lg:w-64 flex-shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search watchlist..."
            className="w-full bg-gray-800/60 border border-gray-700 rounded-md pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
          />
        </div>

        {/* Add button */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors flex-shrink-0">
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </DialogTrigger>
          <DialogContent className="bg-[#111827] border-gray-700 text-gray-100">
            <DialogHeader>
              <DialogTitle>Add Stock to Watchlist</DialogTitle>
              <DialogDescription className="text-gray-400">
                Search by code or name, then set price levels.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block text-gray-300">
                  Search Stock
                </label>
                <StockSearchInput
                  onSelect={(stock) => {
                    setNewStock({
                      ...newStock,
                      stockCode: stock.code,
                      stockName: stock.name,
                    });
                  }}
                  placeholder="Enter code or name..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">
                    Code *
                  </label>
                  <Input
                    value={newStock.stockCode}
                    onChange={(e) =>
                      setNewStock({ ...newStock, stockCode: e.target.value })
                    }
                    placeholder="000001"
                    className="bg-gray-800 border-gray-700 text-gray-100"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">
                    Name *
                  </label>
                  <Input
                    value={newStock.stockName}
                    onChange={(e) =>
                      setNewStock({ ...newStock, stockName: e.target.value })
                    }
                    placeholder="Stock name"
                    className="bg-gray-800 border-gray-700 text-gray-100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">
                    Buy Price
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newStock.buyPrice}
                    onChange={(e) =>
                      setNewStock({ ...newStock, buyPrice: e.target.value })
                    }
                    placeholder="--"
                    className="bg-gray-800 border-gray-700 text-gray-100"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">
                    Stop Loss
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newStock.stopLossPrice}
                    onChange={(e) =>
                      setNewStock({
                        ...newStock,
                        stopLossPrice: e.target.value,
                      })
                    }
                    placeholder="--"
                    className="bg-gray-800 border-gray-700 text-gray-100"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">
                    Target
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newStock.targetPrice}
                    onChange={(e) =>
                      setNewStock({ ...newStock, targetPrice: e.target.value })
                    }
                    placeholder="--"
                    className="bg-gray-800 border-gray-700 text-gray-100"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Notes
                </label>
                <Input
                  value={newStock.notes}
                  onChange={(e) =>
                    setNewStock({ ...newStock, notes: e.target.value })
                  }
                  placeholder="Optional notes..."
                  className="bg-gray-800 border-gray-700 text-gray-100"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddStock}
                className="bg-blue-600 hover:bg-blue-500"
              >
                Add Stock
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Refresh */}
        <button
          onClick={fetchWatchlist}
          className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
          title="Refresh"
        >
          <RefreshCw
            className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
          />
        </button>

        {/* OSINT Link */}
        <Link
          href="/osint"
          className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium px-3 py-1.5 rounded-md transition-colors flex-shrink-0"
        >
          <Radar className="h-3.5 w-3.5 text-cyan-400" />
          OSINT Radar
        </Link>
      </header>

      {/* ============================================================= */}
      {/* MAIN CONTENT                                                   */}
      {/* ============================================================= */}
      <div className="flex-1 flex overflow-hidden">
        {/* ----------------------------------------------------------- */}
        {/* WATCHLIST GRID (~75%)                                        */}
        {/* ----------------------------------------------------------- */}
        <main className="flex-1 overflow-y-auto p-3 scrollbar-thin">
          {isLoaded && !isSignedIn ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-blue-600/10 border border-blue-600/20 flex items-center justify-center mx-auto">
                  <LogIn className="h-5 w-5 text-blue-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-300 font-medium">登录后查看自选股</p>
                  <p className="text-xs text-gray-600">您的自选股将与账户绑定，跨设备同步</p>
                </div>
                <a
                  href="/sign-in"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-2 rounded-md transition-colors"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  立即登录
                </a>
              </div>
            </div>
          ) : isLoading && watchlist.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
                <p className="text-sm text-gray-500">Loading watchlist...</p>
              </div>
            </div>
          ) : filteredWatchlist.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3">
                <div className="text-gray-600 text-sm">
                  {searchQuery
                    ? "No stocks match your search."
                    : "No stocks in watchlist. Add your first stock."}
                </div>
                {!searchQuery && (
                  <button
                    onClick={() => setIsAddDialogOpen(true)}
                    className="text-blue-400 hover:text-blue-300 text-sm underline underline-offset-2"
                  >
                    + Add stock
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {filteredWatchlist.map((item) => {
                const pd = stockPrices[item.stockCode];
                const currentPrice = pd?.price ?? 0;
                const change = pd?.change ?? 0;
                const changePercent = pd?.changePercent ?? 0;
                const isPositive = changePercent > 0;
                const isNegative = changePercent < 0;

                const pnl =
                  item.buyPrice && currentPrice > 0
                    ? ((currentPrice - item.buyPrice) / item.buyPrice) * 100
                    : null;

                const itemAlerts = alerts.get(item.stockCode) || [];
                const hasStopLossAlert =
                  itemAlerts.includes("stop-loss-alert");
                const hasTargetAlert = itemAlerts.includes("target-alert");
                const hasAlert = itemAlerts.length > 0;

                let alertRingClass = "";
                if (hasStopLossAlert)
                  alertRingClass =
                    "animate-alert-breathe border-red-500/60";
                else if (hasTargetAlert)
                  alertRingClass =
                    "animate-alert-breathe-green border-green-500/60";

                return (
                  <div
                    key={item.id}
                    onClick={() => router.push(`/dashboard/stock/${item.stockCode}`)}
                    className={`bg-[#111827] border rounded-lg p-3 transition-all hover:bg-[#1a2332] cursor-pointer ${
                      hasAlert
                        ? alertRingClass
                        : "border-gray-800 hover:border-gray-700"
                    }`}
                  >
                    {/* Header: Code + Name + Actions */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-white leading-tight truncate">
                          {item.stockCode}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {item.stockName}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                        {hasAlert && (
                          <AlertTriangle
                            className={`h-3.5 w-3.5 ${
                              hasStopLossAlert
                                ? "text-red-400"
                                : "text-green-400"
                            }`}
                          />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteStock(item.id, item.stockName);
                          }}
                          className="text-gray-600 hover:text-red-400 transition-colors p-0.5 rounded hover:bg-red-900/20"
                          title="Remove from watchlist"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Price row */}
                    <div className="flex items-baseline gap-2 mb-2">
                      <span
                        className={`font-mono text-xl font-bold ${
                          isPositive
                            ? "text-green-400"
                            : isNegative
                            ? "text-red-400"
                            : "text-gray-200"
                        }`}
                      >
                        {currentPrice > 0 ? currentPrice.toFixed(2) : "--"}
                      </span>
                      <span
                        className={`font-mono text-xs ${
                          isPositive
                            ? "text-green-400"
                            : isNegative
                            ? "text-red-400"
                            : "text-gray-500"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {change !== 0 ? change.toFixed(2) : "0.00"}{" "}
                        ({isPositive ? "+" : ""}
                        {changePercent.toFixed(2)}%)
                      </span>
                    </div>

                    {/* Price levels */}
                    <div className="grid grid-cols-3 gap-1 text-[10px] mb-2">
                      <div className="bg-gray-800/50 rounded px-1.5 py-1">
                        <span className="text-gray-500 block">Buy</span>
                        <span className="text-gray-300 font-mono">
                          {item.buyPrice?.toFixed(2) ?? "--"}
                        </span>
                      </div>
                      <div className="bg-gray-800/50 rounded px-1.5 py-1">
                        <span className="text-gray-500 block">Stop</span>
                        <span className="text-red-400/80 font-mono">
                          {item.stopLossPrice?.toFixed(2) ?? "--"}
                        </span>
                      </div>
                      <div className="bg-gray-800/50 rounded px-1.5 py-1">
                        <span className="text-gray-500 block">Target</span>
                        <span className="text-green-400/80 font-mono">
                          {item.targetPrice?.toFixed(2) ?? "--"}
                        </span>
                      </div>
                    </div>

                    {/* P&L */}
                    {pnl !== null && (
                      <div
                        className={`text-xs font-mono font-semibold ${
                          pnl >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        P&L: {pnl >= 0 ? "+" : ""}
                        {pnl.toFixed(2)}%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* ----------------------------------------------------------- */}
        {/* AI COMMAND TOWER (~25%)                                      */}
        {/* ----------------------------------------------------------- */}
        <aside className="hidden lg:flex flex-col w-80 xl:w-96 border-l border-[#111125] bg-[#050505] overflow-hidden">
          {/* AI Candidates — fixed ~35% */}
          <div className="flex-shrink-0 h-[35%] border-b border-[#111125] overflow-y-auto scrollbar-thin scrollbar-thumb-[#1a1a2e] scrollbar-track-transparent">
            <AICandidatesPanel />
          </div>

          {/* QA Chat — fills remaining ~65% */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <QAChat dashboardContext={dashboardContext} />
          </div>
        </aside>
      </div>
    </div>
  );
}
