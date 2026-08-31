import type { VideoTheme } from "./contracts";

const THEMES_BY_WEEKDAY: Record<number, VideoTheme> = {
  1: { id: "coordinate-grid", name: "坐标网格", background: "#07151D", surface: "#102934", ink: "#EAF7F7", muted: "#8EADB4", accent: "#47D7D0", secondary: "#E7B35A", morningLayout: "grid-morning", closeLayout: "grid-close", motion: "grid", sound: [392, 523, 659] },
  2: { id: "signal-ripple", name: "信号波纹", background: "#1B1116", surface: "#331B24", ink: "#FFF3F5", muted: "#C9A7B1", accent: "#FF6B7A", secondary: "#64D8D0", morningLayout: "ripple-morning", closeLayout: "ripple-close", motion: "ripple", sound: [440, 587, 698] },
  3: { id: "module-slices", name: "模块切片", background: "#10132B", surface: "#1D2450", ink: "#F3F4FF", muted: "#A7AED8", accent: "#8EA1FF", secondary: "#FFCA6B", morningLayout: "slices-morning", closeLayout: "slices-close", motion: "slices", sound: [330, 494, 660] },
  4: { id: "data-track", name: "数据轨道", background: "#18140B", surface: "#332A14", ink: "#FFF9E8", muted: "#C8B88E", accent: "#E7B34B", secondary: "#55C9C0", morningLayout: "track-morning", closeLayout: "track-close", motion: "track", sound: [349, 466, 622] },
  5: { id: "editorial-final", name: "编辑终版", background: "#F0EFEB", surface: "#FFFFFF", ink: "#292A2E", muted: "#73757C", accent: "#A1263A", secondary: "#2A6170", morningLayout: "editorial-morning", closeLayout: "editorial-close", motion: "editorial", sound: [262, 392, 523] },
  6: { id: "global-orbit", name: "全球纵览", background: "#071A2E", surface: "#0D3152", ink: "#EDF8FF", muted: "#91B6CE", accent: "#56BCEB", secondary: "#F2C35A", morningLayout: "orbit-morning", closeLayout: "orbit-close", motion: "orbit", sound: [294, 440, 587] },
  0: { id: "next-week-calendar", name: "下周预告", background: "#171322", surface: "#2D2440", ink: "#FAF5FF", muted: "#B6A7CC", accent: "#B796E8", secondary: "#67D0C5", morningLayout: "calendar-morning", closeLayout: "calendar-close", motion: "calendar", sound: [311, 415, 554] },
};

export function themeForDate(date: string): VideoTheme {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`INVALID_VIDEO_DATE:${date}`);
  return THEMES_BY_WEEKDAY[parsed.getUTCDay()];
}

export const DAILY_VIDEO_THEMES = Object.values(THEMES_BY_WEEKDAY);
