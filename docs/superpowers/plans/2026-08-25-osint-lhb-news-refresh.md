# OSINT 龙虎榜与新闻刷新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保留个股资金排行，新增按买入额排序的游资席位聚合视图，并提供72小时、50条以上、可分类翻页的高质量财经新闻。

**Architecture:** 龙虎榜服务新增稳定的 `hotMoneyFlows` 聚合与 dashboard 轻量投影，UI保留两个视图但去掉单股详情。新闻服务先构建72小时确定性分类的规范化集合，再按服务端分类分页，只对当前页调用 DeepSeek；页面独立拉取行情与新闻，避免慢新闻源阻塞行情。

**Tech Stack:** Next.js 15 App Router、React 19、TypeScript、Tailwind CSS、Node assert/tsx 契约测试、Vercel。

## Global Constraints

- 不增加新依赖，不修改生产数据库，不写入任何密钥。
- Bloomberg 只使用公开索引；Wind 未授权时只报告公开索引健康度，不冒充付费数据。
- 外部数据失败显示缓存态或 unavailable，不使用硬编码新闻或价格。
- 新闻窗口固定72小时，规范化集合上限200条，页面默认20条，数据充足时可翻到至少50条。
- 游资别名是观察映射，不证明真实账户身份。

---

### Task 1: 游资聚合与 dashboard 轻量契约

**Files:**
- Modify: `lib/lhb/contracts.ts`
- Modify: `lib/lhb/service.ts`
- Modify: `app/api/osint/v1/lhb/route.ts`
- Test: `tests/lhb/lhb-contract.test.ts`

**Interfaces:**
- Produces: `LhbHotMoneyFlow`、`LhbDashboardSnapshot`、`toLhbDashboardSnapshot(snapshot)`。
- Consumes: `LhbSnapshot.seatFlows`、现有精确席位标签。

- [ ] **Step 1: Write the failing aggregation test**

```ts
const hotMoney = snapshot.hotMoneyFlows.find((flow) => flow.label === "武汉紫阳东路");
assert.equal(hotMoney?.totalBuyAmount, 174492120.33);
assert.equal(hotMoney?.totalSellAmount, 85042);
assert.equal(hotMoney?.stocks[0].code, "000620");
assert.equal(snapshot.hotMoneyFlows[0].label, "武汉紫阳东路");
```

- [ ] **Step 2: Run the LHB contract and verify RED**

Run: `npx tsx tests/lhb/lhb-contract.test.ts`

Expected: FAIL because `hotMoneyFlows` is missing.

- [ ] **Step 3: Implement exact-label aggregation**

```ts
export interface LhbHotMoneyFlow {
  label: string;
  confidence: Exclude<LhbAliasConfidence, null>;
  departmentNames: string[];
  totalBuyAmount: number;
  totalSellAmount: number;
  totalNetAmount: number;
  stocks: LhbSeatFlow["stocks"];
}
```

Group only `category === "known-seat" && buyAmount > 0` by label, merge departments and stocks, sum buy/sell/net, then sort flows and their stocks by buy amount descending.

- [ ] **Step 4: Add dashboard projection and route view**

`GET /api/osint/v1/lhb?view=dashboard` returns metadata, stock ranks without `buySeats/sellSeats`, and `hotMoneyFlows`; the default response remains backward compatible.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npx tsx tests/lhb/lhb-contract.test.ts`

Expected: `LHB_CONTRACT_OK`.

Commit files explicitly with message `feat: 聚合龙虎榜游资买卖流向`.

### Task 2: 龙虎榜双视图 UI

**Files:**
- Modify: `components/osint-v2/LhbBoard.tsx`
- Test: `tests/lhb/lhb-contract.test.ts`

**Interfaces:**
- Consumes: `LhbDashboardSnapshot` from `/api/osint/v1/lhb?view=dashboard`.
- Produces: `个股资金榜` and `席位资金榜` UI modes.

- [ ] **Step 1: Write failing source assertions**

```ts
assert.equal(boardSource.includes("?view=dashboard"), true);
assert.equal(boardSource.includes("个股资金榜"), true);
assert.equal(boardSource.includes("席位资金榜"), true);
assert.equal(boardSource.includes("买入前五"), false);
assert.equal(boardSource.includes("selectedTradeId"), false);
```

- [ ] **Step 2: Run the LHB contract and verify RED**

Run: `npx tsx tests/lhb/lhb-contract.test.ts`

Expected: FAIL on the dashboard URL or removed single-stock detail assertion.

- [ ] **Step 3: Implement the two views**

The stock view renders full-width net-buy and net-sell rank cards. The seat view renders one card per hot-money label with total buy, total sell, total net, confidence, department names, and bought-stock rows sorted by buy amount.

- [ ] **Step 4: Verify GREEN and commit**

Run: `npx tsx tests/lhb/lhb-contract.test.ts`

Expected: `LHB_CONTRACT_OK`.

Commit exact files with message `feat: 重做龙虎榜游资席位视图`.

### Task 3: 72小时财经新闻集合、来源与服务端分页

**Files:**
- Modify: `lib/osint/contracts.ts`
- Modify: `lib/osint/story-service.ts`
- Modify: `app/api/osint/v1/stories/route.ts`
- Modify: `lib/osint/context.ts`
- Test: `tests/osint/story-contract.test.ts`
- Test: `tests/osint/public-context.test.ts`

**Interfaces:**
- Produces: `StoryPagination` and `StorySnapshot.pagination`.
- Produces: `getStorySnapshot({ window: "72h", page, pageSize, topic })`.
- Consumes: public RSS/Google News index sources and optional `DEEPSEEK_API_KEY`.

- [ ] **Step 1: Write failing 72-hour and pagination tests**

```ts
const page = await buildStorySnapshot(raw72Hours, {
  apiKey: null,
  now,
  windowHours: 72,
  page: 2,
  pageSize: 20,
  topic: "能源",
});
assert.equal(page.pagination.page, 2);
assert.equal(page.pagination.pageSize, 20);
assert.equal(page.pagination.total, 55);
assert.equal(page.stories.every((story) => story.tags.topic.includes("能源")), true);
```

- [ ] **Step 2: Run story contracts and verify RED**

Run: `npx tsx tests/osint/story-contract.test.ts`

Expected: FAIL because pagination and the 72-hour default are missing.

- [ ] **Step 3: Implement canonical filtering before pagination**

Build and deterministically tag up to 200 deduplicated stories within72 hours, filter by topic on the complete collection, calculate pagination, slice the requested page, then enrich only that page with DeepSeek.

- [ ] **Step 4: Add high-quality source adapters**

Add separate source health entries for Bloomberg public Google News index, Reuters public Google News index, Wind public index, CNBC Markets RSS, WSJ Markets RSS, and official central-bank/regulator feeds. Keep existing Chinese finance feeds. Each source has its own timeout and returns `{ name, stories, ok }`.

- [ ] **Step 5: Add route parameters**

Parse `page`, `pageSize`, and `topic`; clamp `pageSize` to 10–50 and allow only `地缘|宏观|能源|科技`. Return cache headers suitable for five-minute news refresh.

- [ ] **Step 6: Verify GREEN and commit**

Run:

```bash
npx tsx tests/osint/story-contract.test.ts
npx tsx tests/osint/public-context.test.ts
```

Expected: `STORY_CONTRACT_OK` and `PUBLIC_CONTEXT_OK`.

Commit exact files with message `feat: 扩充三日财经新闻并支持分页`.

### Task 4: 新闻翻页、分类与独立刷新

**Files:**
- Modify: `components/osint-v2/WorldBriefing.tsx`
- Modify: `components/osint-v2/SituationScreen.tsx`
- Test: `tests/osint/story-contract.test.ts`

**Interfaces:**
- Consumes: `/api/osint/v1/stories?page=&pageSize=20&topic=` and `/api/osint/v1/markets`.
- Produces: server-filtered topic tabs, previous/next pagination, independent loading states.

- [ ] **Step 1: Write failing source assertions**

```ts
assert.equal(briefingSource.includes("pageSize=20"), true);
assert.equal(briefingSource.includes("上一页"), true);
assert.equal(briefingSource.includes("下一页"), true);
assert.equal(briefingSource.includes("过去3天"), true);
assert.equal(screenSource.includes('/api/osint/v1/markets'), true);
```

- [ ] **Step 2: Run story contract and verify RED**

Run: `npx tsx tests/osint/story-contract.test.ts`

Expected: FAIL on paging or independent market endpoint assertions.

- [ ] **Step 3: Implement server-driven filtering and paging**

Changing topic resets page to1 and fetches the server. Previous/next controls use `pagination.totalPages`; loading preserves the current page. Empty state reports the selected category and the72-hour window.

- [ ] **Step 4: Split refresh paths**

SituationScreen loads `/api/osint/v1/markets` independently every30 seconds. WorldBriefing loads stories independently every5 minutes and on topic/page changes. Manual refresh triggers the relevant panel only.

- [ ] **Step 5: Verify GREEN and commit**

Run all OSINT/LHB contracts and `npm run build`; expected all contract markers and build exit0.

Commit exact files with message `fix: 加快 OSINT 分类新闻刷新`.

### Task 5: Review, production deployment, and online verification

**Files:**
- Review only: all touched files.

**Interfaces:**
- Produces: deployed GitHub main and Vercel production version.

- [ ] **Step 1: Run one independent read-only review**

Review correctness of amount aggregation, pagination/filter order, source labels, backward compatibility, and no private-data leakage. Fix only evidence-backed findings.

- [ ] **Step 2: Run focused regression**

```bash
npx tsx tests/lhb/lhb-contract.test.ts
npx tsx tests/osint/story-contract.test.ts
npx tsx tests/osint/public-context.test.ts
npx tsx tests/osint/market-contract.test.ts
npm run build
```

- [ ] **Step 3: Push then deploy**

Push the tested branch changes to `origin/main`, then run `vercel deploy --prod` from the clean integrated checkout.

- [ ] **Step 4: Verify production**

Measure `/api/osint/v1/markets`, `/api/osint/v1/stories?page=1&pageSize=20&topic=能源`, and `/api/osint/v1/lhb?view=dashboard`; verify news `total >= 50` when sources supply enough records, non-empty category pages where matching records exist, reduced LHB payload, and the two LHB tabs in the browser.
