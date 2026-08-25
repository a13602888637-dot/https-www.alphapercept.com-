# AIHOT v1、游资席位与每日复盘 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 AIHOT v1 科技新闻、快速新闻标签、扩展游资/活跃席位，以及移动端每日复盘归档与四种 PDF 打印视图。

**Architecture:** 外部新闻由独立 AIHOT v1 适配器归一化进入现有 story pipeline；DeepSeek 结果按 story id 复用。龙虎榜保持兼容全量契约，dashboard 投影增加已知与活跃席位并压缩股票明细。日报以 Prisma JSON 快照保存，阅读页和打印页共用同一 payload。

**Tech Stack:** Next.js 15、React 19、TypeScript、Prisma/PostgreSQL、Tailwind、原生打印 CSS、Node assert/tsx。

## Global Constraints

- 不调用 `/api/public/*`，不复用任何旧 AIHOT cursor 或 ETag。
- 不新增 PDF npm 依赖；不执行生产迁移、不修改生产 cron。
- 个人游资名称必须带“观察席”；普通营业部必须标“活跃席位”。
- 日报中的每个行情保留 source/status/asOf，失败显示 unavailable。

---

### Task 1: AIHOT v1 适配器与科技新闻

**Files:**
- Create: `lib/osint/aihot-v1.ts`
- Modify: `lib/osint/story-service.ts`
- Test: `tests/osint/aihot-v1.test.ts`
- Test: `tests/osint/story-contract.test.ts`

- [ ] 写失败测试，断言 v1 URL 和字段映射：

```ts
assert.equal(mapped.sourceUrl, item.links.original);
assert.equal(mapped.additionalSources[0].url, item.links.aihot);
assert.equal(mapped.originalTitle, item.originalTitle);
assert.equal(mapped.originalSourceName, item.source.name);
assert.equal(source.includes("/api/public/"), false);
```

- [ ] 运行 `npx tsx tests/osint/aihot-v1.test.ts`，确认缺模块失败。
- [ ] 实现匿名只读 `/api/v1/items` 请求，mode=selected、window=7d、by=published、limit=100；过滤 selected、72小时和 ai-models/ai-products/industry。
- [ ] 将 AIHOT 标记为科技、已翻译、已摘要，并保留原文与 AIHOT 归因链接。
- [ ] 运行 AIHOT 与 story 契约，预期 `AIHOT_V1_OK`、`STORY_CONTRACT_OK`。

### Task 2: DeepSeek 与客户端分类缓存

**Files:**
- Modify: `lib/osint/story-service.ts`
- Modify: `components/osint-v2/WorldBriefing.tsx`
- Test: `tests/osint/story-contract.test.ts`
- Test: `tests/osint/public-context.test.ts`

- [ ] 写失败测试：同一 story 连续构建两次只调用一次 DeepSeek；全部首屏20条请求实际预分析最多50条。
- [ ] 实现 story-id enrichment cache，缓存命中时只覆盖翻译/摘要/AI标签，保留当前 sources 和 verification。
- [ ] 首屏预分析50条后裁成20条响应；`limit=1` 仍只处理1条，保持旧契约。
- [ ] WorldBriefing 用 ref Map 缓存 `topic/page`，返回已访问标签立即展示并后台刷新。
- [ ] 运行 story/public-context 契约。

### Task 3: 已知游资与活跃席位扩展

**Files:**
- Modify: `lib/lhb/contracts.ts`
- Modify: `lib/lhb/seat-aliases.ts`
- Modify: `lib/lhb/service.ts`
- Modify: `components/osint-v2/LhbBoard.tsx`
- Test: `tests/lhb/lhb-contract.test.ts`

- [ ] 写失败测试：知春路分券商、炒股养家、五个拉萨席位精确命中；dashboard 至少返回全部 known + top20 active；每组最多3股并含 stockCount。
- [ ] 扩展 exact aliases，修正古北路/六一中路等冲突，不加入券商级模糊规则。
- [ ] 新增 `kind: known | active` 和稳定 flowId；broker 单日买入按营业部聚合，known 与 active 去重。
- [ ] dashboard 投影保留全部 known + top20 active，并裁每组 top3 stocks。
- [ ] UI 显示观察可信度或“活跃席位”，超过3股显示“另有N只”。
- [ ] 运行 LHB 契约，预期 `LHB_CONTRACT_OK`。

### Task 4: 每日复盘数据模型与快照 API

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/*_add_osint_daily_report/migration.sql`
- Create: `lib/osint/daily-report/contracts.ts`
- Create: `lib/osint/daily-report/service.ts`
- Create: `app/api/osint/v1/reports/route.ts`
- Create: `app/api/osint/v1/reports/[date]/route.ts`
- Test: `tests/osint/daily-report-contract.test.ts`

- [ ] 写失败测试，断言 reportDate/edition/status/payload、数据源时间戳和四个 section。
- [ ] 新增 `OsintDailyReport`，唯一键为 reportDate+edition+version。
- [ ] 实现只读列表/详情和受保护的生成接口；生成时并行读取 markets、stories、lhb，保存不可变 JSON。
- [ ] 只生成 migration SQL，不执行生产数据库命令。
- [ ] 运行 `npx prisma generate` 和日报契约测试。

### Task 5: 移动端日报与打印 PDF

**Files:**
- Create: `app/osint/reports/page.tsx`
- Create: `app/osint/reports/[date]/page.tsx`
- Create: `components/osint-reports/*`
- Modify: `components/osint-v2/SituationScreen.tsx`
- Test: `tests/osint/daily-report-ui.test.ts`

- [ ] 写失败测试：综合/行情/热点/游资、完整PDF/三类PDF、过去日报、移动端16px和 print media 均存在。
- [ ] 实现移动端归档与单日报告，375px 单列，桌面再增强。
- [ ] 实现 section query 和 `window.print()`；打印样式 A4、分页、隐藏导航。
- [ ] OSINT 主页面增加“每日复盘”入口，但不改变 Agent API。
- [ ] 运行 UI 契约和 production build。

### Task 6: 终审与发布准备

- [ ] 运行一次独立只读审查，检查 AIHOT 条款/映射、席位误标、日报隐私、PDF移动端、迁移 SQL。
- [ ] 聚焦回归：AIHOT、story、LHB、daily-report、public-context、market、`npm run build`。
- [ ] 输出人工确认清单：生产 migration SQL、cron 时间、AIHOT 非商业状态、正式部署；未确认前不执行生产写入和部署。
