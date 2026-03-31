# Alpha-Quant-Copilot 开发指南

AI-powered quantitative trading assistant with real-time market data, built with Next.js 15, React 19, Prisma ORM, and Supabase PostgreSQL.

---

## Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/your-org/alpha-quant-copilot.git
cd stock-analysis
npm install
```

### 2. Environment Setup
Copy `.env.example` to `.env.local` and fill in credentials:

```bash
cp .env.example .env.local
```

**Required environment variables:**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk authentication
- `CLERK_SECRET_KEY` - Clerk API secret
- `CLERK_WEBHOOK_SECRET` - Webhook signature validation
- `DATABASE_URL` - Supabase pooled connection
- `DIRECT_URL` - Supabase direct connection (for migrations)
- `DEEPSEEK_API_KEY` - AI analysis engine (optional for dev)
- `NEXT_PUBLIC_API_BASE_URL` - Backend API base URL

### 3. Database Setup
```bash
# Apply Prisma migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# View database (optional)
npx prisma studio
```

### 4. Start Development
```bash
npm run dev
```
Server starts at `http://localhost:3000`

---

## Project Structure

```
stock-analysis/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Authentication pages (sign-in, sign-up)
│   ├── api/                      # 20+ API routes
│   │   ├── market-data/          # Stock price & indicator data
│   │   ├── intelligence-feed/    # AI-generated insights
│   │   ├── strategy-recommendation/  # Trading signals
│   │   ├── portfolio/            # Portfolio management
│   │   ├── unified-search/       # Global A-stock/US stock search
│   │   └── ... (20+ total routes)
│   ├── dashboard/                # Main dashboard
│   │   ├── macro/                # Macro market overview
│   │   ├── asset/[symbol]/       # Global asset detail (crypto/commodity/index)
│   │   └── stock/[symbol]/       # A-share/US stock detail
│   ├── osint/                    # Full-screen OSINT radar (own layout.tsx suppresses global nav)
│   ├── portfolio/                # Portfolio management page
│   ├── stocks/[code]/            # Individual stock details
│   ├── live-feed/                # Intelligence feed
│   ├── strategy-recommendation/  # Strategy recommendations
│   ├── layout.tsx                # Root layout (Clerk providers)
│   └── page.tsx                  # Home (redirects to /dashboard)
│
├── components/                   # React components
│   ├── layout/                   # Navigation, sidebar, headers
│   ├── charts/                   # Charts (technical indicators, K-lines)
│   ├── intelligence-feed/        # Feed items, filtering
│   ├── osint-v2/                 # OSINT situational awareness (GeoMapInner, IntelFeed, StatusBar, AISituationBrain)
│   ├── portfolio/                # Portfolio UI
│   ├── macro/                    # Macro indicators
│   ├── global-search/            # Unified search results
│   ├── strategy-chat/            # Strategy recommendation UI
│   └── ui/                       # shadcn/ui primitives
│
├── services/                     # Data adapters (normalized to SituationalEntity type)
│   └── adapters/                 # finance-adapter, maritime-adapter, aviation-adapter, geoconflict-adapter
│
├── lib/                          # Utility functions
│   ├── api/                      # API client helpers
│   ├── data/                     # Data fetching, caching
│   ├── search-proxy/             # Search service abstraction
│   └── prisma.ts                 # Prisma client singleton
│
├── prisma/                       # Database schema & migrations
│   ├── schema.prisma             # Data models
│   └── migrations/               # Migration history
│
├── public/                       # Static assets
├── skills/                       # Custom utilities & agents
├── scripts/                      # Build, test, deployment scripts
├── tsconfig.json                 # TypeScript config
└── tailwind.config.ts            # Tailwind CSS config
```

---

## Key Technologies

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind 3.4 · Prisma 7 + Supabase PostgreSQL · Clerk auth · DeepSeek AI · Vercel deploy

---

## Common Commands

### Development
```bash
npm run dev              # Start dev server (port 3000)
npm run build            # Build for production
npm run next:lint        # ESLint check
```

### Database
```bash
npx prisma migrate dev   # Create & apply new migration
npx prisma studio       # Open database GUI
npx prisma generate     # Regenerate Prisma client
```

### Verification & Testing
```bash
npm run verify                # Quick milestone verification
npm run verify:uat-quick      # Quick UAT test
npm run verify:uat-full       # Full UAT test
npm run test:smart-selector   # Test data source selection
```

### AI & Data
```bash
npm run dev:deepseek         # Run DeepSeek agent
npm run search:test          # Test search proxy
npm run search:status        # Check search service status
```

### Deployment
```bash
vercel link              # Link to Vercel project
vercel deploy            # Deploy to staging
npm run build            # Pre-flight check
```

---

## Key API Routes

| Route | Notes |
|-------|-------|
| `/api/stock-price-history` | OHLC via East Money K-line API (not DB) |
| `/api/maritime` | AISStream vessels, 3-tier stale cache |
| `/api/geoconflict` | GDELT conflict events (ACLED replacement) |
| `/api/aviation` | OpenSky proxied (CORS workaround) |
| `/api/news-feed` | Returns `{ news, summary }` |
| `/api/intelligence-feed` | Returns `{ feed }` |
| `/api/ai/situation-analysis` | DeepSeek macro analysis (3min cache, mock if no key) |
| `/api/ai/stream` | Streaming AI responses |
| `/api/unified-search` | A-stock + US stock search |
| `/api/users/sync` | Sync Clerk user to DB |
| `/api/watchlist/recalculate` | POST with `{ids}`, computes SL/TP from K-line data (East Money) |

---

## Prisma Data Models

Core entities in `prisma/schema.prisma`:

| Model | Purpose | Key Fields |
|-------|---------|-----------|
| **User** | User profile | clerkUserId, email, settings |
| **Watchlist** | User's stock picks | stockCode, buyPrice, stopLoss, targetPrice |
| **IntelligenceFeed** | AI insights | stockCode, actionSignal, trapProbability |
| **Portfolio** | Investment portfolio | userId, totalValue, cash |
| **BacktestResult** | Strategy backtests | strategyId, returns, sharpeRatio |
| **StockPriceHistory** | Price data cache (unused) | table is empty — OHLC fetched live from East Money API |

**Important**: All user-specific data requires `userId` filter in API routes for privacy.

---

## Code Patterns & Conventions

### Client vs Server Components
- Use `"use client"` for interactive components (state, events)
- Keep server components for data fetching, reducing JS bundle
- Example: `components/portfolio/AddPositionDialog.tsx` uses `"use client"` for form interactivity

### API Route Auth Patterns
Two auth patterns coexist:
- **Clerk middleware** (`auth()` from `@clerk/nextjs/server`) — used by `/api/intelligence-feed`, `/api/strategy-recommendation`, `/api/users/sync`
- **Bearer token** (`getUserIdFromRequest` from `lib/auth-helpers.ts`) — used by `/api/watchlist`, `/api/watchlist/recalculate`

For Bearer-token routes, frontend must send `Authorization: Bearer ${token}` via `useAuth().getToken()`. Do NOT use `credentials: "include"`.

### Database Queries
- Always filter by `userId` for user-specific data
- Run `npx prisma migrate dev` after any schema.prisma change

---

## Environment & Configuration

### Local Development (.env.local)
```bash
# Clerk (get from https://dashboard.clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Supabase (get from https://supabase.com)
DATABASE_URL=postgresql://user:pass@db.supabase.co:5432/postgres
DIRECT_URL=postgresql://user:pass@db.supabase.co:5432/postgres

# DeepSeek (optional, get from https://platform.deepseek.com)
DEEPSEEK_API_KEY=sk_...
```

### Production (Vercel)
Use `vercel env` to manage secrets:
```bash
vercel env add CLERK_SECRET_KEY
vercel env add DATABASE_URL
vercel env add DEEPSEEK_API_KEY
```

Never commit `.env.local` - it's in `.gitignore`.

### MCP & Claude Code Configuration

**Team-shared (committed to git):**
- `.mcp.json` - MCP server declarations (Supabase, etc.) - enables Claude to query databases

**Personal/local only (in .gitignore):**
- `.claude/settings.local.json` - Hook rules, personal permissions, tool allowlists
- Never include Supabase tokens, API keys, or credentials in settings.local.json
- Hook blocks `.env*` edits: use `vercel env` instead

---

## Git Workflow & Discipline

### Before Major Changes
```bash
# Create baseline commit
git commit -m "chore: rebase baseline"
git status  # Ensure clean working directory
```

### Branch Strategy
- Feature branches for new functionality
- Review all changes with `git diff main...HEAD`
- Merge only through tested pull requests

### Commit Message Format
```
<type>: <short description>

<details (optional)>

- What changed
- Why it changed
- Any breaking changes

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Configuration Files Safety
- **Never commit**: `.env*`, Supabase tokens, Clerk secrets
- **Always commit**: `.mcp.json` (team needs MCP servers)
- **Never commit**: `.claude/settings.local.json` (personal hooks/rules)
- **If credential exposed**: Immediately rotate keys in Supabase/Clerk dashboard

### Rollback on Failure
If 3+ consecutive fix attempts fail:
```bash
git reset --hard HEAD~1
# Analyze failure, create improvement plan
```

---

## Development Gotchas

### ⚠️ Prisma Migrations
- **NEVER** edit `.env` files directly - use `vercel env`
- **Always** run `npx prisma migrate dev` after schema changes
- Direct URL required for migrations, pooled URL for queries
- `prisma migrate dev` 需要 shadow database，从本地连 Supabase 常失败 — 替代：`prisma db push` 或 Supabase SQL Editor 手动 ALTER TABLE
- 新增字段后必须 `npx prisma generate` 更新 client 类型

### ⚠️ Authentication
- User-data API routes use two auth patterns — see "API Route Auth Patterns" above
- `lib/auth-helpers.ts` — `getUserIdFromRequest()` decodes JWT from Authorization header
- `lib/trading.ts` — `calculateStopLoss()` / `calculateTakeProfit()` used by `/api/watchlist/recalculate`
- Clerk webhook must be configured for user sync
- Test auth in staging before production deploy

### ⚠️ Real-time Data
- API calls are cached - use `revalidatePath()` for refresh
- SSE streaming for live market data
- WebSocket support for real-time collaboration (if added)

### ⚠️ Component Rendering
- Check for `"use client"` in interactive components
- Server components must not use hooks
- Hydration mismatch errors = missing `"use client"`

### ⚠️ External Market Data APIs
- **Finnhub free tier**: Direct index symbols (`^DJI`, `^GSPC`) blocked → use ETF proxies: DIA×100≈Dow, QQQ×40≈Nasdaq, SPY×10≈S&P500
- **stooq.com**: Free, no API key, works from Vercel US; endpoint: `https://stooq.com/q/l/?s={symbol}&f=sd2t2ohlcvn&e=json`; symbols: `^hsi`, `^nkx`, `gc.f`, `cl.f`, `usdcny`
- **Sina hq.sinajs.cn**: GBK-encoded, geo-blocked from Vercel US for global symbols; only reliable for A-shares
- **OpenSky Network**: Browser fetch blocked by CORS → proxy through Next.js API route (see `/api/aviation`)
- **AISStream**: WebSocket-only → use short-lived server-side connection via `ws` package (6s window, cache 60s as REST); 3-tier cache: fresh <60s → return, stale <300s → return with `stale:true`, else `noDataReason`
- **East Money K-line API**: `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid={secid}&klt=101&fqt=1` — secid: `1.6xx`/`1.9xx` for Shanghai, `0.0xx`/`0.3xx` for Shenzhen; replaces empty `StockPriceHistory` Prisma table; see `app/api/stock-price-history/route.ts`
- **East Money ulist.np 实时报价**: `fltt=2` 参数**必须加**，否则 f2(价格) 返回分为单位（1876 而非 18.76）；缺少会导致 HWM 脏数据级联污染（max()永远取脏值）
- **East Money clist 排序方向**: `po=0` = **降序**（最大值先返回），`po=1` = **升序**（最小值先返回）— 左侧交易按PE升序需用 `po=1`
- **East Money 板块与行业**: 个股 `f100` 行业名（如"电网设备"）与行业板块指数名（如"电力设备", `m:90+t:2`）不匹配，不能直接做 key 查找；概念板块成分股有严重交叉归属（制药股出现在电网板块），趋势引擎V3改为全A股扫描+反查行业
- **East Money 内外盘**: `f34`=外盘(主动买), `f35`=内盘(主动卖), `f34+f35=f5(总量)`; 盘后数据可能清零
- **GDELT GeoJSON**: Free geo-conflict data (ACLED requires paid credentials) → `https://api.gdeltproject.org/api/v2/geo/geo?query=conflict+OR+military&mode=PointData&format=GeoJSON&timespan=24h`; see `app/api/geoconflict/route.ts`
- **Map marker jitter**: Multiple entities at same coordinates stack invisibly — apply deterministic ±0.4°~0.6° lat/lng offsets by index; see `jitter()` in `services/adapters/finance-adapter.ts`

### ⚠️ Sonner Toaster
- `app/layout.tsx` must mount BOTH `<ShadcnToaster />` AND `<SonnerToaster />` — sonner's `toast()` calls are silently dropped without its own Toaster in the tree

### ⚠️ Internal API Response Shapes
- `/api/intelligence-feed` returns `{ feed: SituationFeed[] }` (not `data` or `items`)
- `/api/news-feed` returns `{ news: NewsItem[], summary: string }` (not `data` or `items`)

### ⚠️ Full-Screen Route Isolation
- For full-screen pages (OSINT dashboard, etc.), create `app/<route>/layout.tsx` returning `<>{children}</>` to suppress global nav/sidebar
- Without this, bento grid is constrained by the shell layout

### ⚠️ Sensitive Files
- `.env*` files block edits (security hook)
- Use `vercel env` for production secrets
- Never commit Clerk/Supabase credentials
- **`printf '%s' "$val" | vercel env add KEY production`** — 必须用 `printf`，不能用 `echo`；`echo` 会注入尾部 `\n`，导致 AISStream 等 API Key 鉴权静默失败（表现为 connected=true 但 0 数据）
- 追加 `.env.local` 时先确认文件末尾有换行，否则用 Python 修正（`echo >>` 可能污染上一行）

### ⚠️ A股指数 Sina/Tencent 符号前缀
- `000001`（上证指数）、`000300`（沪深300）、`000905`（中证500）必须用 `sh` 前缀，不能走通用 `startsWith('0') → sz` 规则
- 相关函数：`skills/data_crawler.ts` 的 `normalizeSymbolForSina`/`normalizeSymbolForTencent`，以及 `app/api/stock-prices/route.ts` 的 `fetchFromTencent`

### ⚠️ news-feed Fallback API 解析
- CLS / Sina / 东方财富 fallback API 返回**纯 UTF-8 JSON**（非 GBK，非 JSONP）
- JSONP 剥离正则 `/[)}\];]*$/` 不能对 `{`/`[` 开头的响应使用，会吃掉末尾 `}}` 导致 JSON.parse 失败
- 判断：`trimmed.startsWith('{') || trimmed.startsWith('[')` → 跳过尾部剥离

### ⚠️ 本地调试 curl
- 本地 curl 测试 dev server 必须加 `--noproxy localhost`，否则走系统代理（127.0.0.1:1087）返回 503

### ⚠️ /api/global-macro 响应结构
- 返回 `{ markets: [{symbol, name, price, change, changePercent, source}] }` — 是数组不是对象
- 查找特定 symbol：`json.markets?.find(m => m.symbol === sym)` — 不能用 `json.markets?.[sym]`
- `source` 字段可能为 `'finnhub'` / `'stooq'` / `'unavailable'`（null 表示 API 失败，无 fallback 假数据）

### ⚠️ global-macro STATIC_FALLBACK 已删除
- 历史上曾有硬编码陈旧价格 fallback，已删除。API 失败现在返回 `null` + `source:'unavailable'`
- 不要重新添加任何硬编码价格作为 fallback — 宁可显示 `--` 也不能显示假数据
- Stooq change 计算：URL 参数必须加 `p`（prevClose）: `f=sd2t2ohlcpvn`；用 `close - previous_close`，不能用 `close - open`

### ⚠️ AISStream 全球覆盖
- `MaritimeAdapter()` 无参默认订阅全部 20 个航区；如需限定区域才传数组
- 船只上限 1500，7.5s WebSocket 窗口（Vercel Hobby 限制）

### ⚠️ lightweight-charts 多图联动
- 时间轴缝合：上层图 `timeScale: { visible: false }`，仅底图 `visible: true`
- 十字光标同步：`subscribeCrosshairMove` + `setCrosshairPosition(val, time, series)`；需共享 `isSyncing` flag 防循环
- 缩放同步：`subscribeVisibleLogicalRangeChange` + `setVisibleLogicalRange(range)`
- `technicalindicators` 计算必须 try-catch 保护（数据不足时会抛出）

### ⚠️ lib/utils/mockKlineData.ts — 非死代码
- 被 `lib/kline-api/fallback.ts` 引用，作为所有真实API失败后的最终降级数据源
- 不要以"mock/test/example"命名为由删除 — 先 `grep -r mockKlineData` 确认无引用

### ⚠️ npx tsc --noEmit 与 .next/ 缓存
- 删除 API route 后 tsc 会报 `.next/types/app/api/...` 找不到模块 — 这是 stale 缓存，非真实错误
- `npm run build` 重新生成 `.next/` 后错误消失；过滤命令：`npx tsc --noEmit 2>&1 | grep -v "^.next/"`

### ⚠️ git branch -d 对纯本地分支失败
- 从未 push 过的分支即使已合并到 HEAD，`git branch -d` 仍报错（无 remote tracking ref）
- 安全删除：确认已合并后用 `git branch -D <branch>`

### ⚠️ CLAUDE.md 双文件说明
- `CLAUDE.md` 与 `claude.md` 是同一文件的硬链接（相同 inode）— 编辑任意一个即可，两者始终同步

### ⚠️ Clerk useAuth + getToken 时序
- `getToken()` 在 Clerk 未加载完时返回 `null`（不报错）— 必须在 useEffect 中守卫 `isSignedIn !== undefined`
- useEffect deps 必须包含 `isSignedIn` 和 `getToken`，否则 Clerk 加载完后不会重新触发 fetch
- 参考 `TradingCommandCenter.tsx` 的 `const { getToken, isSignedIn } = useAuth()` 模式

### ⚠️ 止盈止损计算流程（两步）
- `PUT /api/watchlist` 只保存 method + params，不触发计算
- 必须再调 `POST /api/watchlist/recalculate` 传 `{ ids: [itemId] }` 才会用 K 线数据算出实际价格
- 前端需用 recalculate 返回的 `results[].stopLossPrice / targetPrice` 更新 UI 状态
- recalculate 和 watchlist-refresh cron 都用实时报价(ulist.np+fltt=2)，不依赖K线收盘价

### ⚠️ 止盈止损方法语义
- `trailing`(追踪止损) target = HWM×(1-trailPercent)，**永远低于现价**，不适合做 Target 展示
- 打板/趋势止盈应用 `atr_multiple`（buyPrice + N×ATR）或 `fixed`
- 打板止损用 `fixed`（buyPrice×0.95 = -5%），不用 ATR（ATR×3 给出约-15%，对短线太宽）
- HWM 脏数据保护: take-profit-engine 中 HWM > currentPrice×2 自动重置（防 fltt=2 缺失的分单位污染）

### ⚠️ board-track 去重
- POST 必须先查同用户同 stockCode 是否已有 pending/tracked 记录，有则返回 duplicate 不重复创建
- GET/stats 必须按 stockCode 去重后再统计，否则同股票多次接受会重复计算胜率
- DELETE 支持 `?stockCode=xxx` 按股票批量删除所有跟踪记录（取消跟踪用）
- stats recentTracked 包含 pending+tracked 记录；前端 pending 显示黄色"待跟踪"
- 取消跟踪后前端必须调 fetchStats() 同步刷新胜率面板

### ⚠️ DeepSeek API 响应解析
- 提取 JSON 用 `indexOf('{')` + `lastIndexOf('}')` 而非纯 regex — DeepSeek 常加前言/后语
- 字段类型不可信：`risks` 可能是字符串而非数组 — 必须用归一化函数（尝试 `JSON.parse` 再 fallback）
- fallback 文本要清除 `{}[]"\\` 等 JSON 语法字符，避免原始 JSON 碎片暴露给用户

### ⚠️ Vercel 部署流程
- `vercel deploy --prod` 上传本地文件，但 GitHub 自动部署会覆盖 — 必须先 `git push` 再 `vercel deploy --prod`
- Vercel Hobby cron 限制：仅支持每天一次的 schedule，总数 ~2 个；超频 cron 需外部服务（cron-job.org）或升级 Pro

### ⚠️ 导航结构
- 顶部导航栏：`components/layout/TopNavBar.tsx` — `NAV_LINKS` 数组控制菜单项
- 侧边栏：`components/layout/sidebar.tsx` — 存在但未在主 layout 使用
- 新功能页面应创建独立路由（如 `/daban`），不嵌入已有大页面

### ⚠️ Claude Code Configuration
- `.claude/` directory is gitignored (personal tool config)
- `.mcp.json` is committed (team shares MCP server list)
- Hook for `.env*` interception prevents accidental credential edits
- Settings.local.json is for personal permissions/hooks, never share it
- If credentials are exposed: rotate in Supabase/Clerk immediately, then update local config

---

## Deployment

### To Vercel
```bash
# Link project (first time)
vercel link

# Deploy
npm run build      # Pre-check
vercel deploy      # Or: git push (auto-deploys)

# Environment variables
vercel env add KEY_NAME production
vercel env list
```

### Pre-deployment Checklist
- [ ] All tests pass (`npm run verify:uat-full`)
- [ ] `.env.local` has all required keys (never commit)
- [ ] `npm run build` succeeds
- [ ] No console errors in production build
- [ ] Database migrations applied
- [ ] Clerk production keys configured

---

## Trading Strategy

For trading logic & decision rules, see `TRADING_STRATEGY.md`.

---

**Project Version**: 0.1.0
**Last Updated**: 2026-03-19
**Node.js Required**: 20.19.0+
