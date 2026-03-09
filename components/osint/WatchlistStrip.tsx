"use client";

import { cn } from "@/lib/utils";
import { Star } from "lucide-react";
import { useRouter } from "next/navigation";

interface WatchlistItem {
  stockCode: string;
  stockName: string;
  price?: number;
  change?: number;
  changePercent?: number;
}

interface WatchlistStripProps {
  items: WatchlistItem[];
}

export function WatchlistStrip({ items }: WatchlistStripProps) {
  const router = useRouter();

  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-semibold flex items-center gap-1">
        <Star className="h-3 w-3" />
        自选股
      </h3>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
        {items.map(stock => (
          <div
            key={stock.stockCode}
            className={cn(
              "flex-shrink-0 w-36 rounded-lg border p-2.5 cursor-pointer transition-all hover:scale-105",
              (stock.change || 0) >= 0
                ? "border-red-500/20 bg-red-950/15"
                : "border-green-500/20 bg-green-950/15"
            )}
            onClick={() => router.push(`/stocks/${stock.stockCode}`)}
          >
            <div className="text-xs font-medium text-white truncate">{stock.stockName}</div>
            <div className="text-[10px] text-slate-500 mb-1.5">{stock.stockCode}</div>
            {stock.price !== undefined && (
              <>
                <div className="text-base font-bold text-white">{stock.price.toFixed(2)}</div>
                <div className={cn(
                  "text-[11px] font-medium",
                  (stock.change || 0) >= 0 ? "text-red-400" : "text-green-400"
                )}>
                  {(stock.change || 0) >= 0 ? "+" : ""}{(stock.changePercent || 0).toFixed(2)}%
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
