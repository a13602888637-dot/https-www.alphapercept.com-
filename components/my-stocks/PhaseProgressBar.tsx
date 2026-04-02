"use client";

import { cn } from "@/lib/utils";

interface Phase {
  id: string;
  label: string;
  dateRange: string;
  color: string;
}

interface PhaseProgressBarProps {
  phases: Phase[];
  currentPhaseIndex: number;
}

const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  red:   { bg: "bg-red-500/10",   border: "border-red-500",   text: "text-red-400" },
  amber: { bg: "bg-amber-500/10", border: "border-amber-500", text: "text-amber-400" },
  blue:  { bg: "bg-blue-500/10",  border: "border-blue-500",  text: "text-blue-400" },
  green: { bg: "bg-green-500/10", border: "border-green-500", text: "text-green-400" },
};

export const DEFAULT_PHASES: Phase[] = [
  { id: "w1", label: "调仓减压", dateRange: "4.01—4.06", color: "red" },
  { id: "w2", label: "观察择机", dateRange: "4.07—4.11", color: "amber" },
  { id: "w3", label: "试探建仓", dateRange: "4.14—4.18", color: "blue" },
  { id: "w4", label: "财报验证", dateRange: "4.21—4.30", color: "green" },
];

export function PhaseProgressBar({ phases, currentPhaseIndex }: PhaseProgressBarProps) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {phases.map((phase, i) => {
        const colors = COLOR_MAP[phase.color] || COLOR_MAP.blue;
        const isCurrent = i === currentPhaseIndex;
        const isPast = i < currentPhaseIndex;
        const isFuture = i > currentPhaseIndex;

        return (
          <div
            key={phase.id}
            className={cn(
              "relative rounded-md px-3 py-2.5 border-l-[3px] transition-all",
              isCurrent && [colors.bg, colors.border],
              isPast && "border-gray-600 bg-gray-800/30",
              isFuture && "border-[#1a2035] bg-[#0d1117]/50"
            )}
          >
            <div
              className={cn(
                "text-sm font-bold leading-tight",
                isCurrent && colors.text,
                isPast && "text-gray-500",
                isFuture && "text-gray-600"
              )}
            >
              {phase.label}
            </div>
            <div
              className={cn(
                "mt-1 font-mono text-xs",
                isCurrent && "text-gray-300",
                isPast && "text-gray-600",
                isFuture && "text-gray-700"
              )}
            >
              {phase.dateRange}
            </div>
            {isPast && (
              <div className="absolute top-2 right-2 text-gray-600 text-xs">&#10003;</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
