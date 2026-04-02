"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

interface HealthRule {
  id: string;
  name: string;
  pass: boolean;
  value: string;
  message: string;
}

interface HealthCheckProps {
  rules: HealthRule[];
  score: number;
  loading?: boolean;
}

function ScoreBadge({ score }: { score: number }) {
  let ring: string;
  let text: string;
  let bg: string;

  if (score >= 80) {
    ring = "border-green-500/60";
    text = "text-green-400";
    bg = "bg-green-500/10";
  } else if (score >= 60) {
    ring = "border-amber-500/60";
    text = "text-amber-400";
    bg = "bg-amber-500/10";
  } else {
    ring = "border-red-500/60";
    text = "text-red-400";
    bg = "bg-red-500/10";
  }

  return (
    <div
      className={`flex items-center justify-center w-12 h-12 rounded-full border-2 ${ring} ${bg}`}
    >
      <span className={`text-lg font-bold font-mono tabular-nums ${text}`}>
        {score}
      </span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="h-5 w-5 rounded-full bg-[#1a2035] animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-24 rounded bg-[#1a2035] animate-pulse" />
        <div className="h-3 w-40 rounded bg-[#1a2035] animate-pulse" />
      </div>
      <div className="h-4 w-12 rounded bg-[#1a2035] animate-pulse" />
    </div>
  );
}

export function HealthCheck({ rules, score, loading = false }: HealthCheckProps) {
  return (
    <Card className="bg-[#0d1117] border-[#1a2035] shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
            <CardTitle className="text-base font-semibold text-white">
              健康度检查
            </CardTitle>
          </div>
          {!loading && <ScoreBadge score={score} />}
          {loading && (
            <div className="w-12 h-12 rounded-full bg-[#1a2035] animate-pulse" />
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="divide-y divide-[#1a2035]">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            : rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                >
                  {/* Status icon */}
                  <div className="mt-0.5 shrink-0">
                    {rule.pass ? (
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-400" />
                    )}
                  </div>

                  {/* Rule info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {rule.name}
                      </span>
                      <span className="text-xs font-mono tabular-nums text-gray-300 bg-[#1a2035] px-1.5 py-0.5 rounded">
                        {rule.value}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {rule.message}
                    </p>
                  </div>
                </div>
              ))}
        </div>
      </CardContent>
    </Card>
  );
}
