# Clerk域名配置修复脚本使用指南

## 问题概述

**症状**: 用户已登录但添加自选股时报错 "Authentication required (401)"

**根本原因**: Clerk配置的域名与实际生产域名不匹配
- Clerk配置: `clerk.alphapercept.co` (.co)
- 实际域名: `www.alphapercept.com` (.com)

## 快速修复（推荐）

### 方式1: 运行交互式脚本

在项目根目录运行：

```bash
cd /Users/guangyu/stock-analysis
./scripts/quick-clerk-fix.sh
```

脚本会提供两个方案供你选择：
- **方案A**: 在Clerk Dashboard添加域名（最简单，推荐）
- **方案B**: 创建新的Clerk应用并自动更新配置

### 方式2: 直接运行完整自动化脚本

如果你已经决定创建新的Clerk应用：

```bash
cd /Users/guangyu/stock-analysis
./scripts/update-clerk-production.sh
```

这个脚本会：
1. ✅ 检查当前配置
2. ✅ 指导你获取新密钥
3. ✅ 自动更新Vercel环境变量
4. ✅ 自动重新部署
5. ✅ 提供验证步骤

## 手动修复步骤（方案A - 推荐）

如果你不想运行脚本，可以手动操作：

### 步骤1: 登录Clerk Dashboard

1. 访问: https://dashboard.clerk.com/
2. 选择你的应用

### 步骤2: 添加域名

1. 左侧菜单: **Settings** → **Domains**
2. 点击 **"+ Add domain"** 或 **"Add origin"**
3. 添加以下两个域名：
   - `www.alphapercept.com`
   - `alphapercept.com`
4. 点击 **Save**

### 步骤3: 验证修复

1. 等待1-2分钟让配置生效
2. 清除浏览器缓存（Ctrl+Shift+Delete）
3. 访问 https://www.alphapercept.com
4. 重新登录
5. 测试添加自选股（应该不再报401错误）

## 脚本文件说明

### `quick-clerk-fix.sh` - 快速修复向导

**用途**: 交互式向导，提供两种修复方案供选择

**特点**:
- 🎯 清晰的菜单选择
- 📋 详细的步骤说明
- 🚀 快速定位解决方案

**使用场景**: 首次修复，不确定使用哪种方案

### `update-clerk-production.sh` - 完整自动化脚本

**用途**: 自动化更新Clerk密钥和Vercel配置

**特点**:
- ✅ 检查当前配置
- ✅ 验证新密钥格式
- ✅ 自动更新Vercel环境变量
- ✅ 可选自动部署
- ✅ 提供验证指南

**使用场景**: 已决定创建新Clerk应用，需要更新密钥

**执行流程**:
```
1. 检查当前配置
   ↓
2. 提示获取新密钥
   ↓
3. 验证密钥格式和域名
   ↓
4. 更新Vercel环境变量
   ↓
5. 可选: 自动部署
   ↓
6. 提供验证步骤
```

## 修复后验证清单

完成修复后，请按照以下清单验证：

### ✅ Cookie检查

1. 打开 https://www.alphapercept.com
2. 开发者工具 (F12) → Application → Cookies
3. 应该看到 `__session` cookie
4. Domain应该是 `.alphapercept.com`

### ✅ 登录测试

1. 退出当前登录
2. 重新登录
3. 检查Cookie是否正确设置

### ✅ 添加自选股测试

1. 访问自选股页面
2. 点击"添加股票"
3. 添加一只股票（如：600000 浦发银行）
4. **预期结果**:
   - ✅ 不再报 401 错误
   - ✅ 显示 "已添加到自选股"
   - ✅ 列表中出现新股票

### ✅ Network请求检查

1. 开发者工具 → Network标签
2. 添加自选股时，查看 `POST /api/watchlist`
3. **Request Headers** 应包含: `Cookie: __session=...`
4. **Response** 状态码应是: `200` 或 `409`，不应该是 `401`

## 常见问题

### Q: 脚本运行失败怎么办？

**A**: 检查以下内容：
1. 是否安装了Vercel CLI: `npm install -g vercel`
2. 是否在项目根目录运行脚本
3. 是否有执行权限: `chmod +x scripts/*.sh`
4. 查看错误信息，可能需要手动执行某些步骤

### Q: 添加域名后还是报401错误？

**A**: 可能的原因：
1. **配置未生效**: 等待2-5分钟
2. **浏览器缓存**: 清除缓存并重新登录
3. **域名配置不正确**: 检查Clerk Dashboard中的域名列表
4. **使用了测试密钥**: 确保使用 `pk_live_` 而不是 `pk_test_`

解决方法：
```bash
# 使用隐私模式测试
# Chrome: Ctrl+Shift+N
# 访问 https://www.alphapercept.com
# 重新登录并测试
```

### Q: 如何确认配置正确？

**A**: 在Clerk Dashboard检查：

**位置**: Settings → Domains

**应该看到**:
```
Authorized Domains:
✅ clerk.alphapercept.co (Active)
✅ www.alphapercept.com (Active)
✅ alphapercept.com (Active)
```

### Q: 需要更新数据库或迁移用户吗？

**A**: 不需要。
- 如果使用方案A（添加域名）：完全不需要任何迁移
- 如果使用方案B（新应用）：可能需要迁移用户，但Clerk通常会自动处理

### Q: 本地开发环境需要修改吗？

**A**: 不需要。本地开发使用 `localhost`，不受生产域名配置影响。

## 技术支持

如果遇到问题，请查看以下文档：

- **CORS修复**: `docs/WATCHLIST_AUTH_FIX_2026-03-01.md`
- **域名配置**: `docs/CLERK_DOMAIN_FIX_GUIDE.md`
- **Clerk官方文档**: https://clerk.com/docs

## 回滚方案

如果新配置导致问题，可以回滚：

```bash
# 1. 恢复旧的环境变量
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
# 输入旧的密钥

vercel env add CLERK_SECRET_KEY production
# 输入旧的密钥

# 2. 重新部署
vercel --prod

# 3. 在Clerk Dashboard中删除新添加的域名
```

## 最佳实践

1. **备份密钥**: 在更新前记录当前的密钥
2. **测试环境**: 如果可能，先在预览环境测试
3. **分步验证**: 每完成一步就验证一次
4. **文档记录**: 记录所做的修改和时间

---

**创建时间**: 2026-03-01
**维护者**: 技术团队
**版本**: 1.0
