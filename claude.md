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
│   ├── portfolio/                # Portfolio UI
│   ├── macro/                    # Macro indicators
│   ├── global-search/            # Unified search results
│   ├── strategy-chat/            # Strategy recommendation UI
│   └── ui/                       # shadcn/ui primitives
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

## API Routes Overview

### Market Data
- `GET /api/market-data` - Current stock data
- `GET /api/stock-prices` - Price history
- `GET /api/stock-price-history` - Detailed OHLC data
- `GET /api/stocks/search` - Stock search by code/name
- `GET /api/stocks/hot` - Trending stocks

### Intelligence Feed
- `GET /api/intelligence-feed` - Market insights
- `POST /api/intelligence-feed/generate` - Generate AI analysis

### Strategy & Recommendations
- `GET /api/strategy-recommendation` - Trading signals
- `POST /api/analyze-watchlist` - Analyze portfolio

### Portfolio
- `GET /api/portfolio` - User portfolio
- `POST /api/portfolio` - Create/update portfolio
- `GET /api/portfolio/:id` - Portfolio details

### Global Search
- `GET /api/unified-search` - A-stock + US stock search

### AI & Chat
- `POST /api/ai/stream` - Streaming AI responses

### Utilities
- `GET /api/users/sync` - Sync user data with Clerk
- `GET /api/debug-auth` - Authentication debugging

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
| **StockPriceHistory** | Price data cache | stockCode, price, timestamp |

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

### ⚠️ Sensitive Files
- `.env*` files block edits (security hook)
- Use `vercel env` for production secrets
- Never commit Clerk/Supabase credentials

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

## Vibe Coding Collaboration Protocol

See protocol details below for git discipline and development workflow.

### 1. Git Safety
- Commit baseline before major refactors
- Roll back on 3+ consecutive failures
- Always review with `git diff` before pushing

### 2. Development Process
1. Modify code locally
2. Test with `npm run dev`
3. Review changes with `git diff --cached`
4. Commit with proper message format
5. Verify build with `npm run build`

### 3. Error Priority
1. **Compilation errors** - immediate fix
2. **Runtime errors** - fix within 24h
3. **Functionality bugs** - per scope
4. **Performance** - next iteration

### 4. Documentation Sync
- API changes → update API docs
- Config changes → update this file
- Architecture changes → update README

---

**Project Version**: 0.1.0
**Last Updated**: 2026-03-15
**Node.js Required**: 20.19.0+
**Maintained By**: Alpha-Quant-Copilot Team
