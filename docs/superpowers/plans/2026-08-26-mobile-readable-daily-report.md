# OSINT Daily Report Mobile Readability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 OSINT 三页日报改成手机可直接阅读的 4:5 大字号版本，删除系统话术，并补生成 2026-08-26 收盘版。

**Architecture:** 继续使用现有 `OsintDailyReportSnapshot` 和 PDFKit，不新增依赖。将“选什么内容、如何说人话”收口在日报策展层，PDF 和网页预览复用同一组展示规则；PDF 导出增加布局版本，避免 CDN 返回旧版文件。

**Tech Stack:** Next.js 15、TypeScript、PDFKit、Prisma、现有 OSINT/LHB 数据契约。

## Global Constraints

- 完整报告固定三页：热点、个股资金、游资席位；单项导出固定一页。
- 页面使用 1080×1350 的 4:5 竖版画布。
- 手机适配宽度下正文可直接辨认，不通过缩小字号塞内容。
- 删除验证比例、重要度评分、英文标签、门槛、schema、缓存等系统术语。
- 没有内容的热点模块直接隐藏并让其他模块补位。
- 水印和“仅供参考、不构成投资建议”免责声明必须保留。
- 不新增依赖，不修改 Prisma schema，不伪造缺失数据。

---

### Task 1: 统一用户可读的日报内容

**Files:**
- Modify: `lib/osint/daily-report/story-curation.ts`
- Test: `tests/osint/daily-report-pdf-contract.test.ts`

**Interfaces:**
- Produces: `plainCategoryLabel(key)`, `plainStoryImpact(story)`, `plainStockReason(reasons)`, `selectReportStocks(stocks)`, `selectReportHotMoney(flows)`。
- Consumes: `OsintStory`、`LhbStock`、`LhbHotMoneyFlow` 现有契约。

- [ ] **Step 1: 写失败测试**

在 `daily-report-pdf-contract.test.ts` 增加断言：

```ts
assert.equal(plainCategoryLabel("macro"), "今天市场在看什么");
assert.equal(plainStockReason(["日涨幅偏离值达到7%的前5只证券"]), "涨幅明显，登上龙虎榜");
assert.equal(selectReportStocks(stockFixture).inflows.length <= 10, true);
assert.equal(selectReportStocks(stockFixture).outflows.length <= 10, true);
assert.equal(selectReportHotMoney(flowFixture).length <= 15, true);
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx tsx tests/osint/daily-report-pdf-contract.test.ts`

Expected: FAIL，提示上述导出函数不存在。

- [ ] **Step 3: 实现最小策展与文案函数**

规则固定为：热点分类用日常中文；个股资金按净额拆成买入/卖出两组，各最多 10 只；游资按买入额和净额排序，最多 15 个；交易所长原因压缩为“涨幅明显，登上龙虎榜”“换手活跃，登上龙虎榜”等短句。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx tsx tests/osint/daily-report-pdf-contract.test.ts`

Expected: `DAILY_REPORT_PDF_CONTRACT_OK`

- [ ] **Step 5: 提交**

```bash
git add lib/osint/daily-report/story-curation.ts tests/osint/daily-report-pdf-contract.test.ts
git commit -m "feat: 收口日报用户文案与展示数量"
```

### Task 2: 重做三页 4:5 大字号 PDF

**Files:**
- Modify: `lib/osint/daily-report/pdf-export.ts`
- Modify: `lib/osint/daily-report/pdf-readiness.ts`
- Modify: `tests/osint/daily-report-pdf-contract.test.ts`
- Modify: `tests/osint/daily-report-surface.test.ts`

**Interfaces:**
- Produces: `DAILY_REPORT_PDF_LAYOUT_VERSION = "social-v2"`、1080×1350 PDF。
- Consumes: Task 1 的策展函数。

- [ ] **Step 1: 写失败测试**

新增断言：PDF MediaBox 为 `1080 1350`；完整导出 3 页；三种单项导出各 1 页；导出源码不包含“暂无达到展示门槛”“0/”“重要度”；布局版本为 `social-v2`。

- [ ] **Step 2: 运行测试确认失败**

Run: `npx tsx tests/osint/daily-report-pdf-contract.test.ts && npx tsx tests/osint/daily-report-surface.test.ts`

Expected: FAIL，当前仍为 A4 和旧话术。

- [ ] **Step 3: 重写页面坐标与字号**

热点页使用 56pt 页标题、30pt 模块标题、28pt 新闻标题、22–24pt 摘要；未来事件最多 4 条且为空时不绘制。个股页改为净买入/净卖出双栏卡片，各最多 10 只。游资页改为双栏 12–15 张卡片，只保留主要席位和 1–2 只股票。

- [ ] **Step 4: 保留水印和免责声明**

页脚使用不小于 16pt 的免责声明，并在页面中保留低透明度 `AlphaPercept` 水印；不显示验证比例、评分和英文标签。

- [ ] **Step 5: 运行测试确认通过**

Run: `npx tsx tests/osint/daily-report-pdf-contract.test.ts && npx tsx tests/osint/daily-report-surface.test.ts`

Expected: 两项契约均输出 `OK`。

- [ ] **Step 6: 提交**

```bash
git add lib/osint/daily-report/pdf-export.ts lib/osint/daily-report/pdf-readiness.ts tests/osint/daily-report-pdf-contract.test.ts tests/osint/daily-report-surface.test.ts
git commit -m "feat: 重做移动阅读版三页日报"
```

### Task 3: 网页预览同步说人话并刷新 PDF 缓存键

**Files:**
- Modify: `components/osint-reports/DailyReportView.tsx`
- Modify: `components/osint-reports/PrintActions.tsx`
- Modify: `app/api/osint/v1/reports/[reportId]/export/route.ts`
- Modify: `tests/osint/daily-report-surface.test.ts`

**Interfaces:**
- Consumes: `DAILY_REPORT_PDF_LAYOUT_VERSION` 和 Task 1 的策展函数。
- Produces: 带 `layout=social-v2` 的导出 URL 和同版本 ETag。

- [ ] **Step 1: 写失败测试**

断言网页源码不含“低重要度单源杂讯”“达到日报筛选标准”“观察可信度”“组内最新优先”；导出链接含 `layout=${DAILY_REPORT_PDF_LAYOUT_VERSION}`；ETag 包含布局版本。

- [ ] **Step 2: 运行测试确认失败**

Run: `npx tsx tests/osint/daily-report-surface.test.ts`

Expected: FAIL，命中旧文案或缺少布局版本。

- [ ] **Step 3: 实现网页同步改版**

热点预览显示“今天重点”和分类卡片，不显示数量评分；个股仅显示 Task 1 选出的净买入/净卖出；游资仅显示重点 15 个，金额字段改为“买入、卖出、净买入/净卖出”。

- [ ] **Step 4: 更新导出缓存版本**

所有下载 URL 增加 `layout=social-v2`；PDF Promise 缓存键、ETag 和文件名同步包含版本，确保重新部署后不会下载旧 A4 文件。

- [ ] **Step 5: 回归并提交**

Run: `npx tsx tests/osint/daily-report-surface.test.ts`

Expected: `DAILY_REPORT_SURFACE_OK`

```bash
git add components/osint-reports/DailyReportView.tsx components/osint-reports/PrintActions.tsx app/api/osint/v1/reports/[reportId]/export/route.ts tests/osint/daily-report-surface.test.ts
git commit -m "fix: 同步日报预览与新版导出缓存"
```

### Task 4: 生成和检查 8 月 26 日成品

**Files:**
- Modify only if evidence requires: `app/api/osint/v1/reports/generate/route.ts`
- Test: `tests/osint/daily-report-contract.test.ts`
- Output: `tmp/pdfs/2026-08-26/`

**Interfaces:**
- Consumes: 生产 `generateAndSaveDailyReport` 链路和新版 PDF 导出。
- Produces: 归档日期为 `2026-08-26` 的收盘版记录与三页 PDF。

- [ ] **Step 1: 验证北京时间日期契约**

Run: `npx tsx tests/osint/daily-report-contract.test.ts`

Expected: 报告日期在北京时间 2026-08-26 时为 `2026-08-26`。

- [ ] **Step 2: 运行全部 OSINT 回归和构建**

Run: `for test_file in $(rg --files tests/osint | sort); do npx tsx "$test_file"; done`

Run: `npm run next:build`

Expected: OSINT 契约全部通过，Next.js 生产构建成功。

- [ ] **Step 3: 生成本地视觉样稿**

用 2026-08-26 实际快照生成完整 PDF 和三个单项 PDF到 `tmp/pdfs/2026-08-26/`；使用 `pdftoppm -png -r 130` 渲染三页。

- [ ] **Step 4: 视觉验收**

逐页确认：文字清楚、没有拥挤或截断、没有系统话术、日期为 2026-08-26、水印和免责声明存在、三页内容各自完整。

- [ ] **Step 5: 部署与归档前门禁**

部署生产前再次请求用户确认；部署完成后使用已授权的受信任生成链路补归档 2026-08-26 收盘版，不读取或输出任何密钥值。

## Plan Self-Review

- Spec coverage: 三页结构、4:5、大字号、内容精简、说人话、空模块隐藏、水印免责声明、8 月 26 日归档均有对应任务。
- Placeholder scan: 无 TBD、TODO 或未定义步骤。
- Type consistency: `DAILY_REPORT_PDF_LAYOUT_VERSION` 由 PDF 模块导出，网页和 API 统一消费；策展函数由 Task 1 定义并由 Task 2/3 复用。
