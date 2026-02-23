# Alpha-Quant-Copilot 快速部署指南

## 5分钟完成Vercel部署

### 第一步: 安装和登录 (1分钟)
```bash
# 安装Vercel CLI
npm install -g vercel

# 登录Vercel
vercel login
# 邮箱: a13602888637@gmail.com
# 密码: Dicky.666
# 选择Google登录
```

### 第二步: 一键部署 (2分钟)
```bash
# 进入项目目录
cd /Users/guangyu/stock-analysis

# 运行完整部署脚本
chmod +x scripts/deploy-vercel.sh
./scripts/deploy-vercel.sh
```

### 第三步: 环境变量设置 (1分钟)
```bash
# 自动设置所有环境变量
chmod +x scripts/setup-vercel-env.sh
./scripts/setup-vercel-env.sh
```

### 第四步: 生产部署 (1分钟)
```bash
# 预览部署测试
vercel

# 生产部署
vercel --prod
```

## 部署完成！

### 访问地址
- **生产环境**: https://alpha-quant-copilot.vercel.app
- **预览环境**: 查看 `vercel` 命令输出

### 验证部署
```bash
# 运行验证脚本
chmod +x scripts/verify-deployment.sh
./scripts/verify-deployment.sh
```

## 遇到问题？

### 快速排查
1. **Clerk登录失败** → 检查Allowed Origins配置
2. **数据库错误** → 验证DATABASE_URL
3. **构建失败** → 查看 `vercel logs alpha-quant-copilot`

### 详细文档
- [完整部署指南](./docs/vercel-deployment-guide.md)
- [部署检查清单](./DEPLOYMENT_CHECKLIST.md)
- [故障排除指南](./VERCEL_DEPLOYMENT_SUMMARY.md#故障排除)

## 下一步
1. 访问 https://alpha-quant-copilot.vercel.app
2. 测试登录功能
3. 验证实时数据
4. 检查AI助手

---

**部署时间**: 预计5-10分钟
**技术要求**: Node.js 18+, npm, 网络连接
**支持**: 查看详细文档或联系团队