"use client";

/**
 * OSINT v2: Situational Awareness Command Screen
 *
 * Bento Grid layout — h-screen, no scroll:
 *   ┌────────┬──────────────────────────────┬────────┐
 *   │        │         TICKER BAR           │        │
 *   │  LEFT  ├──────────────────────────────┤ RIGHT  │
 *   │  20%   │        CENTER MAP  60%       │  20%   │
 *   │Finance │    Geo-Spatial Base Layer    │ Intel  │
 *   │Sparkln │  Aviation + Maritime + Geo   │ Feed   │
 *   │        │                              │        │
 *   └────────┴──────────────────────────────┴────────┘
 */

import { useMemo, useState, useEffect } from "react";
import { useDataStream } from "@/services/use-data-stream";
import { EntityType } from "@/services/types";
import { FinancePanel } from "./FinancePanel";
import { GeoMapBase } from "./GeoMapBase";
import { IntelFeed } from "./IntelFeed";
import { AISituationBrain } from "./AISituationBrain";
import { TickerBar } from "./TickerBar";
import { StatusBar } from "./StatusBar";

export function SituationScreen() {
  const stream = useDataStream();

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

  return (
    <div className="h-full w-full overflow-hidden bg-[#060a12] text-[#c8cdd5] flex flex-col">
      {/* Top ticker bar */}
      <TickerBar financials={stream.financials} />

      {/* Main 3-column grid */}
      <div className="flex-1 grid grid-cols-[260px_1fr_280px] gap-px min-h-0">
        {/* Left: Finance + Macro */}
        <div className="overflow-y-auto border-r border-[#1a2035]">
          <FinancePanel financials={stream.financials} isLoading={stream.isLoading} />
        </div>

        {/* Center: Geo-Spatial Map */}
        <div className="relative min-h-0">
          <GeoMapBase
            aviation={stream.aviation}
            maritime={stream.maritime}
            conflicts={stream.conflicts}
            financials={stream.financials}
          />
        </div>

        {/* Right: AI Brain + Intelligence Feed */}
        <div className="overflow-hidden border-l border-[#1a2035] flex flex-col min-h-0">
          <AISituationBrain
            newsHeadlines={realNewsHeadlines.length > 0 ? realNewsHeadlines : newsHeadlines}
            conflictCount={stream.conflicts.length}
            marketSummary={marketSummary}
            vesselCount={stream.maritime.length}
          />
          <div className="flex-1 overflow-hidden min-h-0">
            <IntelFeed
              entities={stream.entities}
              conflicts={stream.conflicts}
              errors={stream.errors}
            />
          </div>
        </div>
      </div>

      {/* Bottom status bar */}
      <StatusBar health={stream.health} errors={stream.errors} lastUpdate={stream.lastUpdate} />
    </div>
  );
}
