"use client";

import { MacroMetricCard } from "./MacroMetricCard";

interface MarketItem {
  symbol: string;
  name: string;
  category: string;
  region: string;
  price: number;
  change: number;
  changePercent: number;
}

interface IndexItem {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

interface GlobalMacroPulseProps {
  aShareIndices: IndexItem[];
  globalMarkets: MarketItem[];
  isLoading: boolean;
}

export function GlobalMacroPulse({ aShareIndices, globalMarkets, isLoading }: GlobalMacroPulseProps) {
  const globalIndices = globalMarkets.filter(m => m.category === "index");
  const commoditiesAndRates = globalMarkets.filter(m => m.category !== "index");

  return (
    <div className="space-y-3">
      {/* Row 1: A-Share Indices */}
      <div>
        <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5 font-semibold">A股指数</h3>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          {aShareIndices.length > 0
            ? aShareIndices.map(idx => (
                <MacroMetricCard
                  key={idx.code}
                  name={idx.name}
                  symbol={idx.code}
                  price={idx.price}
                  change={idx.change}
                  changePercent={idx.changePercent}
                  category="index"
                />
              ))
            : Array.from({ length: 5 }).map((_, i) => (
                <MacroMetricCard key={i} name="" symbol="" price={0} change={0} changePercent={0} category="index" isLoading />
              ))}
        </div>
      </div>

      {/* Row 2: Global Indices */}
      <div>
        <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5 font-semibold">全球指数</h3>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          {globalIndices.length > 0
            ? globalIndices.map(m => (
                <MacroMetricCard
                  key={m.symbol}
                  name={m.name}
                  symbol={m.symbol}
                  price={m.price}
                  change={m.change}
                  changePercent={m.changePercent}
                  category={m.category}
                />
              ))
            : Array.from({ length: 5 }).map((_, i) => (
                <MacroMetricCard key={i} name="" symbol="" price={0} change={0} changePercent={0} category="index" isLoading />
              ))}
        </div>
      </div>

      {/* Row 3: Commodities, Rates, FX */}
      <div>
        <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5 font-semibold">大宗 / 利率 / 汇率</h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {commoditiesAndRates.length > 0
            ? commoditiesAndRates.map(m => (
                <MacroMetricCard
                  key={m.symbol}
                  name={m.name}
                  symbol={m.symbol}
                  price={m.price}
                  change={m.change}
                  changePercent={m.changePercent}
                  category={m.category}
                />
              ))
            : Array.from({ length: 6 }).map((_, i) => (
                <MacroMetricCard key={i} name="" symbol="" price={0} change={0} changePercent={0} category="commodity" isLoading />
              ))}
        </div>
      </div>
    </div>
  );
}
