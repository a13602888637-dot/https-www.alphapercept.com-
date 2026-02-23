# Alpha-Quant-Copilot

AI驱动的量化投资分析系统，融合五大投资流派的智能决策引擎。

## 项目概述

Alpha-Quant-Copilot 是一个集成了桥水宏观对冲、巴菲特价值投资、索罗斯反身性理论、佩洛西政策前瞻、中国游资情绪接力五大投资流派的AI量化分析系统。系统提供实时市场监控、智能信号识别、风险预警和投资决策支持。

## 技术架构

### 前端技术栈
- **Next.js 15** - React框架，App Router
- **TypeScript** - 类型安全
- **Tailwind CSS** - 实用优先的CSS框架
- **shadcn/ui** - 可复用的UI组件库
- **Clerk** - 用户认证和授权
- **React 19** - 前端UI库

### 后端技术栈
- **Node.js** - 运行时环境
- **TypeScript** - 类型安全
- **Tushare API** - 金融数据接口
- **DeepSeek API** - AI推理引擎
- **Cron Jobs** - 自动化调度

## 项目结构

```
/Users/guangyu/stock-analysis/
├── app/                    # Next.js App Router
│   ├── (auth)/            # 认证相关页面
│   │   ├── sign-in/       # 登录页面
│   │   └── sign-up/       # 注册页面
│   ├── api/               # API路由
│   │   ├── webhooks/      # Webhook处理
│   │   └── route.ts       # API根路由
│   ├── dashboard/         # 主仪表板
│   ├── globals.css        # 全局样式
│   ├── layout.tsx         # 根布局
│   └── page.tsx           # 首页
├── components/            # React组件
│   ├── ui/               # shadcn/ui组件
│   ├── dashboard-header.tsx
│   ├── dashboard-shell.tsx
│   └── theme-provider.tsx
├── hooks/                # 自定义Hooks
│   └── use-toast.ts
├── lib/                  # 工具函数
│   └── utils.ts
├── skills/               # 核心业务逻辑
│   ├── data_crawler.ts   # 新浪/腾讯财经数据抓取
│   └── deepseek_agent.ts # AI推理引擎
├── components/           # React组件
│   └── live-feed/        # 实时数据推送组件
├── scripts/              # 构建脚本
│   └── start-realtime.sh # 实时系统启动脚本
├── docs/                 # 项目文档
│   └── realtime-system-architecture.md # 实时系统架构文档
├── middleware.ts         # Clerk中间件
├── next.config.ts       # Next.js配置
├── tailwind.config.ts   # Tailwind配置
├── postcss.config.js    # PostCSS配置
├── tsconfig.json        # TypeScript配置
├── package.json         # 项目依赖
└── .env.local           # 环境变量
```

## 核心功能

### 1. 五大投资流派融合分析
- **桥水宏观对冲**：经济周期定位，风险平价配置
- **巴菲特价值投资**：安全边际计算，护城河评估
- **索罗斯反身性**：市场情绪监控，趋势加速识别
- **佩洛西政策前瞻**：政策敏感度分析，产业图谱
- **中国游资情绪接力**：题材热度指数，情绪周期判断

### 2. 硬性交易纪律
- **MA60破位止损**：严格执行60日移动平均线风控
- **MD60趋势跟踪**：60日动量方向判断与跟踪

### 3. 实时数据推送系统
- **SSE (Server-Sent Events)**：单向服务器推送，自动重连，低延迟
- **WebSocket**：双向实时通信，支持订阅/取消订阅
- **MA60实时破位检测**：基于60日移动平均线的实时警告
- **MD60动量跟踪**：60日动量方向实时计算
- **多股票同时监控**：支持最多20只股票实时监控
- **AI交易推荐推送**：基于DeepSeek的实时交易建议

### 4. 实时监控系统
- 市场信号实时推送
- 风险预警即时通知
- 持仓动态监控

### 5. AI智能分析
- DeepSeek驱动的策略推荐
- 多因子模型评估
- 自动化复盘学习

## 快速开始

### 环境准备
1. 确保已安装 Node.js 18+ 和 npm
2. 克隆项目到本地

### 安装依赖
```bash
npm install
```

### 环境配置
复制 `.env.local.example` 到 `.env.local` 并配置以下变量：
```bash
# Tushare API Token
TUSHARE_TOKEN=your_tushare_token_here

# DeepSeek API Key
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key_here
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key_here

# Next.js Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 启动开发服务器
```bash
npm run next:dev
```
访问 http://localhost:3000

### 启动实时数据推送系统
```bash
# 使用启动脚本
./scripts/start-realtime.sh

# 或直接启动
npm run next:dev
```

访问实时数据推送页面：http://localhost:3000/live-feed

### 实时系统API接口
- **SSE API**: `GET /api/sse?symbols=000001,600000`
- **WebSocket API**: `ws://localhost:3000/api/websocket?symbols=000001,600000`
- **连接统计**: `POST /api/sse` (action: "stats")

### 构建生产版本
```bash
npm run next:build
npm run next:start
```

## 开发指南

### 添加新的shadcn/ui组件
```bash
npx shadcn-ui@latest add [component-name]
```

### 创建新的API路由
在 `app/api/` 目录下创建新的路由文件，例如：
```typescript
// app/api/market/data/route.ts
export async function GET() {
  return Response.json({ data: 'market data' });
}
```

### 创建新的页面
在 `app/` 目录下创建新的页面目录，例如：
```typescript
// app/portfolio/page.tsx
export default function PortfolioPage() {
  return <div>Portfolio Management</div>;
}
```

## Git 版本管理与回滚操作指南

### 核心Git工作流
Alpha-Quant-Copilot 采用严格的Git版本管理流程，确保代码稳定性和可追溯性。

### 1. 日常开发流程
```bash
# 1. 开始新功能前创建分支
git checkout -b feature/your-feature-name

# 2. 开发完成后提交
git add .
git commit -m "feat: 添加新功能描述"

# 3. 推送到远程
git push origin feature/your-feature-name

# 4. 创建Pull Request进行代码审查
```

### 2. 紧急回滚操作指南
当遇到严重问题需要回滚时，请按以下步骤操作：

#### 2.1 回滚到上一个提交
```bash
# 查看提交历史，确认要回滚到的提交哈希
git log --oneline -10

# 回滚到指定提交（保留工作区修改）
git reset --soft <commit-hash>

# 强制回滚到指定提交（丢弃所有修改）
git reset --hard <commit-hash>

# 回滚到上一个提交（最常用）
git reset --hard HEAD~1
```

#### 2.2 回滚特定文件
```bash
# 查看文件修改历史
git log --oneline -- path/to/file.ts

# 回滚文件到指定版本
git checkout <commit-hash> -- path/to/file.ts

# 回滚文件到上一个版本
git checkout HEAD~1 -- path/to/file.ts
```

#### 2.3 撤销已推送的提交
```bash
# 创建反向提交（推荐）
git revert <commit-hash>

# 强制推送（谨慎使用）
git push origin main --force
```

### 3. 故障恢复协议
根据《Vibe Coding 协作协议》，当连续3次修复失败时，必须执行以下操作：

#### 3.1 立即回滚
```bash
# 停止所有开发活动
# 执行紧急回滚
git reset --hard HEAD~1

# 确认回滚成功
git status
git log --oneline -5
```

#### 3.2 问题分析
1. 创建故障分析文档
2. 记录失败原因和修复尝试
3. 制定新的修复方案

#### 3.3 重新开始
```bash
# 基于稳定版本重新开发
git checkout -b fix/issue-description

# 小步提交，频繁验证
git add .
git commit -m "fix: 逐步修复问题"
```

### 4. 分支管理策略
- **main**: 生产环境分支，仅接受通过测试的代码
- **develop**: 开发分支，集成所有功能
- **feature/***: 功能开发分支
- **hotfix/***: 紧急修复分支
- **release/***: 发布准备分支

### 5. 提交消息规范
```
<类型>: <简短描述>

<详细描述（可选）>

- 修复了什么问题
- 实现了什么功能
- 需要注意什么

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

**类型说明**:
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具变动

### 6. 重要提醒
1. **跨文件重构前必须提交**: 在进行任何跨文件重构前，务必执行 `git commit -m "chore: 重构前基线"`
2. **连续失败必须回滚**: 连续3次修复失败后，立即执行 `git reset --hard HEAD~1`
3. **定期备份**: 重要修改前创建备份分支
4. **小步提交**: 频繁提交，每次提交解决一个问题

## 部署

### Vercel部署（推荐）

#### 自动部署脚本
我们提供了完整的Vercel部署脚本和指南：

```bash
# 1. 安装Vercel CLI
npm install -g vercel

# 2. 登录Vercel (使用以下凭据)
vercel login
# 邮箱: a13602888637@gmail.com
# 密码: Dicky.666

# 3. 使用部署脚本
chmod +x scripts/deploy-vercel.sh
./scripts/deploy-vercel.sh

# 4. 或按步骤手动部署
# 链接项目
vercel link
# 选择: Link to existing project
# 项目名: alpha-quant-copilot
# 框架: Next.js
# 输出目录: .next

# 设置环境变量
./scripts/setup-vercel-env.sh

# 预览部署
vercel

# 生产部署
vercel --prod
```

#### 详细部署指南
完整的部署步骤请参考：[Vercel部署指南](./docs/vercel-deployment-guide.md)

#### 部署检查清单
部署前请检查：[部署检查清单](./DEPLOYMENT_CHECKLIST.md)

#### 生产环境URL
- 主站: https://alpha-quant-copilot.vercel.app
- 预览环境: 每次推送自动生成

#### 必需环境变量
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DATABASE_URL=postgresql://username:password@host:6543/database?pgbouncer=true
DIRECT_URL=postgresql://username:password@host:5432/database
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TUSHARE_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=https://alpha-quant-copilot.vercel.app
```

### 自托管部署
1. 构建项目：`npm run next:build`
2. 启动生产服务器：`npm run next:start`
3. 配置反向代理（如Nginx）

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request来改进项目。

## 联系方式

项目维护团队：Alpha-Quant-Copilot Team