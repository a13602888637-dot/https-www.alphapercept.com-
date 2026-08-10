import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const OUTPUT_ROOT = join(PROJECT_ROOT, "public", "uzi-assets");
const REPORT_OUTPUT_ROOT = join(OUTPUT_ROOT, "reports");
const MANIFEST_PATH = join(OUTPUT_ROOT, "manifest.json");
const CHECK_ONLY = process.argv.includes("--check");

const uziRoot = resolve(
  process.env.UZI_SKILL_ROOT || join(homedir(), ".codex", "skills", "uzi")
);
const artifactRoot = join(
  uziRoot,
  "skills",
  "deep-analysis",
  "scripts"
);
const sourceReportsRoot = join(artifactRoot, "reports");
const sourceCacheRoot = join(artifactRoot, ".cache");

function fail(message) {
  throw new Error(`[uzi-reports] ${message}`);
}

function parseJson(path, { loose = false } = {}) {
  let text = readFileSync(path, "utf8");
  if (loose) {
    text = text.replace(
      /([:\[,]\s*)(-?Infinity|NaN)(?=\s*[,}\]])/g,
      "$1null"
    );
  }
  return JSON.parse(text);
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function countMatches(text, pattern) {
  return text.match(pattern)?.length ?? 0;
}

function formatReportDate(compactDate) {
  return `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6, 8)}`;
}

function withShanghaiOffset(value) {
  if (!value) return null;
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)) return value;
  return `${value}+08:00`;
}

function qualityStatus(review) {
  if (!review) return "unknown";
  if (!review.passed || Number(review.critical_count) > 0) return "fail";
  if (Number(review.warning_count) > 0) return "warning";
  return "pass";
}

function dimensionQuality(rawData) {
  const dimensions = Object.values(rawData?.dimensions ?? {});
  const counts = {
    total: dimensions.length,
    full: 0,
    partial: 0,
    missingMarker: 0,
    dataGapCount: 0,
  };

  for (const dimension of dimensions) {
    const pipeline = dimension?._pipeline;
    if (pipeline?.quality === "full") counts.full += 1;
    else if (pipeline?.quality === "partial") counts.partial += 1;
    else counts.missingMarker += 1;
    counts.dataGapCount += Array.isArray(pipeline?.data_gaps)
      ? pipeline.data_gaps.length
      : 0;
  }

  return counts;
}

function safeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function validateHtml(html, sourcePath) {
  const byteSize = Buffer.byteLength(html);
  const seatCount = countMatches(
    html,
    /class="seat (?:bullish|neutral|bearish|skip)"/g
  );
  const chatCount = countMatches(
    html,
    /class="chat-msg (?:bullish|neutral|bearish|skip)"/g
  );
  const sections = {
    jury: html.includes('id="section-jury"'),
    chat: html.includes('id="section-chat"'),
    schoolScores: html.includes("school-scores"),
  };

  if (byteSize < 400_000) {
    fail(`${sourcePath} 仅 ${byteSize} bytes，低于完整报告门槛`);
  }
  if (seatCount < 60 || chatCount < 60) {
    fail(`${sourcePath} 评委席/群聊不完整 (${seatCount}/${chatCount})`);
  }
  if (!Object.values(sections).every(Boolean)) {
    fail(`${sourcePath} 缺少 jury/chat/school-scores 章节`);
  }

  return { byteSize, seatCount, chatCount, sections };
}

function hardenForSandbox(sourceHtml) {
  const storageShim = `
  const uziSafeStorage = {
    getItem(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
    setItem(key, value) { try { window.localStorage.setItem(key, value); } catch {} }
  };
`;

  let hardened = sourceHtml
    .replace(/<link\b[^>]*href=["']https:\/\/fonts\.googleapis\.com[^>]*>\s*/gi, "")
    .replace(/<link\b[^>]*href=["']https:\/\/fonts\.gstatic\.com[^>]*>\s*/gi, "")
    .replace(/<path\b[^>]*\bd=["'][^"']*\bnan\b[^"']*["'][^>]*\/?>(?:<\/path>)?/gi, "")
    .replace(/<circle\b[^>]*(?:\bcx|\bcy)=["']nan["'][^>]*\/?>(?:<\/circle>)?/gi, "")
    .replace(/→\s*nan\b/gi, "→ 数据不足")
    .replace(/localStorage\./g, "uziSafeStorage.");
  const scriptStart = hardened.indexOf("<script>");
  if (scriptStart === -1) fail("standalone HTML 未找到内联脚本");
  const insertAt = scriptStart + "<script>".length;
  hardened = `${hardened.slice(0, insertAt)}${storageShim}${hardened.slice(insertAt)}`;
  return hardened.replace(/[ \t]+$/gm, "");
}

function writeAtomically(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.tmp`;
  writeFileSync(tempPath, content);
  renameSync(tempPath, path);
}

function extractReport(reportDirName) {
  const match = /^([A-Za-z0-9.^=-]+)_(\d{8})$/.exec(reportDirName);
  if (!match) return null;

  const [, tickerFromDir, compactDate] = match;
  const reportDir = join(sourceReportsRoot, reportDirName);
  const standalonePath = join(reportDir, "full-report-standalone.html");
  const cacheDir = join(sourceCacheRoot, tickerFromDir);
  const synthesisPath = join(cacheDir, "synthesis.json");
  const panelPath = join(cacheDir, "panel.json");
  const rawDataPath = join(cacheDir, "raw_data.json");
  const reviewPath = join(cacheDir, "_review_issues.json");

  if (
    !existsSync(standalonePath) ||
    !existsSync(synthesisPath) ||
    !existsSync(panelPath) ||
    !existsSync(rawDataPath)
  ) {
    return null;
  }

  const synthesis = parseJson(synthesisPath);
  const panel = parseJson(panelPath);
  const rawData = parseJson(rawDataPath, { loose: true });
  const review = existsSync(reviewPath) ? parseJson(reviewPath) : null;
  const sourceHtml = readFileSync(standalonePath, "utf8");
  const sourceValidation = validateHtml(sourceHtml, standalonePath);
  const hardenedHtml = hardenForSandbox(sourceHtml);

  const ticker = String(synthesis.ticker || tickerFromDir).toUpperCase();
  if (ticker !== tickerFromDir.toUpperCase()) {
    fail(`${reportDirName} 与 synthesis ticker ${ticker} 不一致`);
  }

  const reportDate = formatReportDate(compactDate);
  const reportId = `${ticker}_${compactDate}`;
  const deployedFileName = `${reportId}.html`;
  const outputPath = join(REPORT_OUTPUT_ROOT, deployedFileName);
  const reportPath = `/uzi-assets/reports/${deployedFileName}`;
  const code = String(rawData.code || ticker.split(".")[0]);
  const basic = rawData.dimensions?.["0_basic"]?.data ?? {};
  const candles = rawData.dimensions?.["2_kline"]?.data?.candles_60d;
  const latestCandle = Array.isArray(candles) ? candles.at(-1) : null;
  const signals = panel.signal_distribution ?? {};
  const voteDistribution = panel.vote_distribution ?? {};
  const score = safeNumber(synthesis.overall_score);
  const conclusion = synthesis.dashboard?.core_conclusion ?? "";
  const consistencyWarnings = [];
  const conclusionScore = conclusion.match(/(?:·|^)\s*(\d+(?:\.\d+)?)\s*分/);
  if (
    score !== null &&
    conclusionScore &&
    Math.abs(Number(conclusionScore[1]) - score) >= 0.5
  ) {
    consistencyWarnings.push("score_text_mismatch");
  }

  const schools = Object.entries(panel.school_scores ?? {}).map(
    ([id, school]) => ({
      id,
      label: school.label ?? id,
      consensus: safeNumber(school.consensus),
      verdict: school.verdict ?? "—",
      bullish: Number(school.bullish ?? 0),
      neutral: Number(school.neutral ?? 0),
      bearish: Number(school.bearish ?? 0),
      skip: Number(school.skip ?? 0),
    })
  );

  writeAtomically(outputPath, hardenedHtml);
  const deployedValidation = validateHtml(hardenedHtml, outputPath);

  return {
    id: reportId,
    ticker,
    stockCode: code,
    market: String(rawData.market || ticker.split(".")[1] || "unknown"),
    name: String(synthesis.name || basic.name || ticker),
    reportDate,
    reportGeneratedAt: withShanghaiOffset(review?.reviewed_at),
    price: safeNumber(basic.price),
    priceAsOf: latestCandle?.date ?? null,
    priceSource: safeNumber(basic.price) !== null ? "basic" : "unavailable",
    overallScore: score,
    verdict: String(synthesis.verdict_label || "待研判"),
    verdictDetail: String(synthesis.verdict_detail || ""),
    conclusion: String(conclusion),
    fundamentalScore: safeNumber(synthesis.fundamental_score),
    panelConsensus: safeNumber(synthesis.panel_consensus),
    agentReviewed: synthesis.agent_reviewed === true,
    reviewStatus: synthesis.agent_reviewed === true ? "agent-reviewed" : "mechanical",
    quality: {
      status: qualityStatus(review),
      selfReview: review
        ? {
            passed: review.passed === true,
            criticalCount: Number(review.critical_count ?? 0),
            warningCount: Number(review.warning_count ?? 0),
            infoCount: Number(review.info_count ?? 0),
            checksRun: Array.isArray(review.checks_run)
              ? review.checks_run.length
              : 0,
          }
        : null,
      dimensions: dimensionQuality(rawData),
      consistencyWarnings,
    },
    trend: synthesis.dashboard?.data_perspective?.trend ?? "—",
    battlePlan: {
      entry: synthesis.dashboard?.battle_plan?.entry ?? "—",
      stop: synthesis.dashboard?.battle_plan?.stop ?? "—",
      target: synthesis.dashboard?.battle_plan?.target ?? "—",
      position: synthesis.dashboard?.battle_plan?.position ?? "—",
    },
    signals: {
      bullish: Number(signals.bullish ?? 0),
      neutral: Number(signals.neutral ?? 0),
      bearish: Number(signals.bearish ?? 0),
      skip: Number(signals.skip ?? 0),
    },
    votes: {
      stronglyBuy: Number(voteDistribution.strongly_buy ?? 0),
      buy: Number(voteDistribution.buy ?? 0),
      watch: Number(voteDistribution.watch ?? 0),
      wait: Number(voteDistribution.wait ?? 0),
      avoid: Number(voteDistribution.avoid ?? 0),
      skip: Number(voteDistribution.skip ?? 0),
    },
    schools,
    panelSize:
      Number(signals.bullish ?? 0) +
      Number(signals.neutral ?? 0) +
      Number(signals.bearish ?? 0) +
      Number(signals.skip ?? 0),
    reportPath,
    sourceSha256: sha256(sourceHtml),
    deployedSha256: sha256(hardenedHtml),
    fileSize: deployedValidation.byteSize,
    validation: {
      seats: deployedValidation.seatCount,
      chatMessages: deployedValidation.chatCount,
      sections: deployedValidation.sections,
      sourceFileSize: sourceValidation.byteSize,
      sandboxStorageShim: true,
    },
  };
}

function verifyPublishedManifest() {
  if (!existsSync(MANIFEST_PATH)) fail("manifest.json 不存在，请先执行同步");
  const manifest = parseJson(MANIFEST_PATH);
  if (manifest.schemaVersion !== "uzi-report-manifest/v1") {
    fail("manifest schemaVersion 不受支持");
  }
  if (!Array.isArray(manifest.reports) || manifest.reports.length === 0) {
    fail("manifest 没有已注册报告");
  }

  for (const report of manifest.reports) {
    if (!/^\/uzi-assets\/reports\/[A-Za-z0-9.^=_-]+\.html$/.test(report.reportPath)) {
      fail(`非法 reportPath: ${report.reportPath}`);
    }
    const filePath = join(PROJECT_ROOT, "public", report.reportPath.slice(1));
    if (!existsSync(filePath)) fail(`缺少已发布报告: ${filePath}`);
    const html = readFileSync(filePath, "utf8");
    const validation = validateHtml(html, filePath);
    if (sha256(html) !== report.deployedSha256) {
      fail(`${basename(filePath)} SHA-256 与 manifest 不一致`);
    }
    if (!html.includes("const uziSafeStorage")) {
      fail(`${basename(filePath)} 缺少 sandbox storage shim`);
    }
    if (validation.byteSize !== report.fileSize) {
      fail(`${basename(filePath)} 文件大小与 manifest 不一致`);
    }
  }

  console.log(`[uzi-reports] 验证通过：${manifest.reports.length} 份报告`);
}

if (CHECK_ONLY) {
  verifyPublishedManifest();
} else {
  if (!existsSync(sourceReportsRoot) || !existsSync(sourceCacheRoot)) {
    fail(`Uzi 产物目录不存在: ${artifactRoot}`);
  }

  mkdirSync(REPORT_OUTPUT_ROOT, { recursive: true });
  const reports = readdirSync(sourceReportsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => extractReport(entry.name))
    .filter(Boolean)
    .sort(
      (a, b) =>
        b.reportDate.localeCompare(a.reportDate) ||
        a.ticker.localeCompare(b.ticker)
    );

  if (reports.length === 0) fail("没有找到可注册的 Uzi standalone 报告");

  const newestGeneratedAt = reports
    .map((report) => report.reportGeneratedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  const manifest = {
    schemaVersion: "uzi-report-manifest/v1",
    syncedAt: newestGeneratedAt ?? new Date().toISOString(),
    reportCount: reports.length,
    reports,
  };

  writeAtomically(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  verifyPublishedManifest();
  console.log(`[uzi-reports] 已同步到 ${OUTPUT_ROOT}`);
}
