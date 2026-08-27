# Pantone 2026 High-Contrast Three-Page Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 OSINT PDF 改成 Pantone 2026 高对比三页报告，所有入选文字完整显示，并把个股榜按代码去重。

**Architecture:** 继续使用 1080×1350 PDFKit 画布和现有三页结构。策展层固定热点合计约 10 条、个股 15+15、游资最多 20；渲染层先用 `heightOfString` 测量，若一页容不下则减少最低优先级条目，不新增页面、不截断文字。

**Tech Stack:** TypeScript、PDFKit、Next.js 15、现有 OSINT/LHB 数据契约。

## Global Constraints

- 完整复盘固定三页，热点、个股、游资单项导出各一页。
- 画布固定 1080×1350。
- 主背景 `#F0EFEB`，正文 `#2B2C30`，买入 `#9F2336`，卖出及模块标题 `#2A5D69`。
- 不使用 `clip()`、`ellipsis`、固定高度裁切或自动续页。
- 页面标题不小于 48pt，模块标题不小于 28pt，正文不小于 18pt，辅助文字不小于 16pt。
- 热点的未来事件和新闻合计约 10 条；个股最多 30 只；游资最多 20 个。
- 水印和免责声明每页保留。

---

### Task 1: 固定三页展示数量

**Files:**
- Modify: `lib/osint/daily-report/story-curation.ts`
- Test: `tests/osint/daily-report-pdf-contract.test.ts`

**Interfaces:**
- Produces: `selectReportStocks(stocks)` 返回最多 15 个净买入和 15 个净卖出；`selectReportHotMoney(flows)` 返回最多 20 个席位。
- Consumes: 已完成的 `aggregateLhbStocksByCode(stocks)`，金额不得按重复上榜记录相加。

- [ ] **Step 1: 写失败测试**

```ts
const selectedStocks = selectReportStocks(makeStocks(80));
assert.equal(selectedStocks.inflows.length, 15);
assert.equal(selectedStocks.outflows.length, 15);
assert.equal(selectReportHotMoney(makeFlows(40)).length, 20);
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx tsx tests/osint/daily-report-pdf-contract.test.ts`

Expected: 当前 10/10 和 15 个限制导致断言失败。

- [ ] **Step 3: 修改策展上限并通过测试**

```ts
return {
  inflows: ranked.filter((stock) => stock.netAmount >= 0).slice(0, 15),
  outflows: ranked.filter((stock) => stock.netAmount < 0).sort((a, b) => a.netAmount - b.netAmount).slice(0, 15),
};
```

游资排序保持已知席位优先，再按买入额排序，最后 `.slice(0, 20)`。

- [ ] **Step 4: 提交**

```bash
git add lib/osint/daily-report/story-curation.ts tests/osint/daily-report-pdf-contract.test.ts
git commit -m "feat: 调整三页日报展示容量"
```

### Task 2: 高对比、无截断 PDF

**Files:**
- Modify: `lib/osint/daily-report/pdf-export.ts`
- Modify: `lib/osint/daily-report/pdf-readiness.ts`
- Modify: `tests/osint/daily-report-pdf-contract.test.ts`
- Modify: `tests/osint/daily-report-surface.test.ts`

**Interfaces:**
- Produces: `DAILY_REPORT_PDF_LAYOUT_VERSION = "pantone-v3"`。
- Consumes: Task 1 的固定数量结果。

- [ ] **Step 1: 写失败测试**

```ts
assert.equal(pdfExport.includes("#F0EFEB"), true);
assert.equal(pdfExport.includes("#2B2C30"), true);
assert.equal(pdfExport.includes("#9F2336"), true);
assert.equal(pdfExport.includes("#2A5D69"), true);
assert.equal(pdfExport.includes("clip("), false);
assert.equal(pdfExport.includes("ellipsis"), false);
assert.equal(pdfReadiness.includes('"pantone-v3"'), true);
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx tsx tests/osint/daily-report-pdf-contract.test.ts && npx tsx tests/osint/daily-report-surface.test.ts`

Expected: 旧颜色、`clip()`、`ellipsis` 和 `social-v2` 触发失败。

- [ ] **Step 3: 替换主色并提高对比**

将 `COLORS.canvas/ink/coral/green` 分别替换为 `#F0EFEB/#2B2C30/#9F2336/#2A5D69`，深色模块表头使用 Dragonfly 或 Stretch Limo，浅色正文统一 Stretch Limo。

- [ ] **Step 4: 实现文字测量和条目回退**

热点卡片使用 `doc.heightOfString(title|summary|impact)` 计算高度，最多尝试 6 条，超出内容底线时删除最低优先级条目。个股和游资用完整文字测量行高；若 30/20 条无法在字号下限内放下，则依次删除最后一条，直到一页内完整显示。

- [ ] **Step 5: 移除所有截断路径**

删除 `clip()`；所有 `doc.text()` 不传 `ellipsis` 和固定 `height`。标题、摘要、原因、席位和主要股票允许自然换行。

- [ ] **Step 6: 升级导出缓存版本**

把 `DAILY_REPORT_PDF_LAYOUT_VERSION` 改为 `pantone-v3`，现有下载 URL、Promise 缓存键和 ETag 自动消费新版本。

- [ ] **Step 7: 回归并提交**

Run: `npx tsx tests/osint/daily-report-pdf-contract.test.ts && npx tsx tests/osint/daily-report-surface.test.ts && npx tsx tests/lhb/lhb-contract.test.ts`

Expected: 三项测试输出 `OK`。

```bash
git add lib/osint/daily-report/pdf-export.ts lib/osint/daily-report/pdf-readiness.ts tests/osint/daily-report-pdf-contract.test.ts tests/osint/daily-report-surface.test.ts
git commit -m "feat: 应用Pantone高对比三页日报"
```

### Task 3: 真实数据视觉验收与上线

**Files:**
- Output only: `/tmp/osint-pantone-v3/`

**Interfaces:**
- Consumes: 2026-08-26 已归档报告及新版导出器。
- Produces: 三页 PNG、PDF 文本检查、生产 API 验证结果。

- [ ] **Step 1: 运行完整 OSINT/LHB 回归和生产构建**

Run: `for test_file in $(rg --files tests/osint tests/lhb | sort); do npx tsx "$test_file"; done`

Run: `npm run next:build`

Expected: 契约全部通过，Next.js 构建成功。

- [ ] **Step 2: 用真实归档生成样稿**

下载 2026-08-26 归档快照，用新版 `buildDailyReportPdf` 生成 3 页 PDF，并用 `pdftoppm -png -r 100` 渲染。

- [ ] **Step 3: 检查完整文字**

使用 `pdftotext -layout` 检查输出中不存在 `…`；逐页确认标题、摘要、原因、席位和股票没有重叠或越界。

- [ ] **Step 4: 推送并部署**

用户已明确授权发布。先 `git push origin HEAD:main`，再 `vercel deploy --prod --yes`，最后验证生产 PDF 为 1080×1350、三页且 URL 带 `layout=pantone-v3`。

### Task 4: 热点与游资等高对齐

**Files:**
- Modify: `lib/osint/daily-report/pdf-export.ts`
- Modify: `tests/osint/daily-report-surface.test.ts`

**Interfaces:**
- Produces: `fitAlignedRows()`，将左右卡片按行配对并使用同一行最大高度。
- Consumes: 已测量的热点卡片和游资卡片高度。

- [ ] **Step 1: 写失败测试**

```ts
assert.equal(pdfExport.includes("fitAlignedRows"), true);
assert.equal(pdfExport.includes("drawAlignedStoryRows"), true);
assert.equal(pdfExport.includes("drawAlignedHotMoneyRows"), true);
```

- [ ] **Step 2: 实现等高行**

热点候选按顺序两两配对，行高取两张卡片的最大值；游资固定左右 7+7，逐行用最大卡片高度。总高度超出时删除最后一整行，不缩小字体。

- [ ] **Step 3: 调整文字节奏**

热点元信息、标题和摘要分别使用 2/3/3 的 `lineGap`，卡片之间使用统一的 18pt 间距。

- [ ] **Step 4: 真实样稿验收**

生成 2026-08-26 三页 PDF，确认热点仍约 10 条、游资左右边缘对齐、文字完整且无重叠。

### Task 5: 游资卡片统一为三行资金结构

**Files:**
- Modify: `lib/osint/daily-report/pdf-export.ts`
- Modify: `tests/osint/daily-report-surface.test.ts`

**Interfaces:**
- Produces: `hotMoneyAmountLine()` 和 `hotMoneyStockLine()`，由测量和绘制共同使用。

- [ ] **Step 1: 写失败测试**

```ts
assert.equal(pdfExport.includes("hotMoneyAmountLine"), true);
assert.equal(pdfExport.includes("hotMoneyStockLine"), true);
assert.equal(pdfExport.includes("departmentNames.join"), false);
```

- [ ] **Step 2: 实现三行结构**

第一行绘制排名和游资名；第二行按个股资金榜格式连续绘制“净额 · 买入 · 卖出”，其中净买入和买入为红色、净卖出和卖出为绿色；第三行使用黑色绘制主要买入股票。测量函数使用完全相同的三行文字和字号。

- [ ] **Step 3: 回归与上线**

生成真实样稿确认左右等高、三行无重叠；升级 PDF 缓存版本并完成生产部署。

## Plan Self-Review

- Spec coverage: Pantone 配色、固定三页、数量上限、字号下限、无截断、去重、水印、上线均有对应步骤。
- Placeholder scan: 无待定项。
- Type consistency: 不新增导出 section；现有 `full/stories/stocks/lhb` 语义保持不变。
