"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { EntityType, type SituationalEntity, type GeoConflictEntity } from "@/services/types";

interface IntelFeedProps {
  entities: SituationalEntity[];
  conflicts: SituationalEntity[];
  errors: Record<string, string>;
}

interface FeedItem {
  id: string;
  timestamp: number;
  severity: "low" | "medium" | "high" | "critical";
  icon: string; // "GEO" | "FIN" | "SYS" | "AI" | "NEWS"
  headline: string;
  body: string;
  source: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "border-l-red-500 bg-red-950/20",
  high: "border-l-orange-500 bg-orange-950/10",
  medium: "border-l-amber-500/50",
  low: "border-l-slate-600/50",
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500 animate-pulse",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-slate-600",
};

function entityToFeedItem(e: SituationalEntity): FeedItem | null {
  if (e.type === EntityType.GEO_CONFLICT) {
    const meta = (e as GeoConflictEntity).metadata;
    const fatalities = meta.fatalities;
    let severity: FeedItem["severity"] = "low";
    if (fatalities > 50) severity = "critical";
    else if (fatalities > 10) severity = "high";
    else if (fatalities > 0) severity = "medium";

    return {
      id: e.id,
      timestamp: e.timestamp,
      severity,
      icon: "GEO",
      headline: e.label,
      body: meta.notes.slice(0, 120),
      source: e.source,
    };
  }

  if (e.type === EntityType.FINANCIAL && Math.abs(e.deltaPercent ?? 0) > 3) {
    return {
      id: `alert-${e.id}`,
      timestamp: e.timestamp,
      severity: Math.abs(e.deltaPercent ?? 0) > 5 ? "high" : "medium",
      icon: "FIN",
      headline: `${e.label} ${(e.deltaPercent ?? 0) >= 0 ? "+" : ""}${e.deltaPercent?.toFixed(2)}%`,
      body: `Price: ${e.value?.toLocaleString()} | ${(e.deltaPercent ?? 0) >= 0 ? "Surge" : "Plunge"} detected`,
      source: e.source,
    };
  }

  return null;
}

const SEVERITY_ORDER: Record<FeedItem["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function IntelFeed({ entities, conflicts, errors }: IntelFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [apiFeedItems, setApiFeedItems] = useState<FeedItem[]>([]);

  const fetchApiData = useCallback(async () => {
    const items: FeedItem[] = [];

    try {
      const intelRes = await fetch("/api/intelligence-feed?limit=20");
      if (intelRes.ok) {
        const intelData = await intelRes.json();
        const intelItems: unknown[] = Array.isArray(intelData)
          ? intelData
          : (intelData?.data ?? intelData?.items ?? []);
        for (const raw of intelItems) {
          const item = raw as Record<string, unknown>;
          const trapProb = Number(item.trapProbability ?? 0);
          const severity: FeedItem["severity"] =
            trapProb > 70 ? "high" : trapProb > 40 ? "medium" : "low";
          items.push({
            id: `intel-${item.id ?? Math.random()}`,
            timestamp:
              typeof item.createdAt === "string"
                ? new Date(item.createdAt).getTime()
                : Date.now(),
            severity,
            icon: "AI",
            headline: String(item.title ?? item.headline ?? item.stockCode ?? ""),
            body: String(item.summary ?? item.content ?? item.actionSignal ?? "").slice(0, 120),
            source: String(item.source ?? "intelligence-feed"),
          });
        }
      }
    } catch {
      // silently ignore fetch errors for API data
    }

    try {
      const newsRes = await fetch("/api/news-feed");
      if (newsRes.ok) {
        const newsData = await newsRes.json();
        const newsItems: unknown[] = Array.isArray(newsData)
          ? newsData
          : (newsData?.data ?? newsData?.items ?? []);
        for (const raw of newsItems) {
          const item = raw as Record<string, unknown>;
          const impact = String(item.impact ?? item.importance ?? "low").toLowerCase();
          const severity: FeedItem["severity"] =
            impact === "high" ? "critical" : impact === "medium" ? "medium" : "low";
          items.push({
            id: `news-${item.id ?? Math.random()}`,
            timestamp:
              typeof item.publishedAt === "string"
                ? new Date(item.publishedAt).getTime()
                : typeof item.createdAt === "string"
                ? new Date(item.createdAt).getTime()
                : Date.now(),
            severity,
            icon: "NEWS",
            headline: String(item.title ?? item.headline ?? ""),
            body: String(item.summary ?? item.description ?? item.content ?? "").slice(0, 120),
            source: String(item.source ?? "news-feed"),
          });
        }
      }
    } catch {
      // silently ignore fetch errors for news data
    }

    setApiFeedItems(items);
  }, []);

  useEffect(() => {
    fetchApiData();
    const interval = setInterval(fetchApiData, 60_000);
    return () => clearInterval(interval);
  }, [fetchApiData]);

  // Build feed items from props
  const propFeedItems: FeedItem[] = [];

  for (const e of conflicts) {
    const item = entityToFeedItem(e);
    if (item) propFeedItems.push(item);
  }

  for (const e of entities) {
    if (e.type === EntityType.FINANCIAL) {
      const item = entityToFeedItem(e);
      if (item) propFeedItems.push(item);
    }
  }

  for (const [name, msg] of Object.entries(errors)) {
    propFeedItems.push({
      id: `err-${name}`,
      timestamp: Date.now(),
      severity: "medium",
      icon: "SYS",
      headline: `${name} adapter error`,
      body: msg.slice(0, 100),
      source: "system",
    });
  }

  // Merge all sources, deduplicate by id
  const seen = new Set<string>();
  const allItems: FeedItem[] = [];
  for (const item of [...propFeedItems, ...apiFeedItems]) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      allItems.push(item);
    }
  }

  // Sort by severity first, then timestamp desc
  allItems.sort((a, b) => {
    const sd = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sd !== 0) return sd;
    return b.timestamp - a.timestamp;
  });

  // Auto-scroll to top on new critical items
  useEffect(() => {
    if (allItems[0]?.severity === "critical" && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems[0]?.id]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-[#1a2035] flex items-center justify-between">
        <span className="text-[9px] tracking-[0.2em] text-[#3a4560] font-semibold">INTELLIGENCE FEED</span>
        <span className="text-[9px] text-[#3a4560]">{allItems.length} events</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-px p-1">
        {allItems.length === 0 ? (
          <div className="text-center py-8 text-[#3a4560] text-[11px]">
            No active intelligence items
          </div>
        ) : (
          allItems.map((item) => (
            <div
              key={item.id}
              className={`border-l-2 rounded-r px-2.5 py-2 ${SEVERITY_COLORS[item.severity] || ""}`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[item.severity]}`} />
                <span className="text-[9px] font-mono text-[#5a6580]">{item.icon}</span>
                <span className="text-[9px] text-[#3a4560]">
                  {new Date(item.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="text-[11px] text-[#c8cdd5] leading-snug">{item.headline}</div>
              {item.body && (
                <div className="text-[10px] text-[#5a6580] mt-0.5 leading-relaxed line-clamp-2">
                  {item.body}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
