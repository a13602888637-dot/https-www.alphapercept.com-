"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CommandBar } from "./CommandBar";
import { GlobalMacroPulse } from "./GlobalMacroPulse";
import { WorldMapPanel } from "./WorldMapPanel";
import { IntelligencePanel } from "./IntelligencePanel";
import { AIAnalystPanel } from "./AIAnalystPanel";
import { SectorHeatmap } from "./SectorHeatmap";
import { WatchlistStrip } from "./WatchlistStrip";

const MARKET_INDICES = [
  { code: "000001", name: "上证指数" },
  { code: "399001", name: "深证成指" },
  { code: "399006", name: "创业板指" },
  { code: "000300", name: "沪深300" },
  { code: "000905", name: "中证500" },
];

// Sector representative stocks for heatmap
const SECTOR_STOCKS = [
  "600519", "000858", "600809",  // 白酒
  "300750", "601012", "002594",  // 新能源
  "601318", "600036", "601166",  // 金融
  "600276", "300760", "300015",  // 医药
  "002415", "002475", "688981",  // 科技
  "000333", "600887", "603288",  // 消费
  "601668", "601800", "600585",  // 基建
];

interface IndexData {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

interface GlobalMarket {
  symbol: string;
  name: string;
  category: string;
  region: string;
  price: number;
  change: number;
  changePercent: number;
}

interface IntelItem {
  id: string;
  stockCode: string;
  stockName: string;
  eventSummary: string;
  trapProbability: number;
  actionSignal: string;
}

interface NewsItem {
  title: string;
  summary: string;
  impact: string;
  sectors: string[];
}

interface WatchlistItem {
  stockCode: string;
  stockName: string;
  price?: number;
  change?: number;
  changePercent?: number;
}

export function OSINTDashboard() {
  const [aShareIndices, setAShareIndices] = useState<IndexData[]>([]);
  const [globalMarkets, setGlobalMarkets] = useState<GlobalMarket[]>([]);
  const [intelligence, setIntelligence] = useState<IntelItem[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [stockPrices, setStockPrices] = useState<Record<string, { changePercent: number }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showAiBriefing, setShowAiBriefing] = useState(false);
  const marketContextRef = useRef("");

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Parallel fetch all data sources
      const [indexRes, globalRes, intelRes, newsRes, watchRes, sectorRes] = await Promise.allSettled([
        fetch(`/api/stock-prices?symbols=${MARKET_INDICES.map(i => i.code).join(",")}`),
        fetch("/api/global-macro"),
        fetch("/api/intelligence-feed?limit=15"),
        fetch("/api/news-feed"),
        fetch("/api/watchlist"),
        fetch(`/api/stock-prices?symbols=${SECTOR_STOCKS.join(",")}`),
      ]);

      // A-Share indices
      if (indexRes.status === "fulfilled" && indexRes.value.ok) {
        const data = await indexRes.value.json();
        if (data.success && data.prices) {
          setAShareIndices(MARKET_INDICES.map(idx => ({
            code: idx.code,
            name: idx.name,
            price: data.prices[idx.code]?.price || 0,
            change: data.prices[idx.code]?.change || 0,
            changePercent: data.prices[idx.code]?.changePercent || 0,
          })));
        }
      }

      // Global markets
      if (globalRes.status === "fulfilled" && globalRes.value.ok) {
        const data = await globalRes.value.json();
        if (data.success && data.markets) {
          setGlobalMarkets(data.markets);
        }
      }

      // Intelligence feed
      if (intelRes.status === "fulfilled" && intelRes.value.ok) {
        const data = await intelRes.value.json();
        if (data.success && data.feed) {
          setIntelligence(data.feed);
        }
      }

      // News feed
      if (newsRes.status === "fulfilled" && newsRes.value.ok) {
        const data = await newsRes.value.json();
        if (data.success && data.news) {
          setNews(data.news);
        }
      }

      // Watchlist
      if (watchRes.status === "fulfilled" && watchRes.value.ok) {
        const wData = await watchRes.value.json();
        if (wData.success && wData.watchlist?.length > 0) {
          const wSymbols = wData.watchlist.map((w: any) => w.stockCode).join(",");
          try {
            const wPriceRes = await fetch(`/api/stock-prices?symbols=${wSymbols}`);
            const wpData = wPriceRes.ok ? await wPriceRes.json() : { prices: {} };
            const prices = wpData.success ? wpData.prices || {} : {};
            setWatchlist(wData.watchlist.slice(0, 10).map((w: any) => ({
              stockCode: w.stockCode,
              stockName: w.stockName,
              price: prices[w.stockCode]?.price,
              change: prices[w.stockCode]?.change,
              changePercent: prices[w.stockCode]?.changePercent,
            })));
          } catch {
            setWatchlist(wData.watchlist.slice(0, 10).map((w: any) => ({
              stockCode: w.stockCode,
              stockName: w.stockName,
            })));
          }
        }
      }

      // Sector stock prices
      if (sectorRes.status === "fulfilled" && sectorRes.value.ok) {
        const data = await sectorRes.value.json();
        if (data.success && data.prices) {
          const priceMap: Record<string, { changePercent: number }> = {};
          for (const [code, info] of Object.entries(data.prices)) {
            priceMap[code] = { changePercent: (info as any).changePercent || 0 };
          }
          setStockPrices(priceMap);
        }
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error("OSINT Dashboard fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Build market context string for AI
  useEffect(() => {
    const parts: string[] = [];
    if (aShareIndices.length > 0) {
      parts.push("A股: " + aShareIndices.map(i => `${i.name} ${i.price} (${i.changePercent >= 0 ? "+" : ""}${i.changePercent}%)`).join(", "));
    }
    if (globalMarkets.length > 0) {
      parts.push("全球: " + globalMarkets.map(m => `${m.name} ${m.price} (${m.changePercent >= 0 ? "+" : ""}${m.changePercent}%)`).join(", "));
    }
    marketContextRef.current = parts.join("\n");
  }, [aShareIndices, globalMarkets]);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 60000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-4 space-y-4 max-w-[1600px]">
        {/* Command Bar */}
        <CommandBar
          lastUpdate={lastUpdate}
          isLoading={isLoading}
          onRefresh={fetchAllData}
          onAiBriefing={() => setShowAiBriefing(v => !v)}
        />

        {/* Global Macro Pulse */}
        <GlobalMacroPulse
          aShareIndices={aShareIndices}
          globalMarkets={globalMarkets}
          isLoading={isLoading && aShareIndices.length === 0}
        />

        {/* Map + Intelligence Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4" style={{ minHeight: 360 }}>
          <div className="lg:col-span-3">
            <WorldMapPanel globalMarkets={globalMarkets} />
          </div>
          <div className="lg:col-span-2">
            <IntelligencePanel intelligence={intelligence} news={news} />
          </div>
        </div>

        {/* AI Analyst Panel */}
        {showAiBriefing && (
          <AIAnalystPanel marketContext={marketContextRef.current} />
        )}

        {/* Sector Heatmap */}
        <SectorHeatmap stockPrices={stockPrices} />

        {/* Watchlist Strip */}
        <WatchlistStrip items={watchlist} />
      </div>
    </div>
  );
}
