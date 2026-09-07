#!/usr/bin/env node

import { pathToFileURL } from "node:url";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function readPngDimensions(input) {
  const bytes = Buffer.from(input);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("INVALID_PNG");
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function shanghaiDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function readJson(response, errorCode) {
  if (!response.ok) throw new Error(`${errorCode}:HTTP_${response.status}`);
  return response.json();
}

export async function probeCloseReport({
  baseUrl = "https://www.alphapercept.com",
  reportDate = shanghaiDateKey(),
  fetchImpl = fetch,
} = {}) {
  const listUrl = new URL("/api/osint/v1/reports?limit=8", baseUrl);
  const list = await readJson(await fetchImpl(listUrl), "REPORT_LIST_FAILED");
  const report = (Array.isArray(list.reports) ? list.reports : []).find(
    (candidate) => candidate.reportDate === reportDate && candidate.edition === "close"
  );
  if (!report) throw new Error(`REPORT_MISSING:${reportDate}`);
  if (report.status !== "healthy") {
    throw new Error(`REPORT_NOT_HEALTHY:${report.status || "unknown"}`);
  }

  const detailUrl = new URL(
    `/api/osint/v1/reports/${encodeURIComponent(report.id)}`,
    baseUrl
  );
  const detail = await readJson(await fetchImpl(detailUrl), "REPORT_DETAIL_FAILED");
  if (!detail.exportReady) throw new Error("REPORT_EXPORT_NOT_READY");
  if (detail.report?.snapshot?.lhb?.status !== "live") {
    throw new Error("REPORT_LHB_NOT_LIVE");
  }
  if (detail.report?.snapshot?.lhb?.tradeDate !== reportDate) {
    throw new Error(`REPORT_LHB_STALE:${detail.report?.snapshot?.lhb?.tradeDate || "missing"}`);
  }

  const exports = {};
  for (const section of ["stories", "hotlist"]) {
    const exportUrl = new URL(
      `/api/osint/v1/reports/${encodeURIComponent(report.id)}/export`,
      baseUrl
    );
    exportUrl.searchParams.set("section", section);
    exportUrl.searchParams.set("layout", "tiktok-v2");
    const response = await fetchImpl(exportUrl);
    if (!response.ok) throw new Error(`REPORT_EXPORT_FAILED:${section}:HTTP_${response.status}`);
    if (!response.headers.get("content-type")?.startsWith("image/png")) {
      throw new Error(`REPORT_EXPORT_INVALID_TYPE:${section}`);
    }
    const dimensions = readPngDimensions(Buffer.from(await response.arrayBuffer()));
    if (dimensions.width !== 1080 || dimensions.height !== 1920) {
      throw new Error(
        `REPORT_EXPORT_INVALID_SIZE:${section}:${dimensions.width}x${dimensions.height}`
      );
    }
    exports[section] = dimensions;
  }

  return {
    ok: true,
    reportDate,
    reportId: report.id,
    status: report.status,
    exports,
  };
}

function cliArgument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  probeCloseReport({
    baseUrl: cliArgument("base-url") || process.env.ALPHAPERCEPT_BASE_URL,
    reportDate: cliArgument("date"),
  })
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      }));
      process.exitCode = 1;
    });
}
