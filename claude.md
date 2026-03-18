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
│   │   └── macro/                # Macro market overview
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

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | Next.js | 15.2.3 | App Router, SSR, API routes |
| | React | 19.0.0 | UI components |
| | TypeScript | 5.0 | Type safety |
| | Tailwind CSS | 3.4 | Styling |
| | Radix UI | Latest | Accessible components |
| **Backend** | Next.js API Routes | 15.2.3 | HTTP endpoints |
| | Node.js | 20.19.0+ | Runtime |
| **Database** | Supabase PostgreSQL | 15+ | Data storage |
| | Prisma | 7.4.1 | ORM & migrations |
| **Auth** | Clerk | 6.38.1 | User authentication |
| **AI** | DeepSeek API | Latest | Market analysis |
| **Deployment** | Vercel | Latest | CI/CD & hosting |

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

### API Route Structure
```typescript
// app/api/example/route.ts
import { auth } from "@clerk/nextjs/server";

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    // Fetch data
    const data = await prisma.watchlist.findMany({ where: { userId } });

    return Response.json({ data });
  } catch (error) {
    console.error("API error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
```

### Database Queries
```typescript
// Always filter by userId for user-specific data
const watchlist = await prisma.watchlist.findMany({
  where: { userId: currentUserId },
  orderBy: { createdAt: 'desc' },
});

// Use Prisma migrations for schema changes
// DO NOT modify schema.prisma without running: npx prisma migrate dev
```

### Error Handling
- Catch errors at API boundary
- Log to console for debugging
- Return appropriate HTTP status codes
- Never expose sensitive error details to frontend

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

### ⚠️ Authentication
- All API routes must check `auth()` and verify `userId`
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

## Useful Resources

- **Clerk**: https://dashboard.clerk.com
- **Supabase**: https://app.supabase.com
- **Prisma**: https://www.prisma.io/docs
- **Next.js**: https://nextjs.org/docs
- **DeepSeek**: https://platform.deepseek.com

---

## Trading Strategy

For trading logic & decision rules, see `TRADING_STRATEGY.md`.

---


**Project Version**: 0.1.0
**Last Updated**: 2026-03-16
**Node.js Required**: 20.19.0+
**Maintained By**: Alpha-Quant-Copilot Team
