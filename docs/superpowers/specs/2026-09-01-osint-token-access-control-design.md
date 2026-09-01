# OSINT Token 消耗与访问控制设计

日期：2026-09-01

## 背景与证据

- DeepSeek 近 30 天总计 2,510 次请求、15,526,513 tokens、¥44.16。
- Vercel 生产环境使用的 `API Claude` key 占 2,482 次请求、14,199,212 tokens、¥43.45。
- 2026-08-31 共有 486 次请求、4,380,270 tokens；其中 14:00–16:00 集中发生 445 次。
- Clerk 当前只有两个 Guangyu Zhang 账号，没有发现陌生注册账号；主账号有两个活跃会话。
- `middleware.ts` 当前只注入 Clerk 上下文，没有保护 `/osint` 或相关 API。
- `WorldBriefing` 每 5 分钟自动请求一次新闻；当前待发布的“强制刷新”实现还会绕过页面缓存和数据源缓存，且加载期间允许重复点击。
- OSINT 新闻服务每批最多分析 12 条，首页预热最多 50 条；一次完整 AI 丰富可能形成约 5 次 DeepSeek 请求。

结论：没有证据证明陌生账号登录，但生产 key 被多个用途共用，且 OSINT 页面与 DeepSeek 接口缺少访问控制。当前强制刷新实现不应直接上线。

## 目标

1. 保留公开报告链接，确保抖音用户能访问 `/osint/reports`。
2. 实时 `/osint` 页面及其耗费型 API 只允许账号所有者访问。
3. 普通浏览和重复刷新不再无上限触发 DeepSeek。
4. 每次 DeepSeek 调用留下可归因的 usage 日志。
5. 为 Alpha 生产环境使用独立 API key，和本机 AI、视频工具分账。

## 非目标

- 不修改报告正文、视频模板或新闻来源。
- 不把公开报告页改成登录后可见。
- 不引入新的付费限流服务或大规模数据库改造。
- 本阶段不删除旧 DeepSeek key，避免其他工具立即中断。

## 访问控制

### 公开路径

- `/sign-in(.*)`
- `/osint/reports(.*)`
- `GET /api/osint/v1/reports`
- `GET /api/osint/v1/reports/[reportId]`
- `GET /api/osint/v1/reports/[reportId]/export`
- `POST /api/osint/v1/reports/generate` 继续使用现有 `CRON_SECRET`，不要求浏览器 Clerk 会话

本次不把整站改为 owner-only。与 OSINT、DeepSeek 无关的页面、webhook、cron 和 worker 路径保持现状，避免破坏现有自动任务。

### 所有者路径

- `/osint` 实时态势页面，但不包含 `/osint/reports`
- `/api/osint/v1/stories`
- `/api/osint/v1/context`
- `/api/news-feed`
- `POST /api/ai/stream`
- `POST /api/ai/situation-analysis`
- `GET /api/strategy-recommendation`
- `POST /api/ai/generate-strategy`
- `POST /api/analyze-watchlist`

`POST /api/intelligence-feed/generate` 继续使用现有 `CRON_SECRET`，不改成浏览器会话鉴权。

鉴权使用现有 Clerk。生产环境新增 `OSINT_ALLOWED_CLERK_USER_IDS`，只包含当前两个已确认账号。未登录返回 401 或跳转登录页；已登录但不在白名单返回 403。生产环境缺少白名单时 fail closed，不允许退化为公开访问。

关闭公开 `/sign-up` 页面；现有两个账号继续通过 `/sign-in` 登录。

## 刷新与 Token 控制

1. 删除 `WorldBriefing` 每 5 分钟自动刷新新闻的定时器，页面首次进入只加载一次。
2. “刷新新闻”只允许所有者手动触发；加载期间禁用按钮，并用 `AbortController` 取消旧请求。
3. 服务端为强制刷新增加单航班合并和 5 分钟冷却。同一实例中的并发请求复用同一个 Promise；冷却期内返回最新缓存，不重新启动数据源和 AI 分析。
4. 强制刷新响应使用 `private, no-store`；普通响应不再标记为公共 CDN 缓存，避免鉴权响应被公共缓存。
5. 继续复用 `OsintStoryCache`。已分析的稳定 story id 不重复调用 DeepSeek，只分析新出现且未缓存的故事。
6. DeepSeek 响应记录用途、模型、请求数、prompt/cache/completion/total tokens，不记录 prompt、新闻正文、用户数据或密钥。

## API Key 隔离

1. 在 DeepSeek 新建 `Alpha-Production` key。
2. 只更新 Vercel Production 的 `DEEPSEEK_API_KEY`；不写入仓库或日志。
3. 旧 `API Claude` key 暂时保留给其他工具。
4. 部署后观察 24 小时。若 `Alpha-Production` 的请求量与本人操作不匹配，再进一步查接口访问；其他工具迁移完成后再单独确认是否撤销旧 key。

## 验证

- 未登录访问 `/osint` 会跳转 `/sign-in`。
- 未登录或非白名单调用 OSINT/DeepSeek API 返回 401/403，且 DeepSeek 用量不增加。
- 两个白名单账号可以正常打开 OSINT。
- `/osint/reports` 和具体报告仍可匿名打开。
- 连续点击刷新只产生一次服务端刷新；5 分钟冷却期内不新增 DeepSeek 请求。
- DeepSeek usage 日志包含 token 数但不包含密钥、prompt 或用户隐私。
- 现有日报视频测试、OSINT 聚焦测试、TypeScript 和 production build 通过。

## 发布顺序

1. 先完成代码与本地验证。
2. 新建并配置独立 DeepSeek production key 和 Clerk owner 白名单。
3. 先 `git push`，再执行 `vercel deploy --prod`。
4. 验证匿名、白名单、公开报告、刷新冷却和 DeepSeek 用量。
5. 与已完成的 9 月 1 日视频模板改动一并上线。
