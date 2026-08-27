import type { OsintDailyReportSnapshot } from "./contracts";
import {
  DAILY_REPORT_DISCLAIMER,
  DAILY_REPORT_WATERMARK,
} from "./export-html";

export const DAILY_REPORT_PDF_FONT_ASSET =
  "lib/osint/daily-report/assets/NotoSansSC-Variable.ttf";
export const DAILY_REPORT_PDF_FONT_SHA256 =
  "a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da";
export const DAILY_REPORT_PDF_LAYOUT_VERSION = "pantone-v7";

export function isDailyReportPdfReady(report: OsintDailyReportSnapshot): boolean {
  return Boolean(
    report.schemaVersion === "1.0" &&
    report.stories &&
    report.lhb &&
    DAILY_REPORT_WATERMARK &&
    DAILY_REPORT_DISCLAIMER &&
    DAILY_REPORT_PDF_FONT_ASSET.endsWith(".ttf") &&
    DAILY_REPORT_PDF_FONT_SHA256.length === 64
  );
}
