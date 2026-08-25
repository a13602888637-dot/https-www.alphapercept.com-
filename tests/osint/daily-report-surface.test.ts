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
assert.match(migrations, /CREATE TABLE "OsintDailyReport"/);
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
assert.equal(generateRoute.includes("auth()"), true);
assert.equal(generateRoute.includes("CRON_SECRET"), true);
assert.equal(generateRoute.includes("OSINT_REPORT_ADMIN_USER_IDS"), true);
assert.equal(detailRoute.includes("getDailyReport"), true);
assert.equal(exportRoute.includes("hasRequiredExportNotices"), true);
assert.equal(exportRoute.includes("text/html; charset=utf-8"), true);

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
assert.equal(view.includes("text-base"), true);
assert.equal(view.includes("snapshot.lhb.hotMoneyFlows"), true);
assert.equal(view.includes("另有"), true);
for (const viewLabel of ["综合", "行情", "热点", "游资"]) {
  assert.equal(view.includes(viewLabel), true);
}
assert.equal(printActions.includes("fixed inset-x-3 bottom-3"), true);
for (const section of ["full", "markets", "stories", "lhb"]) {
  assert.equal(printActions.includes(`section: "${section}"`), true);
}
assert.equal(printActions.includes("disabled={!exportReady}"), true);
assert.equal(printActions.includes("window.open"), true);

const exportHtml = read("lib/osint/daily-report/export-html.ts");
assert.equal(exportHtml.includes("z-index:9999"), true);
assert.equal(exportHtml.includes("section{break-inside:auto}"), true);
assert.equal(exportHtml.includes("45mm"), true);
assert.doesNotMatch(exportHtml, /\.watermark\{[^}]*display:none/);
assert.doesNotMatch(exportHtml, /\.report-disclaimer\{[^}]*display:none/);

assert.equal(existsSync(resolve("app/osint/reports/page.tsx")), true);
assert.equal(existsSync(resolve("app/osint/reports/[reportId]/page.tsx")), true);

console.log("DAILY_REPORT_SURFACE_OK");
