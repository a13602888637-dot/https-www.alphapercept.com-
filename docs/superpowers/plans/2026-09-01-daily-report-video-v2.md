# 每日复盘高密度 MP4 视频 V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把早报和收盘视频改成模块化高密度翻页小报，并输出 TikTok 可上传的 H.264/AAC MP4。

**Architecture:** 报告快照先由纯函数整理成动态时长的 `VideoPage[]`；Canvas 使用固定 9:16 杂志网格绘制首屏、新闻双卡、榜单双页和 account 五卡。浏览器使用 WebCodecs 离线编码 H.264/AAC，由锁定版本 `mp4-muxer@5.2.2` 封装 MP4；缺少编码支持时明确失败，不伪造格式。

**Tech Stack:** TypeScript、React 19、Canvas 2D、WebCodecs、mp4-muxer 5.2.2、Next.js 15、ffprobe。

## Global Constraints

- 输出 MP4，视频 H.264/AVC，音频 AAC-LC，1080×1920，30fps。
- 早报最多 20 条新闻，按模块连续分页；每页最多 3 条，单条内容不跨页。
- 收盘最多 20 个榜单项和 10 个 account；榜单每页 10 项、account 每页 5 个。
- 首屏和结尾不使用大面积空白；每页固定报告链接、页码和“公开信息整理 · 不构成投资建议”。
- 7 天主题只改变视觉皮肤和短翻页动效，不改变阅读网格。
- 仅新增锁定版本 `mp4-muxer@5.2.2`，不引入 ffmpeg.wasm，不回退 WebM，不自动发布 TikTok/抖音，不删除 PNG。
- 不实现审核规避、OCR 干扰、拼音混写或用 Emoji 替换敏感关键词。

---

### Task 1: 高密度页面契约与分镜

**Files:**
- Modify: `lib/osint/daily-video/contracts.ts`
- Modify: `lib/osint/daily-video/storyboard.ts`
- Modify: `tests/osint/daily-report-video.test.ts`

**Interfaces:**
- Produces: `buildVideoStoryboard(report, mode, options): VideoStoryboard`
- Produces: `VideoPage` union with `cover | stories | ranking | accounts`
- Produces: `reportUrl`, `pageDurationMs`, `durationMs`, `pages`

- [ ] **Step 1: 写失败测试**

把测试新闻扩为 20 条、分成宏观/科技/能源三个模块；把收盘数据扩为正向 10 项、负向 10 项和 10 个 account。增加以下断言：

```ts
const morning = buildVideoStoryboard(snapshot20, "morning", {
  reportUrl: "https://www.alphapercept.com/osint/reports/report-1",
});
assert.equal(morning.pages.flatMap((page) => page.kind === "stories" ? page.stories : []).length, 20);
assert.equal(morning.pages.filter((page) => page.kind === "stories").every((page) => page.stories.length <= 2), true);
const modulePages = morning.pages.filter((page) => page.kind === "stories");
for (const module of new Set(modulePages.map((page) => page.module))) {
  const indexes = modulePages.flatMap((page, index) => page.module === module ? [index] : []);
  assert.equal(indexes.at(-1)! - indexes[0] + 1, indexes.length);
}
assert.equal(morning.pages.every((page) => page.reportUrl.includes("report-1")), true);

const close = buildVideoStoryboard(snapshot20, "close", { reportUrl: "https://www.alphapercept.com/osint/reports/report-1" });
assert.equal(close.pages.flatMap((page) => page.kind === "ranking" ? page.entries : []).length, 20);
assert.equal(close.pages.flatMap((page) => page.kind === "accounts" ? page.accounts : []).length, 10);
```

- [ ] **Step 2: 运行 RED**

Run: `node --import tsx tests/osint/daily-report-video.test.ts`
Expected: FAIL，因为 `pages` 和第三参数尚不存在。

- [ ] **Step 3: 实现页面类型与分页纯函数**

在 `contracts.ts` 定义：

```ts
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
}

export type VideoPage =
  | { kind: "cover"; title: string; subtitle: string; stats: Array<{ label: string; value: string }>; highlights: string[]; reportUrl: string }
  | { kind: "stories"; module: string; modulePage: number; modulePageTotal: number; stories: VideoStoryCard[]; reportUrl: string }
  | { kind: "ranking"; direction: "in" | "out"; entries: VideoRankingEntry[]; reportUrl: string }
  | { kind: "accounts"; accounts: VideoAccountCard[]; reportUrl: string };

export interface BuildVideoStoryboardOptions {
  reportUrl: string;
}
```

`storyboard.ts` 使用稳定大模块分组：每个模块最多三条一页；余项统一进入“综合观察”模块后以 2–3 条分页，无法成组的单条不入选。早报动态时长为 `1200 + contentPages * 2400 + 800`，收盘为 `1200 + contentPages * 3600 + 800`。

- [ ] **Step 4: 运行 GREEN**

Run: `node --import tsx tests/osint/daily-report-video.test.ts`
Expected: `DAILY_REPORT_VIDEO_TEST_OK`

- [ ] **Step 5: 提交**

```bash
git add lib/osint/daily-video/contracts.ts lib/osint/daily-video/storyboard.ts tests/osint/daily-report-video.test.ts
git commit -m "feat: 重构高密度日报视频分镜"
```

### Task 2: 均衡页面渲染与短翻页

**Files:**
- Modify: `lib/osint/daily-video/canvas-renderer.ts`
- Modify: `tests/osint/daily-report-video.test.ts`

**Interfaces:**
- Consumes: `VideoStoryboard.pages`
- Produces: `pageIndexAtTime(storyboard, elapsedMs): number`
- Produces: `pageTransitionAtTime(storyboard, elapsedMs): number`
- Produces: `drawVideoFrame(ctx, storyboard, elapsedMs): void`

- [ ] **Step 1: 写失败测试**

```ts
assert.equal(pageIndexAtTime(morning, 0), 0);
assert.equal(pageIndexAtTime(morning, 1_800), 1);
assert.equal(pageTransitionAtTime(morning, 2_200), 1);
assert.equal(pageTransitionAtTime(morning, 5_990) > 0, true);
```

- [ ] **Step 2: 运行 RED**

Run: `node --import tsx tests/osint/daily-report-video.test.ts`
Expected: FAIL，因为页面时间函数尚不存在。

- [ ] **Step 3: 实现固定高密度网格**

`canvas-renderer.ts` 拆为以下内部函数，全部在 1080×1920 安全区 `64..1016` 内绘制：

```ts
drawDenseCover(ctx, storyboard, page, motion);
drawStoryPage(ctx, storyboard, page, motion);
drawRankingPage(ctx, storyboard, page, motion);
drawAccountsPage(ctx, storyboard, page, motion);
drawPersistentFooter(ctx, storyboard, pageIndex);
```

新闻页使用三张等高卡片，最后一页可用两张；榜单页固定 10 行，account 页固定 5 卡。转场使用 280ms 双页连续横向滑动，不降低中段文字透明度、不出现闪白。

- [ ] **Step 4: 运行 GREEN 与边界检查**

Run: `node --import tsx tests/osint/daily-report-video.test.ts`
Expected: `DAILY_REPORT_VIDEO_TEST_OK`

Run: `npx tsc --noEmit --target ES2020 --module ESNext --moduleResolution bundler --lib DOM,ES2022 --skipLibCheck lib/osint/daily-video/*.ts`
Expected: exit 0。

- [ ] **Step 5: 提交**

```bash
git add lib/osint/daily-video/canvas-renderer.ts tests/osint/daily-report-video.test.ts
git commit -m "feat: 重排日报视频高密度页面"
```

### Task 3: MP4 录制与下载入口

**Files:**
- Modify: `lib/osint/daily-video/generate.ts`
- Create: `lib/osint/daily-video/mp4-encoder.ts`
- Modify: `components/osint-reports/ReportVideoActions.tsx`
- Modify: `tests/osint/daily-report-video.test.ts`
- Modify: `tests/osint/daily-report-image-surface.test.ts`

**Interfaces:**
- Produces: `generateReportVideo(storyboard, onProgress): Promise<Blob>` returning MP4 only

- [ ] **Step 1: 写失败测试**

```ts
assert.equal(mp4EncodingApisAvailable({ VideoEncoder: {}, AudioEncoder: {}, VideoFrame: {}, AudioData: {} }), true);
assert.equal(mp4EncodingApisAvailable({ VideoEncoder: {}, AudioEncoder: {}, VideoFrame: {} }), false);
assert.equal(reportVideoActionsSource.includes(".mp4"), true);
assert.equal(reportVideoActionsSource.includes(".webm"), false);
```

- [ ] **Step 2: 运行 RED**

Run: `node --import tsx tests/osint/daily-report-video.test.ts && node --import tsx tests/osint/daily-report-image-surface.test.ts`
Expected: MIME 与扩展名断言失败。

- [ ] **Step 3: 实现 MP4-only 录制**

`mp4-encoder.ts` 固定使用：

```ts
const VIDEO_CODEC = "avc1.420028";
const AUDIO_CODEC = "mp4a.40.2";
const FRAME_RATE = 30;
```

逐帧绘制 Canvas，用 `VideoEncoder`/`AudioEncoder` 离线编码；原创提示音直接生成 PCM，按动态页起点安排。编码块交给 `Muxer`，最终 Blob 固定为 `video/mp4`。缺少任一 API 或编码配置时抛出 `MP4_RECORDING_UNSUPPORTED`。

`ReportVideoActions.tsx` 把当前报告绝对 URL 传给分镜，下载 `.mp4`，进度文案改为“约 N 秒，可切到其他标签页但不要关闭页面”。

- [ ] **Step 4: 运行 GREEN**

Run: `node --import tsx tests/osint/daily-report-video.test.ts && node --import tsx tests/osint/daily-report-image-surface.test.ts`
Expected: 两个测试均输出 OK。

- [ ] **Step 5: 提交**

```bash
git add package.json bun.lock lib/osint/daily-video/mp4-encoder.ts lib/osint/daily-video/generate.ts components/osint-reports/ReportVideoActions.tsx tests/osint/daily-report-video.test.ts tests/osint/daily-report-image-surface.test.ts
git commit -m "feat: 导出TikTok兼容MP4日报视频"
```

### Task 4: 真实样片、生产构建与部署

**Files:**
- Modify only if visual or encoding verification finds defects in Task 1–3 files.

**Interfaces:**
- Verifies: report page → snapshot → storyboard → Canvas/Audio → MP4 download

- [ ] **Step 1: 生成真实早报与收盘样片**

使用 2026-08-31 真实报告 JSON，通过本地 Chrome 分别生成早报与收盘 MP4，输出到 `/tmp/alphapercept-preview/`；把最终早报和收盘样片复制到桌面。

- [ ] **Step 2: 编码与页面视觉验收**

Run: `ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,sample_rate,channels -of json <sample.mp4>`
Expected: `h264`、`aac`、`1080`、`1920`、`30/1`。

从早报首屏、4 个模块页面和结尾、收盘全部页面抽帧，逐张确认：内容填充均衡、无越界、同一条信息不跨页、来源链接可读。

- [ ] **Step 3: 聚焦回归与生产构建**

Run: `node --import tsx tests/osint/daily-report-video.test.ts && node --import tsx tests/osint/daily-report-image-surface.test.ts`
Expected: 两个测试均输出 OK。

Run: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY='pk_test_Y2xlcmsuZXhhbXBsZS5jb20k' CLERK_SECRET_KEY='sk_test_local_build_only' npm run build`
Expected: exit 0；允许本地未配置 `DATABASE_URL` 的既有警告。

- [ ] **Step 4: 推送与生产部署**

确认工作区仅包含本计划文件，执行：

```bash
git push origin HEAD:main
vercel deploy --prod --yes
```

Expected: Vercel deployment `READY`，别名为 `https://www.alphapercept.com`。

- [ ] **Step 5: 线上验证**

访问 `https://www.alphapercept.com/osint/reports`，确认生产 JS 包含 MP4 文件名、两个生成按钮和新错误提示；PNG 按钮仍存在。
