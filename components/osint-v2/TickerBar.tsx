"use client";

import type { SituationalEntity } from "@/services/types";

interface TickerBarProps {
  financials: SituationalEntity[];
}

export function TickerBar({ financials }: TickerBarProps) {
  if (financials.length === 0) {
    return (
      <div className="h-7 bg-[#0d1220] border-b border-[#1a2035] flex items-center px-3">
        <span className="text-[10px] text-[#3a4560] animate-pulse">connecting to data feeds...</span>
      </div>
    );
  }

  return (
    <div className="h-7 bg-[#0d1220] border-b border-[#1a2035] flex items-center overflow-hidden">
      <div className="flex gap-4 px-3 animate-ticker whitespace-nowrap">
        {financials.map((e) => {
          const up = (e.deltaPercent ?? 0) >= 0;
          return (
            <span key={e.id} className="text-[11px] font-mono inline-flex items-center gap-1.5">
              <span className="text-[#5a6580]">{e.label}</span>
              <span className="text-white">{e.value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "—"}</span>
              <span className={up ? "text-[#ef4444]" : "text-[#22c55e]"}>
                {up ? "+" : ""}{e.deltaPercent?.toFixed(2) ?? "0.00"}%
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
