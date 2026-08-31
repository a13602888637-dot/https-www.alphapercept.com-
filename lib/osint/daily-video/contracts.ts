export type VideoMode = "morning" | "close";

export interface VideoTheme {
  id: string;
  name: string;
  background: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  secondary: string;
  morningLayout: string;
  closeLayout: string;
  motion: "grid" | "ripple" | "slices" | "track" | "editorial" | "orbit" | "calendar";
  sound: number[];
}

export interface VideoSceneItem {
  label: string;
  value?: string;
  detail?: string;
  tone?: "positive" | "negative" | "neutral";
}

export interface VideoScene {
  id: string;
  kind: "story" | "market" | "account";
  title: string;
  eyebrow: string;
  items: VideoSceneItem[];
}

export interface VideoStoryboard {
  mode: VideoMode;
  date: string;
  durationMs: 12_000;
  theme: VideoTheme;
  cover: {
    layout: string;
    kicker: string;
    title: string;
    subtitle: string;
  };
  scenes: VideoScene[];
  outro: {
    title: string;
    disclaimer: string;
    asOf: string;
  };
}

export type VideoProgressCallback = (progress: number) => void;
