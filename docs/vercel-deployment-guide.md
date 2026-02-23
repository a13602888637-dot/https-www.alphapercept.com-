# Alpha-Quant-Copilot Vercel部署指南

## 概述

本文档提供将Alpha-Quant-Copilot项目部署到Vercel的完整指南。项目使用Next.js 15、TypeScript、Tailwind CSS和Clerk认证。

## 前置要求

1. **Node.js** >= 18.0.0
2. **npm** 或 **yarn**
3. **Git** 版本控制
4. **Vercel账号** (使用Google账号: a13602888637@gmail.com)

## 部署步骤

### 步骤1: 安装Vercel CLI

```bash
# 全局安装Vercel CLI
npm install -g vercel

# 验证安装
vercel --version
```

### 步骤2: 登录Vercel

```bash
# 登录Vercel
vercel login

# 使用以下凭据:
# - 邮箱: a13602888637@gmail.com
# - 密码: Dicky.666
# - 选择Google登录方式
```

### 步骤3: 链接项目到Vercel

```bash
# 在项目根目录执行
vercel link

# 选择以下配置:
# 1. 选择 "Link to existing project"
# 2. 创建新项目: "alpha-quant-copilot"
# 3. 选择框架: Next.js
# 4. 输出目录: .next
# 5. 其他设置保持默认
```

### 步骤4: 设置环境变量

```bash
# 使用脚本自动设置环境变量
chmod +x scripts/setup-vercel-env.sh
./scripts/setup-vercel-env.sh

# 或手动设置每个变量
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
vercel env add CLERK_SECRET_KEY
vercel env add CLERK_WEBHOOK_SECRET
vercel env add DATABASE_URL
vercel env add DIRECT_URL
vercel env add DEEPSEEK_API_KEY
vercel env add TUSHARE_TOKEN
vercel env add NEXT_PUBLIC_APP_URL
```

**环境变量参考值** (从 `.env.local` 复制):

| 变量名 | 值 |
|--------|-----|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_Z2xvcmlvdXMta3JpbGwtOTUuY2xlcmsuYWNjb3VudHMuZGV2JA` |
| `CLERK_SECRET_KEY` | `sk_test_FIjXZ1CCRi1IzsSQ03E5OW2leNxOd00N6EaG6i5pkR` |
| `CLERK_WEBHOOK_SECRET` | `whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `DATABASE_URL` | `postgresql://postgres.wgjlpdgdbnrrtrajnumj:%24%2BE%2EVH6Lbcm%2F5Bb@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | `postgresql://postgres.wgjlpdgdbnrrtrajnumj:%24%2BE%2EVH6Lbcm%2F5Bb@aws-0-us-west-2.pooler.supabase.com:5432/postgres` |
| `DEEPSEEK_API_KEY` | `sk-8adbfb73172d44fd9e85b515627dc8ad` |
| `TUSHARE_TOKEN` | `ca1d64ce2eea8ee0adc5f1acc52faf7dfb30e73d163f66ee5bd81a8a` |
| `NEXT_PUBLIC_APP_URL` | `https://alpha-quant-copilot.vercel.app` |

### 步骤5: 预览部署

```bash
# 部署到预览环境
vercel

# 访问提供的预览URL进行测试
```

### 步骤6: 生产部署

```bash
# 部署到生产环境
vercel --prod

# 生产URL: https://alpha-quant-copilot.vercel.app
```

## 验证部署

### 自动验证

```bash
# 运行验证脚本
chmod +x scripts/verify-deployment.sh
./scripts/verify-deployment.sh
```

### 手动验证

1. **访问生产环境URL**: https://alpha-quant-copilot.vercel.app
2. **测试Clerk认证**:
   - 点击登录/注册按钮
   - 测试Google OAuth登录
   - 验证用户仪表板访问
3. **测试核心功能**:
   - 自选股添加功能
   - 实时数据推送
   - AI助手对话
   - 设置页面访问
4. **检查API路由**:
   - `/api/health` - 健康检查
   - `/api/sse` - 服务器发送事件
   - `/api/websocket` - WebSocket连接

## 配置说明

### Vercel配置文件 (`vercel.json`)

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "build": {
    "env": {
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY": "@next_public_clerk_publishable_key",
      "CLERK_SECRET_KEY": "@clerk_secret_key",
      "CLERK_WEBHOOK_SECRET": "@clerk_webhook_secret",
      "DATABASE_URL": "@database_url",
      "DIRECT_URL": "@direct_url",
      "DEEPSEEK_API_KEY": "@deepseek_api_key",
      "TUSHARE_TOKEN": "@tushare_token",
      "NEXT_PUBLIC_APP_URL": "@next_public_app_url"
    }
  },
  "regions": ["hkg1"],
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

### Next.js配置 (`next.config.js`)

已配置:
- WebSocket支持
- CORS头设置
- 环境变量
- 图片域名
- TypeScript和ESLint配置

## 故障排除

### 常见问题

#### 1. Clerk认证失败
- **症状**: 登录按钮无响应或重定向错误
- **解决方案**:
  1. 检查Clerk密钥是否正确
  2. 在Clerk Dashboard添加Allowed Origins:
     - `https://alpha-quant-copilot.vercel.app`
     - 预览环境URL
  3. 验证环境变量设置

#### 2. 数据库连接错误
- **症状**: API返回数据库错误
- **解决方案**:
  1. 检查DATABASE_URL和DIRECT_URL
  2. 验证Supabase连接
  3. 运行Prisma迁移: `npx prisma migrate deploy`

#### 3. 构建失败
- **症状**: Vercel构建失败
- **解决方案**:
  1. 查看构建日志: `vercel logs alpha-quant-copilot`
  2. 检查TypeScript错误
  3. 验证依赖版本兼容性

#### 4. 实时数据不更新
- **症状**: 实时数据页面无更新
- **解决方案**:
  1. 检查SSE和WebSocket API路由
  2. 验证数据抓取服务配置
  3. 检查网络连接和CORS设置

### 调试命令

```bash
# 查看部署列表
vercel list alpha-quant-copilot

# 查看构建日志
vercel logs alpha-quant-copilot

# 查看环境变量
vercel env ls alpha-quant-copilot

# 重新部署
vercel --prod

# 删除项目
vercel remove alpha-quant-copilot
```

## 维护指南

### 更新部署

1. **代码更新后**:
   ```bash
   git pull origin main
   vercel --prod
   ```

2. **环境变量更新**:
   ```bash
   vercel env rm VARIABLE_NAME
   vercel env add VARIABLE_NAME
   ```

### 监控和日志

1. **访问Vercel Dashboard**:
   - https://vercel.com/dashboard
   - 查看部署状态
   - 监控性能指标
   - 查看错误日志

2. **设置告警**:
   - 配置部署失败通知
   - 设置性能阈值告警
   - 监控API错误率

### 备份和恢复

1. **数据库备份**:
   - 定期备份Supabase数据
   - 导出Prisma schema
   - 备份环境变量

2. **项目恢复**:
   ```bash
   # 重新部署
   vercel --prod

   # 恢复环境变量
   ./scripts/setup-vercel-env.sh
   ```

## 安全建议

1. **密钥管理**:
   - 定期轮换API密钥
   - 使用Vercel环境变量存储敏感信息
   - 避免在代码中硬编码密钥

2. **访问控制**:
   - 限制API访问权限
   - 配置CORS策略
   - 启用Clerk认证保护

3. **监控和审计**:
   - 监控异常登录尝试
   - 审计API使用情况
   - 定期检查安全日志

## 相关文档

- [Clerk Webhook设置指南](./clerk-webhook-setup.md)
- [实时系统架构](./realtime-system-architecture.md)
- [股票价格存储系统](./stock-price-storage-system.md)
- [项目README](../README.md)

## 支持

如遇问题，请参考:
1. Vercel文档: https://vercel.com/docs
2. Next.js文档: https://nextjs.org/docs
3. Clerk文档: https://clerk.com/docs
4. 项目Issue跟踪

---

**文档版本**: 1.0
**最后更新**: 2026-02-23
**维护者**: Alpha-Quant-Copilot Team