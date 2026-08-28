import "server-only";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { OsintDailyReportSnapshot } from "./contracts";
import { DAILY_REPORT_DISCLAIMER, DAILY_REPORT_WATERMARK } from "./export-html";

export const DAILY_REPORT_IMAGE_FONT_ASSET =
  "lib/osint/daily-report/assets/NotoSansSC-Medium-static.ttf";
export const DAILY_REPORT_IMAGE_FONT_SHA256 =
  "38131c0e1f49af40cba9aebc9856d4dea11032223268006526d48d623414c468";

let fontReady: boolean | null = null;

function isImageFontReady(): boolean {
  if (fontReady !== null) return fontReady;
  const path = resolve(process.cwd(), DAILY_REPORT_IMAGE_FONT_ASSET);
  if (!existsSync(path)) return (fontReady = false);
  const digest = createHash("sha256").update(readFileSync(path)).digest("hex");
  return (fontReady = digest === DAILY_REPORT_IMAGE_FONT_SHA256);
}

export function isDailyReportImageReady(report: OsintDailyReportSnapshot): boolean {
  return Boolean(
    report.schemaVersion === "1.0" &&
      report.stories &&
      report.lhb &&
      DAILY_REPORT_WATERMARK &&
      DAILY_REPORT_DISCLAIMER &&
      DAILY_REPORT_IMAGE_FONT_ASSET.endsWith(".ttf") &&
      isImageFontReady()
  );
}
