import type {
  VideoAccountCard,
  VideoAccountsPage,
  VideoCoverPage,
  VideoPage,
  VideoRankingPage,
  VideoStoriesPage,
  VideoStoryCard,
  VideoStoryboard,
  VideoTheme,
} from "./contracts";

const WIDTH = 1080;
const HEIGHT = 1920;
const SAFE_X = 64;
const SAFE_WIDTH = 952;
const TRANSITION_MS = 220;

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function easeOut(value: number): number {
  const normalized = clamp(value);
  return 1 - Math.pow(1 - normalized, 3);
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

export function wrapMeasuredText(text: string, maxWidth: number, measure: (value: string) => number): string[] {
  const characters = Array.from(text);
  const lines: string[] = [];
  let current = "";
  for (const character of characters) {
    const next = `${current}${character}`;
    if (current && measure(next) > maxWidth) {
      lines.push(current);
      current = character;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function textLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const all = wrapMeasuredText(text.trim(), maxWidth, (value) => ctx.measureText(value).width);
  if (all.length <= maxLines) return all;
  const limited = all.slice(0, maxLines);
  let last = limited[maxLines - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
  limited[maxLines - 1] = `${last.replace(/[，。；、,.!?！？]$/u, "")}…`;
  return limited;
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number
) {
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
}

function shortenUrl(value: string, maxLength = 54): string {
  try {
    const parsed = new URL(value);
    const normalized = `${parsed.hostname.replace(/^www\./u, "")}${parsed.pathname.replace(/\/$/u, "")}`;
    if (normalized.length <= maxLength) return normalized;
    const front = Math.ceil((maxLength - 1) * 0.62);
    const back = maxLength - front - 1;
    return `${normalized.slice(0, front)}…${normalized.slice(-back)}`;
  } catch {
    return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
  }
}

function contentPageCount(storyboard: VideoStoryboard): number {
  return Math.max(0, storyboard.pages.length - 1);
}

function outroStart(storyboard: VideoStoryboard): number {
  return storyboard.durationMs - storyboard.outroDurationMs;
}

export function pageIndexAtTime(storyboard: VideoStoryboard, elapsedMs: number): number {
  if (storyboard.pages.length <= 1 || elapsedMs < storyboard.coverDurationMs) return 0;
  if (elapsedMs >= outroStart(storyboard)) return storyboard.pages.length - 1;
  const contentIndex = Math.floor((elapsedMs - storyboard.coverDurationMs) / storyboard.pageDurationMs);
  return Math.min(storyboard.pages.length - 1, contentIndex + 1);
}

function pageLocalTime(storyboard: VideoStoryboard, elapsedMs: number, pageIndex: number): { local: number; duration: number } {
  if (pageIndex === 0) return { local: clamp(elapsedMs, 0, storyboard.coverDurationMs), duration: storyboard.coverDurationMs };
  const start = storyboard.coverDurationMs + (pageIndex - 1) * storyboard.pageDurationMs;
  return { local: clamp(elapsedMs - start, 0, storyboard.pageDurationMs), duration: storyboard.pageDurationMs };
}

export function pageTransitionAtTime(storyboard: VideoStoryboard, elapsedMs: number): number {
  const pageIndex = pageIndexAtTime(storyboard, elapsedMs);
  const { local, duration } = pageLocalTime(storyboard, elapsedMs, pageIndex);
  const entering = easeOut(local / TRANSITION_MS);
  const exiting = clamp((duration - local) / TRANSITION_MS);
  return Math.min(entering, exiting);
}

function pageOffsetAtTime(storyboard: VideoStoryboard, elapsedMs: number): number {
  const pageIndex = pageIndexAtTime(storyboard, elapsedMs);
  const { local, duration } = pageLocalTime(storyboard, elapsedMs, pageIndex);
  if (local < TRANSITION_MS) return (1 - easeOut(local / TRANSITION_MS)) * 92;
  if (duration - local < TRANSITION_MS) return -(1 - clamp((duration - local) / TRANSITION_MS)) * 72;
  return 0;
}

function drawBackground(ctx: CanvasRenderingContext2D, theme: VideoTheme, elapsedMs: number) {
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const progress = (elapsedMs % 5_000) / 5_000;
  ctx.save();
  ctx.globalAlpha = 0.11;
  ctx.strokeStyle = theme.accent;
  ctx.fillStyle = theme.accent;
  ctx.lineWidth = 2;
  if (theme.motion === "grid") {
    for (let x = -100 + progress * 100; x < WIDTH + 100; x += 150) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke(); }
    for (let y = -100 + progress * 100; y < HEIGHT + 100; y += 150) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); }
  } else if (theme.motion === "ripple") {
    for (let index = 0; index < 5; index += 1) { ctx.beginPath(); ctx.arc(880, 280, 90 + index * 95 + progress * 50, 0, Math.PI * 2); ctx.stroke(); }
  } else if (theme.motion === "slices") {
    for (let index = 0; index < 9; index += 1) ctx.fillRect((index * 150 + progress * 100) % 1220 - 70, 0, 28, HEIGHT);
  } else if (theme.motion === "track") {
    for (let index = 0; index < 10; index += 1) { const y = 130 + index * 190; ctx.beginPath(); ctx.moveTo(-250 + progress * 280, y); ctx.lineTo(1_050 + progress * 280, y); ctx.stroke(); }
  } else if (theme.motion === "editorial") {
    ctx.fillRect(42, 70, 8, 1_780); ctx.fillRect(1_030, 70, 4, 1_780);
  } else if (theme.motion === "orbit") {
    ctx.translate(880, 260); ctx.rotate(progress * Math.PI * 2); for (let index = 0; index < 4; index += 1) { ctx.beginPath(); ctx.ellipse(0, 0, 90 + index * 65, 35 + index * 28, index * 0.24, 0, Math.PI * 2); ctx.stroke(); }
  } else {
    for (let row = 0; row < 9; row += 1) for (let column = 0; column < 5; column += 1) ctx.fillRect(80 + column * 205, 100 + row * 195, 74, 54);
  }
  ctx.restore();
}

function drawPageHeader(ctx: CanvasRenderingContext2D, storyboard: VideoStoryboard, title: string, detail: string) {
  ctx.fillStyle = storyboard.theme.muted;
  ctx.font = "700 27px system-ui, sans-serif";
  ctx.fillText(storyboard.mode === "morning" ? "ALPHAPERCEPT MORNING" : "ALPHAPERCEPT CLOSE", SAFE_X, 92);
  ctx.textAlign = "right";
  ctx.fillText(storyboard.date, WIDTH - SAFE_X, 92);
  ctx.textAlign = "left";
  ctx.fillStyle = storyboard.theme.ink;
  ctx.font = "900 58px system-ui, sans-serif";
  ctx.fillText(title, SAFE_X, 164);
  ctx.textAlign = "right";
  ctx.fillStyle = storyboard.theme.muted;
  ctx.font = "700 26px system-ui, sans-serif";
  ctx.fillText(detail, WIDTH - SAFE_X, 160);
  ctx.textAlign = "left";
  ctx.fillStyle = storyboard.theme.accent;
  ctx.fillRect(SAFE_X, 192, SAFE_WIDTH, 5);
}

function drawFooter(ctx: CanvasRenderingContext2D, storyboard: VideoStoryboard, page: VideoPage, pageIndex: number) {
  ctx.fillStyle = storyboard.theme.muted;
  ctx.font = "600 24px system-ui, sans-serif";
  ctx.fillText(shortenUrl(page.reportUrl, 62), SAFE_X, 1_780);
  ctx.fillText("公开信息整理 · 不构成投资建议", SAFE_X, 1_824);
  ctx.textAlign = "right";
  ctx.fillStyle = storyboard.theme.ink;
  ctx.font = "800 25px system-ui, sans-serif";
  ctx.fillText(`${String(pageIndex + 1).padStart(2, "0")} / ${String(storyboard.pages.length).padStart(2, "0")}`, WIDTH - SAFE_X, 1_824);
  ctx.textAlign = "left";
}

function drawCover(ctx: CanvasRenderingContext2D, storyboard: VideoStoryboard, page: VideoCoverPage) {
  const theme = storyboard.theme;
  ctx.fillStyle = theme.muted;
  ctx.font = "700 28px system-ui, sans-serif";
  ctx.fillText(page.kicker, SAFE_X, 100);
  ctx.textAlign = "right";
  ctx.fillText(storyboard.date, WIDTH - SAFE_X, 100);
  ctx.textAlign = "left";
  ctx.fillStyle = theme.ink;
  ctx.font = "900 94px system-ui, sans-serif";
  ctx.fillText(page.title, SAFE_X, 238);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(SAFE_X, 284, 220, 10);
  ctx.fillStyle = theme.ink;
  ctx.font = "750 38px system-ui, sans-serif";
  drawLines(ctx, textLines(ctx, page.subtitle, SAFE_WIDTH, 2), SAFE_X, 360, 52);

  const statGap = 18;
  const statWidth = (SAFE_WIDTH - statGap * 2) / 3;
  page.stats.slice(0, 3).forEach((stat, index) => {
    const x = SAFE_X + index * (statWidth + statGap);
    ctx.fillStyle = theme.surface;
    roundedRect(ctx, x, 465, statWidth, 188, 26);
    ctx.fill();
    ctx.fillStyle = theme.muted;
    ctx.font = "700 25px system-ui, sans-serif";
    ctx.fillText(stat.label, x + 28, 515);
    ctx.fillStyle = index === 1 ? theme.secondary : theme.accent;
    ctx.font = "900 62px system-ui, sans-serif";
    ctx.fillText(stat.value, x + 28, 602);
  });

  ctx.fillStyle = theme.muted;
  ctx.font = "800 25px system-ui, sans-serif";
  ctx.fillText("今日重点", SAFE_X, 735);
  page.highlights.slice(0, 3).forEach((highlight, index) => {
    const y = 780 + index * 260;
    ctx.fillStyle = theme.surface;
    roundedRect(ctx, SAFE_X, y, SAFE_WIDTH, 226, 28);
    ctx.fill();
    ctx.fillStyle = theme.accent;
    ctx.font = "900 29px system-ui, sans-serif";
    ctx.fillText(String(index + 1).padStart(2, "0"), SAFE_X + 28, y + 57);
    ctx.fillStyle = theme.ink;
    ctx.font = "800 39px system-ui, sans-serif";
    drawLines(ctx, textLines(ctx, highlight, SAFE_WIDTH - 120, 3), SAFE_X + 90, y + 58, 51);
  });
}

function drawTag(ctx: CanvasRenderingContext2D, theme: VideoTheme, value: string, x: number, y: number): number {
  ctx.font = "700 23px system-ui, sans-serif";
  const width = Math.min(190, ctx.measureText(value).width + 32);
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = theme.accent;
  roundedRect(ctx, x, y - 30, width, 42, 21);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = theme.ink;
  ctx.fillText(value, x + 16, y);
  return width;
}

function drawStoryCard(
  ctx: CanvasRenderingContext2D,
  theme: VideoTheme,
  story: VideoStoryCard,
  index: number,
  x: number,
  y: number,
  width: number,
  height: number,
  expanded: boolean
) {
  ctx.fillStyle = theme.surface;
  roundedRect(ctx, x, y, width, height, 30);
  ctx.fill();
  ctx.fillStyle = theme.accent;
  ctx.fillRect(x, y, 10, height);

  ctx.fillStyle = theme.muted;
  ctx.font = "800 24px system-ui, sans-serif";
  ctx.fillText(`${String(index + 1).padStart(2, "0")} · ${story.module}`, x + 38, y + 54);

  ctx.fillStyle = theme.ink;
  ctx.font = expanded ? "900 56px system-ui, sans-serif" : "900 48px system-ui, sans-serif";
  const titleLines = textLines(ctx, story.title, width - 76, expanded ? 4 : 3);
  drawLines(ctx, titleLines, x + 38, y + 122, expanded ? 70 : 61);

  const summaryY = y + (expanded ? 430 : 330);
  ctx.fillStyle = theme.ink;
  ctx.font = expanded ? "600 36px system-ui, sans-serif" : "600 31px system-ui, sans-serif";
  const summaryLines = textLines(ctx, story.summary, width - 76, expanded ? 13 : 5);
  drawLines(ctx, summaryLines, x + 38, summaryY, expanded ? 52 : 43);

  let tagX = x + 38;
  const tagY = y + height - 148;
  story.tags.slice(0, 4).forEach((tag) => {
    const tagWidth = Math.min(190, ctx.measureText(tag).width + 32);
    if (tagX + tagWidth > x + width - 38) return;
    tagX += drawTag(ctx, theme, tag, tagX, tagY) + 12;
  });

  ctx.fillStyle = theme.muted;
  ctx.font = "650 24px system-ui, sans-serif";
  ctx.fillText(`${story.publishedAt} · ${story.sourceName}`, x + 38, y + height - 83);
  ctx.fillStyle = theme.secondary;
  ctx.font = "650 22px ui-monospace, SFMono-Regular, monospace";
  ctx.fillText(shortenUrl(story.sourceUrl, expanded ? 72 : 60), x + 38, y + height - 43);
}

function drawStoriesPage(ctx: CanvasRenderingContext2D, storyboard: VideoStoryboard, page: VideoStoriesPage) {
  drawPageHeader(ctx, storyboard, page.module, `模块 ${page.modulePage} / ${page.modulePageTotal}`);
  const expanded = page.stories.length === 1;
  if (expanded) {
    drawStoryCard(ctx, storyboard.theme, page.stories[0], 1, SAFE_X, 230, SAFE_WIDTH, 1_430, true);
    return;
  }
  const gap = 26;
  const cardHeight = (1_430 - gap) / 2;
  page.stories.forEach((story, index) => {
    drawStoryCard(ctx, storyboard.theme, story, index + 1, SAFE_X, 230 + index * (cardHeight + gap), SAFE_WIDTH, cardHeight, false);
  });
}

function drawRankingPage(ctx: CanvasRenderingContext2D, storyboard: VideoStoryboard, page: VideoRankingPage) {
  const title = page.direction === "in" ? "💰变动 · 流入" : "💰变动 · 流出";
  drawPageHeader(ctx, storyboard, title, `${page.entries.length} 项`);
  ctx.fillStyle = storyboard.theme.surface;
  roundedRect(ctx, SAFE_X, 230, SAFE_WIDTH, 1_430, 30);
  ctx.fill();
  ctx.fillStyle = storyboard.theme.muted;
  ctx.font = "800 25px system-ui, sans-serif";
  ctx.fillText("序号", SAFE_X + 32, 292);
  ctx.fillText("名称", SAFE_X + 142, 292);
  ctx.textAlign = "right";
  ctx.fillText("金额（万）", WIDTH - SAFE_X - 32, 292);
  ctx.textAlign = "left";
  page.entries.slice(0, 10).forEach((entry, index) => {
    const rowY = 330 + index * 126;
    if (index % 2 === 0) {
      ctx.save();
      ctx.globalAlpha = 0.055;
      ctx.fillStyle = storyboard.theme.accent;
      ctx.fillRect(SAFE_X + 18, rowY - 34, SAFE_WIDTH - 36, 104);
      ctx.restore();
    }
    ctx.fillStyle = storyboard.theme.muted;
    ctx.font = "800 27px system-ui, sans-serif";
    ctx.fillText(String(index + 1).padStart(2, "0"), SAFE_X + 32, rowY + 28);
    ctx.fillStyle = storyboard.theme.ink;
    ctx.font = "850 38px system-ui, sans-serif";
    ctx.fillText(entry.label, SAFE_X + 142, rowY + 30);
    ctx.fillStyle = entry.tone === "positive" ? storyboard.theme.accent : storyboard.theme.secondary;
    ctx.textAlign = "right";
    ctx.font = "900 38px ui-monospace, SFMono-Regular, monospace";
    ctx.fillText(entry.value, WIDTH - SAFE_X - 32, rowY + 30);
    ctx.textAlign = "left";
  });
}

function drawAccountCard(ctx: CanvasRenderingContext2D, theme: VideoTheme, account: VideoAccountCard, x: number, y: number, width: number) {
  ctx.fillStyle = theme.surface;
  roundedRect(ctx, x, y, width, 250, 28);
  ctx.fill();
  ctx.fillStyle = account.tone === "positive" ? theme.accent : theme.secondary;
  ctx.fillRect(x, y, 9, 250);
  ctx.fillStyle = theme.ink;
  ctx.font = "900 38px system-ui, sans-serif";
  ctx.fillText(account.label, x + 34, y + 58);
  ctx.fillStyle = theme.muted;
  ctx.font = "700 23px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`涉及 ${account.stockCount} 项`, x + width - 30, y + 54);
  ctx.textAlign = "left";
  const columns = [
    ["净", account.net],
    ["入", account.incoming],
    ["出", account.outgoing],
  ] as const;
  columns.forEach(([label, value], index) => {
    const columnX = x + 34 + index * 278;
    ctx.fillStyle = theme.muted;
    ctx.font = "750 22px system-ui, sans-serif";
    ctx.fillText(label, columnX, y + 118);
    ctx.fillStyle = index === 0 ? (account.tone === "positive" ? theme.accent : theme.secondary) : theme.ink;
    ctx.font = "850 31px ui-monospace, SFMono-Regular, monospace";
    ctx.fillText(value, columnX, y + 162);
  });
  ctx.fillStyle = theme.muted;
  ctx.font = "650 25px system-ui, sans-serif";
  ctx.fillText(`关联：${account.relatedNames.join(" · ") || "暂无"}`, x + 34, y + 218);
}

function drawAccountsPage(ctx: CanvasRenderingContext2D, storyboard: VideoStoryboard, page: VideoAccountsPage) {
  drawPageHeader(ctx, storyboard, "活跃account", `第 ${page.page} / ${page.pageTotal} 页`);
  page.accounts.slice(0, 5).forEach((account, index) => {
    drawAccountCard(ctx, storyboard.theme, account, SAFE_X, 230 + index * 282, SAFE_WIDTH);
  });
}

function drawPage(ctx: CanvasRenderingContext2D, storyboard: VideoStoryboard, page: VideoPage) {
  if (page.kind === "cover") drawCover(ctx, storyboard, page);
  else if (page.kind === "stories") drawStoriesPage(ctx, storyboard, page);
  else if (page.kind === "ranking") drawRankingPage(ctx, storyboard, page);
  else drawAccountsPage(ctx, storyboard, page);
}

function drawOutro(ctx: CanvasRenderingContext2D, storyboard: VideoStoryboard, elapsedMs: number) {
  const progress = easeOut((elapsedMs - outroStart(storyboard)) / Math.min(520, storyboard.outroDurationMs));
  ctx.save();
  ctx.globalAlpha = 0.9 * progress;
  ctx.fillStyle = storyboard.theme.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = progress;
  ctx.fillStyle = storyboard.theme.ink;
  ctx.font = "900 82px system-ui, sans-serif";
  ctx.fillText(storyboard.outro.title, SAFE_X, 720);
  ctx.fillStyle = storyboard.theme.accent;
  ctx.fillRect(SAFE_X, 775, 320, 10);
  ctx.fillStyle = storyboard.theme.ink;
  ctx.font = "750 38px system-ui, sans-serif";
  ctx.fillText(storyboard.outro.disclaimer, SAFE_X, 880);
  ctx.fillStyle = storyboard.theme.muted;
  ctx.font = "650 28px system-ui, sans-serif";
  ctx.fillText(`数据截至 ${storyboard.outro.asOf}`, SAFE_X, 952);
  ctx.fillText(storyboard.date, SAFE_X, 1_012);
  ctx.restore();
}

export function drawVideoFrame(ctx: CanvasRenderingContext2D, storyboard: VideoStoryboard, elapsedMs: number): void {
  drawBackground(ctx, storyboard.theme, elapsedMs);
  const pageIndex = pageIndexAtTime(storyboard, elapsedMs);
  const page = storyboard.pages[pageIndex] || storyboard.pages[0];
  ctx.save();
  ctx.translate(pageOffsetAtTime(storyboard, elapsedMs), 0);
  drawPage(ctx, storyboard, page);
  drawFooter(ctx, storyboard, page, pageIndex);
  ctx.restore();
  if (elapsedMs >= outroStart(storyboard)) drawOutro(ctx, storyboard, elapsedMs);
}

export const DAILY_VIDEO_WIDTH = WIDTH;
export const DAILY_VIDEO_HEIGHT = HEIGHT;
