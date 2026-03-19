"use client";

import type { SituationalEntity, SocialEntity } from "@/services/types";

interface SocialPanelProps {
  social: SituationalEntity[];
  isLoading: boolean;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function computeSentimentAvg(items: SituationalEntity[]): number | null {
  const scores: number[] = [];
  for (const e of items) {
    const score = (e as SocialEntity).metadata?.sentimentScore;
    if (typeof score === "number" && !isNaN(score)) {
      scores.push(score);
    }
  }
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function sentimentLabel(score: number): string {
  if (score <= -0.5) return "EXTREME FEAR";
  if (score <= -0.2) return "FEAR";
  if (score < 0.2) return "NEUTRAL";
  if (score < 0.5) return "GREED";
  return "EXTREME GREED";
}

function sentimentColor(score: number): string {
  if (score <= -0.3) return "text-red-400";
  if (score < 0.3) return "text-amber-400";
  return "text-green-400";
}

export function SocialPanel({ social, isLoading }: SocialPanelProps) {
  const avgScore = computeSentimentAvg(social);
  // Map -1..+1 to 0..100% for gauge position
  const gaugePercent = avgScore !== null ? ((avgScore + 1) / 2) * 100 : 50;

  if (isLoading && social.length === 0) {
    return (
      <div className="p-3">
        <div className="h-6 bg-[#111827] rounded mb-2 animate-pulse" />
        <div className="h-3 bg-[#111827] rounded mb-3 animate-pulse" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 bg-[#111827] rounded mb-1 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-[#1a2035] flex items-center justify-between">
        <span className="text-[9px] tracking-[0.2em] text-[#3a4560] font-semibold">SOCIAL SENTIMENT</span>
        <span className="text-[9px] text-[#3a4560]">{social.length} posts</span>
      </div>

      {/* Sentiment Gauge */}
      <div className="px-3 py-2 border-b border-[#1a2035]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[8px] font-mono text-[#5a6580]">FEAR</span>
          {avgScore !== null && (
            <span className={`text-[10px] font-mono font-semibold ${sentimentColor(avgScore)}`}>
              {sentimentLabel(avgScore)} ({(avgScore * 100).toFixed(0)}%)
            </span>
          )}
          <span className="text-[8px] font-mono text-[#5a6580]">GREED</span>
        </div>
        {/* Gauge bar */}
        <div className="relative h-2 rounded bg-[#111827] overflow-hidden">
          {/* Gradient background */}
          <div
            className="absolute inset-0 rounded"
            style={{
              background: "linear-gradient(to right, #ef4444, #f59e0b, #22c55e)",
              opacity: 0.3,
            }}
          />
          {/* Indicator dot */}
          {avgScore !== null && (
            <div
              className="absolute top-0 h-2 w-2 rounded-full border border-white/60"
              style={{
                left: `calc(${gaugePercent}% - 4px)`,
                background:
                  avgScore <= -0.3
                    ? "#ef4444"
                    : avgScore < 0.3
                      ? "#f59e0b"
                      : "#22c55e",
                boxShadow: "0 0 4px rgba(255,255,255,0.3)",
              }}
            />
          )}
        </div>
      </div>

      {/* Post list */}
      <div className="flex-1 overflow-y-auto space-y-px p-1">
        {social.length === 0 ? (
          <div className="text-center py-8 text-[#3a4560] text-[11px]">
            No social data available
          </div>
        ) : (
          social.map((e) => {
            const meta = (e as SocialEntity).metadata;
            const platform = meta?.platform ?? "unknown";
            const author = meta?.author ?? "";
            const text = meta?.text ?? e.label;
            const score = meta?.sentimentScore ?? 0;
            const signal = meta?.tradingSignal;

            const platformBadge =
              platform.toLowerCase().includes("bluesky") || platform.toLowerCase().includes("bsky")
                ? "BSky"
                : platform.toLowerCase().includes("reddit")
                  ? "Reddit"
                  : platform.slice(0, 6);

            const sentimentDotColor =
              signal === "bullish" || score > 0.2
                ? "bg-green-500"
                : signal === "bearish" || score < -0.2
                  ? "bg-red-500"
                  : "bg-slate-500";

            return (
              <div
                key={e.id}
                className="px-2.5 py-2 rounded hover:bg-[#0f1520] transition-colors duration-150"
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  {/* Sentiment dot */}
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sentimentDotColor}`} />

                  {/* Platform badge */}
                  <span className="text-[9px] font-mono text-[#5a6580] bg-[#0f1520] px-1 rounded">
                    {platformBadge}
                  </span>

                  {/* Author */}
                  <span className="text-[9px] font-mono text-[#3a4560] truncate max-w-[80px]">
                    {author}
                  </span>

                  {/* Timestamp */}
                  <span className="text-[9px] font-mono text-[#3a4560] ml-auto">
                    {formatTime(e.timestamp)}
                  </span>
                </div>

                <div className="text-[10px] text-[#c8cdd5] leading-snug line-clamp-2">
                  {text}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
