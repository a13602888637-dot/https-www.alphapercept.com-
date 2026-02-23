# Clerk Webhook 配置指南

## 概述

本文档指导如何配置 Clerk Webhook 以实现用户数据自动同步到 Prisma 数据库。

## 目录

1. [环境变量配置](#环境变量配置)
2. [Clerk 仪表板配置](#clerk-仪表板配置)
3. [Webhook 端点说明](#webhook-端点说明)
4. [测试流程](#测试流程)
5. [故障排除](#故障排除)
6. [监控与日志](#监控与日志)

## 环境变量配置

### 必需的环境变量

在 `.env.local` 文件中添加以下配置：

```bash
# Clerk Webhook Secret (从Clerk仪表板获取)
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Clerk API 密钥
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 数据库连接
DATABASE_URL="postgresql://username:password@host:6543/database?pgbouncer=true"
DIRECT_URL="postgresql://username:password@host:5432/database"
```

### 环境变量说明

| 变量名 | 说明 | 获取方式 |
|--------|------|----------|
| `CLERK_WEBHOOK_SECRET` | Webhook 签名密钥 | Clerk 仪表板 → Webhooks → 复制 Secret |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | 前端发布密钥 | Clerk 仪表板 → API Keys |
| `CLERK_SECRET_KEY` | 后端密钥 | Clerk 仪表板 → API Keys |
| `DATABASE_URL` | 业务数据库连接 | Supabase 项目设置 |
| `DIRECT_URL` | 直连数据库连接 | Supabase 项目设置 |

## Clerk 仪表板配置

### 步骤 1: 创建 Webhook

1. 登录 [Clerk 仪表板](https://dashboard.clerk.com)
2. 选择你的应用
3. 导航到 **Webhooks** 页面
4. 点击 **Add Endpoint**

### 步骤 2: 配置 Webhook

填写以下信息：

- **Endpoint URL**: `https://your-domain.com/api/webhooks/clerk`
  - 开发环境: `http://localhost:3000/api/webhooks/clerk`
  - 生产环境: `https://your-domain.com/api/webhooks/clerk`

- **Secret**: 生成或输入一个密钥，复制到 `CLERK_WEBHOOK_SECRET` 环境变量

- **订阅事件** (勾选以下事件):
  - ✅ `user.created`
  - ✅ `user.updated`
  - ✅ `user.deleted`
  - ✅ `session.created` (可选)
  - ✅ `session.ended` (可选)

### 步骤 3: 保存并启用

1. 点击 **Create**
2. 确保 Webhook 状态为 **Enabled**
3. 复制 **Signing Secret** 到环境变量

## Webhook 端点说明

### 主要端点

| 端点 | 方法 | 功能 | 认证 |
|------|------|------|------|
| `/api/webhooks/clerk` | POST | 处理 Clerk Webhook 事件 | Svix 签名验证 |
| `/api/webhooks/clerk/test` | GET | 测试端点状态 | 无 |

### 处理的事件类型

#### 1. `user.created`
- **触发时机**: 用户注册成功
- **处理逻辑**:
  - 创建用户记录到 Prisma 数据库
  - 同步所有用户信息（邮箱、用户名、头像等）
  - 初始化用户设置

#### 2. `user.updated`
- **触发时机**: 用户信息更新
- **处理逻辑**:
  - 更新现有用户记录
  - 同步变更的用户信息
  - 更新 `updatedAt` 时间戳

#### 3. `user.deleted`
- **触发时机**: 用户删除账户
- **处理逻辑**:
  - 从 Prisma 数据库删除用户记录
  - 级联删除相关数据（依赖关系配置）

### 数据同步字段

| Clerk 字段 | Prisma 字段 | 说明 |
|------------|-------------|------|
| `id` | `clerkUserId` | Clerk 用户 ID |
| `email_addresses[0].email_address` | `email` | 主要邮箱地址 |
| `username` | `username` | 用户名 |
| `first_name` | `firstName` | 名字 |
| `last_name` | `lastName` | 姓氏 |
| `image_url` | `imageUrl` | 头像 URL |
| `public_metadata` | `metadata.publicMetadata` | 公开元数据 |
| `private_metadata` | `metadata.privateMetadata` | 私有元数据 |
| `created_at` | `metadata.clerkCreatedAt` | Clerk 创建时间 |
| `updated_at` | `metadata.clerkUpdatedAt` | Clerk 更新时间 |

## 测试流程

### 1. 本地开发测试

#### 步骤 1: 启动开发服务器
```bash
npm run dev
```

#### 步骤 2: 测试端点状态
访问: http://localhost:3000/api/webhooks/clerk/test

预期响应:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-23T10:30:00.000Z",
  "database": {
    "connected": true,
    "userCount": 0
  },
  "recentUsers": []
}
```

#### 步骤 3: 使用 ngrok 暴露本地服务
```bash
ngrok http 3000
```
复制 ngrok URL 到 Clerk Webhook 配置。

#### 步骤 4: 手动触发测试
在 Clerk 仪表板中:
1. 进入 Webhooks 页面
2. 找到你的 Webhook
3. 点击 **Send test event**
4. 选择事件类型: `user.created`
5. 查看服务器日志确认处理成功

### 2. 生产环境测试

#### 步骤 1: 部署应用
确保应用已部署到生产环境。

#### 步骤 2: 配置生产环境变量
```bash
# 生产环境 .env.production
CLERK_WEBHOOK_SECRET=whsec_production_secret_here
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### 步骤 3: 测试生产端点
访问: `https://your-domain.com/api/webhooks/clerk/test`

#### 步骤 4: 创建测试用户
1. 在前端注册一个新用户
2. 检查数据库是否创建了对应记录
3. 验证用户信息是否完整同步

## 故障排除

### 常见问题

#### 问题 1: Webhook 验证失败
**症状**: 返回 400 错误 "Error occurred -- no svix headers"

**解决方案**:
1. 检查 `CLERK_WEBHOOK_SECRET` 环境变量是否正确
2. 确认 Clerk 仪表板中的 Secret 与本地配置一致
3. 检查 Webhook URL 是否正确

#### 问题 2: 数据库操作失败
**症状**: 用户未同步到数据库

**解决方案**:
1. 检查数据库连接是否正常
2. 查看服务器日志中的错误信息
3. 验证 Prisma schema 是否已迁移
4. 检查用户表是否存在

#### 问题 3: 重复用户记录
**症状**: 同一用户创建了多条记录

**解决方案**:
1. 检查 `clerkUserId` 的唯一性约束
2. 查看 Webhook 是否被重复触发
3. 验证 `user.created` 事件处理逻辑

### 错误代码说明

| HTTP 状态码 | 含义 | 解决方案 |
|-------------|------|----------|
| 400 | 请求验证失败 | 检查 Svix 签名头和环境变量 |
| 500 | 服务器内部错误 | 查看服务器日志，检查数据库连接 |
| 200 | 成功处理 | Webhook 处理完成 |

## 监控与日志

### 日志级别

Webhook 处理会记录以下信息:

1. **INFO**: Webhook 接收和处理开始
2. **SUCCESS**: 用户同步成功
3. **WARNING**: 非关键问题（如用户已存在）
4. **ERROR**: 处理失败，需要干预

### 监控指标

建议监控以下指标:

1. **Webhook 成功率**: 成功处理的 Webhook 比例
2. **同步延迟**: 从事件触发到数据库同步的时间
3. **错误率**: 失败事件的比例
4. **用户同步完整性**: 同步字段的完整度

### 告警配置

设置以下告警:

1. **Webhook 失败率 > 5%**: 检查服务状态
2. **同步延迟 > 10秒**: 检查数据库性能
3. **数据库连接失败**: 立即处理

## 高级配置

### 重试机制

Webhook 处理包含自动重试机制:

- **最大重试次数**: 3 次
- **重试延迟**: 指数退避（1s, 2s, 4s）
- **重试条件**: 数据库连接失败、网络错误

### 数据验证

Webhook 处理包含以下验证:

1. **邮箱验证**: 优先使用已验证的邮箱
2. **用户存在性检查**: 防止重复创建
3. **数据完整性**: 验证必要字段

### 安全考虑

1. **签名验证**: 所有请求必须通过 Svix 签名验证
2. **速率限制**: 考虑添加 API 速率限制
3. **IP 白名单**: 生产环境可配置 Clerk IP 白名单

## 更新与维护

### Schema 变更

当 Prisma schema 更新时:

1. 运行数据库迁移:
   ```bash
   npx prisma migrate dev
   ```

2. 重新生成 Prisma 客户端:
   ```bash
   npx prisma generate
   ```

3. 重启应用服务

### 版本升级

升级 Clerk SDK 时:

1. 检查版本兼容性
2. 更新 package.json
3. 运行 `npm install`
4. 测试 Webhook 功能

## 支持与帮助

### 获取帮助

1. **Clerk 文档**: https://clerk.com/docs
2. **Svix 文档**: https://docs.svix.com
3. **Prisma 文档**: https://www.prisma.io/docs

### 问题反馈

遇到问题时:

1. 检查服务器日志
2. 验证环境变量配置
3. 测试端点状态
4. 联系技术支持

---

**最后更新**: 2026-02-23
**文档版本**: 1.0
**维护团队**: Alpha-Quant-Copilot 开发团队