"use client";

import type { DeltaEvent } from "@/services/types";
import { EntityType } from "@/services/types";

interface DeltaPanelProps {
  deltaEvents: DeltaEvent[];
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

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const TYPE_ABBR: Record<string, string> = {
  [EntityType.ECONOMIC]: "ECON",
  [EntityType.GEO_CONFLICT]: "GEO",
  [EntityType.FINANCIAL]: "FIN",
  [EntityType.WEATHER]: "WX",
  [EntityType.HUMANITARIAN]: "HUM",
  [EntityType.SOCIAL]: "SOC",
  [EntityType.AVIATION]: "AIR",
  [EntityType.MARITIME]: "SEA",
  [EntityType.ALERT]: "ALT",
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export function DeltaPanel({ deltaEvents }: DeltaPanelProps) {
  // Sort: severity first (critical → low), then timestamp desc
  const sorted = [...deltaEvents]
    .sort((a, b) => {
      const sd = (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3);
      if (sd !== 0) return sd;
      return b.timestamp - a.timestamp;
    })
    .slice(0, 50);

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-[#1a2035] flex items-center justify-between">
        <span className="text-[9px] tracking-[0.2em] text-[#3a4560] font-semibold">CHANGE DETECTION</span>
        <span className="text-[9px] text-[#3a4560]">{deltaEvents.length} events</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-px p-1">
        {sorted.length === 0 ? (
          <div className="text-center py-8 text-[#3a4560] text-[11px]">
            No significant changes detected
          </div>
        ) : (
          sorted.map((evt) => {
            const abbr = TYPE_ABBR[evt.entityType] ?? "UNK";
            const signal = evt.tradingSignal;

            return (
              <div
                key={evt.id}
                className={`border-l rounded-r px-2.5 py-2 transition-colors duration-200 ${SEVERITY_COLORS[evt.severity] || ""}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  {/* Severity dot */}
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEVERITY_DOT[evt.severity]}`} />

                  {/* Type badge */}
                  <span className="text-[9px] font-mono text-[#5a6580] bg-[#0f1520] px-1 rounded">
                    {abbr}
                  </span>

                  {/* Timestamp */}
                  <span className="text-[9px] font-mono text-[#3a4560]">
                    {formatTime(evt.timestamp)}
                  </span>

                  {/* Trading signal arrow */}
                  {signal && (
                    <span
                      className={`text-[10px] font-mono ml-auto ${
                        signal === "bullish"
                          ? "text-[#22c55e]"
                          : signal === "bearish"
                            ? "text-[#ef4444]"
                            : "text-[#5a6580]"
                      }`}
                    >
                      {signal === "bullish" ? "\u25B2" : signal === "bearish" ? "\u25BC" : "\u2014"}
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-[#c8cdd5] leading-snug">
                  {evt.description}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
