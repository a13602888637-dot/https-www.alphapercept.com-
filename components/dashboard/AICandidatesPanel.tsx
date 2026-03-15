"use client";

import { useState, useEffect, useCallback } from "react";
import { Brain, RefreshCw } from "lucide-react";

interface Candidate {
  code: string;
  name: string;
  entryRange: [number, number];
  stopLoss: number;
  target: number;
  confidence: number;
  rationale: string;
}

export function AICandidatesPanel() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [scanTime, setScanTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCandidates = useCallback(async () => {
    try {
      const res = await fetch("/api/stock-scanner");
      const data = await res.json();
      if (data.success) {
        setCandidates(data.candidates ?? []);
        setScanTime(data.scanTime ?? null);
      }
    } catch (err) {
      console.error("Failed to fetch candidates:", err);
    }
  }, []);

  const triggerScan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stock-scanner", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setCandidates(data.candidates ?? []);
        setScanTime(data.scanTime ?? null);
      }
    } catch (err) {
      console.error("Scan failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // Auto-refresh every 30 minutes
  useEffect(() => {
    const interval = setInterval(fetchCandidates, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchCandidates]);

  const confidenceBadge = (c: number) => {
    if (c > 70) return "bg-green-900/40 text-green-400";
    if (c > 50) return "bg-amber-900/40 text-amber-400";
    return "bg-red-900/40 text-red-400";
  };

  return (
    <div className="p-3 bg-[#0a0e17]">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-400" />
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
            AI Candidates
          </span>
        </div>
        <button
          onClick={triggerScan}
          disabled={loading}
          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-200 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Scan Now
        </button>
      </div>

      {/* Scan time */}
      {scanTime && (
        <p className="text-[10px] text-gray-600 mb-2">
          Last scan: {new Date(scanTime).toLocaleString()}
        </p>
      )}

      {/* Loading state */}
      {loading && candidates.length === 0 && (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500" />
        </div>
      )}

      {/* Candidates */}
      {candidates.length === 0 && !loading ? (
        <p className="text-xs text-gray-500 leading-relaxed">
          No candidates yet. Click &quot;Scan Now&quot; to run AI analysis.
        </p>
      ) : (
        <div className="space-y-2">
          {candidates.map((c) => (
            <div
              key={c.code}
              className="bg-[#111827] border border-gray-800 rounded-lg p-2.5 hover:border-gray-700 transition-colors"
            >
              {/* Code + Name + Confidence */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="min-w-0">
                  <span className="font-bold text-xs text-white">{c.code}</span>
                  <span className="text-xs text-gray-400 ml-1.5">{c.name}</span>
                </div>
                <span
                  className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${confidenceBadge(c.confidence)}`}
                >
                  {c.confidence}%
                </span>
              </div>

              {/* Entry / Stop / Target */}
              <div className="grid grid-cols-3 gap-1 text-[10px] font-mono mb-1.5">
                <div className="bg-gray-800/50 rounded px-1.5 py-1">
                  <span className="text-gray-500 block">Entry</span>
                  <span className="text-gray-300">
                    {c.entryRange[0]}-{c.entryRange[1]}
                  </span>
                </div>
                <div className="bg-gray-800/50 rounded px-1.5 py-1">
                  <span className="text-gray-500 block">Stop</span>
                  <span className="text-red-400/80">{c.stopLoss}</span>
                </div>
                <div className="bg-gray-800/50 rounded px-1.5 py-1">
                  <span className="text-gray-500 block">Target</span>
                  <span className="text-green-400/80">{c.target}</span>
                </div>
              </div>

              {/* Rationale */}
              <p className="text-[10px] text-gray-500 leading-relaxed">
                {c.rationale}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
