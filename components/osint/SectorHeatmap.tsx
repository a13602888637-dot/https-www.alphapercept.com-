"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface SectorData {
  name: string;
  changePercent: number;
  stocks: string[];
}

interface SectorHeatmapProps {
  stockPrices: Record<string, { changePercent: number }>;
}

const SECTORS: { name: string; codes: string[] }[] = [
  { name: "白酒", codes: ["600519", "000858", "600809"] },
  { name: "新能源", codes: ["300750", "601012", "002594"] },
  { name: "金融", codes: ["601318", "600036", "601166"] },
  { name: "医药", codes: ["600276", "300760", "300015"] },
  { name: "科技", codes: ["002415", "002475", "688981"] },
  { name: "消费", codes: ["000333", "600887", "603288"] },
  { name: "基建", codes: ["601668", "601800", "600585"] },
];

function getHeatColor(pct: number): string {
  if (pct >= 3) return "bg-red-600";
  if (pct >= 1.5) return "bg-red-500/80";
  if (pct >= 0.5) return "bg-red-400/60";
  if (pct > -0.5) return "bg-slate-600";
  if (pct > -1.5) return "bg-green-400/60";
  if (pct > -3) return "bg-green-500/80";
  return "bg-green-600";
}

export function SectorHeatmap({ stockPrices }: SectorHeatmapProps) {
  const sectorData: SectorData[] = SECTORS.map(sector => {
    const changes = sector.codes
      .map(c => stockPrices[c]?.changePercent)
      .filter((v): v is number => v !== undefined);
    const avg = changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;
    return { name: sector.name, changePercent: Number(avg.toFixed(2)), stocks: sector.codes };
  });

  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-semibold">板块热力图</h3>
      <div className="grid grid-cols-4 md:grid-cols-7 gap-1.5">
        {sectorData.map(sector => (
          <motion.div
            key={sector.name}
            whileHover={{ scale: 1.05 }}
            className={cn(
              "rounded-lg p-3 text-center cursor-default transition-colors",
              getHeatColor(sector.changePercent)
            )}
          >
            <div className="text-xs font-medium text-white">{sector.name}</div>
            <div className={cn(
              "text-sm font-bold mt-0.5",
              sector.changePercent >= 0 ? "text-white" : "text-white"
            )}>
              {sector.changePercent >= 0 ? "+" : ""}{sector.changePercent.toFixed(2)}%
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
