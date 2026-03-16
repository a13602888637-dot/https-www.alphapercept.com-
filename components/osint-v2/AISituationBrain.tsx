"use client";

import { useState, useEffect, useCallback } from "react";

interface SituationAnalysis {
  assessment: string;
  risks: string[];
  confidence: "high" | "medium" | "low";
  timestamp: string;
}

interface AISituationBrainProps {
  newsHeadlines: string[];
  conflictCount: number;
  marketSummary: string;
  vesselCount: number;
}

const CONFIDENCE_STYLES: Record<string, { dot: string; label: string; text: string }> = {
  high: { dot: "bg-emerald-500", label: "HIGH", text: "text-emerald-500" },
  medium: { dot: "bg-amber-500", label: "MED", text: "text-amber-500" },
  low: { dot: "bg-red-500", label: "LOW", text: "text-red-500" },
};

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function AISituationBrain({
  newsHeadlines,
  conflictCount,
  marketSummary,
  vesselCount,
}: AISituationBrainProps) {
  const [analysis, setAnalysis] = useState<SituationAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const fetchAnalysis = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/ai/situation-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newsHeadlines,
          conflictCount,
          marketSummary,
          vesselCount,
        }),
      });
      if (!res.ok) throw new Error("API error");
      const data: SituationAnalysis = await res.json();
      setAnalysis(data);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [newsHeadlines, conflictCount, marketSummary, vesselCount]);

  // Initial fetch + auto-refresh every 5 minutes
  useEffect(() => {
    fetchAnalysis();
    const interval = setInterval(fetchAnalysis, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
    // Only re-trigger on meaningful data changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conflictCount, vesselCount]);

  const confStyle = analysis
    ? CONFIDENCE_STYLES[analysis.confidence] ?? CONFIDENCE_STYLES.low
    : CONFIDENCE_STYLES.low;

  return (
    <div className="border-b border-[#1a2035]">
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#0a1020] transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
          <span className="text-[9px] tracking-[0.2em] text-[#3a4560] font-semibold">
            AI SITUATION BRAIN
          </span>
        </div>
        <span className="text-[9px] text-[#3a4560]">
          {collapsed ? "+" : "-"}
        </span>
      </button>

      {/* Collapsible body */}
      {!collapsed && (
        <div className="px-3 pb-2.5">
          {/* Loading skeleton */}
          {isLoading && !analysis && (
            <div className="space-y-2 animate-pulse">
              <div className="h-3 bg-[#1a2035] rounded w-full" />
              <div className="h-3 bg-[#1a2035] rounded w-4/5" />
              <div className="h-2.5 bg-[#1a2035] rounded w-3/5 mt-2" />
              <div className="h-2.5 bg-[#1a2035] rounded w-2/5" />
            </div>
          )}

          {/* Error state */}
          {error && !analysis && (
            <div className="flex items-center gap-1.5 py-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-[10px] text-red-400">
                AI 态势分析暂不可用
              </span>
            </div>
          )}

          {/* Analysis content */}
          {analysis && (
            <div className="space-y-2">
              {/* Assessment */}
              <p className="text-[10px] text-[#a0a8b8] leading-relaxed">
                {analysis.assessment}
              </p>

              {/* Risk signals */}
              {analysis.risks.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[9px] text-[#5a6580] font-semibold tracking-wide">
                    RISK SIGNALS
                  </span>
                  <ul className="space-y-0.5">
                    {analysis.risks.map((risk, i) => (
                      <li
                        key={i}
                        className="text-[9px] text-[#8890a0] flex items-start gap-1"
                      >
                        <span className="text-amber-500 mt-px shrink-0">*</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Footer: confidence + timestamp */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${confStyle.dot}`} />
                  <span className={`text-[9px] font-mono ${confStyle.text}`}>
                    {confStyle.label}
                  </span>
                </div>
                <span className="text-[9px] text-[#3a4560] font-mono">
                  {new Date(analysis.timestamp).toLocaleTimeString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {/* Refresh indicator */}
              {isLoading && (
                <div className="text-[9px] text-cyan-700 animate-pulse">
                  refreshing...
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
