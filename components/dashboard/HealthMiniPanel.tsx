"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HealthRule {
  id: string;
  name: string;
  pass: boolean;
  value: string;
  message: string;
}

interface HealthSummary {
  totalAssets: number;
  totalMarketValue: number;
  cashBalance: number;
  reverseRepo: number;
  positionCount: number;
}

interface HealthCheckResponse {
  success: boolean;
  rules: HealthRule[];
  score: number;
  summary: HealthSummary;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HealthMiniPanel() {
  const { getToken, isSignedIn } = useAuth();

  const [data, setData] = useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch("/api/portfolio/health-check", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`API ${res.status}`);
      }

      const json: HealthCheckResponse = await res.json();
      if (json.success) {
        setData(json);
        setError(null);
      } else {
        throw new Error("API returned success=false");
      }
    } catch (err) {
      console.warn("[HealthMiniPanel] fetch error:", err);
      setError("数据加载失败");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  // Fetch on mount + auto-refresh every 5 minutes
  useEffect(() => {
    if (isSignedIn === undefined) return; // Clerk still loading
    if (!isSignedIn) {
      setLoading(false);
      return;
    }

    fetchHealth();
    const interval = setInterval(fetchHealth, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isSignedIn, fetchHealth]);

  // -- Not signed in --
  if (isSignedIn === false) {
    return (
      <div className="flex-shrink-0 border-b border-white/5 px-4 py-3">
        <p className="text-center text-xs text-gray-500">登录后查看健康度</p>
      </div>
    );
  }

  // -- Score color helper --
  const scoreColor =
    !data || error
      ? "text-gray-500"
      : data.score >= 80
        ? "text-emerald-400"
        : data.score >= 60
          ? "text-amber-400"
          : "text-red-400";

  return (
    <div className="flex-shrink-0 border-b border-white/5 bg-[#0d1117] px-4 py-2.5">
      {/* Score header */}
      <div className="mb-2 text-center">
        {loading ? (
          <div className="inline-block h-10 w-12 animate-pulse rounded bg-white/5" />
        ) : (
          <span className={`font-mono text-4xl font-bold leading-none ${scoreColor}`}>
            {error ? "--" : data?.score ?? "--"}
          </span>
        )}
        <p className="mt-0.5 text-[11px] text-gray-500">健康度</p>
      </div>

      {/* Rule rows */}
      <div className="space-y-1">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-3 w-24 animate-pulse rounded bg-white/5" />
                <div className="h-3 w-12 animate-pulse rounded bg-white/5" />
              </div>
            ))
          : data?.rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between text-[11px] leading-tight"
                title={rule.message}
              >
                <span className="text-gray-500">{rule.name}</span>
                <span className="flex items-center gap-1">
                  <span className={rule.pass ? "text-emerald-400" : "text-red-400"}>
                    {rule.value}
                  </span>
                  <span className={rule.pass ? "text-emerald-400" : "text-red-400"}>
                    {rule.pass ? "\u2713" : "\u2717"}
                  </span>
                </span>
              </div>
            ))}
      </div>

      {/* Error hint */}
      {error && !loading && (
        <p className="mt-1 text-center text-[10px] text-red-400/60">{error}</p>
      )}
    </div>
  );
}
