import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { DAILY_VIDEO_THEMES, themeForDate, TEMPLATE_ROTATION_START } from "../../lib/osint/daily-video/themes.ts";
import { accountTemplateBoxes, rankingTemplateBoxes, storyTemplateBoxes, TEMPLATE_BODY, type TemplateBox } from "../../lib/osint/daily-video/template-layout.ts";
import { buildSoundtrack, fillSoundtrackChunk } from "../../lib/osint/daily-video/soundtrack.ts";
import type { VideoStoryboard, VideoTheme } from "../../lib/osint/daily-video/contracts.ts";

const dateAt = (index: number) => new Date(Date.parse(`${TEMPLATE_ROTATION_START}T00:00:00Z`) + index * 86_400_000).toISOString().slice(0, 10);
const schedule = Array.from({ length: 301 }, (_, day) => [themeForDate(dateAt(day), "morning"), themeForDate(dateAt(day), "close")]);
assert.equal(DAILY_VIDEO_THEMES.length, 200);
for (let start = 0; start <= 200; start += 1) {
  const window = schedule.slice(start, start + 100).flat();
  assert.equal(new Set(window.map((theme) => theme.id)).size, 200, `repeat within 100-day window starting ${dateAt(start)}`);
  assert.equal(new Set(window.map((theme) => theme.music?.id)).size, 200);
}
for (let day = 0; day < 100; day += 1) {
  assert.notEqual(schedule[day][0].layout?.cover, schedule[day][1].layout?.cover, "same-day editions must look different");
  assert.deepEqual(schedule[day][0], themeForDate(dateAt(day), "morning"), "retry changed assignment");
}
assert.notEqual(themeForDate("2026-09-08").id, themeForDate("2026-09-15").id);
assert.equal(themeForDate("2026-09-01").id, "signal-ripple");
for (const date of ["2026-02-30", "2026-9-08", "2026-13-01", "", "not-a-date"]) assert.throws(() => themeForDate(date), /INVALID_VIDEO_DATE/);
assert.equal(new Set(DAILY_VIDEO_THEMES.map((theme) => JSON.stringify(theme.layout))).size, 200, "names/colours alone cannot count as new templates");
const musicalIdentities = DAILY_VIDEO_THEMES.map((theme) => {
  const { id: _id, name: _name, ...score } = theme.music!;
  return JSON.stringify(score);
});
assert.equal(new Set(musicalIdentities).size, 200, "music must differ beyond title/ID");

function assertBoxes(boxes: TemplateBox[]) {
  for (const box of boxes) {
    assert.ok(box.width > 0 && box.height > 0);
    assert.ok(box.x >= TEMPLATE_BODY.x && box.y >= TEMPLATE_BODY.y);
    assert.ok(box.x + box.width <= TEMPLATE_BODY.x + TEMPLATE_BODY.width + 0.01);
    assert.ok(box.y + box.height <= TEMPLATE_BODY.y + TEMPLATE_BODY.height + 0.01);
  }
  for (let left = 0; left < boxes.length; left += 1) for (let right = left + 1; right < boxes.length; right += 1) {
    const a = boxes[left], b = boxes[right];
    const overlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0.01 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0.01;
    assert.equal(overlap, false, `overlapping cards: ${JSON.stringify([a, b])}`);
  }
}
for (let layout = 0; layout < 10; layout += 1) {
  for (let count = 0; count <= 3; count += 1) assertBoxes(storyTemplateBoxes(layout, count));
  for (let count = 0; count <= 10; count += 1) assertBoxes(rankingTemplateBoxes(layout, count));
  for (let count = 0; count <= 5; count += 1) assertBoxes(accountTemplateBoxes(layout, count));
}

function board(theme: VideoTheme): VideoStoryboard {
  return {
    mode: "morning", date: "2026-09-08", dataDate: "2026-09-08", theme,
    durationMs: 18_800, coverDurationMs: 1200, pageDurationMs: 2400, outroDurationMs: 800,
    pages: Array.from({ length: 8 }, () => ({ kind: "cover" as const, reportUrl: "https://example.com/report", kicker: "", title: "", subtitle: "", stats: [], highlights: [] })),
    outro: { title: "", disclaimer: "", asOf: "" },
  };
}

const audioHashes = new Set<string>();
for (const theme of DAILY_VIDEO_THEMES) {
  const soundtrack = buildSoundtrack(board(theme));
  const sample = new Float32Array(24_000);
  fillSoundtrackChunk(sample, 48_000, 12_000, 12_000, soundtrack);
  let squared = 0;
  for (const value of sample) { assert.ok(Number.isFinite(value) && Math.abs(value) < 0.8); squared += value * value; }
  assert.ok(Math.sqrt(squared / sample.length) > 0.006, `silent score: ${theme.id}`);
  audioHashes.add(createHash("sha256").update(Buffer.from(sample.buffer)).digest("hex"));
}
assert.equal(audioHashes.size, 200, "actual PCM should differ for all templates");

const soundtrack = buildSoundtrack(board(DAILY_VIDEO_THEMES[0]));
const whole = new Float32Array(96_000);
fillSoundtrackChunk(whole, 0, 48_000, 48_000, soundtrack);
for (let start = 0; start < 48_000; start += 2048) {
  const length = Math.min(2048, 48_000 - start);
  const chunk = new Float32Array(length * 2);
  fillSoundtrackChunk(chunk, start, length, 48_000, soundtrack);
  assert.deepEqual(chunk.subarray(0, length), whole.subarray(start, start + length));
  assert.deepEqual(chunk.subarray(length), whole.subarray(48_000 + start, 48_000 + start + length));
}
console.log("REPORT_TEMPLATE_ROTATION_OK: 200 templates, rolling 100-day uniqueness, bounded layouts, 200 distinct audible scores, chunk continuity");
