"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SignInButton, useAuth } from "@clerk/nextjs";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  BookOpenCheck,
  CircleCheck,
  Clock3,
  Loader2,
  Radio,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

interface Position {
  id: string;
  stockCode: string;
  stockName: string;
  industry: string | null;
  quantity: number;
  avgCost: number;
  currentPrice: number | null;
  priceIsLive: boolean;
  priceSource: string;
  priceAsOf: string | null;
  marketValue: number | null;
  profitLoss: number | null;
  profitLossPercent: number | null;
  changePercent: number;
  weight: number | null;
}

interface ResearchJob {
  id: string;
  stockCode: string;
  stockName: string;
  status: string;
  stage: string;
  stageMessage: string | null;
  publicReportId: string | null;
  createdAt: string;
}

interface RadarEvent {
  id: string;
  stockCode: string;
  stockName: string;
  severity: "CRITICAL" | "WARNING" | "INFO" | string;
  status: string;
  title: string;
  summary: string;
  lastSeenAt: string;
}

interface WorkerSummary {
  online: boolean;
  status: string;
  lastSeenAt: string | null;
}

function formatNumber(value: number | null, digits = 2) {
  return value == null || !Number.isFinite(value) ? "--" : value.toFixed(digits);
}

function formatMoney(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(value);
}

function formatTime(value: string | null) {
  if (!value) return "尚未运行";
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function statusLabel(job: ResearchJob) {
  if (job.status === "SUCCEEDED") return "已完成";
  if (job.status === "FAILED") return "需检查";
  if (job.status === "QUEUED") return "排队中";
  return job.stageMessage || "深研中";
}

function severityStyle(severity: string) {
  if (severity.toLowerCase() === "critical") return "border-rose-400/25 bg-rose-400/[0.06] text-rose-200";
  if (severity.toLowerCase() === "warning") return "border-amber-300/25 bg-amber-300/[0.055] text-amber-100";
  return "border-cyan-300/20 bg-cyan-300/[0.045] text-cyan-100";
}

export function PersonalInvestmentAssistant() {
  const { getToken, isSignedIn } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [events, setEvents] = useState<RadarEvent[]>([]);
  const [worker, setWorker] = useState<WorkerSummary>({ online: false, status: "OFFLINE", lastSeenAt: null });
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (isSignedIn !== true) {
      if (isSignedIn === false) setLoading(false);
      return;
    }
    if (!quiet) setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };
      const [portfolioResponse, radarResponse, jobsResponse] = await Promise.all([
        fetch("/api/portfolio", { headers, cache: "no-store" }),
        fetch("/api/portfolio/radar", { headers, cache: "no-store" }),
        fetch("/api/uzi/research-jobs", { headers, cache: "no-store" }),
      ]);
      if (!portfolioResponse.ok || !radarResponse.ok || !jobsResponse.ok) {
        throw new Error("个人投资数据暂时未能完整加载");
      }
      const [portfolioData, radarData, jobsData] = await Promise.all([
        portfolioResponse.json(), radarResponse.json(), jobsResponse.json(),
      ]);
      setPositions(portfolioData.portfolio || []);
      setEvents((radarData.events || []).filter((item: RadarEvent) => item.status === "ACTIVE"));
      setLastScanAt(radarData.lastScanAt || null);
      setJobs(jobsData.jobs || []);
      if (jobsData.worker || radarData.worker) setWorker(jobsData.worker || radarData.worker);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    void load();
    if (isSignedIn !== true) return;
    const timer = window.setInterval(() => void load(true), 30_000);
    return () => window.clearInterval(timer);
  }, [isSignedIn, load]);

  const activeJobs = jobs.filter((job) => ["QUEUED", "RUNNING", "PUBLISHING"].includes(job.status));
  const actionableCount = events.filter((event) => event.severity.toLowerCase() !== "info").length;
  const resourcePositions = useMemo(
    () => positions.filter((item) => {
      const descriptor = `${item.stockName}${item.industry || ""}`;
      return !/银行/.test(descriptor) && /白银|钨|有色|金属|资源|矿产|采矿/i.test(descriptor);
    }),
    [positions]
  );
  const correlatedRisk = resourcePositions.length >= 2;
  const today = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", month: "long", day: "numeric", weekday: "long",
  }).format(new Date());

  if (isSignedIn === undefined || loading) {
    return <div className="grid min-h-[calc(100dvh-40px)] place-items-center bg-[#080b10]"><Loader2 className="h-5 w-5 animate-spin text-cyan-300" /></div>;
  }

  if (isSignedIn === false) {
    return (
      <main className="grid min-h-[calc(100dvh-40px)] place-items-center bg-[#080b10] px-6">
        <div className="max-w-md text-center">
          <BookOpenCheck className="mx-auto h-9 w-9 text-cyan-300" />
          <h1 className="mt-5 text-2xl font-semibold text-[#f0ede4]">这是你的投资决策簿</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">登录后只展示你的持仓异动、风险条件和 Uzi 深研进度。</p>
          <SignInButton mode="redirect" forceRedirectUrl="/dashboard">
            <button className="mt-6 rounded-lg bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-[#071015]">登录查看</button>
          </SignInButton>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100dvh-40px)] bg-[#080b10] text-[#eeeae0]">
      <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
        <header className="flex flex-col gap-5 border-b border-white/[0.08] pb-7 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300/70">Personal decision ledger · {today}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#f4f0e7] sm:text-4xl">今天，先处理真正需要看的事。</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">不预测每一次涨跌。只监测你的计划是否被触发，以及哪只持仓值得投入一次完整深研。</p>
          </div>
          <button onClick={() => void load()} className="inline-flex h-9 items-center gap-2 self-start rounded-md border border-white/[0.1] px-3 text-xs text-slate-400 transition hover:bg-white/[0.04] hover:text-white md:self-auto">
            <RefreshCw className="h-3.5 w-3.5" /> 刷新
          </button>
        </header>

        {error && <div className="mt-5 rounded-lg border border-rose-400/20 bg-rose-400/[0.05] px-4 py-3 text-xs text-rose-200">{error}</div>}

        <section className="mt-6 grid gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.08] md:grid-cols-3">
          <div className="bg-[#0c1016] p-5">
            <div className="flex items-center gap-2 text-[11px] text-slate-500"><BellRing className="h-3.5 w-3.5" /> 今日动作</div>
            <p className="mt-4 font-mono text-3xl font-semibold text-[#f4f0e7]">{actionableCount}</p>
            <p className="mt-1 text-xs text-slate-500">条止损、目标或异常条件需要复核</p>
          </div>
          <div className="bg-[#0c1016] p-5">
            <div className="flex items-center gap-2 text-[11px] text-slate-500"><Sparkles className="h-3.5 w-3.5" /> Uzi 深研</div>
            <p className="mt-4 font-mono text-3xl font-semibold text-[#f4f0e7]">{activeJobs.length}</p>
            <p className="mt-1 text-xs text-slate-500">份正在排队、复核或发布</p>
          </div>
          <div className="bg-[#0c1016] p-5">
            <div className="flex items-center gap-2 text-[11px] text-slate-500"><Radio className="h-3.5 w-3.5" /> 本机监测</div>
            <div className="mt-4 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${worker.online ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.6)]" : "bg-slate-700"}`} />
              <p className="text-lg font-medium text-[#f4f0e7]">{worker.online ? "在线" : "离线"}</p>
            </div>
            <p className="mt-2 text-xs text-slate-500">最近扫描 {formatTime(lastScanAt)}</p>
          </div>
        </section>

        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)]">
          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">01 · Decision queue</p>
                <h2 className="mt-2 text-xl font-semibold">今日决策队列</h2>
              </div>
              <span className="text-[11px] text-slate-600">规则触发，不是自动交易</span>
            </div>

            <div className="mt-4 space-y-3">
              {correlatedRisk && (
                <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.045] p-5">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-amber-100">组合暴露集中：金属资源链</h3><span className="rounded border border-amber-300/20 px-1.5 py-0.5 font-mono text-[9px] text-amber-200/70">PORTFOLIO</span></div>
                      <p className="mt-2 text-xs leading-5 text-amber-100/60">{resourcePositions.map((item) => item.stockName).join("、")} 可能受相近的商品价格、周期情绪与风险偏好驱动。单只股票看对，不代表组合风险分散。</p>
                    </div>
                  </div>
                </div>
              )}

              {events.map((event) => (
                <article key={event.id} className={`rounded-xl border p-5 ${severityStyle(event.severity)}`}>
                  <div className="flex items-start gap-3">
                    {event.severity.toLowerCase() === "critical" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <BellRing className="mt-0.5 h-4 w-4 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{event.title}</h3><span className="font-mono text-[10px] opacity-50">{event.stockCode}</span></div>
                      <p className="mt-2 text-xs leading-5 opacity-65">{event.summary}</p>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="text-[10px] opacity-45">{formatTime(event.lastSeenAt)} 更新</span>
                        <Link href={`/uzi-reports?stock=${event.stockCode}&name=${encodeURIComponent(event.stockName)}`} className="inline-flex items-center gap-1 text-[11px] font-medium">进入深研 <ArrowRight className="h-3 w-3" /></Link>
                      </div>
                    </div>
                  </div>
                </article>
              ))}

              {events.length === 0 && !correlatedRisk && (
                <div className="rounded-xl border border-white/[0.08] bg-[#0c1016] px-5 py-9 text-center">
                  <CircleCheck className="mx-auto h-5 w-5 text-emerald-400" />
                  <p className="mt-3 text-sm text-slate-300">当前没有触发行动条件</p>
                  <p className="mt-1 text-xs text-slate-600">保持原计划；监测不会把“没数据”伪装成安全。</p>
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">02 · Research</p>
                <h2 className="mt-2 text-xl font-semibold">深研工作台</h2>
              </div>
              <Link href="/uzi-reports" className="text-[11px] text-cyan-300/80">全部任务</Link>
            </div>
            <div className="mt-4 rounded-xl border border-white/[0.08] bg-[#0c1016] p-4">
              {jobs.length > 0 ? jobs.slice(0, 4).map((job) => (
                <Link key={job.id} href={job.publicReportId ? `/uzi-reports/${job.publicReportId}` : `/uzi-reports?job=${job.id}`} className="flex items-center gap-3 border-b border-white/[0.06] py-3 first:pt-0 last:border-b-0 last:pb-0">
                  <span className={`h-2 w-2 rounded-full ${job.status === "SUCCEEDED" ? "bg-emerald-400" : job.status === "FAILED" ? "bg-rose-400" : "bg-cyan-300"}`} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm text-slate-200">{job.stockName} <span className="font-mono text-[10px] text-slate-600">{job.stockCode}</span></p><p className="mt-1 truncate text-[10px] text-slate-600">{statusLabel(job)}</p></div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-700" />
                </Link>
              )) : <div className="py-4 text-center text-xs text-slate-600">还没有深研任务</div>}
              <Link href="/uzi-reports" className="mt-4 flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-300 text-xs font-semibold text-[#071015]">发起 Uzi 深研 <Sparkles className="h-3.5 w-3.5" /></Link>
            </div>
          </section>
        </div>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">03 · Positions</p><h2 className="mt-2 text-xl font-semibold">持仓快照</h2></div><Link href="/my-stocks" className="text-[11px] text-slate-500 hover:text-white">管理持仓</Link></div>
          <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c1016]">
            <div className="hidden grid-cols-[1.4fr_.8fr_.8fr_.8fr_.7fr_auto] border-b border-white/[0.07] px-5 py-3 text-[9px] uppercase tracking-[0.14em] text-slate-600 md:grid"><span>标的</span><span className="text-right">现价</span><span className="text-right">日涨跌</span><span className="text-right">持仓盈亏</span><span className="text-right">仓位</span><span className="w-20" /></div>
            {positions.map((item) => (
              <div key={item.id} className="grid gap-3 border-b border-white/[0.06] px-5 py-4 last:border-b-0 md:grid-cols-[1.4fr_.8fr_.8fr_.8fr_.7fr_auto] md:items-center">
                <div><p className="text-sm font-medium text-slate-200">{item.stockName}</p><p className="mt-1 font-mono text-[10px] text-slate-600">{item.stockCode} · {item.quantity} 股</p></div>
                <div className="flex justify-between md:block md:text-right"><span className="text-[10px] text-slate-600 md:hidden">现价</span><span className="font-mono text-xs">{item.priceIsLive ? `¥${formatNumber(item.currentPrice)}` : "行情不可用"}</span></div>
                <div className="flex justify-between md:block md:text-right"><span className="text-[10px] text-slate-600 md:hidden">日涨跌</span><span className={`font-mono text-xs ${item.changePercent > 0 ? "text-rose-300" : item.changePercent < 0 ? "text-emerald-300" : "text-slate-500"}`}>{item.priceIsLive ? `${item.changePercent > 0 ? "+" : ""}${formatNumber(item.changePercent)}%` : "--"}</span></div>
                <div className="flex justify-between md:block md:text-right"><span className="text-[10px] text-slate-600 md:hidden">盈亏</span><span className={`font-mono text-xs ${(item.profitLossPercent || 0) > 0 ? "text-rose-300" : (item.profitLossPercent || 0) < 0 ? "text-emerald-300" : "text-slate-500"}`}>{item.priceIsLive ? `${formatMoney(item.profitLoss)} / ${formatNumber(item.profitLossPercent)}%` : "--"}</span></div>
                <div className="flex justify-between md:block md:text-right"><span className="text-[10px] text-slate-600 md:hidden">仓位</span><span className="font-mono text-xs text-slate-400">{formatNumber(item.weight, 1)}%</span></div>
                <Link href={`/uzi-reports?stock=${item.stockCode}&name=${encodeURIComponent(item.stockName)}`} className="inline-flex h-8 w-full items-center justify-center rounded-md border border-white/[0.09] px-3 text-[10px] text-slate-300 hover:bg-white/[0.04] md:w-20">深研</Link>
              </div>
            ))}
            {positions.length === 0 && <div className="px-5 py-10 text-center text-xs text-slate-600">尚未录入持仓。<Link href="/my-stocks" className="ml-1 text-cyan-300">去添加</Link></div>}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-700"><Clock3 className="h-3 w-3" /> 现价只接受新浪/腾讯实时源；行情失败时显示不可用，不用成本价冒充。</div>
        </section>
      </div>
    </main>
  );
}
