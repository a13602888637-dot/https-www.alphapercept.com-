import type { VideoMode, VideoTheme } from "./contracts";
import { REPORT_VIDEO_TEMPLATES } from "./templates";

const THEMES_BY_WEEKDAY: Record<number, VideoTheme> = {
  1: { id: "coordinate-grid", name: "坐标网格", background: "#07151D", surface: "#102934", ink: "#EAF7F7", muted: "#8EADB4", accent: "#47D7D0", secondary: "#E7B35A", morningLayout: "grid-morning", closeLayout: "grid-close", motion: "grid", sound: [392, 523, 659] },
  2: { id: "signal-ripple", name: "信号波纹", background: "#1B1116", surface: "#331B24", ink: "#FFF3F5", muted: "#C9A7B1", accent: "#FF6B7A", secondary: "#64D8D0", morningLayout: "ripple-morning", closeLayout: "ripple-close", motion: "ripple", sound: [440, 587, 698] },
  3: { id: "module-slices", name: "模块切片", background: "#10132B", surface: "#1D2450", ink: "#F3F4FF", muted: "#A7AED8", accent: "#8EA1FF", secondary: "#FFCA6B", morningLayout: "slices-morning", closeLayout: "slices-close", motion: "slices", sound: [330, 494, 660] },
  4: { id: "data-track", name: "数据轨道", background: "#18140B", surface: "#332A14", ink: "#FFF9E8", muted: "#C8B88E", accent: "#E7B34B", secondary: "#55C9C0", morningLayout: "track-morning", closeLayout: "track-close", motion: "track", sound: [349, 466, 622] },
  5: { id: "editorial-final", name: "编辑终版", background: "#F0EFEB", surface: "#FFFFFF", ink: "#292A2E", muted: "#73757C", accent: "#A1263A", secondary: "#2A6170", morningLayout: "editorial-morning", closeLayout: "editorial-close", motion: "editorial", sound: [262, 392, 523] },
  6: { id: "global-orbit", name: "全球纵览", background: "#071A2E", surface: "#0D3152", ink: "#EDF8FF", muted: "#91B6CE", accent: "#56BCEB", secondary: "#F2C35A", morningLayout: "orbit-morning", closeLayout: "orbit-close", motion: "orbit", sound: [294, 440, 587] },
  0: { id: "next-week-calendar", name: "下周预告", background: "#171322", surface: "#2D2440", ink: "#FAF5FF", muted: "#B6A7CC", accent: "#B796E8", secondary: "#67D0C5", morningLayout: "calendar-morning", closeLayout: "calendar-close", motion: "calendar", sound: [311, 415, 554] },
};

export const TEMPLATE_ROTATION_START = "2026-09-08";
export const TEMPLATE_ROTATION_DAYS = 100;

// One saved, random draw without replacement. Keep this order stable once
// released: retries, different browsers and revised reports must agree. Two
// slots per calendar day also reserve weekends when no report is published.
const TEMPLATE_ORDER = [
  145, 39, 7, 152, 73, 104, 135, 81, 194, 156, 105, 9, 147, 4, 34, 182, 38, 48, 37, 164,
  77, 0, 128, 144, 159, 20, 60, 12, 139, 155, 190, 175, 169, 29, 58, 180, 40, 160, 113, 76,
  140, 172, 108, 70, 80, 116, 162, 88, 112, 31, 161, 191, 13, 95, 45, 14, 82, 126, 111, 168,
  21, 85, 121, 137, 72, 171, 93, 188, 100, 61, 123, 84, 198, 187, 154, 33, 127, 165, 22, 122,
  50, 117, 124, 43, 59, 19, 177, 107, 99, 68, 132, 55, 89, 153, 3, 118, 158, 69, 46, 8,
  149, 28, 44, 18, 192, 102, 2, 141, 26, 196, 120, 86, 183, 36, 101, 199, 5, 74, 92, 178,
  83, 103, 119, 41, 142, 91, 189, 94, 66, 16, 115, 136, 179, 109, 32, 87, 173, 184, 6, 130,
  195, 110, 23, 63, 71, 176, 186, 148, 52, 90, 51, 67, 75, 47, 197, 64, 146, 193, 138, 78,
  17, 42, 98, 10, 129, 174, 134, 106, 54, 150, 57, 181, 143, 56, 125, 97, 30, 27, 163, 151,
  65, 166, 62, 133, 167, 25, 35, 49, 157, 15, 79, 114, 53, 131, 185, 24, 96, 11, 170, 1,
];

export function themeForDate(date: string, mode: VideoMode = "morning"): VideoTheme {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`INVALID_VIDEO_DATE:${date}`);
  }
  if (mode !== "morning" && mode !== "close") throw new Error(`INVALID_VIDEO_MODE:${mode}`);
  const day = Math.floor((parsed.getTime() - Date.parse(`${TEMPLATE_ROTATION_START}T00:00:00Z`)) / 86_400_000);
  if (day < 0) return THEMES_BY_WEEKDAY[parsed.getUTCDay()];
  // Retaining the same permutation in subsequent cycles guarantees that ANY
  // rolling 100-day window stays unique, including across the cycle boundary.
  const slot = (day % TEMPLATE_ROTATION_DAYS) * 2 + (mode === "morning" ? 0 : 1);
  return REPORT_VIDEO_TEMPLATES[TEMPLATE_ORDER[slot]];
}

export const LEGACY_VIDEO_THEMES = Object.values(THEMES_BY_WEEKDAY);
export const DAILY_VIDEO_THEMES = REPORT_VIDEO_TEMPLATES;
