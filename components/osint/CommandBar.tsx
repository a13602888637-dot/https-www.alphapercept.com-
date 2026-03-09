"use client";

import { Globe, RefreshCw, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CommandBarProps {
  lastUpdate: Date | null;
  isLoading: boolean;
  onRefresh: () => void;
  onAiBriefing: () => void;
}

function getMarketStatus(): { label: string; color: string } {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const day = now.getDay();
  const time = hour * 60 + minute;

  if (day === 0 || day === 6) return { label: "休市", color: "bg-slate-500" };
  if (time >= 570 && time < 690) return { label: "开市", color: "bg-emerald-500" };
  if (time >= 780 && time < 900) return { label: "开市", color: "bg-emerald-500" };
  if (time >= 690 && time < 780) return { label: "午休", color: "bg-amber-500" };
  if (time >= 555 && time < 570) return { label: "盘前", color: "bg-amber-500" };
  return { label: "休市", color: "bg-slate-500" };
}

export function CommandBar({ lastUpdate, isLoading, onRefresh, onAiBriefing }: CommandBarProps) {
  const status = getMarketStatus();

  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Globe className="h-5 w-5 text-cyan-400" />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-cyan-400" />
        </div>
        <h1 className="text-lg font-bold text-white tracking-wide">OSINT 态势感知</h1>
        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border-0 text-white", status.color)}>
          {status.label}
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500 hidden sm:inline">
          {lastUpdate ? `${lastUpdate.toLocaleTimeString("zh-CN")}` : "加载中..."}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAiBriefing}
          className="text-purple-400 hover:text-purple-300 hover:bg-slate-700/50 h-8 px-2"
        >
          <Brain className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline text-xs">AI简报</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="text-slate-400 hover:text-white hover:bg-slate-700/50 h-8 px-2"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      </div>
    </div>
  );
}
