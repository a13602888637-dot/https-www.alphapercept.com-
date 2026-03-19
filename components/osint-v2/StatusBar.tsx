"use client";

import { useState, useEffect } from "react";

interface StatusBarProps {
  health: Record<string, boolean>;
  errors: Record<string, string>;
  lastUpdate: Record<string, number>;
}

const ADAPTER_LABELS: Record<string, string> = {
  finance: "FIN",
  aviation: "AVI",
  maritime: "MAR",
  geoconflict: "GEO",
  news: "NEWS",
  economic: "ECON",
  humanitarian: "HUM",
  weather: "WX",
  social: "SOC",
};

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getAgeBucket(lastMs: number | undefined, now: number): "fresh" | "stale" | "dead" {
  if (!lastMs) return "dead";
  const ageSeconds = (now - lastMs) / 1000;
  if (ageSeconds < 120) return "fresh";
  if (ageSeconds < 600) return "stale";
  return "dead";
}

const DOT_STYLES: Record<string, string> = {
  fresh: "bg-emerald-500 animate-pulse",
  stale: "bg-amber-500",
  dead: "bg-red-500 animate-pulse",
};

export function StatusBar({ health, errors, lastUpdate }: StatusBarProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-5 bg-[#060a12] border-t border-[#1a2035]/30 flex items-center px-3 gap-4 text-[9px] font-mono">
      {/* Adapter status dots */}
      {Object.entries(ADAPTER_LABELS).map(([key, label]) => {
        const isUp = health[key] ?? false;
        const lastMs = lastUpdate[key];
        const bucket = isUp ? getAgeBucket(lastMs, now) : "dead";
        const errorMsg = errors[key];

        return (
          <div key={key} className="flex items-center gap-1 group relative">
            <div className={`w-1.5 h-1.5 rounded-full ${DOT_STYLES[bucket]}`} />
            <span className="text-[#5a6580]">{label}</span>
            {lastMs ? (
              <span className={`${bucket === "fresh" ? "text-[#3a4560]" : bucket === "stale" ? "text-amber-600" : "text-red-600"}`}>
                {formatTime(lastMs)}
              </span>
            ) : (
              <span className="text-red-600">--:--:--</span>
            )}
            {/* Error tooltip on hover */}
            {errorMsg && (
              <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-50">
                <div className="bg-[#1a2035] border border-red-500/30 text-red-400 text-[9px] px-2 py-1 rounded shadow-lg max-w-[200px] whitespace-pre-wrap">
                  {errorMsg}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Error count */}
      {Object.keys(errors).length > 0 && (
        <span className="text-red-500 ml-auto">
          {Object.keys(errors).length} ERR
        </span>
      )}

      {/* Live clock */}
      <span className="text-[#3a4560] ml-auto">
        {formatTime(now)}
      </span>
    </div>
  );
}
