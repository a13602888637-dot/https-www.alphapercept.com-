# Alpha-Quant-Copilot Milestone 1 Design Document

## Project Overview
**Project**: Alpha-Quant-Copilot
**Milestone**: 1 - Core Engine & Infrastructure
**Date**: 2026-02-22
**Status**: Approved for Implementation

## Architecture Decision
**Selected Approach**: Monolithic Next.js Full-Stack Application

### Rationale
1. **BMad Principles Alignment**: Single codebase enables independent thinking and auto-correction
2. **Rapid Development**: Unified TypeScript ecosystem simplifies iteration
3. **Real-time Requirements**: Next.js App Router handles SSE and cron jobs natively
4. **Deployment Simplicity**: Single Vercel deployment for full system

## Technical Stack

### Core Framework
- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** for component library

### Authentication & Multi-tenancy
- **Clerk** (over NextAuth.js for built-in SaaS features)
- Organization-based data isolation
- Subscription management ready

### Data & AI Integration
- **Tushare API**: Dragon-tiger list, fundamentals, technical indicators
- **Sina/Tencent Finance**: Real-time price data
- **DeepSeek R1/V3**: AI strategy generation
- **Data Pipeline**: Raw JSON → cleaned market features

### Automation & Scheduling
- **node-cron**: Daily/hourly task scheduling
- **Server-Sent Events (SSE)**: Real-time frontend updates
- **Automated Strategy Evolution**: Daily复盘 → claude.md updates

## System Architecture

### Directory Structure
```
alpha-quant-copilot/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (data, AI, auth)
│   ├── (auth)/           # Clerk authentication routes
│   ├── dashboard/        # Main dashboard with live feed
│   └── layout.tsx        # Root layout with auth provider
├── components/           # Reusable UI components
│   ├── ui/              # shadcn/ui components
│   ├── live-feed/       # Real-time market cards
│   └── strategy-chat/   # Q&A interface
├── lib/                  # Utilities & shared logic
│   ├── auth.ts          # Authentication helpers
│   ├── api.ts           API client configuration
│   └── utils.ts         # Common utilities
├── skills/              # Core business logic
│   ├── data_crawler.ts  # Real data collection & cleaning
│   └── deepseek_agent.ts # AI strategy generation
├── scripts/             # Build & verification
│   └── verify_milestone.sh # Milestone validation
├── claude.md            # Core strategy document
├── .env.local           # Environment variables (NO KEYS)
└── package.json         # Dependencies & scripts
```

### Core Components

#### 1. Strategy Engine (claude.md)
**Static Principles Section**:
- Bridgewater macro hedging principles
- Buffett value investing margins
- Soros reflexivity theory
- Pelosi policy foresight framework
- Chinese top trader sentiment patterns

**Hard Trading Rules**:
- MA60 break stop loss (automatic position exit)
- MD60 trend tracking (momentum enforcement)

**Dynamic Evolution**:
- `## Daily Strategy Iteration` placeholder
- Automated daily updates from DeepSeek复盘

#### 2. Data Pipeline (skills/data_crawler.ts)
**Data Sources**:
1. Tushare API (requires token)
   - Dragon-tiger list (龙虎榜)
   - Company fundamentals
   - MA60/MD60 technical indicators
2. Sina/Tencent Finance APIs
   - Real-time stock prices
   - Percentage changes
   - Market indices

**Data Processing**:
- Raw JSON → structured TypeScript objects
- Noise reduction & feature extraction
- Time-series normalization
- Market state classification

#### 3. AI Agent (skills/deepseek_agent.ts)
**Input**:
- claude.md strategy rules
- Cleaned market data
- Current portfolio state

**Prompt Engineering**:
- Structured prompt combining principles + data
- Enforced JSON output format
- Confidence scoring (0-100)

**Output Format** (strict JSON):
```json
{
  "action": "buy|sell|hold",
  "target_price": number,
  "stop_loss": number,
  "reasoning": "logical deduction text",
  "confidence": 75
}
```

#### 4. Automation System
**Cron Schedule**:
- **Hourly (9:30-15:00)**: Market hotspot scanning
- **Daily (15:30)**: Deep复盘 & strategy evolution
- **Real-time**: SSE push for immediate alerts

**SSE Implementation**:
- `/api/sse` endpoint for live updates
- Connection management for multiple clients
- Event types: alerts, strategies, warnings

### Frontend UI Design

#### Design Philosophy
- **Dark theme** with minimalistic aesthetic
- **"Message conversation flow"** layout
- **High information density** with clear hierarchy

#### Layout Components
**Left Panel - Live Feed**:
- Real-time scrolling alert cards
- MA60 breach warnings (visual highlight)
- DeepSeek strategy recommendations
- Market anomaly detection

**Right Panel - Strategy Chat**:
- Interactive Q&A interface
- Stock-specific query input
- AI-generated analysis with citations
- Conversation history with timestamps

#### UI Components (shadcn/ui based)
- Dark theme variant configuration
- Custom card components for market data
- Real-time updating charts (lightweight)
- Interactive data tables with sorting

### Security & Compliance

#### API Key Management
- **NEVER** hardcode keys in source
- `.env.local` with placeholder comments:
  ```
  # Tushare API Token (get from tushare.pro)
  TUSHARE_TOKEN=your_tushare_token_here

  # DeepSeek API Key (get from platform.deepseek.com)
  DEEPSEEK_API_KEY=your_deepseek_api_key_here

  # Clerk Keys (get from clerk.com)
  CLERK_PUBLISHABLE_KEY=pk_test_...
  CLERK_SECRET_KEY=sk_test_...
  ```

#### Data Isolation
- User-specific data partitioning
- Organization-based access control
- Audit logging for all data accesses

#### Rate Limiting
- API route rate limiting
- Data source request throttling
- User-tier based limits

### Deployment & Verification

#### Build Process
```bash
npm install
npm run build  # Must succeed
```

#### Verification Script (scripts/verify_milestone.sh)
**Validation Steps**:
1. Build success check
2. Environment variable validation
3. Real data API connectivity test
4. DeepSeek API format validation
5. Authentication system test
6. Cron job scheduling test

**Success Criteria**: All steps pass → exit code 0

#### Final Delivery State
System is ready for production when:
1. Verification script returns exit code 0
2. All API keys are injected via environment
3. Database is provisioned (if needed)
4. Cron jobs are scheduled

**Final Output Message**:
```
Pro Milestone 1 core engine built, real data channels connected, inject API Keys to start digital life.
```

## Implementation Priorities

### Phase 1: Foundation (Week 1)
1. Next.js + TypeScript + Tailwind setup
2. Clerk authentication integration
3. Basic project structure
4. Environment configuration

### Phase 2: Core Engine (Week 2)
1. claude.md with strategy principles
2. Data crawler implementation
3. DeepSeek agent with JSON enforcement
4. Basic API routes

### Phase 3: Automation (Week 3)
1. Cron job scheduling
2. SSE real-time updates
3. Daily strategy evolution
4. Data cleaning pipeline

### Phase 4: Frontend (Week 4)
1. Dark theme implementation
2. Live feed component
3. Strategy chat interface
4. Real-time data visualization

### Phase 5: Verification (Week 5)
1. Verification script development
2. End-to-end testing
3. Performance optimization
4. Security audit

## Success Metrics

### Technical Metrics
- Build success rate: 100%
- API response time: < 200ms
- Real-time update latency: < 1s
- Data accuracy: > 95%

### Business Metrics
- Strategy confidence scores: Track improvement
- User engagement: Time in application
- Alert accuracy: MA60 breach detection rate
- System uptime: > 99.5%

## Risk Mitigation

### Technical Risks
1. **API Rate Limits**: Implement caching & throttling
2. **Data Source Changes**: Abstract data layer, multiple sources
3. **AI Model Changes**: Version pinning, prompt testing
4. **Real-time Scaling**: Connection pooling, load testing

### Business Risks
1. **Regulatory Compliance**: China financial data regulations
2. **Data Licensing**: Tushare commercial license requirements
3. **SaaS Readiness**: Multi-tenant data isolation verification
4. **Market Conditions**: Strategy adaptation mechanisms

## Next Steps
1. **Immediate**: Begin Phase 1 implementation
2. **Review**: Weekly progress against this design
3. **Adjust**: Update design based on implementation learnings
4. **Deliver**: Complete all phases → verification → production readiness

---
*Design approved for implementation following BMad principles: Independent thinking, auto-correction, zero manual intervention.*