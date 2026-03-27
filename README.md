# Alpha-Quant-Copilot

AI 驱动的量化交易助手，集成实时全球行情、OSINT 态势感知、智能选股与 AI 持仓分析。

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 核心功能

### 行情与分析
- **全球宏观总览** — A 股、美股、港股、加密货币、大宗商品、外汇实时行情
- **个股详情页** — 专业 K 线图（lightweight-charts）、技术指标联动、盘口数据
- **智能选股** — AI 驱动的策略推荐与情报 Feed
- **止盈止损计算** — 基于 K 线数据的动态 SL/TP 引擎

### OSINT 态势感知
- **全球地图** — Leaflet 驱动，集成金融、海运（AISStream）、航空（OpenSky）、地缘冲突（GDELT）四大数据源
- **AI 态势大脑** — DeepSeek 实时分析全球宏观局势
- **多面板仪表盘** — 金融面板、经济面板、社交面板、情报 Feed、Delta 面板

### 投资组合
- **持仓管理** — 实时盈亏计算、仓位分析
- **AI 持仓分析** — 智能诊断持仓风险与优化建议
- **Watchlist** — 关注列表 + 自动止盈止损监控

### 实时数据推送
- **SSE (Server-Sent Events)** — 单向服务器推送，自动重连
- **WebSocket** — 双向实时通信，支持订阅/取消订阅

---

## 技术架构

```
+--------------------------------------------------+
|                   Frontend                        |
|  Next.js 15 App Router  -  React 19  -  Tailwind |
|  lightweight-charts  -  Leaflet  -  Framer Motion |
+--------------------------------------------------+
|                API Layer (30+ routes)              |
|  行情: East Money / Stooq / Finnhub / Sina        |
|  OSINT: AISStream / OpenSky / GDELT / ReliefWeb   |
|  宏观: FRED / EIA / BLS / Treasury                |
|  AI:   DeepSeek (Streaming)                       |
+--------------------------------------------------+
|                  Data Layer                        |
|  Prisma 7  -  Supabase PostgreSQL  -  Clerk Auth  |
+--------------------------------------------------+
```

---

## 快速开始

### 环境要求

- Node.js >= 20.19.0
- npm
- Supabase 项目（PostgreSQL）
- Clerk 账户（认证）

### 1. 克隆 & 安装

```bash
git clone https://github.com/your-org/alpha-quant-copilot.git
cd stock-analysis
npm install
```

### 2. 环境变量

```bash
cp .env.example .env.local
```

在 `.env.local` 中填入：

| 变量 | 说明 | 必需 |
|------|------|:----:|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk 公钥 | Yes |
| `CLERK_SECRET_KEY` | Clerk 密钥 | Yes |
| `CLERK_WEBHOOK_SECRET` | Webhook 签名验证 | Yes |
| `DATABASE_URL` | Supabase 连接池 URL | Yes |
| `DIRECT_URL` | Supabase 直连 URL（迁移用） | Yes |
| `DEEPSEEK_API_KEY` | DeepSeek AI 分析引擎 | No |
| `NEXT_PUBLIC_API_BASE_URL` | 后端 API 基础 URL | No |

### 3. 数据库初始化

```bash
npx prisma migrate dev
npx prisma generate
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

---

## 项目结构

```
app/
├── api/                        # 30+ API 路由
│   ├── market-data/            # 行情数据
│   ├── stock-price-history/    # K 线历史（East Money）
│   ├── global-macro/           # 全球宏观指数
│   ├── intelligence-feed/      # AI 情报流
│   ├── ai/                     # AI 分析 & 流式响应
│   │   ├── situation-analysis/ # DeepSeek 态势分析
│   │   └── stream/             # 流式 AI 响应
│   ├── maritime/               # AISStream 海运追踪
│   ├── aviation/               # OpenSky 航空追踪
│   ├── geoconflict/            # GDELT 地缘冲突
│   ├── watchlist/              # 关注列表 & 止盈止损
│   │   └── recalculate/        # SL/TP 重新计算
│   ├── portfolio/              # 投资组合
│   ├── fred/                   # 美联储经济数据
│   ├── eia/                    # 能源信息署
│   ├── bls/                    # 劳工统计局
│   ├── treasury/               # 美国国债
│   ├── news-feed/              # 新闻聚合
│   ├── unified-search/         # A 股 + 美股统一搜索
│   ├── sse/                    # Server-Sent Events
│   ├── websocket/              # WebSocket 推送
│   └── ...
├── (auth)/                     # 认证页面 (sign-in, sign-up)
├── dashboard/
│   ├── macro/                  # 宏观行情页
│   ├── osint/                  # OSINT 态势感知入口
│   ├── stock/[symbol]/         # 个股详情
│   └── asset/[symbol]/         # 全球资产详情
├── osint/                      # 全屏 OSINT 雷达（独立 layout）
├── portfolio/                  # 持仓管理
├── live-feed/                  # 实时情报
└── strategy-recommendation/    # 策略推荐

components/
├── osint-v2/                   # OSINT 核心组件
│   ├── SituationScreen.tsx     # 主控屏幕
│   ├── GeoMapInner.tsx         # Leaflet 全球地图
│   ├── AISituationBrain.tsx    # AI 态势大脑
│   ├── IntelFeed.tsx           # 情报 Feed
│   ├── FinancePanel.tsx        # 金融面板
│   ├── EconomicPanel.tsx       # 经济面板
│   ├── SocialPanel.tsx         # 社交面板
│   ├── DeltaPanel.tsx          # Delta 面板
│   ├── TickerBar.tsx           # 行情滚动条
│   └── StatusBar.tsx           # 状态栏
├── dashboard/                  # 仪表盘组件
├── charts/                     # 图表组件
├── portfolio/                  # 持仓 UI
├── intelligence-feed/          # Feed 组件
├── global-search/              # 搜索结果
└── ui/                         # shadcn/ui 基础组件

services/adapters/              # 数据适配器（标准化为 SituationalEntity）
├── finance-adapter.ts          # 金融市场
├── maritime-adapter.ts         # 海运 AIS
├── aviation-adapter.ts         # 航空 OpenSky
└── geoconflict-adapter.ts      # 地缘冲突 GDELT

lib/                            # 工具函数
├── api/                        # API 客户端
├── data/                       # 数据获取 & 缓存
├── search-proxy/               # 搜索服务抽象
├── prisma.ts                   # Prisma 客户端单例
└── auth-helpers.ts             # 认证工具

prisma/                         # Schema & 迁移历史
```

---

## 常用命令

### 开发

```bash
npm run dev                  # 启动开发服务器 (port 3000)
npm run build                # 生产构建
npm run next:lint            # ESLint 检查
```

### 数据库

```bash
npx prisma migrate dev       # 创建 & 应用迁移
npx prisma studio            # 数据库 GUI
npx prisma generate          # 重新生成 Prisma Client
```

### 验证 & 测试

```bash
npm run verify               # 里程碑快速验证
npm run verify:uat-quick     # 快速 UAT
npm run verify:uat-full      # 完整 UAT
npm run test:smart-selector  # 数据源选择测试
```

### 部署

```bash
vercel link                  # 关联 Vercel 项目
vercel deploy                # 部署到预览环境
vercel --prod                # 部署到生产环境
```

---

## 数据源一览

| 类别 | 数据源 | 用途 |
|------|--------|------|
| A 股行情 | East Money K-line API | K 线、实时报价 |
| 全球指数 | Stooq / Finnhub (ETF proxy) | 恒指、日经、大宗商品、外汇 |
| A 股实时 | Sina hq.sinajs.cn | A 股实时行情 |
| 海运 | AISStream (WebSocket) | 全球船舶位置追踪 |
| 航空 | OpenSky Network (API proxy) | 航班实时追踪 |
| 地缘冲突 | GDELT GeoJSON | 全球冲突事件热力图 |
| 宏观经济 | FRED / EIA / BLS / Treasury | 美国核心经济指标 |
| AI 分析 | DeepSeek | 态势分析、持仓诊断、策略推荐 |
| 社交舆情 | Bluesky | 社交情绪监测 |
| 灾害预警 | NOAA / ReliefWeb | 自然灾害 & 人道主义事件 |

---

## API 路由速查

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/stock-price-history` | GET | K 线数据（East Money） |
| `/api/global-macro` | GET | 全球宏观指数行情 |
| `/api/stock-prices` | GET | A 股实时价格 |
| `/api/unified-search` | GET | A 股 + 美股统一搜索 |
| `/api/intelligence-feed` | GET | AI 情报 Feed |
| `/api/news-feed` | GET | 新闻聚合 |
| `/api/ai/situation-analysis` | POST | DeepSeek 态势分析（3min 缓存） |
| `/api/ai/stream` | POST | 流式 AI 响应 |
| `/api/maritime` | GET | AISStream 船舶数据 |
| `/api/aviation` | GET | OpenSky 航空数据 |
| `/api/geoconflict` | GET | GDELT 冲突数据 |
| `/api/watchlist` | GET/PUT | 关注列表 CRUD |
| `/api/watchlist/recalculate` | POST | 止盈止损重算 |
| `/api/portfolio` | GET/POST | 投资组合管理 |
| `/api/analyze-watchlist` | POST | AI 持仓分析 |
| `/api/sse` | GET | Server-Sent Events |
| `/api/websocket` | GET | WebSocket 连接 |

---

## 部署

### Vercel（推荐）

```bash
vercel link
npm run build              # 预检
vercel deploy              # 预览部署
vercel --prod              # 生产部署
```

管理环境变量：

```bash
# 使用 printf 避免尾部换行导致 API Key 鉴权失败
printf '%s' "$VALUE" | vercel env add KEY production
vercel env list
```

### 部署前检查

- [ ] `npm run build` 成功
- [ ] `npm run verify:uat-full` 通过
- [ ] Clerk 生产密钥已配置
- [ ] Supabase 数据库迁移已执行
- [ ] 所有环境变量已设置

---

## 许可证

MIT License
