"use client";

import { FileDown } from "lucide-react";

const EXPORT_ACTIONS = [
  { section: "full", label: "完整报告" },
  { section: "markets", label: "仅行情" },
  { section: "stories", label: "仅热点" },
  { section: "lhb", label: "仅游资" },
] as const;

export function PrintActions({
  reportId,
  exportReady,
}: {
  reportId: string;
  exportReady: boolean;
}) {
  function openPrint(section: (typeof EXPORT_ACTIONS)[number]["section"]) {
    if (!exportReady) return;
    const url = `/api/osint/v1/reports/${encodeURIComponent(reportId)}/export?section=${section}&print=1`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-30 space-y-2 rounded-xl border border-[#2A394E] bg-[#070B12]/95 p-2 shadow-2xl backdrop-blur sm:static sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none" aria-label="PDF 导出">
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {EXPORT_ACTIONS.map((action) => (
          <button
            key={action.section}
            type="button"
            disabled={!exportReady}
            onClick={() => openPrint(action.section)}
            className="inline-flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg border border-[#2A394E] bg-[#101A29] px-1 text-[11px] text-[#C9D3E0] transition-colors hover:border-[#2EC4C7]/50 hover:text-[#9DE7E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EC4C7] disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-11 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm"
          >
            <FileDown className="h-4 w-4" />
            {action.label}
          </button>
        ))}
      </div>
      {!exportReady && (
        <p className="text-sm text-amber-300" role="alert">
          水印或免责声明校验未通过，导出已禁用。
        </p>
      )}
    </div>
  );
}
