"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Clock3,
  FileText,
  Loader2,
  MonitorUp,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getUziReportViewerPath, type UziReport } from "@/lib/uzi-reports";

interface StockOption { code: string; name: string; market?: string }
interface Position { stockCode: string; stockName: string; quantity: number }
interface Worker { online: boolean; status: string; lastSeenAt: string | null; currentJobId?: string | null }
interface BriefEvidence { label: string; value: string; source?: string; asOf?: string }
interface PrivateBrief {
  stance?: string;
  summary?: string;
  evidence?: BriefEvidence[];
  action?: string;
  actionCondition?: string;
  invalidatesWhen?: string;
  riskFlags?: string[];
  dataGaps?: string[];
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
  privateBrief: PrivateBrief | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

const STAGES = [
  ["QUEUED", "排队"], ["DATA_COLLECTION", "采集"], ["CROSS_CHECK", "核验"],
  ["AGENT_REVIEW", "多 Agent"], ["SYNTHESIS", "汇总"], ["PUBLISHING", "发布"], ["COMPLETED", "完成"],
] as const;

function formatDate(value: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

function actionLabel(action?: string) {
  return ({ WATCH: "继续观察", REVIEW: "需要复核", REDUCE: "考虑降风险", EXIT: "触发退出复核" } as Record<string, string>)[action || ""] || "等待结论";
}

function statusDot(status: string) {
  if (status === "SUCCEEDED") return "bg-emerald-400";
  if (status === "FAILED") return "bg-rose-400";
  if (status === "QUEUED") return "bg-amber-300";
  return "bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,.45)]";
}

export function UziResearchWorkbench({ reports }: { reports: UziReport[] }) {
  const { getToken, isSignedIn } = useAuth();
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("stock") || "";
  const initialName = searchParams.get("name") || "";
  const initialJob = searchParams.get("job");
  const [query, setQuery] = useState(initialName || initialCode);
  const [selectedStock, setSelectedStock] = useState<StockOption | null>(initialCode ? { code: initialCode, name: initialName || initialCode } : null);
  const [options, setOptions] = useState<StockOption[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [worker, setWorker] = useState<Worker>({ online: false, status: "OFFLINE", lastSeenAt: null });
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialJob);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    if (isSignedIn !== true) return;
    const token = await getToken();
    if (!token) throw new Error("登录状态尚未就绪");
    const headers = { Authorization: `Bearer ${token}` };
    const response = await fetch("/api/uzi/research-jobs", { headers, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "研判任务加载失败");
    setJobs(data.jobs || []);
    if (data.worker) setWorker(data.worker);
    setSelectedJobId((current) => current || data.jobs?.[0]?.id || null);
  }, [getToken, isSignedIn]);

  const loadPositions = useCallback(async () => {
    if (isSignedIn !== true) return;
    const token = await getToken();
    if (!token) throw new Error("登录状态尚未就绪");
    const response = await fetch("/api/portfolio", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "持仓加载失败");
    setPositions(data.portfolio || []);
  }, [getToken, isSignedIn]);

  const hasActiveJobs = jobs.some((job) => ["QUEUED", "RUNNING", "PUBLISHING"].includes(job.status));

  useEffect(() => {
    if (isSignedIn !== true) return;
    setLoading(true);
    void Promise.all([loadJobs(), loadPositions()])
      .then(() => setError(null))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "数据加载失败"))
      .finally(() => setLoading(false));
  }, [isSignedIn, loadJobs, loadPositions]);

  useEffect(() => {
    if (isSignedIn !== true) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadJobs()
          .then(() => setError(null))
          .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "任务状态更新失败"));
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
    if (needle.length < 2) { setOptions([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(needle)}`, { signal: controller.signal });
      if (!response.ok) return;
      const payload = await response.json();
      setOptions((payload.data || []).filter((item: StockOption) => /^\d{6}$/.test(item.code) && !["港股", "美股", "US", "US-ETF"].includes(item.market || "" )).slice(0, 8));
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, selectedStock]);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId) || jobs[0] || null, [jobs, selectedJobId]);
  const currentStageIndex = selectedJob ? STAGES.findIndex(([stage]) => stage === selectedJob.stage) : -1;
  const existingReport = selectedStock ? reports.find((report) => report.stockCode === selectedStock.code) : null;

  async function submitResearch() {
    if (!selectedStock || isSignedIn !== true) return;
    setSubmitting(true); setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("登录状态尚未就绪");
      const response = await fetch("/api/uzi/research-jobs", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ stockCode: selectedStock.code, stockName: selectedStock.name }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "提交失败");
      setSelectedJobId(payload.job.id);
      await loadJobs();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "提交失败");
    } finally { setSubmitting(false); }
  }

  if (isSignedIn === undefined || (isSignedIn === true && loading)) return <div className="grid min-h-[70vh] place-items-center"><Loader2 className="h-5 w-5 animate-spin text-cyan-300" /></div>;
  if (isSignedIn === false) return (
    <main className="grid min-h-[calc(100dvh-40px)] place-items-center bg-[#080b10] px-6 text-center">
      <div><Sparkles className="mx-auto h-8 w-8 text-cyan-300" /><h1 className="mt-5 text-2xl font-semibold">登录后发起深度研判</h1><p className="mt-3 max-w-md text-sm leading-6 text-slate-500">任务会进入你的私有队列，由本机 Codex 完成 Uzi 多 Agent 复核。</p><SignInButton mode="redirect" forceRedirectUrl="/uzi-reports"><button className="mt-6 rounded-lg bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-[#071015]">登录</button></SignInButton></div>
    </main>
  );

  return (
    <main className="min-h-[calc(100dvh-40px)] bg-[#080b10] text-[#eeeae0]">
      <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
        <header className="grid gap-6 border-b border-white/[0.08] pb-7 lg:grid-cols-[1fr_auto] lg:items-end">
          <div><p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300/70">Local Codex · Verified Uzi workflow</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">深度研判，不是一次聊天。</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">公开数据采集、交叉核验、多 Agent 评审、结论汇总和发布都必须真实完成。持仓成本与行动卡只在登录后可见。</p></div>
          <div className="flex items-center gap-3 rounded-lg border border-white/[0.09] bg-[#0c1016] px-4 py-3"><span className={`h-2 w-2 rounded-full ${worker.online ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.6)]" : "bg-slate-700"}`} /><div><p className="text-xs text-slate-300">本机 Worker {worker.online ? "在线" : "离线"}</p><p className="mt-0.5 text-[10px] text-slate-600">{worker.online ? worker.status === "BUSY" ? "正在执行任务" : "等待任务" : `最后心跳 ${formatDate(worker.lastSeenAt)}`}</p></div></div>
        </header>

        <section className="mt-6 rounded-xl border border-white/[0.09] bg-[#0c1016] p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="relative"><label className="mb-2 block text-[10px] uppercase tracking-[0.16em] text-slate-600">股票代码或名称</label><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" /><input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedStock(null); }} placeholder="例如：湖南白银 / 002716" className="h-12 w-full rounded-lg border border-white/[0.1] bg-[#080b10] pl-10 pr-4 text-sm text-white outline-none transition focus:border-cyan-300/40" /></div>
              {options.length > 0 && <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-white/[0.1] bg-[#10151d] shadow-2xl">{options.map((option) => <button key={option.code} onClick={() => { setSelectedStock(option); setQuery(option.name); setOptions([]); }} className="flex w-full items-center justify-between border-b border-white/[0.06] px-4 py-3 text-left last:border-b-0 hover:bg-white/[0.04]"><span className="text-sm text-slate-200">{option.name}</span><span className="font-mono text-[10px] text-slate-600">{option.code} · {option.market}</span></button>)}</div>}
            </div>
            <button disabled={!selectedStock || submitting} onClick={submitResearch} className="flex h-12 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-6 text-sm font-semibold text-[#071015] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-30">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}提交深研</button>
          </div>
          {positions.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2"><span className="mr-1 text-[10px] text-slate-600">我的持仓</span>{positions.map((position) => <button key={position.stockCode} onClick={() => { setSelectedStock({ code: position.stockCode, name: position.stockName }); setQuery(position.stockName); }} className={`rounded-md border px-2.5 py-1.5 text-[10px] transition ${selectedStock?.code === position.stockCode ? "border-cyan-300/35 bg-cyan-300/[0.08] text-cyan-200" : "border-white/[0.08] text-slate-500 hover:text-white"}`}>{position.stockName} · {position.quantity} 股</button>)}</div>}
          {existingReport && <div className="mt-4 flex items-center justify-between rounded-lg border border-emerald-400/15 bg-emerald-400/[0.035] px-4 py-3 text-xs"><span className="text-emerald-100/70">已有 {existingReport.reportDate} 深报，仍可重新提交以更新结论。</span><Link href={getUziReportViewerPath(existingReport)} className="text-emerald-200">打开旧报告</Link></div>}
          {error && <div className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/[0.05] px-4 py-3 text-xs text-rose-200">{error}</div>}
        </section>

        <div className="mt-6 grid min-h-[620px] gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-3">
            <div className="flex items-center justify-between px-2 py-2"><h2 className="text-xs font-semibold">我的研判队列</h2><span className="font-mono text-[10px] text-slate-600">{jobs.length}</span></div>
            <div className="mt-1 space-y-1">{jobs.map((job) => <button key={job.id} onClick={() => setSelectedJobId(job.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${selectedJob?.id === job.id ? "bg-white/[0.06]" : "hover:bg-white/[0.035]"}`}><span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(job.status)}`} /><div className="min-w-0 flex-1"><p className="truncate text-sm text-slate-200">{job.stockName} <span className="font-mono text-[9px] text-slate-600">{job.stockCode}</span></p><p className="mt-1 truncate text-[10px] text-slate-600">{job.stageMessage || job.status}</p></div><ChevronRight className="h-3.5 w-3.5 text-slate-700" /></button>)}</div>
            {jobs.length === 0 && <div className="px-4 py-14 text-center"><Clock3 className="mx-auto h-5 w-5 text-slate-700" /><p className="mt-3 text-xs text-slate-600">提交一只股票后，进度会显示在这里。</p></div>}
          </aside>

          <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c1016]">
            {selectedJob ? <>
              <div className="flex flex-col gap-4 border-b border-white/[0.07] px-5 py-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><h2 className="text-xl font-semibold">{selectedJob.stockName}</h2><span className="font-mono text-[10px] text-slate-600">{selectedJob.ticker}</span></div><p className="mt-2 text-xs text-slate-500">{selectedJob.stageMessage || "等待状态更新"} · 第 {Math.max(selectedJob.attempt, 1)} 次执行</p></div>{selectedJob.publicReportId && <Link href={`/uzi-reports/${selectedJob.publicReportId}`} className="inline-flex h-9 items-center gap-2 rounded-md bg-cyan-300 px-4 text-xs font-semibold text-[#071015]">打开完整报告 <ArrowRight className="h-3.5 w-3.5" /></Link>}</div>
              <div className="border-b border-white/[0.07] px-5 py-5"><div className="grid grid-cols-7 gap-1">{STAGES.map(([stage, label], index) => { const complete = selectedJob.status === "SUCCEEDED" || index < currentStageIndex; const active = selectedJob.status !== "FAILED" && index === currentStageIndex; return <div key={stage} className="min-w-0"><div className={`h-1 rounded-full ${complete ? "bg-emerald-400/75" : active ? "bg-cyan-300" : "bg-white/[0.07]"}`} /><p className={`mt-2 truncate text-center text-[9px] ${active ? "text-cyan-200" : complete ? "text-emerald-200/70" : "text-slate-700"}`}>{label}</p></div>; })}</div></div>

              {selectedJob.status === "FAILED" ? <div className="p-6"><div className="rounded-lg border border-rose-400/20 bg-rose-400/[0.05] p-5"><div className="flex items-center gap-2 text-sm font-medium text-rose-200"><AlertTriangle className="h-4 w-4" />深研没有完成</div><p className="mt-3 text-xs leading-5 text-rose-100/60">{selectedJob.errorMessage || "请检查本机 Worker 日志后重新提交。"}</p></div></div> : selectedJob.privateBrief ? <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
                <div><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-600">Private position brief</p><div className="mt-3 flex flex-wrap items-center gap-3"><h3 className="text-2xl font-semibold">{selectedJob.privateBrief.stance || "研判完成"}</h3><span className="rounded border border-cyan-300/20 bg-cyan-300/[0.06] px-2 py-1 text-[10px] text-cyan-200">{actionLabel(selectedJob.privateBrief.action)}</span></div><p className="mt-4 text-sm leading-7 text-slate-400">{selectedJob.privateBrief.summary}</p><div className="mt-6 grid gap-3 sm:grid-cols-2">{selectedJob.privateBrief.evidence?.map((item, index) => <div key={`${item.label}-${index}`} className="rounded-lg border border-white/[0.07] bg-black/10 p-4"><p className="text-[10px] text-slate-600">{item.label}</p><p className="mt-2 text-sm font-medium text-slate-200">{item.value}</p><p className="mt-2 text-[9px] text-slate-700">{item.source} {item.asOf ? `· ${item.asOf}` : ""}</p></div>)}</div></div>
                <div className="space-y-3"><div className="rounded-lg border border-amber-300/15 bg-amber-300/[0.035] p-4"><p className="text-[10px] uppercase tracking-wider text-amber-200/50">何时需要动作</p><p className="mt-2 text-xs leading-5 text-amber-100/70">{selectedJob.privateBrief.actionCondition || "等待明确触发条件"}</p></div><div className="rounded-lg border border-white/[0.07] p-4"><p className="text-[10px] uppercase tracking-wider text-slate-600">结论何时失效</p><p className="mt-2 text-xs leading-5 text-slate-400">{selectedJob.privateBrief.invalidatesWhen || "关键事实发生变化时重新深研"}</p></div>{(selectedJob.privateBrief.riskFlags?.length || 0) > 0 && <div className="rounded-lg border border-rose-400/15 bg-rose-400/[0.025] p-4"><p className="text-[10px] uppercase tracking-wider text-rose-200/50">风险旗标</p><ul className="mt-2 space-y-2 text-xs leading-5 text-rose-100/60">{selectedJob.privateBrief.riskFlags?.map((item, index) => <li key={index}>· {item}</li>)}</ul></div>}</div>
              </div> : <div className="grid min-h-[390px] place-items-center px-6 text-center"><div>{selectedJob.status === "SUCCEEDED" ? <ShieldCheck className="mx-auto h-7 w-7 text-emerald-400" /> : <Loader2 className="mx-auto h-7 w-7 animate-spin text-cyan-300" />}<p className="mt-4 text-sm text-slate-300">{selectedJob.status === "QUEUED" ? "等待本机 Worker 领取" : "Uzi 深研正在后台执行"}</p><p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-slate-600">可以关闭网页。任务在本机 Codex 中继续运行，完成后公开报告与私有持仓行动卡会自动回到这里。</p></div></div>}
            </> : <div className="grid min-h-[620px] place-items-center px-6 text-center"><div><MonitorUp className="mx-auto h-8 w-8 text-slate-700" /><p className="mt-4 text-sm text-slate-400">从持仓或搜索选择一只股票，提交第一次深研。</p></div></div>}
          </section>
        </div>

        <section className="mt-10 border-t border-white/[0.08] pt-8"><div className="flex items-end justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">Published archive</p><h2 className="mt-2 text-xl font-semibold">已发布深报</h2></div><span className="text-[10px] text-slate-600">公开市场研究 · 不含账户数据</span></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{reports.map((report) => <Link key={report.id} href={getUziReportViewerPath(report)} className="group rounded-xl border border-white/[0.08] bg-[#0c1016] p-4 transition hover:border-cyan-300/20"><div className="flex items-center justify-between"><FileText className="h-4 w-4 text-slate-600 group-hover:text-cyan-300" /><span className="font-mono text-[9px] text-slate-700">{report.reportDate}</span></div><h3 className="mt-4 text-sm font-medium">{report.name}</h3><p className="mt-1 font-mono text-[10px] text-slate-600">{report.ticker}</p><div className="mt-4 flex items-center justify-between text-[10px]"><span className={report.agentReviewed ? "text-emerald-300/70" : "text-amber-300/70"}>{report.agentReviewed ? "Agent 已复核" : "机械生成"}</span><span className="text-slate-600">{report.overallScore ?? "--"} 分</span></div></Link>)}</div></section>
      </div>
    </main>
  );
}
