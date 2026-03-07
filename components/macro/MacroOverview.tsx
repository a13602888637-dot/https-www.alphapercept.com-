"use client";

import { useState, useEffect, useCallback } from "react";
import { MarketIndexCard } from "./MarketIndexCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Brain,
  Flame,
  Star,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface IndexData {
  name: string;
  code: string;
  price: number;
  change: number;
  changePercent: number;
}

interface WatchlistItem {
  stockCode: string;
  stockName: string;
  buyPrice?: number;
}

// Core market indices
const MARKET_INDICES = [
  { code: "000001", name: "上证指数" },
  { code: "399001", name: "深证成指" },
  { code: "399006", name: "创业板指" },
  { code: "000300", name: "沪深300" },
  { code: "000905", name: "中证500" },
];

// Hot sector leaders
const HOT_STOCKS = [
  { code: "600519", name: "贵州茅台" },
  { code: "300750", name: "宁德时代" },
  { code: "002415", name: "海康威视" },
  { code: "000858", name: "五粮液" },
  { code: "601318", name: "中国平安" },
];

export function MacroOverview() {
  const router = useRouter();
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [hotStocks, setHotStocks] = useState<IndexData[]>([]);
  const [watchlistStocks, setWatchlistStocks] = useState<(WatchlistItem & { price?: number; change?: number; changePercent?: number })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);

  const fetchMarketData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch index data
      const indexSymbols = MARKET_INDICES.map((i) => i.code).join(",");
      const indexRes = await fetch(`/api/stock-prices?symbols=${indexSymbols}`);
      if (indexRes.ok) {
        const data = await indexRes.json();
        if (data.success && data.prices) {
          const indexList = MARKET_INDICES.map((idx) => {
            const priceData = data.prices[idx.code];
            return {
              code: idx.code,
              name: idx.name,
              price: priceData?.price || 0,
              change: priceData?.change || 0,
              changePercent: priceData?.changePercent || 0,
            };
          });
          setIndices(indexList);
        }
      }

      // Fetch hot stock data
      const hotSymbols = HOT_STOCKS.map((s) => s.code).join(",");
      const hotRes = await fetch(`/api/stock-prices?symbols=${hotSymbols}`);
      if (hotRes.ok) {
        const data = await hotRes.json();
        if (data.success && data.prices) {
          const hotList = HOT_STOCKS.map((stock) => {
            const priceData = data.prices[stock.code];
            return {
              code: stock.code,
              name: stock.name,
              price: priceData?.price || 0,
              change: priceData?.change || 0,
              changePercent: priceData?.changePercent || 0,
            };
          });
          setHotStocks(hotList);
        }
      }

      // Fetch watchlist
      try {
        const watchRes = await fetch("/api/watchlist");
        if (watchRes.ok) {
          const wData = await watchRes.json();
          if (wData.success && wData.watchlist && wData.watchlist.length > 0) {
            const wSymbols = wData.watchlist.map((w: any) => w.stockCode).join(",");
            const wPriceRes = await fetch(`/api/stock-prices?symbols=${wSymbols}`);
            let wPrices: any = {};
            if (wPriceRes.ok) {
              const wpData = await wPriceRes.json();
              if (wpData.success) wPrices = wpData.prices || {};
            }
            setWatchlistStocks(
              wData.watchlist.slice(0, 10).map((w: any) => ({
                stockCode: w.stockCode,
                stockName: w.stockName,
                buyPrice: w.buyPrice,
                price: wPrices[w.stockCode]?.price,
                change: wPrices[w.stockCode]?.change,
                changePercent: wPrices[w.stockCode]?.changePercent,
              }))
            );
          }
        }
      } catch {
        // Watchlist fetch is optional
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error fetching market data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAiSummary = useCallback(async () => {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content:
                "请用3-5句话简要分析今日A股市场整体走势、热点板块和主要风险点。语言简洁专业，直接给出结论。",
            },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.reply) {
          setAiSummary(data.reply);
        }
      }
    } catch (error) {
      console.error("Error fetching AI summary:", error);
      setAiSummary("AI市场分析暂时不可用，请稍后重试。");
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarketData();
    fetchAiSummary();

    // Auto refresh every 60 seconds
    const interval = setInterval(fetchMarketData, 60000);
    return () => clearInterval(interval);
  }, [fetchMarketData, fetchAiSummary]);

  // Market sentiment calculation
  const upCount = hotStocks.filter((s) => s.change > 0).length;
  const downCount = hotStocks.filter((s) => s.change < 0).length;
  const flatCount = hotStocks.filter((s) => s.change === 0).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-blue-400" />
              态势感知
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {lastUpdate
                ? `最后更新: ${lastUpdate.toLocaleTimeString()}`
                : "加载中..."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMarketData}
            disabled={isLoading}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")}
            />
            刷新
          </Button>
        </div>

        {/* Core Market Indices */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            核心市场指数
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {isLoading && indices.length === 0
              ? MARKET_INDICES.map((idx) => (
                  <MarketIndexCard
                    key={idx.code}
                    name={idx.name}
                    code={idx.code}
                    price={0}
                    change={0}
                    changePercent={0}
                    isLoading
                  />
                ))
              : indices.map((idx) => (
                  <MarketIndexCard
                    key={idx.code}
                    name={idx.name}
                    code={idx.code}
                    price={idx.price}
                    change={idx.change}
                    changePercent={idx.changePercent}
                  />
                ))}
          </div>
        </section>

        {/* Middle section: Sentiment + AI */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Market Sentiment */}
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-400" />
                市场情绪
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">{upCount}</div>
                  <div className="text-xs text-slate-400">上涨</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-400">{flatCount}</div>
                  <div className="text-xs text-slate-400">平盘</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{downCount}</div>
                  <div className="text-xs text-slate-400">下跌</div>
                </div>
              </div>

              {/* Sentiment bar */}
              <div className="h-2 rounded-full bg-slate-700 overflow-hidden flex">
                {hotStocks.length > 0 && (
                  <>
                    <div
                      className="bg-red-500 transition-all duration-500"
                      style={{
                        width: `${(upCount / hotStocks.length) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-slate-500 transition-all duration-500"
                      style={{
                        width: `${(flatCount / hotStocks.length) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-green-500 transition-all duration-500"
                      style={{
                        width: `${(downCount / hotStocks.length) * 100}%`,
                      }}
                    />
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* AI Market Analysis */}
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-400" />
                AI市场解读
              </CardTitle>
            </CardHeader>
            <CardContent>
              {aiLoading ? (
                <div className="flex items-center gap-2 text-slate-400 py-4">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-sm">AI正在分析市场...</span>
                </div>
              ) : aiSummary ? (
                <p className="text-sm text-slate-300 leading-relaxed">
                  {aiSummary}
                </p>
              ) : (
                <p className="text-sm text-slate-500">暂无AI分析</p>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchAiSummary}
                disabled={aiLoading}
                className="mt-3 text-purple-400 hover:text-purple-300 hover:bg-slate-700/50 p-0 h-auto"
              >
                <RefreshCw
                  className={cn(
                    "h-3 w-3 mr-1",
                    aiLoading && "animate-spin"
                  )}
                />
                重新分析
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Hot Sector Leaders */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            热门龙头股
          </h2>
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-0">
              <div className="divide-y divide-slate-700/50">
                {hotStocks.map((stock) => (
                  <div
                    key={stock.code}
                    className="flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors cursor-pointer"
                    onClick={() => router.push(`/stocks/${stock.code}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-medium text-white text-sm">
                          {stock.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {stock.code}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-white text-sm">
                        {stock.price.toFixed(2)}
                      </div>
                      <div
                        className={cn(
                          "text-xs font-medium",
                          stock.change >= 0 ? "text-red-400" : "text-green-400"
                        )}
                      >
                        {stock.change >= 0 ? "+" : ""}
                        {stock.changePercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
                {hotStocks.length === 0 && !isLoading && (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    暂无数据
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Watchlist Snapshot */}
        {watchlistStocks.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Star className="h-4 w-4" />
              自选股快照
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
              {watchlistStocks.map((stock) => (
                <div
                  key={stock.stockCode}
                  className={cn(
                    "flex-shrink-0 w-40 rounded-lg border p-3 cursor-pointer transition-all hover:scale-105",
                    (stock.change || 0) >= 0
                      ? "border-red-500/30 bg-red-950/20"
                      : "border-green-500/30 bg-green-950/20"
                  )}
                  onClick={() => router.push(`/stocks/${stock.stockCode}`)}
                >
                  <div className="text-sm font-medium text-white truncate">
                    {stock.stockName}
                  </div>
                  <div className="text-xs text-slate-500 mb-2">
                    {stock.stockCode}
                  </div>
                  {stock.price !== undefined && (
                    <>
                      <div className="text-lg font-bold text-white">
                        {stock.price.toFixed(2)}
                      </div>
                      <div
                        className={cn(
                          "text-xs font-medium",
                          (stock.change || 0) >= 0
                            ? "text-red-400"
                            : "text-green-400"
                        )}
                      >
                        {(stock.change || 0) >= 0 ? "+" : ""}
                        {(stock.changePercent || 0).toFixed(2)}%
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
