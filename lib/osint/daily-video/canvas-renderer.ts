import type { VideoStoryboard, VideoTheme } from "./contracts";

const WIDTH = 1080;
const HEIGHT = 1920;
const COVER_END = 1_500;
const OUTRO_START = 9_500;

export function sceneIndexAtTime(storyboard: VideoStoryboard, elapsedMs: number): number {
  if (elapsedMs < COVER_END || elapsedMs >= OUTRO_START || storyboard.scenes.length === 0) return -1;
  const sceneDuration = (OUTRO_START - COVER_END) / storyboard.scenes.length;
  return Math.min(storyboard.scenes.length - 1, Math.floor((elapsedMs - COVER_END) / sceneDuration));
}

export function sceneOpacityAtTime(storyboard: VideoStoryboard, elapsedMs: number): number {
  const sceneIndex = sceneIndexAtTime(storyboard, elapsedMs);
  if (sceneIndex < 0) return 0;
  const sceneDuration = (OUTRO_START - COVER_END) / storyboard.scenes.length;
  const local = (elapsedMs - COVER_END - sceneIndex * sceneDuration) / sceneDuration;
  const enter = easeOut(Math.min(1, local * 3));
  const exit = Math.min(1, Math.max(0, (1 - local) * 18));
  return Math.min(1, enter * exit);
}

function easeOut(value: number): number {
  return 1 - Math.pow(1 - Math.max(0, Math.min(1, value)), 3);
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
    } else current = next;
  }
  if (current) lines.push(current);
  return lines;
}

function textLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  return wrapMeasuredText(text, maxWidth, (value) => ctx.measureText(value).width);
}

function drawBackground(ctx: CanvasRenderingContext2D, theme: VideoTheme, elapsedMs: number) {
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const progress = (elapsedMs % 3_000) / 3_000;
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = theme.accent;
  ctx.fillStyle = theme.accent;
  ctx.lineWidth = 2;
  if (theme.motion === "grid") {
    for (let x = -120 + progress * 120; x < WIDTH + 120; x += 120) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke(); }
    for (let y = -120 + progress * 120; y < HEIGHT + 120; y += 120) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); }
  } else if (theme.motion === "ripple") {
    for (let index = 0; index < 6; index += 1) { ctx.beginPath(); ctx.arc(540, 730, 120 + index * 150 + progress * 80, 0, Math.PI * 2); ctx.stroke(); }
  } else if (theme.motion === "slices") {
    for (let index = 0; index < 8; index += 1) ctx.fillRect((index * 170 + progress * 120) % 1250 - 100, 0, 70, HEIGHT);
  } else if (theme.motion === "track") {
    for (let index = 0; index < 8; index += 1) { const y = 180 + index * 210; ctx.beginPath(); ctx.moveTo(-200 + progress * 300, y); ctx.lineTo(980 + progress * 300, y); ctx.stroke(); }
  } else if (theme.motion === "editorial") {
    ctx.fillRect(70, 120, 14, 1_650); ctx.fillRect(996, 120, 6, 1_650); ctx.globalAlpha = 0.08; ctx.fillRect(540, 0, 1, HEIGHT);
  } else if (theme.motion === "orbit") {
    ctx.translate(540, 760); ctx.rotate(progress * Math.PI * 2); for (let index = 0; index < 5; index += 1) { ctx.beginPath(); ctx.ellipse(0, 0, 150 + index * 100, 70 + index * 55, index * 0.3, 0, Math.PI * 2); ctx.stroke(); }
  } else {
    for (let row = 0; row < 7; row += 1) for (let column = 0; column < 4; column += 1) ctx.fillRect(100 + column * 230, 180 + row * 210, 150, 120);
  }
  ctx.restore();
}

function drawCover(ctx: CanvasRenderingContext2D, storyboard: VideoStoryboard, elapsedMs: number) {
  const theme = storyboard.theme;
  const enter = easeOut(elapsedMs / 800);
  ctx.save();
  ctx.globalAlpha = enter;
  ctx.translate(0, (1 - enter) * 80);
  ctx.fillStyle = theme.muted;
  ctx.font = "600 34px system-ui, sans-serif";
  ctx.fillText(storyboard.cover.kicker, 84, 170);
  ctx.textAlign = "right";
  ctx.fillText(storyboard.date, 996, 170);
  ctx.textAlign = "left";
  ctx.fillStyle = theme.ink;
  ctx.font = "800 104px system-ui, sans-serif";
  ctx.fillText(storyboard.cover.title, 84, 430);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(84, 480, 190, 12);
  ctx.fillStyle = theme.ink;
  ctx.font = "700 48px system-ui, sans-serif";
  const lines = textLines(ctx, storyboard.cover.subtitle, 880).slice(0, 3);
  lines.forEach((line, index) => ctx.fillText(line, 84, 600 + index * 70));
  ctx.fillStyle = theme.secondary;
  ctx.font = "700 30px system-ui, sans-serif";
  ctx.fillText(`${storyboard.theme.name} · ${storyboard.mode === "morning" ? "早报" : "收盘"}`, 84, 1_650);
  ctx.restore();
}

function drawScene(ctx: CanvasRenderingContext2D, storyboard: VideoStoryboard, elapsedMs: number, sceneIndex: number) {
  const theme = storyboard.theme;
  const scene = storyboard.scenes[sceneIndex];
  const sceneDuration = (OUTRO_START - COVER_END) / storyboard.scenes.length;
  const local = (elapsedMs - COVER_END - sceneIndex * sceneDuration) / sceneDuration;
  const enter = easeOut(Math.min(1, local * 3));
  ctx.save();
  ctx.globalAlpha = sceneOpacityAtTime(storyboard, elapsedMs);
  ctx.translate((1 - enter) * (storyboard.mode === "morning" ? 110 : -110), 0);
  ctx.fillStyle = theme.muted;
  ctx.font = "700 30px system-ui, sans-serif";
  ctx.fillText(scene.eyebrow, 84, 165);
  ctx.fillStyle = theme.surface;
  roundedRect(ctx, 64, 245, 952, 1_350, 40);
  ctx.fill();
  ctx.fillStyle = theme.accent;
  ctx.fillRect(64, 245, 14, 1_350);
  ctx.fillStyle = theme.ink;
  ctx.font = "800 68px system-ui, sans-serif";
  const titleLines = textLines(ctx, scene.title, 820).slice(0, 3);
  titleLines.forEach((line, index) => ctx.fillText(line, 118, 390 + index * 86));
  let y = 680;
  for (const [index, item] of scene.items.entries()) {
    ctx.fillStyle = item.tone === "positive" ? theme.accent : item.tone === "negative" ? theme.secondary : theme.ink;
    ctx.font = "700 42px system-ui, sans-serif";
    const labelLines = textLines(ctx, item.label, item.value ? 520 : 760).slice(0, scene.kind === "story" ? 4 : 2);
    labelLines.forEach((line, labelIndex) => {
      const prefix = labelIndex === 0 ? `${String(index + 1).padStart(2, "0")}  ` : "";
      ctx.fillText(`${prefix}${line}`, labelIndex === 0 ? 118 : 178, y + labelIndex * 56);
    });
    if (item.value) { ctx.textAlign = "right"; ctx.fillText(item.value, 944, y); ctx.textAlign = "left"; }
    const labelHeight = Math.max(1, labelLines.length) * 56;
    if (item.detail) {
      ctx.fillStyle = theme.muted;
      ctx.font = "500 28px system-ui, sans-serif";
      const detailLines = textLines(ctx, item.detail, 760).slice(0, 2);
      detailLines.forEach((line, detailIndex) => ctx.fillText(line, 178, y + labelHeight + detailIndex * 38));
      y += detailLines.length * 38 + 36;
    }
    y += labelHeight + 44;
  }
  ctx.fillStyle = theme.muted;
  ctx.font = "600 26px system-ui, sans-serif";
  ctx.fillText(`${sceneIndex + 1} / ${storyboard.scenes.length}`, 118, 1_510);
  ctx.restore();
}

function drawOutro(ctx: CanvasRenderingContext2D, storyboard: VideoStoryboard, elapsedMs: number) {
  const theme = storyboard.theme;
  const enter = easeOut((elapsedMs - OUTRO_START) / 700);
  ctx.save();
  ctx.globalAlpha = enter;
  ctx.fillStyle = theme.ink;
  ctx.font = "800 88px system-ui, sans-serif";
  ctx.fillText(storyboard.outro.title, 84, 620);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(84, 680, 300, 12);
  ctx.fillStyle = theme.ink;
  ctx.font = "700 40px system-ui, sans-serif";
  textLines(ctx, storyboard.outro.disclaimer, 860).forEach((line, index) => ctx.fillText(line, 84, 810 + index * 62));
  ctx.fillStyle = theme.muted;
  ctx.font = "600 30px system-ui, sans-serif";
  ctx.fillText(`数据截至 ${storyboard.outro.asOf}`, 84, 1_520);
  ctx.fillText(storyboard.date, 84, 1_580);
  ctx.restore();
}

export function drawVideoFrame(ctx: CanvasRenderingContext2D, storyboard: VideoStoryboard, elapsedMs: number): void {
  drawBackground(ctx, storyboard.theme, elapsedMs);
  if (elapsedMs < COVER_END) drawCover(ctx, storyboard, elapsedMs);
  else if (elapsedMs >= OUTRO_START) drawOutro(ctx, storyboard, elapsedMs);
  else drawScene(ctx, storyboard, elapsedMs, sceneIndexAtTime(storyboard, elapsedMs));
}

export const DAILY_VIDEO_WIDTH = WIDTH;
export const DAILY_VIDEO_HEIGHT = HEIGHT;
