# 我的股票模块设计方案

> 日期：2026-04-01
> 状态：已实现

---

## 概述

新增 `/my-stocks` 路由，作为个人投资决策中心。两个 Tab：

1. **持仓策略** — 账户总览 + 健康度检查(5条铁律) + 持仓列表 + 监控清单(触发检测) + Claude Opus AI诊断
2. **交易日历** — 月度阶段进度条 + 月历网格(事件标注) + 日期详情/事件管理 + 本周待办

## 数据模型

新增 `PersonalNote` Prisma 模型，type 字段区分：
- `strategy` — 买入策略(triggerPrice, maxShares 等)
- `calendar` — 日历事件(eventType: action/watch/earnings/review/trigger)
- `rule` — 铁律规则
- `review` — AI 诊断/复盘记录

复用已有：`Portfolio`(持仓), `Watchlist`(自选), East Money API(实时报价)

## 新增文件清单

### API 路由
- `app/api/personal-notes/route.ts` — GET(筛选查询) + POST(创建)
- `app/api/personal-notes/[id]/route.ts` — PUT(更新) + DELETE(删除)
- `app/api/portfolio/health-check/route.ts` — GET(5条铁律检测 + 实时价格)

### 页面
- `app/my-stocks/layout.tsx` — 布局(TopNavBar + 内容区)
- `app/my-stocks/page.tsx` — 主页面(数据获取 + Tab 切换 + 组件集成)

### 组件 (components/my-stocks/)
- `AccountSummary.tsx` — 四宫格总览(总资产/盈亏/现金比/最大单股)
- `HealthCheck.tsx` — 5条铁律检测(单股40%/现金20%/月交易6次/板块35%/止损8%)
- `PositionTable.tsx` — 持仓表格 + 监控清单(触发检测)
- `AIDiagnosis.tsx` — Claude Opus 流式诊断面板
- `PhaseProgressBar.tsx` — W1-W4 阶段进度条
- `CalendarGrid.tsx` — 月历网格 + 事件标注
- `DayDetailPanel.tsx` — 日期详情 + 事件表单(CRUD)
- `WeeklyTodoList.tsx` — 本周待办(可勾选完成)

### 其他修改
- `components/layout/TopNavBar.tsx` — NAV_LINKS 新增"我的股票"入口
- `prisma/schema.prisma` — 新增 PersonalNote 模型
- `app/api/ai/stream/route.ts` — MODEL_CONFIGS 新增 claude-opus

## 集成点

| 已有能力 | 新模块复用方式 |
|---------|--------------|
| East Money ulist.np 批量报价 | 监控清单触发检测、持仓盈亏 |
| Portfolio Prisma 模型 | 直接读取，不改 schema |
| /api/ai/stream 流式AI | Claude Opus 诊断复用 |
| Clerk auth | PersonalNote 按 userId 隔离 |
