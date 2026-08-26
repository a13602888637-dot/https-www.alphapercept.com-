# Upcoming Events and Three-Page PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add authoritative future-event cards to OSINT and replace the long PDF with a social-media-ready fixed three-page report.

**Architecture:** Official calendar adapters normalize scheduled events into the existing story pipeline without DeepSeek. The PDF renderer consumes the same story curation and LHB ranking functions, but uses dedicated fixed-page renderers so each module has a deterministic one-page budget. The browser and PDF share topic labels, timing semantics, and cached source records.

**Tech Stack:** Next.js 15, TypeScript, Prisma/PostgreSQL cache, PDFKit 0.20.1, Noto Sans SC, Tailwind CSS.

## Global Constraints

- Future window is exactly 7 days and only official-source events enter it.
- Future events never call DeepSeek and always carry the `未来事件` topic tag.
- Ordinary news remains newest-first; future events are nearest-first.
- Full PDF is exactly 3 A4 pages; `stories`, `stocks`, and `lhb` exports are exactly 1 page each.
- PDF contains no market-price page and no cover page.
- Every page retains watermark, disclaimer, page number, and source-time boundary.
- Social palette: navy `#0B1B32`, cyan `#00B8C4`, coral `#F45B69`, orange `#F59E32`, green `#11966F`, canvas `#F6FAFC`.
- Hotspot page content must end near the footer safe line without blank lower blocks or unreadably small text.

---

### Task 1: Scheduled-event contract and official adapters

**Files:**
- Create: `lib/osint/scheduled-events.ts`
- Modify: `lib/osint/contracts.ts`
- Modify: `lib/osint/story-service.ts`
- Test: `tests/osint/scheduled-events-contract.test.ts`

**Interfaces:**
- Produces: `fetchScheduledEvents(options?: { now?: Date; fetchImpl?: typeof fetch; days?: number; finnhubApiKey?: string | null }): Promise<ScheduledEventFetchResult>` where the result contains `stories` plus per-source `{ name, ok, count, error }` health.
- Extends: `OsintStory` with `eventType: "news" | "upcoming"` and `scheduledFor: string | null`
- Consumes: Finnhub earnings/IPO calendars, Fed monthly calendar, BLS ICS, BEA release schedule, and NVIDIA Newsroom press-release RSS as a precision-time supplement.

- [ ] **Step 1: Write the failing contract test**

Create fixtures for Fed, BLS, BEA, and NVIDIA. Assert that an event inside seven days is normalized with `eventType: "upcoming"`, `scheduledFor`, `未来事件`, official verification, impact assets, and no future event outside the seven-day window.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
TS_NODE_TRANSPILE_ONLY=1 TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"Node"}' node -r ts-node/register tests/osint/scheduled-events-contract.test.ts
```

Expected: FAIL because `scheduled-events.ts` and the new fields do not exist.

- [ ] **Step 3: Implement the normalized adapter**

Implement source-local parsers and return `RawStory` objects shaped as:

```ts
{
  sourceId: `scheduled:${source}:${scheduledFor}:${slug}`,
  sourceName,
  sourceUrl,
  title,
  description,
  publishedAt: scheduledFor,
  scheduledFor,
  eventType: "upcoming",
  topicHints: ["未来事件", category],
  preAnalyzed: true,
  importanceHint,
}
```

Use `America/New_York` for Fed/BLS/BEA times and `America/Los_Angeles` for NVIDIA times before converting to ISO. Fetch sources with `Promise.allSettled`; preserve the last successful persistent stories when a source fails, and expose source health for monitoring.

- [ ] **Step 4: Merge scheduled events into story collection**

Add the adapter result to `getStorySnapshot()`. Allow future records through the 7-day bound, merge persistent cached events when official sources fail, and sort upcoming events by `scheduledFor` ascending before ordinary news by `publishedAt` descending.

- [ ] **Step 5: Run focused story tests**

Run the scheduled-event contract and existing story/cache tests. Expected: `SCHEDULED_EVENTS_CONTRACT_OK`, `STORY_CONTRACT_OK`, and `STORY_CACHE_SURFACE_OK`.

---

### Task 2: Future-event browser experience

**Files:**
- Modify: `components/osint-v2/WorldBriefing.tsx`
- Modify: `lib/osint/daily-report/story-curation.ts`
- Test: `tests/osint/story-contract.test.ts`
- Test: `tests/osint/daily-report-pdf-contract.test.ts`

**Interfaces:**
- Consumes: `OsintStory.eventType` and `OsintStory.scheduledFor`
- Produces: `未来事件` filter and `upcoming` report category.

- [ ] **Step 1: Add failing UI/source assertions**

Assert `TOPICS` includes `未来事件`, upcoming cards render “今天 / X天后”, and report curation exposes `未来大事` before macro/energy/technology modules.

- [ ] **Step 2: Verify RED**

Run the story and report contract tests. Expected: assertions fail on the missing label/category.

- [ ] **Step 3: Implement UI timing and visual state**

Use amber border/background for upcoming cards, show Beijing time and relative countdown, keep the official source link, and change the section subtitle to “过去3天新闻 + 未来7天事件”.

- [ ] **Step 4: Extend report curation**

Add category key `upcoming` with label `未来大事`. Future events bypass DeepSeek but still require official verification and an importance score of at least 7.

- [ ] **Step 5: Run tests**

Expected: story and report contracts pass without changing ordinary-news descending order.

---

### Task 3: Fixed-page PDF renderers and social palette

**Files:**
- Modify: `lib/osint/daily-report/pdf-export.ts`
- Modify: `lib/osint/daily-report/pdf-readiness.ts`
- Modify: `tests/osint/daily-report-pdf-contract.test.ts`
- Modify: `tests/osint/daily-report-surface.test.ts`

**Interfaces:**
- Produces: full PDF pages `[stories, stocks, lhb]` and single-section PDFs with exactly one page.
- Reuses: `curateReportStories()` and `rankReportStocks()`.

- [ ] **Step 1: Write failing page-count and layout-contract tests**

Generate fixtures large enough to overflow the old renderer. Assert `%PDF-`, full page count `3`, each single export page count `1`, absence of `全球行情`, and presence of future/macro/energy/technology section titles.

- [ ] **Step 2: Verify RED**

Run:

```bash
TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"Node"}' node -r ts-node/register tests/osint/daily-report-pdf-contract.test.ts
```

Expected: FAIL because the current renderer produces more than three pages.

- [ ] **Step 3: Replace flow layout with fixed page budgets**

Create three render functions:

```ts
drawStoryBoardPage(doc, report); // future band + 2x2 full-height category grid
drawStockBoardPage(doc, report); // max 36 unique rows, 17.6pt row height
drawHotMoneyBoardPage(doc, report); // max 28 rows, one lead stock per seat
```

Do not call `doc.addPage()` inside any page renderer. The orchestration layer alone creates pages.

- [ ] **Step 4: Apply the social palette**

Increase heading contrast, use cyan category rails, coral positive-flow values, green sells, and orange future-event emphasis. Expand hotspot panels to fill the area above the footer safe line; use two stories per module with two-line summaries and visible tags rather than adding low-value stories.

- [ ] **Step 5: Run PDF contract tests**

Expected: `DAILY_REPORT_PDF_CONTRACT_OK` and `DAILY_REPORT_SURFACE_OK`.

- [ ] **Step 6: Render and visually inspect**

Generate the production-data PDF, run `pdfinfo`, `pdftotext`, and `pdftoppm`, and inspect all three PNG pages. Reject clipped text, gray low-contrast labels, empty lower blocks, missing watermark, or page counts other than three.

---

### Task 4: Production verification

**Files:**
- No new source files.

**Interfaces:**
- Verifies: scheduled-event API, persistent cache, PDF exports, CDN cache, and mobile report page.

- [ ] **Step 1: Run focused regression and production build**

Run scheduled event, story cache, report contract, surface, and public-context tests, then `prisma validate` and `next build`.

- [ ] **Step 2: Commit and push explicit files**

Use explicit `git add` paths and a Chinese commit message with the required co-author line.

- [ ] **Step 3: Deploy with the tracked Bun lock**

Confirm `package-lock.json` is absent, then run `vercel deploy --prod --force` with proxy variables unset.

- [ ] **Step 4: Verify production outputs**

Confirm:

- `/api/osint/v1/stories?topic=未来事件` returns official future events in nearest-first order.
- NVIDIA result and call times are 04:20 and 05:00 Beijing.
- Full PDF is three pages; each section PDF is one page.
- Second identical PDF request is `x-vercel-cache: HIT`.
- Mobile report page shows the three modules and no “打印/行情” export text.

## Self-Review

- Spec coverage: future-event sources, UI tag, cache behavior, fixed PDF pages, social palette, and deployment verification all map to tasks.
- Placeholder scan: no TBD/TODO or unspecified implementation steps remain.
- Type consistency: `eventType`, `scheduledFor`, `fetchScheduledEvents`, `upcoming`, and the three page-render function names are consistent across tasks.
