import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

const topNav = read("components/layout/TopNavBar.tsx");
assert.equal(topNav.includes('label: "今日"'), false);
assert.equal(topNav.includes('{ href: "/uzi-reports", label: "深度研究"'), true);
assert.equal(topNav.includes('<Link href="/uzi-reports"'), true);
assert.equal(topNav.includes('forceRedirectUrl="/uzi-reports"'), true);

for (const route of ["app/page.tsx", "app/dashboard/page.tsx"]) {
  const source = read(route);
  assert.equal(source.includes('redirect("/uzi-reports")'), true);
  assert.equal(source.includes("PersonalInvestmentAssistant"), false);
}

const reportsPage = read("app/uzi-reports/page.tsx");
assert.equal(reportsPage.includes("getOwnedUziReports"), true);
assert.equal(reportsPage.includes("requireResearchUserId"), true);
assert.equal(reportsPage.includes("reports={uziReports}"), false);

const access = read("lib/uzi/report-access.ts");
assert.equal(access.includes("getOwnedUziReports"), true);
assert.equal(access.includes("getOwnedUziReport"), true);
assert.equal(access.includes("clerkUserId"), true);
assert.equal(access.includes("publicReportId"), true);
assert.match(access, /status:\s*"SUCCEEDED"/);

const serverReports = read("lib/uzi-reports.ts");
assert.equal(serverReports.includes('import "server-only"'), true);
const reportTypes = read("lib/uzi/report-types.ts");
assert.equal(reportTypes.includes("manifest.json"), false);
assert.equal(reportTypes.includes("getUziReportViewerPath"), true);

const detailPage = read("app/uzi-reports/[reportId]/page.tsx");
assert.equal(detailPage.includes("getOwnedUziReport"), true);
assert.equal(detailPage.includes("requireResearchUserId"), true);
assert.equal(detailPage.includes("report.reportPath"), false);
assert.equal(detailPage.includes("/api/uzi/reports/"), true);

const contentRoutePath = "app/api/uzi/reports/[reportId]/content/route.ts";
assert.equal(existsSync(resolve(contentRoutePath)), true);
const contentRoute = read(contentRoutePath);
assert.equal(contentRoute.includes("getOwnedUziReport"), true);
assert.equal(contentRoute.includes("getAuthUserId"), true);
assert.equal(contentRoute.includes("readFile"), true);
assert.equal(contentRoute.includes('"Content-Type": "text/html; charset=utf-8"'), true);
assert.equal(contentRoute.includes('"Cache-Control": "private, no-store"'), true);
for (const sandboxPolicy of ["sandbox allow-scripts allow-popups", "base-uri 'none'", "form-action 'none'"]) {
  assert.equal(contentRoute.includes(sandboxPolicy), true);
}

const middleware = read("middleware.ts");
assert.equal(middleware.includes('startsWith("/uzi-assets/")'), true);
assert.equal(middleware.includes("status: 404"), true);
assert.equal(middleware.includes('"/uzi-assets/(.*)"'), true);
assert.equal(middleware.includes('pathname === "/dashboard"'), true);
assert.equal(middleware.includes('NextResponse.redirect(new URL("/uzi-reports"'), true);
assert.equal(middleware.includes("auth.protect"), false);

const workerManifestRoutePath = "app/api/uzi/worker/report-manifest/route.ts";
assert.equal(existsSync(resolve(workerManifestRoutePath)), true);
const workerManifestRoute = read(workerManifestRoutePath);
assert.equal(workerManifestRoute.includes("isAuthorizedUziWorker"), true);
assert.equal(workerManifestRoute.includes("uziReportManifest"), true);
const worker = read("scripts/uzi-local-worker.mjs");
assert.equal(worker.includes('api("/api/uzi/worker/report-manifest")'), true);
assert.equal(worker.includes("/uzi-assets/manifest.json?publish="), false);

const nextConfig = read("next.config.js");
assert.equal(nextConfig.includes("'/api/uzi/reports/[reportId]/content'"), true);
assert.equal(nextConfig.includes("'./public/uzi-assets/reports/*.html'"), true);

const workbench = read("components/uzi/UziResearchWorkbench.tsx");
assert.equal(workbench.includes("max-w-[1600px]"), false);
assert.equal(workbench.includes("max-w-[1920px]"), false);
assert.equal(workbench.includes("w-full"), true);
for (const osintToken of ["bg-[#070B12]", "bg-[#080E17]", "border-[#1F2A3A]", "text-[#D6DEE8]", "text-[#718096]", "text-[#2EC4C7]"]) {
  assert.equal(workbench.includes(osintToken), true);
}
for (const removedCopy of ["今日决策队列", "持仓快照", "持仓快找", "我的持仓", "公开市场研究 · 不含账户数据"]) {
  assert.equal(workbench.includes(removedCopy), false);
}
assert.equal(workbench.includes("loadPositions"), false);
assert.equal(workbench.includes("我的研究报告"), true);
assert.equal(workbench.includes('@/lib/uzi/report-types'), true);
assert.equal(workbench.includes('@/lib/uzi-reports'), false);

for (const legacySurface of [
  "app/stocks/[code]/page.tsx",
  "app/my-stocks/page.tsx",
  "components/my-stocks/PositionTable.tsx",
  "components/dashboard/AssetDetailView.tsx",
]) {
  const source = read(legacySurface);
  assert.equal(source.includes("findLatestUziReport"), false, `${legacySurface} leaks the global report registry`);
  assert.equal(source.includes("getUziReportViewerPath"), false, `${legacySurface} links reports without ownership context`);
}

console.log("PRIVATE_RESEARCH_SURFACE_OK");
