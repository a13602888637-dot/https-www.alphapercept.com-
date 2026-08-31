"use client";

import { ImageDown } from "lucide-react";
import { DAILY_REPORT_IMAGE_LAYOUT_VERSION } from "@/lib/osint/daily-report/image-contract";
import { ReportVideoActions } from "./ReportVideoActions";

const EXPORT_ACTIONS = [
  { section: "stories", label: "下载当日热点图片" },
  { section: "hotlist", label: "下载个股热榜图片" },
] as const;

export function PrintActions({
  reportId,
  exportReady,
}: {
  reportId: string;
  exportReady: boolean;
}) {
  return (
    <div className="fixed inset-x-3 bottom-3 z-30 space-y-2 rounded-xl border border-[#2A394E] bg-[#070B12]/95 p-2 shadow-2xl backdrop-blur sm:static sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none" aria-label="图片导出">
      <div className="grid grid-cols-2 gap-2">
        {EXPORT_ACTIONS.map((action) => (
          <a
            key={action.section}
            href={exportReady ? `/api/osint/v1/reports/${encodeURIComponent(reportId)}/export?section=${action.section}&layout=${DAILY_REPORT_IMAGE_LAYOUT_VERSION}` : undefined}
            download
            aria-disabled={!exportReady}
            onClick={(event) => { if (!exportReady) event.preventDefault(); }}
            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#2A394E] bg-[#101A29] px-3 text-sm font-medium text-[#C9D3E0] transition-colors hover:border-[#2EC4C7]/50 hover:text-[#9DE7E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EC4C7] ${exportReady ? "" : "cursor-not-allowed opacity-40"}`}
          >
            <ImageDown className="h-4 w-4" />
            {action.label}
          </a>
        ))}
      </div>
      <ReportVideoActions reportId={reportId} exportReady={exportReady} />
      {!exportReady && (
        <p className="text-sm text-amber-300" role="alert">
          水印或免责声明校验未通过，导出已禁用。
        </p>
      )}
    </div>
  );
}
