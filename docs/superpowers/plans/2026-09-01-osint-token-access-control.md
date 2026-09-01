# OSINT Token Access Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保留公开日报的同时，把实时 OSINT 和 DeepSeek 交互接口收紧为 owner-only，并阻止新闻刷新重复烧 token。

**Architecture:** Clerk middleware 负责页面和 API 的统一 owner allowlist；独立纯函数模块负责可测试的授权决策。新闻刷新由客户端取消/禁用重复请求，服务端 coordinator 合并并发并执行 5 分钟冷却。DeepSeek 用量只记录结构化计数，生产环境使用独立 key。

**Tech Stack:** Next.js 15 App Router、Clerk、TypeScript、Prisma/Supabase、DeepSeek Chat Completions、Vercel CLI。

## Global Constraints

- `/osint/reports(.*)` 与只读报告 API 必须保持匿名可访问。
- `/osint`、故事/context/news-feed 与交互式 DeepSeek API 必须 owner-only。
- 生产缺少 `OSINT_ALLOWED_CLERK_USER_IDS` 时 fail closed。
- 不提交或输出 Clerk、DeepSeek、Vercel secret。
- 不撤销旧 `API Claude` key；只新增 `Alpha-Production` 并更新 Vercel Production。
- `git push` 必须先于 `vercel deploy --prod`。

---

### Task 1: Owner-only Clerk 边界

**Files:**
- Create: `lib/auth/owner-access.ts`
- Modify: `middleware.ts`
- Modify: `app/(auth)/sign-up/[[...sign-up]]/page.tsx`
- Create: `tests/security/osint-owner-access.test.ts`

**Interfaces:**
- Produces: `ownerAccessDecision(userId, allowlistValue, nodeEnv): "allow" | "unauthenticated" | "forbidden" | "misconfigured"`
- Consumes: `OSINT_ALLOWED_CLERK_USER_IDS`，逗号分隔 Clerk user id。

- [ ] **Step 1: 写授权失败测试**

```ts
assert.equal(ownerAccessDecision(null, "user_a,user_b", "production"), "unauthenticated");
assert.equal(ownerAccessDecision("user_x", "user_a,user_b", "production"), "forbidden");
assert.equal(ownerAccessDecision("user_a", "user_a,user_b", "production"), "allow");
assert.equal(ownerAccessDecision("user_a", "", "production"), "misconfigured");
assert.equal(ownerAccessDecision("user_a", "", "development"), "allow");
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --import tsx tests/security/osint-owner-access.test.ts`

Expected: FAIL，`lib/auth/owner-access` 不存在。

- [ ] **Step 3: 实现纯授权决策**

```ts
export type OwnerAccessDecision = "allow" | "unauthenticated" | "forbidden" | "misconfigured";

export function ownerAccessDecision(
  userId: string | null | undefined,
  allowlistValue = process.env.OSINT_ALLOWED_CLERK_USER_IDS ?? "",
  nodeEnv = process.env.NODE_ENV ?? "development",
): OwnerAccessDecision {
  if (!userId) return "unauthenticated";
  const allowed = new Set(allowlistValue.split(",").map((value) => value.trim()).filter(Boolean));
  if (allowed.size === 0) return nodeEnv === "production" ? "misconfigured" : "allow";
  return allowed.has(userId) ? "allow" : "forbidden";
}
```

- [ ] **Step 4: 在 middleware 中保护 OSINT 与所有交互式 DeepSeek 路径**

```ts
const isPublicReport = createRouteMatcher([
  "/osint/reports(.*)",
  "/api/osint/v1/reports(.*)",
]);
const isOwnerPage = createRouteMatcher(["/osint"]);
const isOwnerApi = createRouteMatcher([
  "/api/osint/v1/stories(.*)",
  "/api/osint/v1/context(.*)",
  "/api/news-feed(.*)",
  "/api/ai/stream(.*)",
  "/api/ai/situation-analysis(.*)",
  "/api/ai/generate-strategy(.*)",
  "/api/strategy-recommendation(.*)",
  "/api/analyze-watchlist(.*)",
]);
```

在 public report 判断之后读取 `await auth()`；未登录页面跳转 `/sign-in`，API 返回 401；非白名单或生产配置缺失时页面跳转 `/sign-in?reason=unauthorized`，API 返回 403。`/sign-up(.*)` 永久重定向 `/sign-in?reason=registration-closed`。

- [ ] **Step 5: 运行授权测试与 middleware 静态断言**

Run: `node --import tsx tests/security/osint-owner-access.test.ts`

Expected: `OSINT_OWNER_ACCESS_OK`。

- [ ] **Step 6: 提交**

```bash
git add lib/auth/owner-access.ts middleware.ts 'app/(auth)/sign-up/[[...sign-up]]/page.tsx' tests/security/osint-owner-access.test.ts
git commit -m "feat: 为OSINT增加所有者鉴权"
```

---

### Task 2: 合并并冷却新闻刷新

**Files:**
- Create: `lib/osint/refresh-coordinator.ts`
- Modify: `lib/osint/story-service.ts`
- Modify: `app/api/osint/v1/stories/route.ts`
- Modify: `components/osint-v2/WorldBriefing.tsx`
- Modify: `tests/osint/world-briefing-refresh.test.ts`
- Create: `tests/osint/refresh-coordinator.test.ts`

**Interfaces:**
- Produces: `createRefreshCoordinator<T>(cooldownMs, now?)`，返回 `{ run(key, loader), clear() }`。
- Consumes: `getStorySnapshot({ forceRefresh: true })`。

- [ ] **Step 1: 写 coordinator 失败测试**

```ts
const coordinator = createRefreshCoordinator<number>(300_000, () => now);
const first = coordinator.run("all|1|20", async () => { calls += 1; return 7; });
const concurrent = coordinator.run("all|1|20", async () => { calls += 1; return 8; });
assert.equal(await first, 7);
assert.equal(await concurrent, 7);
assert.equal(calls, 1);
assert.equal(await coordinator.run("all|1|20", async () => 9), 7);
now += 300_001;
assert.equal(await coordinator.run("all|1|20", async () => { calls += 1; return 9; }), 9);
assert.equal(calls, 2);
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --import tsx tests/osint/refresh-coordinator.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现 coordinator 并接入 story service**

```ts
type RefreshEntry<T> = { completedAt: number; value?: T; inFlight?: Promise<T> };

export function createRefreshCoordinator<T>(cooldownMs: number, now = Date.now) {
  const entries = new Map<string, RefreshEntry<T>>();
  return {
    async run(key: string, loader: () => Promise<T>): Promise<T> {
      const entry = entries.get(key);
      if (entry?.inFlight) return entry.inFlight;
      if (entry?.value !== undefined && now() - entry.completedAt < cooldownMs) return entry.value;
      const inFlight = loader().then((value) => {
        entries.set(key, { completedAt: now(), value });
        return value;
      }).catch((error) => {
        entries.delete(key);
        throw error;
      });
      entries.set(key, { completedAt: entry?.completedAt ?? 0, value: entry?.value, inFlight });
      return inFlight;
    },
    clear() { entries.clear(); },
  };
}
```

`getStorySnapshot` 仅在真实 production fetch 且 `forceRefresh` 时进入 coordinator；测试注入的 `fetchImpl` 保持原行为。

- [ ] **Step 4: 修复客户端重复刷新**

删除 5 分钟 `setInterval`。为手动刷新保存独立 `AbortController`，新请求先 abort 旧请求；按钮在 `loading` 时禁用，避免同一页面重复提交。

- [ ] **Step 5: 修复响应缓存语义**

```ts
const cacheControl = forceRefresh
  ? "private, no-store"
  : "private, max-age=0, must-revalidate";
return jsonWithEtag(request, snapshot, cacheControl);
```

- [ ] **Step 6: 运行刷新测试**

Run:

```bash
node --import tsx tests/osint/refresh-coordinator.test.ts
node --import tsx tests/osint/world-briefing-refresh.test.ts
node --import tsx tests/osint/story-contract.test.ts
```

Expected: 三个测试均以 `OK` 结束。

- [ ] **Step 7: 提交**

```bash
git add lib/osint/refresh-coordinator.ts lib/osint/story-service.ts app/api/osint/v1/stories/route.ts components/osint-v2/WorldBriefing.tsx tests/osint/refresh-coordinator.test.ts tests/osint/world-briefing-refresh.test.ts
git commit -m "fix: 限制OSINT新闻重复刷新"
```

---

### Task 3: DeepSeek 用量归因

**Files:**
- Create: `lib/ai/deepseek-usage.ts`
- Modify: `lib/osint/story-service.ts`
- Modify: `app/api/ai/situation-analysis/route.ts`
- Modify: `lib/ai/deepseek-stream.ts`
- Modify: `app/api/strategy-recommendation/route.ts`
- Modify: `app/api/ai/generate-strategy/route.ts`
- Modify: `app/api/intelligence-feed/generate/route.ts`
- Modify: `skills/deepseek_agent.ts`
- Create: `tests/security/deepseek-usage.test.ts`

**Interfaces:**
- Produces: `logDeepSeekUsage(context, payload)`，只输出计数字段。

- [ ] **Step 1: 写安全日志失败测试**

测试验证输出含 `context/model/promptTokens/cacheHitTokens/completionTokens/totalTokens`，且不含 `Authorization`、prompt、message content 或 `sk-`。

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --import tsx tests/security/deepseek-usage.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现安全 usage 日志**

```ts
export function logDeepSeekUsage(context: string, payload: unknown): void {
  const body = payload as { model?: unknown; usage?: Record<string, unknown> };
  const usage = body?.usage ?? {};
  console.info("[deepseek usage]", {
    context,
    model: String(body?.model ?? "unknown"),
    promptTokens: Number(usage.prompt_tokens ?? 0),
    cacheHitTokens: Number(usage.prompt_cache_hit_tokens ?? 0),
    cacheMissTokens: Number(usage.prompt_cache_miss_tokens ?? 0),
    completionTokens: Number(usage.completion_tokens ?? 0),
    totalTokens: Number(usage.total_tokens ?? 0),
  });
}
```

- [ ] **Step 4: 在非流式调用解析 JSON 后调用 helper**

各调用点使用稳定 context：`osint-story-batch`、`osint-situation`、`strategy-recommendation`、`generate-strategy`、`intelligence-feed`、`deepseek-agent`。

流式接口请求增加 `stream_options: { include_usage: true }`，只在最终 usage chunk 记录一次。

- [ ] **Step 5: 运行安全日志测试与 TypeScript 聚焦检查**

Run:

```bash
node --import tsx tests/security/deepseek-usage.test.ts
npx tsc --noEmit --pretty false 2>&1 | grep -v '^.next/'
```

Expected: usage 测试通过；无新增源代码类型错误。

- [ ] **Step 6: 提交**

```bash
git add lib/ai/deepseek-usage.ts lib/osint/story-service.ts app/api/ai/situation-analysis/route.ts lib/ai/deepseek-stream.ts app/api/strategy-recommendation/route.ts app/api/ai/generate-strategy/route.ts app/api/intelligence-feed/generate/route.ts skills/deepseek_agent.ts tests/security/deepseek-usage.test.ts
git commit -m "feat: 记录DeepSeek安全用量日志"
```

---

### Task 4: 完整回归与生产配置

**Files:**
- Modify: Vercel Production environment only; no repository secret file.

**Interfaces:**
- Consumes: two confirmed Clerk user ids and a new DeepSeek `Alpha-Production` key。

- [ ] **Step 1: 运行聚焦回归**

```bash
node --import tsx tests/security/osint-owner-access.test.ts
node --import tsx tests/security/deepseek-usage.test.ts
node --import tsx tests/osint/refresh-coordinator.test.ts
node --import tsx tests/osint/world-briefing-refresh.test.ts
node --import tsx tests/osint/daily-report-video.test.ts
node --import tsx tests/osint/daily-report-image-surface.test.ts
```

Expected: 全部以 `OK` 结束。

- [ ] **Step 2: 构建 production**

Run: `npm run build`

Expected: exit 0。

- [ ] **Step 3: 创建隔离的生产 key 并配置 Vercel**

通过 DeepSeek 控制台创建 `Alpha-Production`，通过 Vercel API/CLI 更新 `DEEPSEEK_API_KEY` Production。查询 Clerk 后端 API 得到两个已确认 user id，并配置 `OSINT_ALLOWED_CLERK_USER_IDS` Production。命令和日志不得打印实际值。

- [ ] **Step 4: 推送与部署**

```bash
git fetch origin
git push origin HEAD:main
vercel deploy --prod
```

Expected: custom domain 指向新 deployment。

- [ ] **Step 5: 线上验收**

- 匿名 `/osint` 跳转登录。
- 匿名 `/api/osint/v1/stories` 返回 401。
- 匿名 `/osint/reports` 返回 200。
- 白名单 Chrome 登录后可打开 OSINT 并刷新。
- 两次快速刷新只产生一次后端刷新。
- DeepSeek Usage 显示新 key，旧 key 不因 Alpha 操作增加。

- [ ] **Step 6: 最终提交状态确认**

Run:

```bash
git status --short --branch
git log -5 --oneline --decorate
```

Expected: 工作树干净，`origin/main` 包含安全改动和 9 月 1 日视频模板。
