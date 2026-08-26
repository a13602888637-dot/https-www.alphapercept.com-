import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

function read(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

const schema = read("prisma/schema.prisma");
assert.match(schema, /model OsintDailyReport\s*\{/);
for (const field of ["reportDate", "edition", "version", "status", "payload", "generatedAt", "finalizedAt"]) {
  assert.equal(schema.includes(field), true);
}
assert.match(schema, /@@unique\(\[reportDate, edition, version\]\)/);

const migrationFiles = readdirSync(resolve("prisma/migrations"), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => resolve("prisma/migrations", entry.name, "migration.sql"))
  .filter(existsSync);
const migrations = migrationFiles.map((path) => readFileSync(path, "utf8")).join("\n");
assert.match(migrations, /CREATE TABLE IF NOT EXISTS "OsintDailyReport"/);
assert.match(migrations, /"payload" JSONB NOT NULL/);
assert.match(migrations, /"edition" TEXT NOT NULL/);
assert.match(migrations, /"version" INTEGER NOT NULL/);

const service = read("lib/osint/daily-report/service.ts");
for (const dependency of [
  "getMarketSnapshot",
  "getStorySnapshot",
  "getLhbSnapshot",
  "Promise.all",
]) {
  assert.equal(service.includes(dependency), true);
}

const listRoute = read("app/api/osint/v1/reports/route.ts");
const generateRoute = read("app/api/osint/v1/reports/generate/route.ts");
const detailRoute = read("app/api/osint/v1/reports/[reportId]/route.ts");
const exportRoute = read("app/api/osint/v1/reports/[reportId]/export/route.ts");
assert.equal(listRoute.includes("listDailyReports"), true);
assert.equal(generateRoute.includes("generateAndSaveDailyReport"), true);
assert.equal(generateRoute.includes("CRON_SECRET"), true);
assert.equal(generateRoute.includes("currentUser"), false);
assert.equal(generateRoute.includes("export async function POST"), false);
assert.equal(generateRoute.includes("previousShanghaiDate"), true);
assert.equal(detailRoute.includes("getDailyReport"), true);
assert.equal(detailRoute.includes("isDailyReportPdfReady"), true);
assert.equal(detailRoute.includes("isDailyReportExportReady"), false);
assert.equal(exportRoute.includes("buildDailyReportPdf"), true);
assert.equal(exportRoute.includes("application/pdf"), true);
assert.equal(exportRoute.includes("attachment;"), true);
assert.equal(exportRoute.includes(".pdf"), true);
assert.equal(exportRoute.includes("text/html; charset=utf-8"), false);
assert.equal(exportRoute.includes("autoPrint"), false);
assert.equal(exportRoute.includes('"markets"'), false);
assert.equal(exportRoute.includes("pdfPromiseCache"), true);
assert.equal(exportRoute.includes("s-maxage=31536000"), true);
assert.equal(exportRoute.includes("immutable"), true);

for (const routeSource of [listRoute, generateRoute, detailRoute, exportRoute]) {
  assert.equal(/watchlist|portfolio|personalNote/i.test(routeSource), false);
}

const center = read("components/osint-reports/DailyReportCenter.tsx");
const view = read("components/osint-reports/DailyReportView.tsx");
const printActions = read("components/osint-reports/PrintActions.tsx");
assert.equal(center.includes("日复盘"), true);
assert.equal(center.includes("周复盘"), true);
assert.equal(center.includes("月复盘"), true);
assert.equal(center.includes("text-base"), true);
assert.equal(center.includes("生成今日复盘"), false);
assert.equal(center.includes("后台每日自动归档"), true);
assert.equal(center.includes("max-w-4xl"), false);
assert.equal(center.includes("selectedReportId"), true);
assert.equal(center.includes("DailyReportView"), true);
assert.equal(center.includes("报告直接预览"), true);
assert.equal(center.includes("个股 {report.lhbStockCount}"), true);
assert.equal(center.includes("游资 {report.lhbHotMoneyCount}"), true);
assert.equal(center.includes("行情 {report.marketAvailable}"), false);
assert.equal(view.includes("text-base"), true);
assert.equal(view.includes("embedded"), true);
assert.equal(view.includes("snapshot.lhb.hotMoneyFlows"), true);
assert.equal(view.includes("另有"), true);
for (const viewLabel of ["热点", "个股资金", "游资"]) {
  assert.equal(view.includes(viewLabel), true);
}
assert.equal(view.includes('{ value: "markets"'), false);
assert.equal(printActions.includes("fixed inset-x-3 bottom-3"), true);
for (const section of ["full", "stories", "stocks", "lhb"]) {
  assert.equal(printActions.includes(`section: "${section}"`), true);
}
assert.equal(printActions.includes('section: "markets"'), false);
assert.equal(printActions.includes("disabled={!exportReady}"), true);
assert.equal(printActions.includes("window.open"), false);
assert.equal(printActions.includes("download"), true);
assert.equal(printActions.includes("print=1"), false);

const exportHtml = read("lib/osint/daily-report/export-html.ts");
const pdfExport = read("lib/osint/daily-report/pdf-export.ts");
const nextConfig = read("next.config.js");
assert.equal(exportHtml.includes("z-index:9999"), true);
assert.equal(exportHtml.includes("section{break-inside:auto}"), true);
assert.equal(exportHtml.includes("45mm"), true);
assert.doesNotMatch(exportHtml, /\.watermark\{[^}]*display:none/);
assert.doesNotMatch(exportHtml, /\.report-disclaimer\{[^}]*display:none/);
assert.ok(pdfExport.indexOf("drawLegalPanel(doc, report);") < pdfExport.indexOf('if (section === "full" || section === "stories")'));
assert.equal(pdfExport.includes("hotMoneyFlows.slice(0, 28)"), true);
assert.equal(nextConfig.includes("serverExternalPackages: ['pdfkit']"), true);
assert.equal(nextConfig.includes("./node_modules/pdfkit/js/standard-fonts/**/*"), true);

assert.equal(existsSync(resolve("app/osint/reports/page.tsx")), true);
assert.equal(existsSync(resolve("app/osint/reports/[reportId]/page.tsx")), true);

const vercelConfig = JSON.parse(read("vercel.json"));
assert.equal(vercelConfig.crons.some((cron: { path: string; schedule: string }) => cron.path === "/api/osint/v1/reports/generate?edition=close" && cron.schedule === "0 8 * * 1-5"), true);
assert.equal(vercelConfig.crons.some((cron: { path: string; schedule: string }) => cron.path === "/api/osint/v1/reports/generate?edition=global" && cron.schedule === "15 0 * * 2-6"), true);

console.log("DAILY_REPORT_SURFACE_OK");
