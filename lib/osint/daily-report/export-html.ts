import type {
  DailyReportExportSection,
  OsintDailyReportSnapshot,
} from "./contracts";

export const DAILY_REPORT_WATERMARK = "AlphaPercept · 仅供参考";
export const DAILY_REPORT_DISCLAIMER =
  "本报告基于公开信息自动整理，仅供学习与复盘参考，不构成投资建议或任何买卖依据。数据可能延迟或存在误差，请以交易所、上市公司及原始来源为准。";

export function hasRequiredExportNotices(html: string): boolean {
  const watermarkRule = html.match(/\.watermark\{([^}]*)\}/)?.[1] ?? "";
  const disclaimerRule = html.match(/\.report-disclaimer\{([^}]*)\}/)?.[1] ?? "";
  return (
    html.includes(DAILY_REPORT_WATERMARK) &&
    html.includes(DAILY_REPORT_DISCLAIMER) &&
    html.includes("class=\"watermark\"") &&
    html.includes("class=\"print-footer\"") &&
    watermarkRule.includes("z-index:9999") &&
    !/display\s*:\s*none/i.test(watermarkRule) &&
    !/display\s*:\s*none/i.test(disclaimerRule)
  );
}

export function isDailyReportExportReady(
  report: OsintDailyReportSnapshot
): boolean {
  return (["full", "markets", "stories", "lhb"] as const).every((section) =>
    hasRequiredExportNotices(buildDailyReportHtml(report, section))
  );
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatShanghaiTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });
}

function marketSection(report: OsintDailyReportSnapshot): string {
  const rows = report.markets.markets
    .map((market) => {
      const change = market.changePercent;
      const direction = change === null ? "muted" : change >= 0 ? "up" : "down";
      return `<tr>
        <td><strong>${escapeHtml(market.name)}</strong><small>${escapeHtml(market.symbol)}</small></td>
        <td>${formatNumber(market.value, market.instrumentType === "fx" ? 4 : 2)}${market.instrumentType === "yield" ? "%" : ""}</td>
        <td class="${direction}">${change === null ? "—" : `${change >= 0 ? "+" : ""}${formatNumber(change)}%`}</td>
        <td><span class="badge">${escapeHtml(market.status)}</span> ${escapeHtml(market.source)}</td>
      </tr>`;
    })
    .join("");
  return `<section><h2>全球行情</h2><p class="section-meta">覆盖 ${report.markets.coverage.available}/${report.markets.coverage.total}，陈旧 ${report.markets.coverage.stale}</p><div class="table-wrap"><table><thead><tr><th>指标</th><th>最新</th><th>涨跌</th><th>来源</th></tr></thead><tbody>${rows || '<tr><td colspan="4">暂无行情</td></tr>'}</tbody></table></div></section>`;
}

function storySection(report: OsintDailyReportSnapshot): string {
  const cards = report.stories.stories
    .map(
      (story) => `<article class="card">
        <div class="card-head"><time>${escapeHtml(formatShanghaiTime(story.publishedAt))}</time><strong>重要度 ${formatNumber(story.importance, 1)}/10</strong></div>
        <h3>${escapeHtml(story.title)}</h3>
        <p>${escapeHtml(story.summary)}</p>
        <div class="tags">${[...story.tags.topic, ...story.tags.region, ...story.tags.assets]
          .slice(0, 8)
          .map((tag) => `<span>${escapeHtml(tag)}</span>`)
          .join("")}</div>
        <p class="source">${story.sources.map((source) => `<a href="${escapeHtml(source.url)}">${escapeHtml(source.name)}</a>`).join(" · ")}</p>
      </article>`
    )
    .join("");
  return `<section><h2>世界热点</h2><p class="advice">一句建议：${escapeHtml(report.stories.advice.text || "暂无明确建议")}</p>${cards || '<p class="empty">暂无热点</p>'}</section>`;
}

function lhbSection(report: OsintDailyReportSnapshot): string {
  const seats = report.lhb.hotMoneyFlows
    .slice(0, 30)
    .map((flow) => {
      const stocks = flow.stocks.slice(0, 3).map((stock) => `<li><strong>${escapeHtml(stock.name)}</strong> <small>${escapeHtml(stock.code)}</small><span>买 ${formatNumber(stock.buyAmount / 10_000, 0)} 万 · 卖 ${formatNumber(stock.sellAmount / 10_000, 0)} 万</span></li>`).join("");
      const more = flow.stockCount > flow.stocks.length ? `<p class="source">另有 ${flow.stockCount - flow.stocks.length} 只买入股票</p>` : "";
      return `<article class="card seat-card"><div class="card-head"><h3>${escapeHtml(flow.label)}</h3><strong>${flow.kind === "known" ? `观察可信度 ${escapeHtml(flow.confidence ?? "C")}` : "活跃席位"}</strong></div><p>买入 ${formatNumber(flow.totalBuyAmount / 10_000, 0)} 万 · 卖出 ${formatNumber(flow.totalSellAmount / 10_000, 0)} 万 · 净额 ${formatNumber(flow.totalNetAmount / 10_000, 0)} 万</p><ul>${stocks}</ul>${more}</article>`;
    })
    .join("");
  return `<section><h2>资金龙虎榜</h2><p class="section-meta">交易日 ${escapeHtml(report.lhb.tradeDate || "暂无")} · ${report.lhb.hotMoneyFlows.length} 组游资/活跃席位 · 状态 ${escapeHtml(report.lhb.status)}</p>${seats || '<p class="empty">暂无游资或活跃席位</p>'}<p class="disclaimer">${escapeHtml(report.lhb.disclaimer)}</p></section>`;
}

export function buildDailyReportHtml(
  report: OsintDailyReportSnapshot,
  section: DailyReportExportSection,
  options: { autoPrint?: boolean } = {}
): string {
  const sections = [
    section === "full" || section === "markets" ? marketSection(report) : "",
    section === "full" || section === "stories" ? storySection(report) : "",
    section === "full" || section === "lhb" ? lhbSection(report) : "",
  ].join("");
  const autoPrint = options.autoPrint
    ? '<script>window.addEventListener("load",()=>window.setTimeout(()=>window.print(),150));</script>'
    : "";

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(report.title)}</title><style>
  :root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f4f7fa;color:#17202c;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}main{max-width:980px;margin:0 auto;padding:24px;position:relative;z-index:1}header,section{background:#fff;border:1px solid #dce3eb;border-radius:12px;padding:20px;margin-bottom:16px}h1{font-size:24px;margin:0 0 6px}h2{font-size:19px;margin:0 0 8px}h3{font-size:16px;margin:6px 0}p{margin:4px 0}.meta,.section-meta,.source,.disclaimer{color:#667386;font-size:13px}.advice{padding:12px;border-left:4px solid #d99b22;background:#fff8e8;margin:12px 0}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:620px}th,td{padding:10px 8px;border-bottom:1px solid #e6ebf0;text-align:left;vertical-align:top}th{color:#667386;font-size:13px}td small{display:block;color:#7a8798}.up{color:#c43f3f}.down{color:#138454}.muted{color:#7a8798}.badge,.tags span{display:inline-block;border:1px solid #ced7e2;border-radius:999px;padding:1px 7px;color:#526174;font-size:12px}.card{border-top:1px solid #e6ebf0;padding:14px 0}.card-head{display:flex;justify-content:space-between;color:#667386;font-size:12px}.seat-card ul{list-style:none;margin:8px 0 0;padding:0}.seat-card li{display:grid;grid-template-columns:1fr auto;gap:8px;padding:5px 0;border-top:1px solid #eef2f6}.seat-card li span{font-size:12px;color:#667386}.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.source a{color:#126b78}.empty{color:#7a8798}.watermark{position:fixed;inset:45% auto auto 50%;z-index:9999;transform:translate(-50%,-50%) rotate(-24deg);font-size:42px;font-weight:700;letter-spacing:5px;color:rgba(34,67,84,.075);white-space:nowrap;pointer-events:none;mix-blend-mode:multiply}.report-disclaimer{margin-top:20px;padding:14px;border-top:1px solid #dce3eb;color:#667386;font-size:13px}.print-footer{display:none}@media(max-width:640px){main{padding:12px}header,section{border-radius:8px;padding:16px}h1{font-size:21px}body{font-size:16px}.seat-card li{grid-template-columns:1fr}.watermark{font-size:26px}}@media print{body{background:#fff;font-size:11pt}main{max-width:none;padding:0}header,section{border:0;border-radius:0;padding:0;margin:0 0 14mm}header{break-inside:avoid}section{break-inside:auto}.card{break-inside:avoid}a{color:inherit;text-decoration:none}.watermark{position:fixed;inset:45% auto auto 50%;display:block;color:rgba(34,67,84,.09)}.print-footer{display:block;position:fixed;left:13mm;right:13mm;bottom:5mm;z-index:9999;border-top:1px solid #ccd5df;padding-top:2mm;color:#667386;font-size:8pt}.report-disclaimer{break-inside:avoid}@page{size:A4;margin:13mm 13mm 45mm}}
  </style></head><body><div class="watermark" aria-hidden="true">${escapeHtml(DAILY_REPORT_WATERMARK)}</div><main><header><h1>${escapeHtml(report.title)}</h1><p class="meta">数据截至 ${escapeHtml(formatShanghaiTime(report.asOf))} · 生成于 ${escapeHtml(formatShanghaiTime(report.generatedAt))} · 归档快照，不代表实时行情</p></header>${sections}<aside class="report-disclaimer">${escapeHtml(DAILY_REPORT_DISCLAIMER)}</aside></main><footer class="print-footer">${escapeHtml(DAILY_REPORT_DISCLAIMER)}</footer>${autoPrint}</body></html>`;
}
