# Alpha-Quant-Copilot Vercel部署检查清单

## 部署前检查

### ✅ 环境准备
- [ ] Node.js >= 18.0.0 已安装
- [ ] npm 已安装
- [ ] Git 已安装
- [ ] 项目代码已拉取到本地

### ✅ 项目配置
- [ ] `package.json` 文件存在且配置正确
- [ ] `next.config.js` 文件存在且配置正确
- [ ] `.env.local` 文件存在且包含必要变量
- [ ] `vercel.json` 配置文件已创建

## 部署步骤

### ✅ 步骤1: 安装Vercel CLI
```bash
npm install -g vercel
vercel --version
```

### ✅ 步骤2: 登录Vercel
```bash
vercel login
# 使用: a13602888637@gmail.com / Dicky.666
```

### ✅ 步骤3: 链接项目
```bash
vercel link
# 选择: Link to existing project
# 项目名: alpha-quant-copilot
# 框架: Next.js
# 输出目录: .next
```

### ✅ 步骤4: 设置环境变量
```bash
# 运行自动设置脚本
chmod +x scripts/setup-vercel-env.sh
./scripts/setup-vercel-env.sh

# 或手动设置
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
vercel env add CLERK_SECRET_KEY
vercel env add CLERK_WEBHOOK_SECRET
vercel env add DATABASE_URL
vercel env add DIRECT_URL
vercel env add DEEPSEEK_API_KEY
vercel env add TUSHARE_TOKEN
vercel env add NEXT_PUBLIC_APP_URL
```

### ✅ 步骤5: 预览部署
```bash
vercel
# 访问提供的预览URL
```

### ✅ 步骤6: 生产部署
```bash
vercel --prod
# 生产URL: https://alpha-quant-copilot.vercel.app
```

## 部署后验证

### ✅ 基础功能测试
- [ ] 访问 https://alpha-quant-copilot.vercel.app
- [ ] 主页加载正常
- [ ] Clerk登录/注册按钮显示
- [ ] 静态资源加载正常

### ✅ Clerk认证测试
- [ ] 点击登录按钮
- [ ] Google OAuth登录流程
- [ ] 成功登录后跳转仪表板
- [ ] 用户会话保持

### ✅ 核心功能测试
- [ ] 仪表板页面访问
- [ ] 自选股添加功能
- [ ] 实时数据页面访问
- [ ] AI助手对话功能
- [ ] 设置页面访问

### ✅ API测试
- [ ] `/api/health` - 健康检查
- [ ] `/api/sse` - 实时数据推送
- [ ] `/api/websocket` - WebSocket连接
- [ ] 其他业务API

## 环境变量验证

### ✅ 必需变量
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- [ ] `CLERK_SECRET_KEY`
- [ ] `CLERK_WEBHOOK_SECRET`
- [ ] `DATABASE_URL`
- [ ] `DIRECT_URL`
- [ ] `DEEPSEEK_API_KEY`
- [ ] `TUSHARE_TOKEN`
- [ ] `NEXT_PUBLIC_APP_URL`

### ✅ 可选变量
- [ ] `LOG_LEVEL`
- [ ] `NODE_ENV`
- [ ] `PORT`
- [ ] `NEXT_PUBLIC_API_URL`

## Clerk配置检查

### ✅ Clerk Dashboard设置
- [ ] Allowed Origins已添加:
  - `https://alpha-quant-copilot.vercel.app`
  - 预览环境URL
- [ ] Webhook已配置
- [ ] 认证方式已启用 (Google OAuth)

## 数据库配置检查

### ✅ Supabase连接
- [ ] 数据库可访问
- [ ] 连接池配置正确
- [ ] Prisma迁移已应用

### ✅ 数据表验证
- [ ] `User` 表存在
- [ ] `Watchlist` 表存在
- [ ] `StockPrice` 表存在
- [ ] 其他业务表存在

## 性能监控

### ✅ Vercel Dashboard
- [ ] 部署状态正常
- [ ] 构建日志无错误
- [ ] 性能指标正常
- [ ] 错误率在可接受范围

### ✅ 实时监控
- [ ] 页面加载时间 < 3秒
- [ ] API响应时间 < 2秒
- [ ] 实时数据更新延迟 < 5秒
- [ ] 内存使用率正常

## 安全检查

### ✅ 访问控制
- [ ] 敏感API需要认证
- [ ] CORS配置正确
- [ ] 文件上传限制
- [ ] 请求频率限制

### ✅ 密钥安全
- [ ] 无硬编码密钥
- [ ] 环境变量存储敏感信息
- [ ] 定期轮换密钥计划

## 文档更新

### ✅ 部署文档
- [ ] `docs/vercel-deployment-guide.md` 已更新
- [ ] `scripts/deploy-vercel.sh` 可用
- [ ] `scripts/setup-vercel-env.sh` 可用
- [ ] `scripts/verify-deployment.sh` 可用

### ✅ 项目文档
- [ ] README.md 包含部署说明
- [ ] 环境变量说明完整
- [ ] 故障排除指南

## 紧急恢复计划

### ✅ 回滚策略
- [ ] 了解如何回滚到前一版本
- [ ] 备份当前环境变量
- [ ] 记录当前配置状态

### ✅ 故障处理
- [ ] 知道如何查看Vercel日志
- [ ] 了解如何重启服务
- [ ] 有联系支持渠道

## 完成状态

### ✅ 最终验证
- [ ] 所有测试通过
- [ ] 文档完整
- [ ] 团队通知已发送
- [ ] 监控告警已设置

---

**部署完成时间**: _______________
**部署版本**: v1.0.0
**部署人员**: _______________
**验证人员**: _______________

**备注**:
________________________________________________________________
________________________________________________________________
________________________________________________________________

**下次部署改进建议**:
________________________________________________________________
________________________________________________________________
________________________________________________________________