import type { VideoAccountCard, VideoCoverPage, VideoPage, VideoStoryboard, VideoStoryCard, VideoTheme } from "./contracts";
import { accountTemplateBoxes, rankingTemplateBoxes, storyTemplateBoxes, type TemplateBox } from "./template-layout";

const BODY_FONT = '"PingFang SC", "Noto Sans SC", system-ui, sans-serif';
const DISPLAY_FONTS = {
  sans: BODY_FONT,
  serif: '"Songti SC", "Noto Serif SC", Georgia, serif',
  mono: '"SFMono-Regular", "PingFang SC", monospace',
};
const measuredWidths = new Map<string, number>();
const wrappedLines = new Map<string, string[]>();

function measuredWidth(ctx: CanvasRenderingContext2D, value: string): number {
  const key = `${ctx.font}\u0000${value}`;
  const cached = measuredWidths.get(key);
  if (cached !== undefined) return cached;
  const width = ctx.measureText(value).width;
  if (measuredWidths.size >= 12_000) measuredWidths.clear();
  measuredWidths.set(key, width);
  return width;
}

function font(ctx: CanvasRenderingContext2D, size: number, weight = 600, family = BODY_FONT) {
  ctx.font = `${weight} ${size}px ${family}`;
}

function lines(ctx: CanvasRenderingContext2D, value: string, width: number): string[] {
  const key = `${ctx.font}\u0000${width}\u0000${value}`;
  const cached = wrappedLines.get(key);
  if (cached) return cached;
  const result: string[] = [];
  let line = "";
  const tokens = value.match(/[A-Za-z0-9]+|[^\r]/gu) || [];
  const units = tokens.flatMap((token) => measuredWidth(ctx, token) > width ? Array.from(token) : [token]);
  for (const character of units) {
    if (line && (character === "\n" || measuredWidth(ctx, line + character) > width)) {
      if (/^[。，！？、；：,.!?;:)\]】》”’]$/u.test(character) && Array.from(line).length > 1) {
        const previous = Array.from(line); const tail = previous.pop()!;
        result.push(previous.join("")); line = tail;
      } else { result.push(line); line = ""; }
    }
    if (character !== "\n") line += character;
  }
  if (line) result.push(line);
  if (wrappedLines.size >= 2048) wrappedLines.clear();
  wrappedLines.set(key, result);
  return result;
}

function paragraph(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, width: number, size: number, maxLines: number, weight = 600, family = BODY_FONT): number {
  font(ctx, size, weight, family);
  const wrapped = lines(ctx, value, width);
  const selected = wrapped.slice(0, maxLines);
  if (wrapped.length > maxLines && selected.length > 0) {
    let last = selected[selected.length - 1];
    while (last && measuredWidth(ctx, `${last}…`) > width) last = last.slice(0, -1);
    selected[selected.length - 1] = `${last}…`;
  }
  const lineHeight = size * 1.32;
  selected.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return y + selected.length * lineHeight;
}

function singleLine(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, width: number, size: number, weight = 700) {
  let actualSize = size;
  font(ctx, actualSize, weight);
  while (measuredWidth(ctx, value) > width && actualSize > 23) {
    actualSize -= 1; font(ctx, actualSize, weight);
  }
  paragraph(ctx, value, x, y, width, actualSize, 1, weight);
}

function panel(ctx: CanvasRenderingContext2D, theme: VideoTheme, box: TemplateBox) {
  const frame = theme.layout!.frame;
  ctx.fillStyle = theme.surface;
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.width, box.height, frame === "panel" ? 28 : frame === "outline" ? 14 : 4);
  ctx.fill();
  if (frame === "outline") {
    ctx.strokeStyle = theme.accent; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.fillStyle = theme.accent;
  if (frame === "rule") ctx.fillRect(box.x, box.y, box.width, 4);
  if (frame === "stripe") ctx.fillRect(box.x, box.y, 8, box.height);
  if (frame === "tab") ctx.fillRect(box.x + box.width - 82, box.y, 82, 10);
}

function sourceLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch { return url; }
}

function pageHeader(ctx: CanvasRenderingContext2D, storyboard: VideoStoryboard, title: string, detail: string) {
  const theme = storyboard.theme;
  const variant = theme.layout!.cover % 10;
  const mirrored = theme.layout!.cover >= 10;
  const display = DISPLAY_FONTS[theme.layout!.typography];
  ctx.fillStyle = theme.muted; font(ctx, 24, 650);
  ctx.fillText(storyboard.mode === "morning" ? "ALPHAPERCEPT / MORNING" : "ALPHAPERCEPT / CLOSE", 64, 82);
  ctx.textAlign = "right"; ctx.fillText(storyboard.date, 1016, 82); ctx.textAlign = "left";
  if ([2, 4, 8].includes(variant)) {
    ctx.fillStyle = theme.accent; ctx.fillRect(64, 112, 952, 104);
    ctx.fillStyle = theme.background;
  } else { ctx.fillStyle = theme.ink; }
  font(ctx, 52, 850, display);
  if (mirrored) { ctx.textAlign = "right"; ctx.fillText(title, 990, 180); ctx.textAlign = "left"; }
  else ctx.fillText(title, [2, 4, 8].includes(variant) ? 86 : 64, 180);
  ctx.fillStyle = theme.muted; font(ctx, 24, 600);
  ctx.fillText(detail, 64, 232);
  if (![2, 4, 8].includes(variant)) {
    ctx.fillStyle = theme.accent;
    ctx.fillRect(64, 201, variant % 2 ? 276 : 952, variant % 3 ? 4 : 8);
  }
}

function coverStats(ctx: CanvasRenderingContext2D, theme: VideoTheme, page: VideoCoverPage, x: number, y: number, width: number, vertical = false) {
  const gap = 18;
  const statWidth = vertical ? width : (width - gap * 2) / 3;
  page.stats.slice(0, 3).forEach((stat, index) => {
    const box = { x: vertical ? x : x + index * (statWidth + gap), y: vertical ? y + index * 184 : y, width: statWidth, height: 162 };
    panel(ctx, theme, box);
    ctx.fillStyle = theme.muted; singleLine(ctx, stat.label, box.x + 22, box.y + 45, statWidth - 44, 25);
    ctx.fillStyle = index === 1 ? theme.secondary : theme.accent;
    singleLine(ctx, stat.value, box.x + 22, box.y + 122, statWidth - 44, 58, 900);
  });
}

function coverList(ctx: CanvasRenderingContext2D, theme: VideoTheme, page: VideoCoverPage, box: TemplateBox, columns: number) {
  const values = page.highlights.slice(0, 6);
  const gap = 20;
  const rows = Math.max(1, Math.ceil(values.length / columns));
  const width = (box.width - gap * (columns - 1)) / columns;
  const height = (box.height - gap * (rows - 1)) / rows;
  values.forEach((value, index) => {
    const cell = { x: box.x + index % columns * (width + gap), y: box.y + Math.floor(index / columns) * (height + gap), width, height };
    panel(ctx, theme, cell);
    ctx.fillStyle = theme.accent; font(ctx, 24, 750);
    // The label describes the content, rather than inventing a ranking.
    ctx.fillText(storyboardLabel(value), cell.x + 24, cell.y + 42);
    ctx.fillStyle = theme.ink;
    paragraph(ctx, value, cell.x + 24, cell.y + 91, width - 48, width < 400 ? 30 : 34, Math.max(1, Math.floor((height - 103) / 45)), 750);
  });
}

function storyboardLabel(value: string): string {
  if (value.includes("截至")) return "截止时间";
  if (value.includes("来源")) return "信息来源";
  if (value.includes("方向")) return "方向统计";
  return "本期内容";
}

function cover(ctx: CanvasRenderingContext2D, storyboard: VideoStoryboard, page: VideoCoverPage) {
  const theme = storyboard.theme;
  const variant = theme.layout!.cover % 10;
  const mirrored = theme.layout!.cover >= 10;
  const display = DISPLAY_FONTS[theme.layout!.typography];
  ctx.fillStyle = theme.muted; font(ctx, 25, 650);
  ctx.fillText(page.kicker, 64, 88);
  ctx.textAlign = "right"; ctx.fillText(storyboard.date, 1016, 88); ctx.textAlign = "left";

  // Ten materially different arrangements; a second edition swaps the lead
  // rail and gives the date/headline a different reading hierarchy.
  if (variant === 1 || variant === 6) {
    const railX = mirrored ? 730 : 64;
    const mainX = mirrored ? 64 : 372;
    ctx.fillStyle = theme.accent; ctx.fillRect(railX, 138, 286, 242);
    ctx.fillStyle = theme.background;
    paragraph(ctx, page.title, railX + 24, 214, 238, 54, 3, 850, display);
    coverStats(ctx, theme, page, railX, 410, 286, true);
    ctx.fillStyle = theme.ink;
    paragraph(ctx, page.subtitle, mainX, 208, 644, 34, 4, 700);
    coverList(ctx, theme, page, { x: mainX, y: variant === 1 ? 430 : 620, width: 644, height: variant === 1 ? 1230 : 1040 }, variant === 1 ? 1 : 2);
    if (variant === 6) {
      ctx.fillStyle = theme.secondary; font(ctx, 115, 850, display);
      ctx.fillText(storyboard.date.slice(5).replace("-", "/"), mainX, 485);
    }
    return;
  }
  if (variant === 2 || variant === 7) {
    const titleY = mirrored ? 416 : 216;
    ctx.fillStyle = theme.ink;
    paragraph(ctx, page.title, 64, titleY, 952, 88, 1, 850, display);
    if (mirrored) coverStats(ctx, theme, page, 64, 140, 952);
    else coverStats(ctx, theme, page, 64, 378, 952);
    ctx.fillStyle = theme.muted;
    paragraph(ctx, page.subtitle, 64, mirrored ? 506 : 303, 952, 33, 2);
    coverList(ctx, theme, page, { x: 64, y: 620, width: 952, height: 1040 }, variant === 2 ? 2 : 1);
    return;
  }
  if (variant === 3 || variant === 8) {
    const boxX = mirrored ? 572 : 64;
    const sideX = mirrored ? 64 : 572;
    panel(ctx, theme, { x: boxX, y: 146, width: 444, height: 510 });
    ctx.fillStyle = theme.ink;
    paragraph(ctx, page.title, boxX + 28, 250, 388, 76, 3, 850, display);
    ctx.fillStyle = theme.muted;
    paragraph(ctx, page.subtitle, boxX + 28, 478, 388, 30, 4);
    coverStats(ctx, theme, page, sideX, 146, 444, true);
    coverList(ctx, theme, page, { x: 64, y: 760, width: 952, height: 900 }, variant === 3 ? 2 : 1);
    return;
  }
  ctx.fillStyle = theme.ink; font(ctx, 88, 900, display);
  if (mirrored) { ctx.textAlign = "right"; ctx.fillText(page.title, 1016, 222); ctx.textAlign = "left"; }
  else ctx.fillText(page.title, 64, 222);
  ctx.fillStyle = theme.accent;
  if (variant === 4) ctx.fillRect(64, 254, 952, 20);
  else ctx.fillRect(mirrored ? 776 : 64, 257, 240, 8);
  ctx.fillStyle = theme.muted; paragraph(ctx, page.subtitle, 64, 330, 952, 34, 2);
  if (variant === 5) {
    coverList(ctx, theme, page, { x: 64, y: 434, width: 952, height: 990 }, 2);
    coverStats(ctx, theme, page, 64, 1498, 952);
  } else if (variant === 9) {
    coverStats(ctx, theme, page, 64, 458, 952);
    coverList(ctx, theme, page, { x: 64, y: 698, width: 952, height: 962 }, 3);
  } else {
    coverStats(ctx, theme, page, 64, 434, 952);
    coverList(ctx, theme, page, { x: 64, y: 682, width: 952, height: 978 }, variant === 4 ? 2 : 1);
  }
}

function storyCard(ctx: CanvasRenderingContext2D, theme: VideoTheme, story: VideoStoryCard, box: TemplateBox) {
  panel(ctx, theme, box);
  const pad = box.width < 350 ? 18 : 26;
  const width = box.width - pad * 2;
  const x = box.x + pad;
  const compact = box.height < 550;
  const narrow = box.width < 530;
  ctx.fillStyle = theme.accent;
  singleLine(ctx, story.module, x, box.y + 40, width, 24);
  ctx.fillStyle = theme.ink;
  const titleSize = narrow ? (box.height > 1000 ? 46 : 34) : compact ? 38 : 48;
  const titleLines = narrow ? 5 : compact ? 2 : 3;
  const titleEnd = paragraph(ctx, story.title, x, box.y + 91, width, titleSize, titleLines, 850, DISPLAY_FONTS[theme.layout!.typography]);
  const summarySize = narrow ? (box.height > 1000 ? 34 : 27) : compact ? 28 : 33;
  const summaryStart = titleEnd + 18;
  const summaryLines = Math.min(12, Math.max(0, Math.floor((box.y + box.height - 135 - summaryStart) / (summarySize * 1.32))));
  if (summaryLines > 0) paragraph(ctx, story.summary, x, summaryStart, width, summarySize, summaryLines, 500);
  ctx.fillStyle = theme.secondary;
  singleLine(ctx, story.tags.slice(0, narrow ? 2 : 3).join(" / "), x, box.y + box.height - 91, width, 24, 650);
  ctx.fillStyle = theme.muted;
  singleLine(ctx, `${story.publishedAt} · ${story.sourceName}`, x, box.y + box.height - 54, width, 23, 600);
  paragraph(ctx, sourceLabel(story.sourceUrl), x, box.y + box.height - 24, width, 22, 1, 500);
}

function accountCard(ctx: CanvasRenderingContext2D, theme: VideoTheme, account: VideoAccountCard, box: TemplateBox) {
  panel(ctx, theme, box);
  const narrow = box.width < 600;
  const x = box.x + 26;
  const width = box.width - 52;
  ctx.fillStyle = theme.ink;
  singleLine(ctx, account.label, x, box.y + 46, width, narrow ? 30 : 34, 850);
  ctx.fillStyle = theme.muted; font(ctx, 23);
  ctx.fillText(`涉及 ${account.stockCount} 项`, x, box.y + 80);
  const values = [["净额", account.net], ["流入", account.incoming], ["流出", account.outgoing]];
  values.forEach(([label, value], index) => {
    const columnX = narrow ? x : x + index * width / 3;
    const rowY = narrow ? box.y + 126 + index * 62 : box.y + 122;
    ctx.fillStyle = theme.muted; font(ctx, 23); ctx.fillText(label, columnX, rowY);
    ctx.fillStyle = index === 0 ? (account.tone === "positive" ? theme.accent : theme.secondary) : theme.ink;
    if (narrow) singleLine(ctx, value, columnX + 74, rowY, width - 74, 28, 800);
    else singleLine(ctx, value, columnX, rowY + 43, width / 3 - 20, 32, 800);
  });
  ctx.fillStyle = theme.muted;
  paragraph(ctx, `关联：${account.relatedNames.join(" · ") || "暂无"}`, x, box.y + box.height - (narrow ? 72 : 32), width, 24, narrow ? 2 : 1);
}

export function drawTemplatePage(ctx: CanvasRenderingContext2D, storyboard: VideoStoryboard, page: VideoPage) {
  const theme = storyboard.theme;
  const layout = theme.layout!.content;
  if (page.kind === "cover") { cover(ctx, storyboard, page); return; }
  if (page.kind === "stories") {
    pageHeader(ctx, storyboard, page.module, `模块 ${page.modulePage} / ${page.modulePageTotal} · ${page.stories.length} 条公开信息`);
    const boxes = storyTemplateBoxes(layout, page.stories.length);
    if (layout === 3) {
      ctx.strokeStyle = theme.accent; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(94, 270); ctx.lineTo(94, 1640); ctx.stroke();
      boxes.forEach((box, index) => {
        ctx.fillStyle = theme.accent; ctx.beginPath(); ctx.arc(94, box.y + 45, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = theme.muted; font(ctx, 22); ctx.fillText(String(index + 1), 79, box.y + 82);
      });
    }
    if (layout === 6) {
      ctx.fillStyle = theme.accent;
      paragraph(ctx, "本期\n线索", 918, 316, 80, 32, 4, 800);
      ctx.fillStyle = theme.muted;
      paragraph(ctx, `${page.stories.length}条\n公开\n信息`, 918, 520, 80, 26, 5);
    }
    boxes.forEach((box, index) => storyCard(ctx, theme, page.stories[index], box));
    return;
  }
  if (page.kind === "ranking") {
    pageHeader(ctx, storyboard, page.direction === "in" ? "流入观察" : "流出观察", `${page.entries.length} 项 · 金额单位：万 · 按净额排序`);
    rankingTemplateBoxes(layout, page.entries.length).forEach((box, index) => {
      const entry = page.entries[index];
      const narrow = box.width < 600;
      panel(ctx, theme, box);
      ctx.fillStyle = theme.muted; font(ctx, 24, 700);
      ctx.fillText(String(index + 1).padStart(2, "0"), box.x + 22, box.y + (narrow ? 40 : box.height / 2 + 9));
      ctx.fillStyle = theme.ink;
      singleLine(ctx, entry.label, box.x + (narrow ? 24 : 88), box.y + (narrow ? 99 : box.height / 2 + 10), narrow ? box.width - 48 : box.width * 0.48 - 88, narrow ? 35 : 37, 800);
      ctx.fillStyle = entry.tone === "positive" ? theme.accent : theme.secondary;
      if (narrow) singleLine(ctx, entry.value, box.x + 24, box.y + 178, box.width - 48, 36, 850);
      else singleLine(ctx, entry.value, box.x + box.width * 0.55, box.y + box.height / 2 + 10, box.width * 0.45 - 24, 38, 850);
    });
    return;
  }
  pageHeader(ctx, storyboard, "活跃席位", `第 ${page.page} / ${page.pageTotal} 页 · 净额 / 流入 / 流出`);
  accountTemplateBoxes(layout, page.accounts.length).forEach((box, index) => accountCard(ctx, theme, page.accounts[index], box));
}
