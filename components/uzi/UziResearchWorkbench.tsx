"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Clock3,
  FileText,
  Loader2,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getUziReportViewerPath, type UziReport } from "@/lib/uzi/report-types";

interface StockOption {
  code: string;
  name: string;
  market?: string;
}

interface WorkerState {
  online: boolean;
  status: string;
  lastSeenAt: string | null;
}

interface ResearchJob {
  id: string;
  stockCode: string;
  stockName: string;
  ticker: string;
  status: string;
  stage: string;
  stageMessage: string | null;
  attempt: number;
  publicReportId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

const STAGES = [
  ["QUEUED", "排队"],
  ["DATA_COLLECTION", "采集"],
  ["CROSS_CHECK", "核验"],
  ["AGENT_REVIEW", "评审"],
  ["SYNTHESIS", "成稿"],
  ["PUBLISHING", "归档"],
  ["COMPLETED", "完成"],
] as const;

function formatDate(value: string | null): string {
  if (!value) return "--";
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function statusLabel(job: ResearchJob): string {
  if (job.status === "SUCCEEDED") return "报告已完成";
  if (job.status === "FAILED") return "生成失败";
  if (job.status === "QUEUED") return "等待生成";
  return job.stageMessage || "报告生成中";
}

function statusTone(status: string): string {
  if (status === "SUCCEEDED") return "bg-[#36C878]";
  if (status === "FAILED") return "bg-[#F35A5A]";
  if (status === "QUEUED") return "bg-[#F2B84B]";
  return "bg-[#2EC4C7] shadow-[0_0_10px_rgba(46,196,199,0.45)]";
}

export function UziResearchWorkbench({ reports }: { reports: UziReport[] }) {
  const { getToken, isSignedIn } = useAuth();
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("stock") || "";
  const initialName = searchParams.get("name") || "";
  const initialJob = searchParams.get("job");
  const [query, setQuery] = useState(initialName || initialCode);
  const [selectedStock, setSelectedStock] = useState<StockOption | null>(
    initialCode ? { code: initialCode, name: initialName || initialCode } : null
  );
  const [options, setOptions] = useState<StockOption[]>([]);
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [worker, setWorker] = useState<WorkerState>({
    online: false,
    status: "OFFLINE",
    lastSeenAt: null,
  });
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialJob);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    if (isSignedIn !== true) return;
    const token = await getToken();
    if (!token) throw new Error("登录状态尚未就绪");
    const response = await fetch("/api/uzi/research-jobs", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "研究记录加载失败");
    setJobs(payload.jobs || []);
    if (payload.worker) setWorker(payload.worker);
    setSelectedJobId((current) => current || payload.jobs?.[0]?.id || null);
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (isSignedIn !== true) return;
    setLoading(true);
    void loadJobs()
      .then(() => setError(null))
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : "研究记录加载失败")
      )
      .finally(() => setLoading(false));
  }, [isSignedIn, loadJobs]);

  const hasActiveJobs = jobs.some((job) =>
    ["QUEUED", "RUNNING", "PUBLISHING"].includes(job.status)
  );

  useEffect(() => {
    if (isSignedIn !== true) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadJobs().catch((loadError) =>
          setError(loadError instanceof Error ? loadError.message : "研究进度更新失败")
        );
      }
    }, hasActiveJobs ? 5_000 : 30_000);
    return () => window.clearInterval(timer);
  }, [hasActiveJobs, isSignedIn, loadJobs]);

  useEffect(() => {
    const needle = query.trim();
    if (selectedStock && (needle === selectedStock.name || needle === selectedStock.code)) {
      setOptions([]);
      return;
    }
    if (needle.length < 2) {
      setOptions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(needle)}`, {
        signal: controller.signal,
      });
      if (!response.ok) return;
      const payload = await response.json();
      setOptions(
        (payload.data || [])
          .filter(
            (item: StockOption) =>
              /^\d{6}$/.test(item.code) &&
              !["港股", "美股", "US", "US-ETF"].includes(item.market || "")
          )
          .slice(0, 8)
      );
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selectedStock]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) || jobs[0] || null,
    [jobs, selectedJobId]
  );
  const currentStageIndex = selectedJob
    ? STAGES.findIndex(([stage]) => stage === selectedJob.stage)
    : -1;
  const selectedReport = selectedJob?.publicReportId
    ? reports.find((report) => report.id === selectedJob.publicReportId) || null
    : null;

  async function submitResearch() {
    if (!selectedStock || isSignedIn !== true) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("登录状态尚未就绪");
      const response = await fetch("/api/uzi/research-jobs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stockCode: selectedStock.code,
          stockName: selectedStock.name,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "提交失败");
      setSelectedJobId(payload.job.id);
      await loadJobs();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  if (isSignedIn !== true || loading) {
    return (
      <div className="grid min-h-[calc(100dvh-40px)] place-items-center bg-[#070B12]">
        <Loader2 className="h-5 w-5 animate-spin text-[#2EC4C7] motion-reduce:animate-none" />
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100dvh-40px)] w-full bg-[#070B12] text-[#D6DEE8]">
      <header className="border-b border-[#1F2A3A] bg-[#080E17] px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex w-full flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#2EC4C7]">
              <Radio className="h-3.5 w-3.5" /> AlphaPercept Research
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#D6DEE8] sm:text-3xl">
              深度研究
            </h1>
            <p className="mt-2 text-xs leading-5 text-[#718096]">
              输入股票，生成并保存一份只属于当前账号的深度研究报告。
            </p>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-[#718096]">
            <span className={`h-2 w-2 rounded-full ${worker.online ? "bg-[#36C878]" : "bg-[#536177]"}`} />
            <span>{worker.online ? (worker.status === "BUSY" ? "正在生成报告" : "报告服务在线") : "报告服务暂时离线"}</span>
            {!worker.online && worker.lastSeenAt && <span>· {formatDate(worker.lastSeenAt)}</span>}
          </div>
        </div>

        <div className="mt-5 grid w-full gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <label className="sr-only" htmlFor="research-stock">股票代码或名称</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#718096]" />
            <input
              id="research-stock"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedStock(null);
              }}
              placeholder="输入 A 股名称或 6 位代码"
              className="h-11 w-full rounded-md border border-[#1F2A3A] bg-[#0D1420] pl-10 pr-4 text-sm text-[#D6DEE8] outline-none placeholder:text-[#536177] focus:border-[#2EC4C7]/60 focus:ring-2 focus:ring-[#2EC4C7]/15"
            />
            {options.length > 0 && (
              <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-[#1F2A3A] bg-[#0D1420] shadow-2xl">
                {options.map((option) => (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => {
                      setSelectedStock(option);
                      setQuery(option.name);
                      setOptions([]);
                    }}
                    className="flex min-h-11 w-full items-center justify-between border-b border-[#1F2A3A]/70 px-3 text-left last:border-b-0 hover:bg-[#101927] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2EC4C7]"
                  >
                    <span className="text-xs text-[#D6DEE8]">{option.name}</span>
                    <span className="font-mono text-[10px] text-[#718096]">{option.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={!selectedStock || submitting}
            onClick={submitResearch}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#2EC4C7]/50 bg-[#2EC4C7]/15 px-5 text-xs font-semibold text-[#9DE7E8] hover:bg-[#2EC4C7]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EC4C7] disabled:cursor-not-allowed disabled:opacity-35"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            生成深度报告
          </button>
        </div>
        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-[#F35A5A]/35 bg-[#F35A5A]/[0.08] px-3 py-2 text-xs text-rose-200">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
      </header>

      <div className="grid min-h-[620px] w-full xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-b border-[#1F2A3A] bg-[#090F19] xl:border-b-0 xl:border-r">
          <div className="flex items-center justify-between border-b border-[#1F2A3A] px-4 py-3">
            <h2 className="text-xs font-semibold tracking-wide text-[#D6DEE8]">研究记录</h2>
            <span className="font-mono text-[10px] text-[#718096]">{jobs.length}</span>
          </div>
          <div className="max-h-[340px] overflow-y-auto xl:max-h-[calc(100dvh-145px)]">
            {jobs.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => setSelectedJobId(job.id)}
                className={`grid min-h-[62px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#1F2A3A]/70 px-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2EC4C7] ${selectedJob?.id === job.id ? "bg-[#142235]" : "hover:bg-[#101927]"}`}
              >
                <span className={`h-2 w-2 rounded-full ${statusTone(job.status)}`} />
                <span className="min-w-0">
                  <span className="block truncate text-xs text-[#D6DEE8]">
                    {job.stockName} <span className="font-mono text-[9px] text-[#536177]">{job.stockCode}</span>
                  </span>
                  <span className="mt-1 block truncate text-[10px] text-[#718096]">{statusLabel(job)}</span>
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-[#536177]" />
              </button>
            ))}
            {jobs.length === 0 && (
              <div className="px-5 py-16 text-center">
                <Clock3 className="mx-auto h-5 w-5 text-[#536177]" />
                <p className="mt-3 text-xs text-[#718096]">还没有研究报告</p>
              </div>
            )}
          </div>
        </aside>

        <section className="min-w-0 bg-[#070B12]">
          <div className="border-b border-[#1F2A3A] px-4 py-3 sm:px-6">
            <h2 className="text-xs font-semibold tracking-wide text-[#D6DEE8]">报告输出</h2>
          </div>
          {selectedJob ? (
            <div className="p-4 sm:p-6 lg:p-8">
              <div className="flex flex-col gap-4 border-b border-[#1F2A3A] pb-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h3 className="text-2xl font-semibold text-[#D6DEE8]">{selectedJob.stockName}</h3>
                    <span className="font-mono text-[11px] text-[#718096]">{selectedJob.ticker}</span>
                  </div>
                  <p className="mt-2 text-xs text-[#718096]">
                    {statusLabel(selectedJob)} · {formatDate(selectedJob.updatedAt)}
                  </p>
                </div>
                {selectedReport && (
                  <Link
                    href={getUziReportViewerPath(selectedReport)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#2EC4C7]/50 bg-[#2EC4C7]/15 px-4 text-xs font-semibold text-[#9DE7E8] hover:bg-[#2EC4C7]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EC4C7]"
                  >
                    打开深度研究报告 <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>

              <div className="border-b border-[#1F2A3A] py-6">
                <div className="grid grid-cols-7 gap-1.5">
                  {STAGES.map(([stage, label], index) => {
                    const complete = selectedJob.status === "SUCCEEDED" || index < currentStageIndex;
                    const active = selectedJob.status !== "FAILED" && index === currentStageIndex;
                    return (
                      <div key={stage} className="min-w-0">
                        <div className={`h-1 rounded-full ${complete ? "bg-[#36C878]" : active ? "bg-[#2EC4C7]" : "bg-[#1F2A3A]"}`} />
                        <p className={`mt-2 truncate text-center text-[9px] ${active ? "text-[#9DE7E8]" : complete ? "text-emerald-300/70" : "text-[#536177]"}`}>{label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedJob.status === "FAILED" ? (
                <div className="mt-6 rounded-md border border-[#F35A5A]/35 bg-[#F35A5A]/[0.08] p-5">
                  <div className="flex items-center gap-2 text-sm font-medium text-rose-200">
                    <AlertTriangle className="h-4 w-4" /> 报告没有生成成功
                  </div>
                  <p className="mt-3 text-xs leading-5 text-rose-100/70">{selectedJob.errorMessage || "请稍后重新提交。"}</p>
                </div>
              ) : selectedReport ? (
                <div className="mt-6 grid gap-4 rounded-md border border-[#1F2A3A] bg-[#0D1420] p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#D6DEE8]">
                      <ShieldCheck className="h-4 w-4 text-[#36C878]" /> 报告已保存到当前账号
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#718096]">{selectedReport.reportDate} · {selectedReport.name} · {selectedReport.ticker}</p>
                  </div>
                  <Link href={getUziReportViewerPath(selectedReport)} className="inline-flex min-h-9 items-center justify-center gap-2 rounded border border-[#1F2A3A] px-3 text-xs text-[#D6DEE8] hover:bg-[#101927]">
                    查看报告 <FileText className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="grid min-h-[320px] place-items-center text-center">
                  <div>
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#2EC4C7] motion-reduce:animate-none" />
                    <p className="mt-4 text-sm text-[#D6DEE8]">{selectedJob.status === "QUEUED" ? "等待生成" : "正在生成深度研究报告"}</p>
                    <p className="mt-2 text-xs text-[#718096]">可以关闭页面，完成后报告会保存在当前账号。</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid min-h-[560px] place-items-center px-6 text-center">
              <div>
                <FileText className="mx-auto h-7 w-7 text-[#536177]" />
                <p className="mt-4 text-sm text-[#D6DEE8]">输入一只股票，生成第一份深度研究报告。</p>
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="w-full border-t border-[#1F2A3A] bg-[#080E17] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-[#D6DEE8]">我的研究报告</h2>
            <p className="mt-1 text-[10px] text-[#718096]">仅当前账号可见</p>
          </div>
          <span className="font-mono text-[10px] text-[#718096]">{reports.length} 份</span>
        </div>
        {reports.length > 0 ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {reports.map((report) => (
              <Link
                key={report.id}
                href={getUziReportViewerPath(report)}
                className="group rounded-md border border-[#1F2A3A] bg-[#0D1420] p-4 hover:border-[#2EC4C7]/45 hover:bg-[#101927] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EC4C7]"
              >
                <div className="flex items-center justify-between gap-3">
                  <FileText className="h-4 w-4 text-[#2EC4C7]" />
                  <span className="font-mono text-[9px] text-[#718096]">{report.reportDate}</span>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-[#D6DEE8]">{report.name}</h3>
                <p className="mt-1 font-mono text-[10px] text-[#718096]">{report.ticker}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-dashed border-[#1F2A3A] px-4 py-8 text-center text-xs text-[#718096]">
            完成的报告会保存在这里。
          </div>
        )}
      </section>
    </main>
  );
}
