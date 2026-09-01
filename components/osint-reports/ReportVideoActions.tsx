"use client";

import { Film, Loader2 } from "lucide-react";
import { useState } from "react";
import type { OsintDailyReportRecord } from "@/lib/osint/daily-report/contracts";
import type { VideoMode } from "@/lib/osint/daily-video/contracts";
import { buildVideoStoryboard } from "@/lib/osint/daily-video/storyboard";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function ReportVideoActions({ reportId, exportReady }: { reportId: string; exportReady: boolean }) {
  const [activeMode, setActiveMode] = useState<VideoMode | null>(null);
  const [progress, setProgress] = useState(0);
  const [estimatedSeconds, setEstimatedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function generate(mode: VideoMode) {
    if (activeMode || !exportReady) return;
    setActiveMode(mode);
    setProgress(0);
    setEstimatedSeconds(0);
    setError(null);
    try {
      const response = await fetch(`/api/osint/v1/reports/${encodeURIComponent(reportId)}`, { cache: "no-store" });
      const payload = await response.json() as { report?: OsintDailyReportRecord; error?: string };
      if (!response.ok || !payload.report) throw new Error(payload.error || `HTTP ${response.status}`);
      const reportUrl = `${window.location.origin}/osint/reports/${encodeURIComponent(reportId)}`;
      const storyboard = buildVideoStoryboard(payload.report.snapshot, mode, { reportUrl });
      setEstimatedSeconds(Math.ceil(storyboard.durationMs / 1_000));
      const { generateReportVideo } = await import("@/lib/osint/daily-video/generate");
      const blob = await generateReportVideo(storyboard, setProgress);
      downloadBlob(blob, `alphapercept-${storyboard.date}-${mode}-${storyboard.theme.id}.mp4`);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "VIDEO_GENERATION_FAILED";
      if (message.startsWith("STALE_CLOSE_DATA:")) {
        setError(`收盘数据日期为 ${message.split(":")[1]}，与本期日期不一致，请等待当天数据更新后重试。`);
      } else if (message.startsWith("INCOMPLETE_CLOSE_DATA:")) {
        setError(`当天收盘数据状态为 ${message.split(":")[1]}，尚未完整，暂不生成视频。`);
      } else if (message === "MP4_RECORDING_UNSUPPORTED") {
        setError("当前浏览器无法生成 TikTok 可上传的 MP4，请使用最新版 Chrome 后重试。");
      } else if (message.includes("UNSUPPORTED")) {
        setError("当前浏览器不支持视频录制，请继续使用 PNG 下载。");
      } else {
        setError("短视频生成失败，请刷新后重试。");
      }
    } finally {
      setActiveMode(null);
    }
  }

  return (
    <div className="space-y-2" aria-label="短视频生成">
      <div className="grid grid-cols-2 gap-2">
        {([
          ["morning", "生成早报短视频"],
          ["close", "生成收盘短视频"],
        ] as const).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            disabled={!exportReady || activeMode !== null}
            onClick={() => void generate(mode)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#2A394E] bg-[#101A29] px-3 text-sm font-medium text-[#C9D3E0] transition-colors hover:border-[#2EC4C7]/50 hover:text-[#9DE7E8] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {activeMode === mode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
            {label}
          </button>
        ))}
      </div>
      {activeMode && (
        <div className="space-y-1" aria-label="生成进度">
          <div className="h-1.5 overflow-hidden rounded-full bg-[#1C2737]"><div className="h-full bg-[#2EC4C7] transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          <p className="text-xs text-[#718096]">生成进度 {Math.round(progress * 100)}% · 请保持本页打开{estimatedSeconds > 0 ? `约 ${estimatedSeconds} 秒` : ""}</p>
        </div>
      )}
      {error && <p className="text-sm text-amber-300" role="alert">{error}</p>}
    </div>
  );
}
