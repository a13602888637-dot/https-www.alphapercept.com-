# OSINT Intelligence Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unused OSINT map and long AI panel with trustworthy global markets, a tagged world-news timeline, and stable read-only REST v1 data for other agents.

**Architecture:** Put all public OSINT contracts and server aggregation in `lib/osint/`. Legacy `/api/global-macro` and `/api/news-feed` remain compatible, while new `/api/osint/v1/*` routes expose the same normalized snapshots. The `/osint` page consumes `/api/osint/v1/context`, so the screen and agent clients cannot drift.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, native `fetch`, DeepSeek chat completions, Tailwind CSS, Node `assert` via existing `ts-node`.

## Global Constraints

- Do not edit `package.json`, add dependencies, or touch existing unrelated dirty files.
- Do not delete any page, API, Prisma model, or user data; hide `/my-stocks` only from `TopNavBar`.
- Keep `/dashboard`, `/uzi-reports`, and `/osint` URLs stable; relabel them as `今日`, `深度研究`, and `OSINT 情报`.
- Public OSINT v1 responses must not include Clerk identity, watchlist, portfolio, or personal notes.
- Never expose or log API keys.
- Never show hard-coded or mock prices as live data; unavailable numbers are `null` and render as `—`.
- Preserve Chinese market color convention: up is red, down is green.
- Do not depend on the retired Stooq `/q/l/` endpoint.
- Keep existing map, portfolio, and AI component files on disk even when no longer mounted.

---

## File Structure

- Create `lib/osint/contracts.ts`: stable v1 market/story/context interfaces and status guards.
- Create `lib/osint/market-manifest.ts`: the single authoritative symbol manifest.
- Create `lib/osint/market-service.ts`: Yahoo, East Money, U.S. Treasury, merge, coverage, and last-good logic.
- Create `lib/osint/story-service.ts`: source parsing, deduplication, deterministic scoring/tags, DeepSeek enrichment, and cache.
- Create `lib/osint/http.ts`: ETag and v1 JSON response helpers.
- Create `app/api/osint/v1/markets/route.ts`, `stories/route.ts`, `context/route.ts`: read-only v1 endpoints.
- Modify `app/api/global-macro/route.ts`: compatibility adapter over `getMarketSnapshot()`.
- Modify `app/api/treasury/route.ts`: compatibility adapter over official Treasury yield data; remove mock fallback.
- Modify `app/api/news-feed/route.ts`: compatibility adapter over `getStorySnapshot()`; raw news remains when DeepSeek fails.
- Create `components/osint-v2/MarketBoard.tsx`: categorized market list and trust state.
- Create `components/osint-v2/WorldBriefing.tsx`: timeline, filters, search, tags, sources, and one-line advice.
- Modify `components/osint-v2/SituationScreen.tsx`: two-column workspace, no map, no watchlist, no long AI panel.
- Modify `components/osint-v2/StatusBar.tsx`: compact coverage and Agent API rail.
- Modify `components/layout/TopNavBar.tsx`: `今日 / 深度研究 / OSINT 情报`; hide My Stocks.
- Create `tests/osint/market-contract.test.ts`, `story-contract.test.ts`, `public-context.test.ts`: focused no-dependency verification.

---

### Task 1: Stable Contracts and Authoritative Manifest

**Files:**
- Create: `lib/osint/contracts.ts`
- Create: `lib/osint/market-manifest.ts`
- Create: `tests/osint/market-contract.test.ts`

**Interfaces:**
- Produces: `OsintMarket`, `OsintStory`, `OsintContext`, `MarketManifestEntry`, `MARKET_MANIFEST`, `calculateCoverage()`.
- Consumes: no earlier task.

- [ ] **Step 1: Write the failing contract test**

```ts
import assert from "node:assert/strict";
import { MARKET_MANIFEST } from "../../lib/osint/market-manifest";

const required = [
  "^GSPC", "^IXIC", "^DJI", "^N225", "^KS11", "GEISAC.FGI",
  "NQ=F", "ES=F", "YM=F", "NKD=F", "CN00Y",
  "CL=F", "BZ=F", "^VIX", "UST1Y", "UST10Y", "UST20Y", "UST30Y",
];

assert.deepEqual(required.filter((symbol) => !MARKET_MANIFEST[symbol]), []);
assert.equal(MARKET_MANIFEST["CL=F"].name, "WTI原油");
assert.equal(MARKET_MANIFEST["BZ=F"].name, "Brent原油");
assert.equal(MARKET_MANIFEST["^VIX"].instrumentType, "index");
assert.equal(new Set(Object.keys(MARKET_MANIFEST)).size, Object.keys(MARKET_MANIFEST).length);
console.log("MARKET_CONTRACT_OK");
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
npx ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' tests/osint/market-contract.test.ts
```

Expected: failure because `lib/osint/market-manifest.ts` does not exist.

- [ ] **Step 3: Add contracts and manifest**

`lib/osint/contracts.ts` must define these exact fields:

```ts
export type OsintDataStatus = "live" | "cached" | "stale" | "unavailable";
export type OsintInstrumentType = "index" | "future" | "commodity" | "fx" | "yield";

export interface OsintMarket {
  symbol: string;
  name: string;
  category: "index" | "future" | "commodity" | "fx" | "rate";
  instrumentType: OsintInstrumentType;
  region: string;
  value: number | null;
  change: number | null;
  changePercent: number | null;
  source: string;
  asOf: string | null;
  status: OsintDataStatus;
  confidence: "official" | "multi-source" | "single-source" | "unavailable";
}

export interface StoryTags {
  topic: string[];
  region: string[];
  assets: string[];
  direction: "risk-on" | "risk-off" | "mixed" | "neutral";
  horizon: "intraday" | "1-3d" | "1-3w" | "medium";
  verification: "official" | "multi-source" | "single-source";
}

export interface OsintStory {
  id: string;
  publishedAt: string;
  title: string;
  summary: string;
  importance: number;
  sources: Array<{ name: string; url: string }>;
  tags: StoryTags;
  analysisStatus: "complete" | "fallback";
}

export interface Coverage {
  available: number;
  total: number;
  ratio: number;
  stale: number;
}

export interface OsintContext {
  schemaVersion: "1.0";
  generatedAt: string;
  coverage: Coverage;
  markets: OsintMarket[];
  stories: OsintStory[];
  advice: { text: string; confidence: "high" | "medium" | "low"; generatedAt: string | null };
}

export interface MarketSnapshot {
  schemaVersion: "1.0";
  generatedAt: string;
  coverage: Coverage;
  markets: OsintMarket[];
}

export interface StorySnapshot {
  schemaVersion: "1.0";
  generatedAt: string;
  stories: OsintStory[];
  advice: { text: string; confidence: "high" | "medium" | "low"; generatedAt: string | null };
  sources: Array<{ name: string; ok: boolean; count: number }>;
}

export function calculateCoverage(items: Array<{ status: OsintDataStatus }>): Coverage {
  const available = items.filter((item) => item.status !== "unavailable").length;
  const stale = items.filter((item) => item.status === "stale").length;
  const total = items.length;
  return { available, total, stale, ratio: total === 0 ? 0 : Number((available / total).toFixed(2)) };
}
```

`market-manifest.ts` must contain all exact symbols from the spec, with Yahoo symbols for global markets, East Money secids for A-share indices and `104.CN00Y`, and Treasury field keys for `UST1Y/10Y/20Y/30Y`. It must not contain `OANDA:BCO_USD`, `VIXY`, `zn.f`, or Stooq symbols.

- [ ] **Step 4: Run the contract test**

Expected: `MARKET_CONTRACT_OK`, exit 0.

- [ ] **Step 5: Commit Task 1**

```bash
git add lib/osint/contracts.ts lib/osint/market-manifest.ts tests/osint/market-contract.test.ts
git commit -m "feat: define osint data contracts"
```

---

### Task 2: Reliable Market Aggregation and Compatible APIs

**Files:**
- Create: `lib/osint/market-service.ts`
- Create: `lib/osint/http.ts`
- Create: `app/api/osint/v1/markets/route.ts`
- Modify: `app/api/global-macro/route.ts`
- Modify: `app/api/treasury/route.ts`
- Extend test: `tests/osint/market-contract.test.ts`

**Interfaces:**
- Consumes: `MARKET_MANIFEST`, `OsintMarket`, `Coverage`.
- Produces: `getMarketSnapshot(fetchImpl?: typeof fetch): Promise<{ markets: OsintMarket[]; coverage: Coverage; generatedAt: string }>` and `jsonWithEtag(body, cacheControl)`.

- [ ] **Step 1: Extend the failing test with source payload fixtures**

Use injected `fetchImpl` fixtures to assert:

```ts
assert.equal(snapshot.markets.find((m) => m.symbol === "CL=F")?.value, 85.4);
assert.equal(snapshot.markets.find((m) => m.symbol === "CN00Y")?.source, "eastmoney");
assert.equal(snapshot.markets.find((m) => m.symbol === "UST20Y")?.confidence, "official");
assert.equal(snapshot.markets.find((m) => m.symbol === "BZ=F")?.status, "unavailable");
assert.equal(snapshot.coverage.total, Object.keys(MARKET_MANIFEST).length);
```

- [ ] **Step 2: Run and confirm failure**

Expected: failure because `getMarketSnapshot` is missing.

- [ ] **Step 3: Implement market service**

The implementation must:

1. Fetch Yahoo Chart URLs for Yahoo-backed symbols with an 8-second timeout and bounded concurrency.
2. Parse `meta.regularMarketPrice`, `meta.chartPreviousClose`, `meta.regularMarketTime` and compute change safely.
3. Fetch East Money `ulist.np` with `fltt=2`, including `104.CN00Y` and A-share index secids.
4. Fetch official U.S. Treasury XML for the current month and parse the two newest records for `BC_1YEAR`, `BC_10YEAR`, `BC_20YEAR`, and `BC_30YEAR`.
5. Keep a module-level last-good map. A failed refresh may return its prior value only as `cached` or `stale`.
6. Return every manifest slot exactly once; complete failure becomes `value:null,status:"unavailable"`.

The public entry point is exact:

```ts
export async function getMarketSnapshot(fetchImpl: typeof fetch = fetch) {
  const generatedAt = new Date().toISOString();
  const fresh = await fetchAllConfiguredSources(fetchImpl);
  const markets = Object.values(MARKET_MANIFEST).map((entry) => resolveMarket(entry, fresh, generatedAt));
  return { schemaVersion: "1.0" as const, generatedAt, coverage: calculateCoverage(markets), markets };
}
```

- [ ] **Step 4: Add ETag response helper and v1 market route**

```ts
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export function jsonWithEtag(request: NextRequest, body: unknown, cacheControl: string) {
  const serialized = JSON.stringify(body);
  const etag = `"${createHash("sha256").update(serialized).digest("hex")}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": cacheControl } });
  }
  return new NextResponse(serialized, {
    headers: { "Content-Type": "application/json; charset=utf-8", ETag: etag, "Cache-Control": cacheControl },
  });
}
```

`/api/osint/v1/markets` uses `public, s-maxage=60, stale-while-revalidate=300`.

- [ ] **Step 5: Preserve legacy route shapes**

- `/api/global-macro` must still return `{ success, markets, liveCount, totalCount, timestamp }`.
- `/api/treasury` must still return `{ success, yields, curveInverted, source:"us-treasury", asOf }`.
- Remove `getMockData()` and all mock fallbacks from Treasury.

- [ ] **Step 6: Run market tests**

Expected: `MARKET_CONTRACT_OK`, source assertions pass, exit 0.

- [ ] **Step 7: Commit Task 2**

```bash
git add lib/osint/market-service.ts lib/osint/http.ts app/api/osint/v1/markets/route.ts app/api/global-macro/route.ts app/api/treasury/route.ts tests/osint/market-contract.test.ts
git commit -m "feat: harden global osint markets"
```

---

### Task 3: World Stories, One-Line DeepSeek Enrichment, and Story API

**Files:**
- Create: `lib/osint/story-service.ts`
- Create: `app/api/osint/v1/stories/route.ts`
- Modify: `app/api/news-feed/route.ts`
- Create: `tests/osint/story-contract.test.ts`

**Interfaces:**
- Produces: `getStorySnapshot(options?: { window?: "24h"; limit?: number; fetchImpl?: typeof fetch }): Promise<StorySnapshot>`.
- Consumes: `OsintStory`, `StoryTags`, `jsonWithEtag()`.

- [ ] **Step 1: Write failing story tests**

Tests must prove:

```ts
assert.equal(withoutDeepSeek.stories.length, 2);
assert.equal(withoutDeepSeek.stories[0].analysisStatus, "fallback");
assert.ok(withoutDeepSeek.stories[0].sources[0].url.startsWith("https://"));
assert.ok(withoutDeepSeek.stories[0].tags.topic.length > 0);
assert.ok(withoutDeepSeek.stories[0].importance >= 0 && withoutDeepSeek.stories[0].importance <= 10);
assert.equal(duplicateHeadlines.stories.length, 1);
assert.equal(duplicateHeadlines.stories[0].tags.verification, "multi-source");
```

- [ ] **Step 2: Run and confirm failure**

Expected: missing `story-service` module.

- [ ] **Step 3: Implement source normalization and fallback tagging**

Aggregate the current finance sources plus BBC World RSS, GDELT DOC results, and ReliefWeb reports. Normalize every source to:

```ts
interface RawStory {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  title: string;
  description: string;
  publishedAt: string;
}
```

Deduplicate using normalized title tokens and shared named entities. Deterministic fallback tags must use explicit keyword maps for topic, region, assets, direction, and horizon, so tags still exist without DeepSeek.

Importance score is exactly bounded 0-10 and combines: source tier 0-3, corroborating sources 0-3, recency 0-2, market relevance 0-2.

- [ ] **Step 4: Implement DeepSeek enrichment without coupling news availability**

DeepSeek receives at most the top 12 normalized stories and returns:

```json
{
  "advice": "一句不超过45字的风险建议",
  "stories": [
    {
      "id": "stable-story-id",
      "summary": "一句不超过60字的中文摘要",
      "topic": ["地缘"],
      "region": ["中东"],
      "assets": ["原油"],
      "direction": "risk-off",
      "horizon": "1-3d"
    }
  ]
}
```

Parse using first `{` and last `}`; normalize every field. If the key is missing, HTTP fails, or JSON is invalid, return raw stories with deterministic summaries/tags and `analysisStatus:"fallback"`.

- [ ] **Step 5: Add v1 and legacy routes**

- `/api/osint/v1/stories?window=24h&limit=20` returns `{ schemaVersion, generatedAt, stories, advice, sources }` with ETag and `s-maxage=300`.
- `/api/news-feed` keeps `{ success, news, summary, sources, timestamp }`; `news` is never empty merely because DeepSeek is unavailable.

- [ ] **Step 6: Run story tests**

Expected: all assertions pass and output `STORY_CONTRACT_OK`.

- [ ] **Step 7: Commit Task 3**

```bash
git add lib/osint/story-service.ts app/api/osint/v1/stories/route.ts app/api/news-feed/route.ts tests/osint/story-contract.test.ts
git commit -m "feat: add tagged world briefing feed"
```

---

### Task 4: Agent Context API

**Files:**
- Create: `app/api/osint/v1/context/route.ts`
- Create: `tests/osint/public-context.test.ts`

**Interfaces:**
- Consumes: `getMarketSnapshot()`, `getStorySnapshot()`, `jsonWithEtag()`.
- Produces: public `OsintContext` v1 without user data.

- [ ] **Step 1: Write a failing public-schema test**

```ts
const serialized = JSON.stringify(context);
for (const forbidden of ["userId", "clerk", "watchlist", "portfolio", "personalNote"]) {
  assert.equal(serialized.toLowerCase().includes(forbidden.toLowerCase()), false);
}
assert.equal(context.schemaVersion, "1.0");
assert.ok(Array.isArray(context.markets));
assert.ok(Array.isArray(context.stories));
assert.equal(typeof context.advice.text, "string");
console.log("PUBLIC_CONTEXT_OK");
```

- [ ] **Step 2: Run and confirm failure**

Expected: context composer is missing.

- [ ] **Step 3: Implement the context route**

Run market and story services in parallel. If either side fails, return the successful side plus an explicit error entry; do not fail the whole response. Use `public, s-maxage=60, stale-while-revalidate=300` and ETag.

The route must not call Clerk, `/api/watchlist`, or `/api/portfolio`.

- [ ] **Step 4: Run public-schema test**

Expected: `PUBLIC_CONTEXT_OK`, exit 0.

- [ ] **Step 5: Commit Task 4**

```bash
git add app/api/osint/v1/context/route.ts tests/osint/public-context.test.ts
git commit -m "feat: expose public osint agent context"
```

---

### Task 5: Two-Column OSINT Workspace and Navigation Simplification

**Files:**
- Create: `components/osint-v2/MarketBoard.tsx`
- Create: `components/osint-v2/WorldBriefing.tsx`
- Modify: `components/osint-v2/SituationScreen.tsx`
- Modify: `components/osint-v2/StatusBar.tsx`
- Modify: `components/layout/TopNavBar.tsx`

**Interfaces:**
- Consumes: `GET /api/osint/v1/context` with `OsintContext`.
- Produces: responsive OSINT page matching the approved prototype.

- [ ] **Step 1: Add a static UI assertion script before changing UI**

Extend `tests/osint/public-context.test.ts` to read `SituationScreen.tsx` and assert that it no longer contains `GeoMapBase`, `AISituationBrain`, `useAuth`, or `/api/watchlist`, and that it contains `MarketBoard` and `WorldBriefing`. Confirm this fails before editing.

- [ ] **Step 2: Implement `MarketBoard`**

- Filters: 全部、指数、连续期指、商品、外汇、利率.
- Columns: 名称/代码、最新、涨跌幅、来源/新鲜度.
- `null` values render `—` and `暂无`.
- Source status is text plus color, never color alone.
- Each navigable row is a keyboard-accessible `Link`.

- [ ] **Step 3: Implement `WorldBriefing`**

- Header: 过去 24 小时 count, category filters, source filter, search.
- One-line advice band with DeepSeek timestamp and confidence.
- Timeline cards: time, title, one-line summary, importance, sources, original link, tags.
- Preserve raw story cards when analysis status is fallback.
- Use buttons with `aria-pressed`, visible focus, and touch-sized controls.

- [ ] **Step 4: Replace `SituationScreen` composition**

Fetch `/api/osint/v1/context` once and refresh every 60 seconds. Keep the last successful snapshot while refreshing. Desktop grid is `minmax(340px, 34%) 1fr`; below `lg`, switch between 行情 and 热点 tabs.

Do not mount `GeoMapBase`, `AISituationBrain`, `IntelFeed`, `DeltaPanel`, `SocialPanel`, `EconomicPanel`, or `useDataStream`.

- [ ] **Step 5: Simplify status rail**

Render `Agent 数据接口 v1`, coverage ratio, stale count, generated time, and an overall status label. Do not show adapters that are not mounted.

- [ ] **Step 6: Hide unused navigation without deleting routes**

Set `NAV_LINKS` to exactly:

```ts
const NAV_LINKS = [
  { href: "/dashboard", label: "今日", icon: LayoutDashboard },
  { href: "/uzi-reports", label: "深度研究", icon: FileChartColumnIncreasing },
  { href: "/osint", label: "OSINT 情报", icon: Globe },
];
```

Remove the unused `Briefcase` import only. Do not delete `/my-stocks`, `/portfolio`, or any backing API/model.

- [ ] **Step 7: Run static assertions**

Expected: `PUBLIC_CONTEXT_OK`; forbidden OSINT imports/strings absent; required components present.

- [ ] **Step 8: Commit Task 5**

```bash
git add components/osint-v2/MarketBoard.tsx components/osint-v2/WorldBriefing.tsx components/osint-v2/SituationScreen.tsx components/osint-v2/StatusBar.tsx components/layout/TopNavBar.tsx tests/osint/public-context.test.ts
git commit -m "feat: redesign osint intelligence workspace"
```

---

### Task 6: Focused Regression and Browser Acceptance

**Files:**
- Modify only evidence-backed defects in files from Tasks 1-5.

**Interfaces:**
- Consumes: completed workspace and v1 routes.
- Produces: fresh verification evidence and residual-risk record.

- [ ] **Step 1: Run all focused contract checks**

```bash
for test_file in tests/osint/*.test.ts; do
  npx ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' "$test_file" || exit 1
done
```

Expected: `MARKET_CONTRACT_OK`, `STORY_CONTRACT_OK`, `PUBLIC_CONTEXT_OK`, exit 0.

- [ ] **Step 2: Run diff and targeted type checks**

```bash
git diff --check
npx tsc --noEmit --pretty false --incremental false 2>&1 | tee /tmp/osint-tsc.log
rg "lib/osint|app/api/osint|components/osint-v2/(MarketBoard|WorldBriefing|SituationScreen|StatusBar)|components/layout/TopNavBar" /tmp/osint-tsc.log
```

Expected: `git diff --check` exits 0 and the focused `rg` prints no errors. Record unrelated existing errors separately.

- [ ] **Step 3: Run the production build only if existing unrelated deletions no longer block it**

Run `npm run build`. Expected: exit 0. If it fails only because user-owned dirty deletions such as `components/providers/theme-provider.tsx` remain, report that exact blocker and do not restore or overwrite user files.

- [ ] **Step 4: Start the local app and verify APIs**

Use an available local port. Call with `curl --noproxy localhost` and assert:

- `/api/osint/v1/markets`: all required slots, valid coverage, no hard-coded fallback source.
- `/api/osint/v1/stories`: source URLs, tags, fallback content if DeepSeek fails.
- `/api/osint/v1/context`: stable schema and no private fields.

- [ ] **Step 5: Browser acceptance**

Verify `/osint` at desktop and narrow viewport:

- no map and no long AI panel;
- full market groups and `—` unavailable state;
- timeline filters/search/source links/tags;
- one-line advice only;
- `今日 / 深度研究 / OSINT 情报` navigation with no My Stocks entry;
- keyboard focus and reduced-motion behavior;
- no console errors caused by touched files.

- [ ] **Step 6: Independent read-only delivery review**

Dispatch one reviewer with the design, implementation diff, user constraints, and verification output. Fix confirmed P0/P1 findings, then run one focused regression only.

- [ ] **Step 7: Final commit if fixes were required**

```bash
git add lib/osint app/api/osint app/api/global-macro/route.ts app/api/treasury/route.ts app/api/news-feed/route.ts components/osint-v2/MarketBoard.tsx components/osint-v2/WorldBriefing.tsx components/osint-v2/SituationScreen.tsx components/osint-v2/StatusBar.tsx components/layout/TopNavBar.tsx tests/osint
git commit -m "fix: close osint delivery findings"
```
