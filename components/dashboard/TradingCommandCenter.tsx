"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  WatchlistStrip,
  type WatchlistItem,
  type StockPriceMap,
  type AlertType,
  type NewStockData,
} from "@/components/dashboard/WatchlistStrip";
import DabanPanel from "@/components/dashboard/DabanPanel";
import { HealthMiniPanel } from "@/components/dashboard/HealthMiniPanel";
import { QAChat, type DashboardContext } from "@/components/strategy-chat/qa-chat";

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

  // Selected stock (for watchlist card → AI chat context linkage)
  const [selectedStock, setSelectedStock] = useState<string | null>(null);

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
    if (isSignedIn === undefined || !isSignedIn) return;
    fetchWatchlist();
  }, [fetchWatchlist, isSignedIn]);

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
          isSelected: item.stockCode === selectedStock,
        };
      });
    }

    // News
    if (newsHeadlines.length > 0) {
      ctx.newsHeadlines = newsHeadlines;
    }

    return ctx;
  }, [watchlist, stockPrices, newsHeadlines, selectedStock]);

  // -------------------------------------------------------------------
  // Add stock handler
  // -------------------------------------------------------------------
  const handleAddStock = useCallback(async (newStock: NewStockData) => {
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
        fetchWatchlist();
      }
    } catch (error) {
      console.error("Error adding stock:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to add stock"
      );
    }
  }, [getToken, fetchWatchlist]);

  // -------------------------------------------------------------------
  // Delete stock handler
  // -------------------------------------------------------------------
  const handleDeleteStock = useCallback(async (id: string, stockName: string) => {
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
  }, [getToken]);

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div className="h-full overflow-hidden bg-[#0a0e17] text-gray-100 flex">
      {/* ============================================================= */}
      {/* LEFT PANEL                                                     */}
      {/* ============================================================= */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-[#1a2035]">
        {/* WATCHLIST STRIP - compact, fixed height */}
        <WatchlistStrip
          watchlist={watchlist}
          stockPrices={stockPrices}
          alerts={alerts}
          isLoading={isLoading && isLoaded !== false}
          selectedStock={selectedStock}
          onSelectStock={(code) => {
            setSelectedStock(code);
            router.push(`/dashboard/stock/${code}`);
          }}
          onAdd={handleAddStock}
          onDelete={handleDeleteStock}
          onRefresh={fetchWatchlist}
        />

        {/* DABAN AREA - fills remaining space, scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <DabanPanel />
        </div>
      </div>

      {/* ============================================================= */}
      {/* RIGHT PANEL - 320px                                            */}
      {/* ============================================================= */}
      <aside className="hidden lg:flex flex-col w-80 overflow-hidden bg-[#060a12]">
        {/* Health Mini */}
        <HealthMiniPanel />

        {/* QA Chat - fills remaining */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <QAChat dashboardContext={dashboardContext} />
        </div>
      </aside>
    </div>
  );
}
