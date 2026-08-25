"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { OsintMarket } from "@/lib/osint/contracts";

type MarketFilter = "all" | OsintMarket["category"];

const FILTERS: Array<{ key: MarketFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "index", label: "指数" },
  { key: "future", label: "连续期指" },
  { key: "commodity", label: "商品" },
  { key: "fx", label: "外汇" },
  { key: "rate", label: "利率" },
];

const STATUS_LABELS: Record<OsintMarket["status"], { label: string; className: string }> = {
  live: { label: "实时", className: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" },
  cached: { label: "缓存", className: "text-amber-300 border-amber-500/30 bg-amber-500/10" },
  stale: { label: "陈旧", className: "text-orange-300 border-orange-500/30 bg-orange-500/10" },
  unavailable: { label: "暂无", className: "text-slate-500 border-slate-700 bg-slate-900/60" },
};

function formatValue(market: OsintMarket): string {
  if (market.value === null) return "—";
  if (market.instrumentType === "yield") return `${market.value.toFixed(2)}%`;
  if (market.instrumentType === "fx") return market.value.toFixed(4);
  const digits = Math.abs(market.value) < 10 ? 3 : 2;
  return market.value.toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatChange(market: OsintMarket): { text: string; className: string } {
  const comparable = market.instrumentType === "yield" ? market.change : market.changePercent;
  if (comparable === null) return { text: "—", className: "text-slate-600" };
  const positive = comparable >= 0;
  const text = market.instrumentType === "yield"
    ? `${positive ? "+" : ""}${comparable.toFixed(2)}pp`
    : `${positive ? "+" : ""}${comparable.toFixed(2)}%`;
  return { text, className: positive ? "text-[#F35A5A]" : "text-[#36C878]" };
}

function formatAsOf(asOf: string | null): string {
  if (!asOf) return "未取得";
  return new Date(asOf).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export function MarketBoard({ markets, isLoading }: { markets: OsintMarket[]; isLoading: boolean }) {
  const [filter, setFilter] = useState<MarketFilter>("all");
  const visibleMarkets = useMemo(
    () => markets.filter((market) => filter === "all" || market.category === filter),
    [filter, markets]
  );

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#090f19]" aria-label="全球行情">
      <div className="border-b border-[#1F2A3A] px-4 py-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-[#D6DEE8]">全球行情</h2>
            <p className="mt-0.5 text-[11px] text-[#718096]">来源、新鲜度和缺失状态逐项可见</p>
          </div>
          <span className="font-mono text-[11px] text-[#718096]">{markets.length} 项</span>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="行情分类">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
              className={`min-h-8 rounded-md border px-2.5 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EC4C7] ${
                filter === item.key
                  ? "border-[#2EC4C7]/50 bg-[#2EC4C7]/15 text-[#9DE7E8]"
                  : "border-[#1F2A3A] bg-[#0D1420] text-[#718096] hover:text-[#D6DEE8]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1.25fr)_0.8fr_0.7fr_1fr] border-b border-[#1F2A3A] bg-[#0D1420] px-3 py-2 text-[10px] text-[#718096]">
        <span>名称（代码）</span><span className="text-right">最新</span><span className="text-right">涨跌</span><span className="text-right">来源 / 新鲜度</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {isLoading && markets.length === 0 ? (
          <div className="space-y-px p-2">
            {Array.from({ length: 12 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded bg-[#0D1420]" />)}
          </div>
        ) : visibleMarkets.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-xs text-[#718096]">该分类暂无数据</div>
        ) : (
          visibleMarkets.map((market) => {
            const change = formatChange(market);
            const status = STATUS_LABELS[market.status];
            return (
              <Link
                key={market.symbol}
                href={`/dashboard/asset/${encodeURIComponent(market.symbol)}`}
                className="grid min-h-[52px] grid-cols-[minmax(0,1.25fr)_0.8fr_0.7fr_1fr] items-center border-b border-[#1F2A3A]/70 px-3 py-2 transition-colors hover:bg-[#101927] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2EC4C7]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs text-[#D6DEE8]">{market.name}</span>
                  <span className="block truncate font-mono text-[10px] text-[#718096]">{market.symbol}</span>
                </span>
                <span className="text-right font-mono text-xs text-[#D6DEE8]">{formatValue(market)}</span>
                <span className={`text-right font-mono text-[11px] ${change.className}`}>{change.text}</span>
                <span className="flex min-w-0 items-center justify-end gap-1.5">
                  <span className="hidden truncate text-[9px] text-[#718096] xl:inline">{market.source}</span>
                  <span title={`${market.source} · ${formatAsOf(market.asOf)}`} className={`rounded border px-1.5 py-0.5 text-[9px] ${status.className}`}>{status.label}</span>
                </span>
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}
