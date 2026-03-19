"use client";

import type { SituationalEntity, EconomicEntity } from "@/services/types";
import { Sparkline } from "./Sparkline";

interface EconomicPanelProps {
  economic: SituationalEntity[];
  isLoading: boolean;
}

type GroupKey = "indicator" | "energy" | "yield" | "supply_chain";

const GROUP_LABELS: Record<GroupKey, string> = {
  indicator: "FRED INDICATORS",
  energy: "ENERGY (EIA)",
  yield: "TREASURY YIELDS",
  supply_chain: "SUPPLY CHAIN",
};

const GROUP_ORDER: GroupKey[] = ["indicator", "energy", "yield", "supply_chain"];

export function EconomicPanel({ economic, isLoading }: EconomicPanelProps) {
  // Group by subtype
  const groups = new Map<GroupKey, SituationalEntity[]>();
  for (const e of economic) {
    const key = (e.subtype as GroupKey) || "indicator";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  if (isLoading && economic.length === 0) {
    return (
      <div className="p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 bg-[#111827] rounded mb-1 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-[#1a2035] flex items-center justify-between">
        <span className="text-[9px] tracking-[0.2em] text-[#3a4560] font-semibold">MACRO INDICATORS</span>
        <span className="text-[9px] text-[#3a4560]">{economic.length} items</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {economic.length === 0 ? (
          <div className="text-center py-8 text-[#3a4560] text-[11px]">
            No economic data available
          </div>
        ) : (
          GROUP_ORDER.map((groupKey) => {
            const items = groups.get(groupKey);
            if (!items || items.length === 0) return null;

            return (
              <div key={groupKey}>
                <div className="text-[8px] tracking-[0.3em] uppercase text-[#3a4560] font-semibold mb-1 px-1">
                  {GROUP_LABELS[groupKey]}
                </div>
                <div className="space-y-px">
                  {items.map((e) => {
                    const meta = (e as EconomicEntity).metadata;
                    const delta = e.deltaPercent ?? 0;
                    // Chinese convention: up = red, down = green
                    const up = delta >= 0;
                    const signal = meta?.tradingSignal;
                    const isVix =
                      meta?.seriesId === "VIXCLS" ||
                      e.label.toUpperCase().includes("VIX");
                    const vixHigh = isVix && (e.value ?? 0) > 25;
                    const sparkline = (meta as Record<string, unknown>)?.sparkline as number[] | undefined;

                    return (
                      <div
                        key={e.id}
                        className={`flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#0f1520] transition-colors duration-150 ${
                          vixHigh ? "bg-red-950/20 shadow-[0_0_8px_rgba(239,68,68,0.15)]" : ""
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-[#8892a8] truncate">
                            {e.label}
                          </div>
                          {meta?.unit && (
                            <div className="text-[8px] text-[#3a4560] font-mono">
                              {meta.unit}
                            </div>
                          )}
                        </div>

                        {/* Sparkline */}
                        {sparkline && sparkline.length > 1 && (
                          <div className="w-12 h-4 mx-1.5 opacity-50">
                            <Sparkline data={sparkline} color={up ? "#ef4444" : "#22c55e"} />
                          </div>
                        )}

                        {/* Value + Delta */}
                        <div className="text-right flex-shrink-0">
                          <div className={`text-[11px] font-mono ${vixHigh ? "text-red-400 font-semibold" : "text-white"}`}>
                            {e.value?.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }) ?? "\u2014"}
                          </div>
                          <div className="flex items-center justify-end gap-1">
                            <span className={`text-[10px] font-mono ${up ? "text-[#ef4444]" : "text-[#22c55e]"}`}>
                              {up ? "\u25B2" : "\u25BC"}
                              {up ? "+" : ""}
                              {delta.toFixed(2)}%
                            </span>
                            {signal && signal !== "neutral" && (
                              <span
                                className={`text-[8px] font-mono px-1 rounded ${
                                  signal === "bullish"
                                    ? "text-[#ef4444] bg-red-950/30"
                                    : "text-[#22c55e] bg-green-950/30"
                                }`}
                              >
                                {signal === "bullish" ? "BULL" : "BEAR"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
