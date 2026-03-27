"use client";

/**
 * OSINT v2: Situational Awareness Command Screen
 *
 * Bento Grid layout — h-screen, no scroll:
 *   ┌────────┬──────────────────────────────┬────────┐
 *   │        │         TICKER BAR           │        │
 *   │  LEFT  ├──────────────────────────────┤ RIGHT  │
 *   │  20%   │        CENTER MAP  60%       │  20%   │
 *   │  Tab:  │    Geo-Spatial Base Layer    │  Tab:  │
 *   │ 行情/宏│  Aviation + Maritime + Geo   │情报/变化│
 *   │  观    │   + Weather + Humanitarian   │ /舆情  │
 *   └────────┴──────────────────────────────┴────────┘
 */

import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useDataStream } from "@/services/use-data-stream";
import { EntityType } from "@/services/types";
import { FinancePanel } from "./FinancePanel";
import { EconomicPanel } from "./EconomicPanel";
import { GeoMapBase } from "./GeoMapBase";
import { IntelFeed } from "./IntelFeed";
import { DeltaPanel } from "./DeltaPanel";
import { SocialPanel } from "./SocialPanel";
import { AISituationBrain } from "./AISituationBrain";
import { TickerBar } from "./TickerBar";
import { StatusBar } from "./StatusBar";

type LeftTab = "market" | "macro";
type RightTab = "intel" | "delta" | "social";

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[11px] font-mono px-2 py-1 transition-colors ${
        active
          ? "text-[#c8cdd5] border-b border-[#4a90d9]"
          : "text-[#3a4560] hover:text-[#5a6580]"
      }`}
    >
      {label}
    </button>
  );
}

export function SituationScreen() {
  const stream = useDataStream();
  const { getToken, isSignedIn } = useAuth();
  const [leftTab, setLeftTab] = useState<LeftTab>("market");
  const [rightTab, setRightTab] = useState<RightTab>("intel");

  // Real news headlines fetched from /api/news-feed (refreshed every 5 min)
  const [realNewsHeadlines, setRealNewsHeadlines] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadNews() {
      try {
        const res = await fetch("/api/news-feed");
        if (!res.ok) return;
        const data = await res.json();
        const titles = (data.news ?? [])
          .slice(0, 5)
          .map((item: { title?: string }) => item.title ?? "")
          .filter(Boolean);
        if (!cancelled) setRealNewsHeadlines(titles);
      } catch { /* silent */ }
    }
    loadNews();
    const iv = setInterval(loadNews, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  // Fetch user watchlist/portfolio for personalized AI analysis
  const [watchlistSummary, setWatchlistSummary] = useState<string>("");

  useEffect(() => {
    // Wait until Clerk auth state is resolved
    if (isSignedIn === undefined) return;
    if (!isSignedIn) { setWatchlistSummary(""); return; }

    let cancelled = false;
    async function loadWatchlist() {
      try {
        const token = await getToken();
        const res = await fetch("/api/watchlist", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const data = await res.json();
        const items = data.watchlist ?? [];
        if (items.length === 0) {
          if (!cancelled) setWatchlistSummary("");
          return;
        }
        const summary = items
          .map((item: { stockCode: string; stockName: string; buyPrice?: number | null; targetPrice?: number | null; stopLossPrice?: number | null }) => {
            const parts = [`${item.stockName}(${item.stockCode})`];
            if (item.buyPrice) parts.push(`买入价:${item.buyPrice}`);
            if (item.targetPrice) parts.push(`目标价:${item.targetPrice}`);
            if (item.stopLossPrice) parts.push(`止损价:${item.stopLossPrice}`);
            return parts.join(" ");
          })
          .join("; ");
        if (!cancelled) setWatchlistSummary(summary);
      } catch { /* silent — user may not be logged in */ }
    }
    loadWatchlist();
    const iv = setInterval(loadWatchlist, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [isSignedIn, getToken]);

  // Derive AI brain props from stream data (fallback when real news not yet loaded)
  const newsHeadlines = useMemo(() => {
    return stream.entities
      .filter((e) => e.type === EntityType.GEO_CONFLICT || (e.type === EntityType.FINANCIAL && Math.abs(e.deltaPercent ?? 0) > 3))
      .slice(0, 10)
      .map((e) => e.label);
  }, [stream.entities]);

  const marketSummary = useMemo(() => {
    const fins = stream.financials.slice(0, 5);
    if (fins.length === 0) return "";
    return fins
      .map((f) => `${f.label}: ${f.value ?? "N/A"} (${(f.deltaPercent ?? 0) >= 0 ? "+" : ""}${f.deltaPercent?.toFixed(2) ?? "0"}%)`)
      .join("; ");
  }, [stream.financials]);

  const economicSummary = useMemo(() => {
    if (stream.economic.length === 0) return "";
    return stream.economic
      .slice(0, 5)
      .map((e) => `${e.label}: ${e.value ?? "N/A"}`)
      .join("; ");
  }, [stream.economic]);

  return (
    <div className="h-full w-full overflow-hidden bg-[#060a12] text-[#c8cdd5] flex flex-col">
      {/* Top ticker bar */}
      <TickerBar financials={stream.financials} />

      {/* Main 3-column grid */}
      <div className="flex-1 grid grid-cols-[260px_1fr_280px] gap-px min-h-0">
        {/* Left: Tab [行情] / [宏观] */}
        <div className="overflow-hidden border-r border-[#1a2035] flex flex-col min-h-0">
          <div className="flex items-center gap-0 px-2 py-1 border-b border-[#1a2035]/50">
            <TabButton active={leftTab === "market"} label="行情" onClick={() => setLeftTab("market")} />
            <TabButton active={leftTab === "macro"} label="宏观" onClick={() => setLeftTab("macro")} />
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {leftTab === "market" ? (
              <FinancePanel financials={stream.financials} isLoading={stream.isLoading} />
            ) : (
              <EconomicPanel economic={stream.economic} isLoading={stream.isLoading} />
            )}
          </div>
        </div>

        {/* Center: Geo-Spatial Map */}
        <div className="relative min-h-0">
          <GeoMapBase
            aviation={stream.aviation}
            maritime={stream.maritime}
            conflicts={stream.conflicts}
            financials={stream.financials}
            weather={stream.weather}
            humanitarian={stream.humanitarian}
          />
        </div>

        {/* Right: Tab [情报] / [变化] / [舆情] */}
        <div className="overflow-hidden border-l border-[#1a2035] flex flex-col min-h-0">
          <AISituationBrain
            newsHeadlines={realNewsHeadlines.length > 0 ? realNewsHeadlines : newsHeadlines}
            conflictCount={stream.conflicts.length}
            marketSummary={marketSummary}
            vesselCount={stream.maritime.length}
            economicSummary={economicSummary}
            deltaEventCount={stream.deltaEvents.length}
            weatherAlertCount={stream.weather.length}
            watchlistSummary={watchlistSummary}
          />
          <div className="flex items-center gap-0 px-2 py-1 border-b border-[#1a2035]/50">
            <TabButton active={rightTab === "intel"} label="情报" onClick={() => setRightTab("intel")} />
            <TabButton active={rightTab === "delta"} label="变化" onClick={() => setRightTab("delta")} />
            <TabButton active={rightTab === "social"} label="舆情" onClick={() => setRightTab("social")} />
          </div>
          <div className="flex-1 overflow-hidden min-h-0">
            {rightTab === "intel" ? (
              <IntelFeed
                entities={stream.entities}
                conflicts={stream.conflicts}
                errors={stream.errors}
              />
            ) : rightTab === "delta" ? (
              <DeltaPanel deltaEvents={stream.deltaEvents} />
            ) : (
              <SocialPanel social={stream.social} isLoading={stream.isLoading} />
            )}
          </div>
        </div>
      </div>

      {/* Bottom status bar */}
      <StatusBar health={stream.health} errors={stream.errors} lastUpdate={stream.lastUpdate} />
    </div>
  );
}
