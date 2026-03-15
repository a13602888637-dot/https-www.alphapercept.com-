"use client";

import { useRef, useEffect } from "react";
import { EntityType, Severity, type SituationalEntity, type GeoConflictEntity, type AlertEntity } from "@/services/types";

interface IntelFeedProps {
  entities: SituationalEntity[];
  conflicts: SituationalEntity[];
  errors: Record<string, string>;
}

interface FeedItem {
  id: string;
  timestamp: number;
  severity: "low" | "medium" | "high" | "critical";
  icon: string;
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

export function IntelFeed({ entities, conflicts, errors }: IntelFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Convert entities to feed items
  const feedItems: FeedItem[] = [];

  // Add conflict events
  for (const e of conflicts) {
    const item = entityToFeedItem(e);
    if (item) feedItems.push(item);
  }

  // Add financial alerts (large moves)
  for (const e of entities) {
    if (e.type === EntityType.FINANCIAL) {
      const item = entityToFeedItem(e);
      if (item) feedItems.push(item);
    }
  }

  // Add system errors
  for (const [name, msg] of Object.entries(errors)) {
    feedItems.push({
      id: `err-${name}`,
      timestamp: Date.now(),
      severity: "medium",
      icon: "SYS",
      headline: `${name} adapter error`,
      body: msg.slice(0, 100),
      source: "system",
    });
  }

  // Sort by severity then timestamp
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  feedItems.sort((a, b) => {
    const sd = severityOrder[a.severity] - severityOrder[b.severity];
    if (sd !== 0) return sd;
    return b.timestamp - a.timestamp;
  });

  // Auto-scroll to top on new critical items
  useEffect(() => {
    if (feedItems[0]?.severity === "critical" && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [feedItems[0]?.id]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-[#1a2035] flex items-center justify-between">
        <span className="text-[9px] tracking-[0.2em] text-[#3a4560] font-semibold">INTELLIGENCE FEED</span>
        <span className="text-[9px] text-[#3a4560]">{feedItems.length} events</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-px p-1">
        {feedItems.length === 0 ? (
          <div className="text-center py-8 text-[#3a4560] text-[11px]">
            No active intelligence items
          </div>
        ) : (
          feedItems.map((item) => (
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
