"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LhbSeat, LhbSnapshot, LhbStock } from "@/lib/lhb/contracts";

type ViewMode = "stocks" | "seats";

function formatAmount(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 100_000_000) return `${(value / 100_000_000).toFixed(2)}亿`;
  return `${(value / 10_000).toFixed(0)}万`;
}

function amountClass(value: number): string {
  return value > 0 ? "text-[#F35A5A]" : value < 0 ? "text-[#36C878]" : "text-[#718096]";
}

function categoryLabel(seat: LhbSeat): string {
  if (seat.category === "institution") return "机构";
  if (seat.category === "northbound") return "股通";
  if (seat.category === "known-seat") return seat.aliasConfidence ? `观察席 ${seat.aliasConfidence}` : "观察席";
  return "营业部";
}

function SeatList({ title, seats, direction }: { title: string; seats: LhbSeat[]; direction: "buy" | "sell" }) {
  return (
    <div className="min-w-0">
      <h4 className="mb-2 text-[10px] font-medium tracking-wide text-[#718096]">{title}</h4>
      <div className="space-y-1">
        {seats.slice(0, 5).map((seat, index) => {
          const amount = direction === "buy" ? seat.buyAmount : seat.sellAmount;
          return (
            <div key={`${seat.departmentCode}-${index}-${amount}`} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded border border-[#1F2A3A] bg-[#0A111C] px-2.5 py-2">
              <div className="min-w-0">
                <div className="truncate text-[11px] text-[#C7D0DD]" title={seat.departmentName}>{seat.label}</div>
                <div className="mt-0.5 text-[9px] text-[#536177]">{categoryLabel(seat)} · 净额 <span className={amountClass(seat.netAmount)}>{formatAmount(seat.netAmount)}</span></div>
              </div>
              <span className={`font-mono text-[11px] ${direction === "buy" ? "text-[#F35A5A]" : "text-[#36C878]"}`}>{formatAmount(amount)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LhbBoard() {
  const [snapshot, setSnapshot] = useState<LhbSnapshot | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("stocks");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/osint/v1/lhb", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as LhbSnapshot;
      setSnapshot(data);
      setSelectedCode((current) => current && data.stocks.some((stock) => stock.code === current) ? current : data.stocks[0]?.code ?? null);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "龙虎榜数据加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(
    () => snapshot?.stocks.find((stock) => stock.code === selectedCode) ?? null,
    [selectedCode, snapshot?.stocks]
  );
  const netSellStocks = useMemo(
    () => [...(snapshot?.stocks ?? [])].sort((left, right) => left.netAmount - right.netAmount),
    [snapshot?.stocks]
  );

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#070B12]" aria-label="资金龙虎榜">
      <div className="border-b border-[#1F2A3A] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-[#D6DEE8]">资金龙虎榜</h2>
            <p className="mt-0.5 text-[11px] text-[#718096]">
              {snapshot?.tradeDate || "最近交易日"} · {snapshot?.stockCount ?? 0} 只股票 · {snapshot?.seatCount ?? 0} 个席位
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded border border-emerald-500/20 bg-emerald-500/[0.06] px-2 py-1 text-[9px] text-emerald-300">来源：东方财富盘后公开数据</span>
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-8 items-center gap-1.5 rounded border border-[#1F2A3A] px-2.5 text-[10px] text-[#718096] hover:bg-[#101927] hover:text-[#D6DEE8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EC4C7] disabled:opacity-50">
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} />刷新
            </button>
          </div>
        </div>
        <div className="mt-3 flex gap-1.5" role="group" aria-label="龙虎榜视图">
          {(["stocks", "seats"] as const).map((item) => (
            <button key={item} type="button" aria-pressed={mode === item} onClick={() => setMode(item)} className={`min-h-8 rounded-md border px-3 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EC4C7] ${mode === item ? "border-[#2EC4C7]/50 bg-[#2EC4C7]/15 text-[#9DE7E8]" : "border-[#1F2A3A] bg-[#0D1420] text-[#718096]"}`}>{item === "stocks" ? "个股资金榜" : "席位资金榜"}</button>
          ))}
        </div>
      </div>

      {error && <div className="border-b border-red-500/20 bg-red-500/[0.06] px-4 py-2 text-[11px] text-red-300">本次刷新失败（{error}），继续显示最近成功数据。</div>}

      <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin">
        {loading && !snapshot ? (
          <div className="grid gap-2 md:grid-cols-2">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded bg-[#0D1420]" />)}</div>
        ) : !snapshot || snapshot.stocks.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-xs text-[#718096]">最近交易日暂无龙虎榜数据</div>
        ) : mode === "stocks" ? (
          <div className="grid min-h-full gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="grid min-h-0 gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <StockRank title="净买入榜" stocks={snapshot.stocks.slice(0, 12)} selectedCode={selectedCode} onSelect={setSelectedCode} />
              <StockRank title="净卖出榜" stocks={netSellStocks.slice(0, 12)} selectedCode={selectedCode} onSelect={setSelectedCode} />
            </div>
            <div className="rounded-md border border-[#1F2A3A] bg-[#0D1420] p-3">
              {selected && (
                <>
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-[#1F2A3A] pb-3">
                    <div><h3 className="text-sm font-medium text-[#D6DEE8]">{selected.name} <span className="font-mono text-[11px] text-[#718096]">{selected.code}</span></h3><p className="mt-1 text-[10px] text-[#536177]">{selected.reasons.join(" / ")}</p></div>
                    <div className="text-right"><div className={`font-mono text-sm ${amountClass(selected.netAmount)}`}>{formatAmount(selected.netAmount)}</div><div className="text-[9px] text-[#536177]">买 {formatAmount(selected.buyAmount)} · 卖 {formatAmount(selected.sellAmount)}</div></div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2"><SeatList title="买入前五" seats={selected.buySeats} direction="buy" /><SeatList title="卖出前五" seats={selected.sellSeats} direction="sell" /></div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-[#1F2A3A]">
            <div className="grid grid-cols-[minmax(120px,0.8fr)_0.5fr_0.6fr_1.5fr] bg-[#0D1420] px-3 py-2 text-[10px] text-[#718096]"><span>席位/标签</span><span>类型</span><span className="text-right">净额</span><span className="pl-4">涉及股票</span></div>
            {snapshot.seatFlows.slice(0, 80).map((seat) => (
              <div key={seat.departmentCode || seat.departmentName} className="grid min-h-12 grid-cols-[minmax(120px,0.8fr)_0.5fr_0.6fr_1.5fr] items-center border-t border-[#1F2A3A] px-3 py-2 text-[11px]">
                <span className="truncate text-[#C7D0DD]" title={seat.departmentName}>{seat.label}</span><span className="text-[9px] text-[#718096]">{categoryLabel(seat)}</span><span className={`text-right font-mono ${amountClass(seat.netAmount)}`}>{formatAmount(seat.netAmount)}</span><span className="truncate pl-4 text-[10px] text-[#718096]" title={seat.stocks.map((stock) => `${stock.name} ${formatAmount(stock.netAmount)}`).join("、")}>{seat.stocks.slice(0, 5).map((stock) => `${stock.name} ${formatAmount(stock.netAmount)}`).join(" · ")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-[#1F2A3A] px-4 py-2 text-[9px] text-[#536177]">{snapshot?.disclaimer ?? "龙虎榜为盘后披露数据，不构成投资建议。"}</div>
    </section>
  );
}

function StockRank({ title, stocks, selectedCode, onSelect }: { title: string; stocks: LhbStock[]; selectedCode: string | null; onSelect: (code: string) => void }) {
  return (
    <div className="min-w-0 rounded-md border border-[#1F2A3A] bg-[#0D1420] p-2">
      <h3 className="px-1 pb-2 text-[10px] font-medium tracking-wide text-[#718096]">{title}</h3>
      <div className="space-y-0.5">
        {stocks.map((stock, index) => (
          <button key={`${title}-${stock.code}`} type="button" onClick={() => onSelect(stock.code)} className={`grid min-h-9 w-full grid-cols-[20px_1fr_auto] items-center gap-2 rounded px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EC4C7] ${selectedCode === stock.code ? "bg-[#162438]" : "hover:bg-[#101927]"}`}><span className="font-mono text-[9px] text-[#536177]">{index + 1}</span><span className="truncate text-[11px] text-[#C7D0DD]">{stock.name} <span className="font-mono text-[9px] text-[#536177]">{stock.code}</span></span><span className={`font-mono text-[11px] ${amountClass(stock.netAmount)}`}>{formatAmount(stock.netAmount)}</span></button>
        ))}
      </div>
    </div>
  );
}
