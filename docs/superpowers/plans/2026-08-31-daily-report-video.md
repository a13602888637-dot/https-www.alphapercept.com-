# 每日复盘短视频 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在报告页在线生成 7 日轮换、早晚双变体、带原创轻音效的 1080×1920 WebM 短视频。

**Architecture:** 报告快照先经纯函数生成分镜，再由客户端 Canvas 按主题绘制并通过 MediaRecorder 录制；Web Audio 同步生成提示音。服务端、数据库和 PNG API 不变。

**Tech Stack:** TypeScript、React 19、Canvas 2D、Web Audio、MediaRecorder、Next.js 15。

## Global Constraints

- 7 个星期主题，每个主题含早报和收盘两个变体。
- 早报每天可生成；收盘仅当 `lhb.tradeDate === reportDate` 时可生成。
- 1080×1920、30fps、10–12 秒 WebM。
- 不新增依赖、密钥、TTS、版权音乐、数据库或对象存储。
- 保留现有 PNG 下载，不自动发布抖音。

---

### Task 1: 主题和分镜纯函数

**Files:**
- Create: `lib/osint/daily-video/contracts.ts`
- Create: `lib/osint/daily-video/themes.ts`
- Create: `lib/osint/daily-video/storyboard.ts`
- Create: `tests/osint/daily-report-video.test.ts`

**Interfaces:**
- Produces: `themeForDate(date: string): VideoTheme`
- Produces: `buildVideoStoryboard(report, mode): VideoStoryboard`

- [ ] **Step 1: 写失败测试**

覆盖 7 个连续日期得到 7 个主题、同日早晚分镜不同、过期收盘数据抛出 `STALE_CLOSE_DATA`。

- [ ] **Step 2: 运行 RED**

Run: `node --import tsx tests/osint/daily-report-video.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现类型、7 套主题和分镜选择**

`VideoStoryboard` 固定包含 `theme`、`mode`、`durationMs`、`cover`、`scenes`、`outro`；早报最多 5 条新闻，收盘使用 8 条资金变化和 4 个活跃席位。

- [ ] **Step 4: 运行 GREEN 并提交**

Run: `node --import tsx tests/osint/daily-report-video.test.ts`
Expected: `DAILY_REPORT_VIDEO_TEST_OK`

### Task 2: Canvas 与音频渲染

**Files:**
- Create: `lib/osint/daily-video/canvas-renderer.ts`
- Create: `lib/osint/daily-video/audio.ts`
- Create: `lib/osint/daily-video/generate.ts`
- Modify: `tests/osint/daily-report-video.test.ts`

**Interfaces:**
- Consumes: `VideoStoryboard`, `VideoTheme`
- Produces: `drawVideoFrame(ctx, storyboard, elapsedMs): void`
- Produces: `generateReportVideo(storyboard, onProgress): Promise<Blob>`

- [ ] **Step 1: 扩展失败测试**

断言每个主题的封面布局、配色和音效签名不同，并验证 MIME 选择回退顺序。

- [ ] **Step 2: 运行 RED**

Run: `node --import tsx tests/osint/daily-report-video.test.ts`
Expected: FAIL，渲染函数不存在。

- [ ] **Step 3: 实现 Canvas 分镜、Web Audio 和 MediaRecorder**

使用 `canvas.captureStream(30)`，优先 `video/webm;codecs=vp9,opus`，回退 VP8/WebM；结束时停止所有轨道并关闭 AudioContext。

- [ ] **Step 4: 运行 GREEN 并提交**

Run: `node --import tsx tests/osint/daily-report-video.test.ts`
Expected: `DAILY_REPORT_VIDEO_TEST_OK`

### Task 3: 报告页生成入口

**Files:**
- Create: `components/osint-reports/ReportVideoActions.tsx`
- Modify: `components/osint-reports/PrintActions.tsx`
- Modify: `tests/osint/daily-report-image-surface.test.ts`

**Interfaces:**
- Produces: `ReportVideoActions({ reportId, exportReady })`
- Fetches: `/api/osint/v1/reports/${reportId}`

- [ ] **Step 1: 写失败的界面契约测试**

断言页面包含“生成早报短视频”“生成收盘短视频”、进度状态和 `STALE_CLOSE_DATA` 提示。

- [ ] **Step 2: 运行 RED**

Run: `node --import tsx tests/osint/daily-report-image-surface.test.ts`
Expected: FAIL，组件不存在。

- [ ] **Step 3: 实现按钮、进度、下载和错误提示**

下载文件名为 `alphapercept-YYYY-MM-DD-morning|close-<theme>.webm`；录制中禁用重复点击。

- [ ] **Step 4: 运行 GREEN 并提交**

Run: `node --import tsx tests/osint/daily-report-image-surface.test.ts`
Expected: `DAILY_REPORT_IMAGE_SURFACE_OK`

### Task 4: 浏览器验收与上线

**Files:**
- Modify only if verification finds defects in Task 1–3 files.

- [ ] **Step 1: 运行聚焦测试和构建**

Run: `node --import tsx tests/osint/daily-report-video.test.ts && node --import tsx tests/osint/daily-report-image-surface.test.ts && npm run build`
Expected: all exit 0。

- [ ] **Step 2: 本地真实报告生成**

用 8 月 31 日报告在 Chrome 生成早报视频；收盘数据不新鲜时必须被门禁阻止。使用 `ffprobe` 校验 1080×1920、10–12 秒、视频流和音轨。

- [ ] **Step 3: 提交、推送、生产部署**

只添加本计划涉及文件；先 `git push origin HEAD:main`，再 `vercel deploy --prod`。

- [ ] **Step 4: 线上回归**

确认报告页出现两个视频按钮，真实下载成功，PNG 下载仍可用。
