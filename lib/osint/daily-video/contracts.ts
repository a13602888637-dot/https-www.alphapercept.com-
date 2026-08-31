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

export interface VideoStoryCard {
  id: string;
  module: string;
  title: string;
  summary: string;
  tags: string[];
  publishedAt: string;
  sourceName: string;
  sourceUrl: string;
}

export interface VideoRankingEntry {
  label: string;
  value: string;
  tone: "positive" | "negative";
}

export interface VideoAccountCard {
  label: string;
  net: string;
  incoming: string;
  outgoing: string;
  stockCount: number;
  relatedNames: string[];
  tone: "positive" | "negative";
}

interface VideoPageBase {
  reportUrl: string;
}

export interface VideoCoverPage extends VideoPageBase {
  kind: "cover";
  kicker: string;
  title: string;
  subtitle: string;
  stats: Array<{ label: string; value: string }>;
  highlights: string[];
}

export interface VideoStoriesPage extends VideoPageBase {
  kind: "stories";
  module: string;
  modulePage: number;
  modulePageTotal: number;
  stories: VideoStoryCard[];
}

export interface VideoRankingPage extends VideoPageBase {
  kind: "ranking";
  direction: "in" | "out";
  entries: VideoRankingEntry[];
}

export interface VideoAccountsPage extends VideoPageBase {
  kind: "accounts";
  page: number;
  pageTotal: number;
  accounts: VideoAccountCard[];
}

export type VideoPage = VideoCoverPage | VideoStoriesPage | VideoRankingPage | VideoAccountsPage;

export interface VideoStoryboard {
  mode: VideoMode;
  date: string;
  durationMs: number;
  coverDurationMs: 1_800;
  pageDurationMs: number;
  outroDurationMs: 1_200;
  theme: VideoTheme;
  pages: VideoPage[];
  outro: {
    title: string;
    disclaimer: string;
    asOf: string;
  };
}

export interface BuildVideoStoryboardOptions {
  reportUrl: string;
}

export type VideoProgressCallback = (progress: number) => void;
