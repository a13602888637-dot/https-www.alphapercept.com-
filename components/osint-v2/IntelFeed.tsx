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

  if (e.type === ("economic" as EntityType)) {
    const meta = e.metadata as any;
    const changePct = Math.abs(e.deltaPercent ?? 0);
    if (changePct < 2) return null; // Only show significant moves
    return {
      id: `econ-${e.id}`,
      timestamp: e.timestamp,
      severity: changePct > 5 ? "high" : "medium",
      icon: "ECON",
      headline: `${e.label} ${(e.deltaPercent ?? 0) >= 0 ? "▲" : "▼"} ${e.deltaPercent?.toFixed(2)}%`,
      body: `${meta?.name || e.label}: ${e.value?.toFixed(2)} (${meta?.tradingSignal || "neutral"})`,
      source: e.source,
    };
  }

  if (e.type === ("weather" as EntityType)) {
    const meta = e.metadata as any;
    return {
      id: `wx-${e.id}`,
      timestamp: e.timestamp,
      severity: meta?.severity === "Extreme" ? "critical" : "high",
      icon: "WX",
      headline: `${meta?.event || e.label}`,
      body: `${meta?.headline || ""} — ${meta?.areaDesc || ""}`.slice(0, 120),
      source: "NOAA",
    };
  }

  if (e.type === ("humanitarian" as EntityType)) {
    return {
      id: `hum-${e.id}`,
      timestamp: e.timestamp,
      severity: "medium",
      icon: "HUM",
      headline: e.label,
      body: `${(e.metadata as any)?.country || ""} — ${(e.metadata as any)?.disasterType || ""}`,
      source: "ReliefWeb",
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
      const newsRes = await fetch("/api/news-feed");
      if (newsRes.ok) {
        const newsData = await newsRes.json();
        const newsItems: unknown[] = Array.isArray(newsData)
          ? newsData
          : (newsData?.news ?? []);
        for (const raw of newsItems) {
          const item = raw as Record<string, unknown>;
          const impact = String(item.impact ?? "low").toLowerCase();
          const severity: FeedItem["severity"] =
            impact === "high" ? "high" : impact === "medium" ? "medium" : "low";
          items.push({
            id: `news-${item.id ?? Math.random()}`,
            timestamp:
              typeof item.pubDate === "string"
                ? new Date(item.pubDate).getTime()
                : Date.now(),
            severity,
            icon: "NEWS",
            headline: String(item.title ?? item.headline ?? ""),
            body: String(item.summary ?? item.description ?? item.content ?? "").slice(0, 120),
            source: String(item.source ?? "news-feed"),
          });
        }

        if (newsData?.summary && newsData.summary.length > 10 && newsData.summary !== '暂无新闻摘要') {
          items.unshift({
            id: 'news-ai-summary',
            timestamp: Date.now(),
            severity: 'low' as const,
            icon: 'AI',
            headline: '今日财经要闻摘要',
            body: newsData.summary.slice(0, 120),
            source: 'AI摘要',
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
    const item = entityToFeedItem(e);
    if (item) propFeedItems.push(item);
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
        {allItems.length === 0 && Object.keys(errors).length > 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <svg
              className="w-5 h-5 text-red-500"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-[11px] text-red-400 font-medium">
              数据源连接失败
            </span>
            <span className="text-[9px] text-[#5a6580]">
              请检查网络连接
            </span>
          </div>
        ) : allItems.length === 0 ? (
          <div className="text-center py-8 text-[#3a4560] text-[11px]">
            No active intelligence items
          </div>
        ) : (
          allItems.map((item) => (
            <div
              key={item.id}
              className={`border-l rounded-r px-2.5 py-2 transition-colors duration-200 ${SEVERITY_COLORS[item.severity] || ""}`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[item.severity]}`} />
                <span className="text-[9px] font-mono text-[#5a6580] bg-[#0f1520] px-1 rounded">{item.icon}</span>
                <span className="text-[9px] font-mono text-[#3a4560]">
                  {new Date(item.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="text-[11px] text-[#c8cdd5] leading-snug font-medium">{item.headline}</div>
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
