"use client";

import type { SituationalEntity, FinancialEntity } from "@/services/types";
import { Sparkline } from "./Sparkline";

interface FinancePanelProps {
  financials: SituationalEntity[];
  isLoading: boolean;
}

type GroupKey = "index" | "commodity" | "fx" | "rate" | "stock";

const GROUP_LABELS: Record<GroupKey, string> = {
  index: "INDICES",
  commodity: "COMMODITIES",
  fx: "FX",
  rate: "RATES",
  stock: "STOCKS",
};

const GROUP_ORDER: GroupKey[] = ["index", "commodity", "fx", "rate", "stock"];

export function FinancePanel({ financials, isLoading }: FinancePanelProps) {
  // Group by subtype
  const groups = new Map<GroupKey, SituationalEntity[]>();
  for (const e of financials) {
    const key = (e.subtype as GroupKey) || "index";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  if (isLoading && financials.length === 0) {
    return (
      <div className="p-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 bg-[#111827] rounded mb-1 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-2 space-y-3">
      {GROUP_ORDER.map((groupKey) => {
        const items = groups.get(groupKey);
        if (!items || items.length === 0) return null;

        return (
          <div key={groupKey}>
            <div className="text-[8px] tracking-[0.3em] uppercase text-[#3a4560] font-semibold mb-1 px-1">
              {GROUP_LABELS[groupKey]}
            </div>
            <div className="space-y-px">
              {items.map((e) => {
                const up = (e.deltaPercent ?? 0) >= 0;
                const sparkline = (e as FinancialEntity).metadata?.sparkline;

                return (
                  <div
                    key={e.id}
                    className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#0f1520] transition-colors duration-150 group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-[#8892a8] truncate group-hover:text-white transition-colors">
                        {e.label}
                      </div>
                    </div>

                    {/* Sparkline */}
                    {sparkline && sparkline.length > 1 && (
                      <div className="w-12 h-4 mx-1.5 opacity-50">
                        <Sparkline data={sparkline} color={up ? "#ef4444" : "#22c55e"} />
                      </div>
                    )}

                    {/* Price */}
                    <div className="text-right">
                      <div className="text-[11px] font-mono text-white">
                        {e.value?.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }) ?? "—"}
                      </div>
                      <div className={`text-[10px] font-mono ${up ? "text-[#ef4444]" : "text-[#22c55e]"}`}>
                        {up ? "+" : ""}{e.deltaPercent?.toFixed(2) ?? "0.00"}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
