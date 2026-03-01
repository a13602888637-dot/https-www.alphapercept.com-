# Clerk生产域名配置指南

## 问题诊断

**当前状态**:
- Clerk配置域名: `clerk.alphapercept.co` (注意是.co)
- 实际生产域名: `www.alphapercept.com` (注意是.com)
- ❌ **域名不匹配** - 导致认证失败

**错误表现**:
```
[WatchlistManager] API响应状态: 401
[WatchlistManager] 认证失败: 用户未登录
Error: Authentication required
详情: Clerk authentication failed. Please sign in to manage watchlist.
```

## 根本原因

Clerk的Publishable Key (pk_live_Y2xlcmsuYWxwaGFwZXJjZXB0LmNvbSQ) 编码的域名是 `clerk.alphapercept.co`，但生产网站使用的是 `www.alphapercept.com`。

域名不匹配导致：
1. Clerk拒绝在该域名上设置session cookie
2. API调用时无法获取用户认证信息
3. 所有需要认证的操作返回401错误

## 解决步骤（必须执行）

### 方案A: 在Clerk Dashboard添加域名（推荐）

#### 步骤1: 登录Clerk Dashboard
1. 访问: https://dashboard.clerk.com/
2. 登录你的账户
3. 选择你的应用（Alpha-Quant-Copilot或对应的应用名称）

#### 步骤2: 配置允许的域名
1. 在左侧菜单找到 **Settings** 或 **Configure**
2. 点击 **Domains** 或 **Allowed Origins**
3. 添加以下域名：
   - `www.alphapercept.com` ✅ (主域名)
   - `alphapercept.com` ✅ (根域名，推荐)
   - `*.alphapercept.com` (通配符，可选)

#### 步骤3: 验证并保存
1. 确认域名列表中包含 `www.alphapercept.com`
2. 点击 **Save** 或 **Update**
3. 等待1-2分钟让配置生效

#### 步骤4: 检查Frontend API
1. 在Clerk Dashboard中，找到 **API Keys** 或 **Developers** → **API Keys**
2. 查看 "Frontend API" 或 "Publishable Key" 部分
3. 确认显示的域名包含 `alphapercept.com`
4. 如果需要，点击 "Add domain" 添加域名

### 方案B: 更新Clerk密钥（如果方案A不工作）

如果无法在现有应用中添加域名，需要为生产域名创建新的Clerk应用：

#### 步骤1: 创建新的Clerk应用
1. 在Clerk Dashboard点击 "Create Application"
2. 应用名称: `Alpha-Quant-Copilot Production`
3. 选择认证方式（Email, Google等，保持与现有配置一致）
4. 在 "Production URL" 中输入: `https://www.alphapercept.com`

#### 步骤2: 获取新密钥
1. 创建应用后，进入 **API Keys** 页面
2. 复制以下密钥：
   - **Publishable Key** (以 `pk_live_` 开头)
   - **Secret Key** (以 `sk_live_***` 开头)

#### 步骤3: 更新Vercel环境变量
在本地终端运行（我会帮你执行）：
```bash
# 更新Publishable Key
vercel env rm NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
# 粘贴新的 pk_live_... 密钥

# 更新Secret Key
vercel env rm CLERK_SECRET_KEY production
vercel env add CLERK_SECRET_KEY production
# 粘贴新的 sk_live_***... 密钥
```

#### 步骤4: 重新部署
```bash
vercel --prod
```

## 验证修复

### 1. Cookie检查（最重要）
修复后第一步：检查Clerk cookie是否正确设置

1. 访问 https://www.alphapercept.com
2. 打开浏览器开发者工具（F12）
3. 进入 **Application** 标签（Chrome）或 **Storage** 标签（Firefox）
4. 点击左侧 **Cookies** → `https://www.alphapercept.com`
5. ✅ 应该看到以下cookies：
   - `__session` (Clerk session token)
   - `__clerk_db_jwt` (可能存在)
   - Domain应该是 `.alphapercept.com` 或 `www.alphapercept.com`

如果看不到这些cookies：
- ❌ Clerk域名配置可能还没生效
- ❌ 需要清除浏览器缓存重试
- ❌ 可能需要重新登录

### 2. 登录测试
1. 如果已登录，先退出
2. 重新登录
3. 登录成功后，检查Cookie（参考上一步）
4. 访问个人中心页面，应该显示用户信息

### 3. 添加自选股测试
1. 访问自选股页面: https://www.alphapercept.com/watchlist
2. 点击"添加股票"按钮
3. 搜索并选择一只股票（如：600000 浦发银行）
4. 填写信息后点击"添加"
5. ✅ **预期结果**：
   - 不再报 "Authentication required" 错误
   - 显示 "✅ 浦发银行 (600000) 已添加到自选股"
   - 列表中出现新添加的股票

### 4. Network请求检查
1. 开发者工具 → **Network** 标签
2. 添加自选股时，找到 `POST /api/watchlist` 请求
3. 点击该请求，查看详情
4. **Request Headers** 应该包含：
   ```
   Cookie: __session=eyJhbG...很长的token
   ```
5. **Response** 状态码应该是：
   - `200 OK` (成功添加)
   - `409 Conflict` (股票已存在)
   - ❌ **不应该是** `401 Unauthorized`

### 5. 完整功能测试
测试所有需要认证的操作：
- ✅ 添加自选股
- ✅ 编辑自选股（修改买入价、止损价等）
- ✅ 删除自选股
- ✅ 从个股页面添加到自选股
- ✅ 查看自选股列表

## 常见问题

### Q1: 域名添加后还是报401错误？

**可能原因**:
1. Clerk配置还没生效（等待2-5分钟）
2. 浏览器缓存了旧的cookie
3. 域名配置不正确

**解决方法**:
```bash
# 步骤1: 清除浏览器数据
- Chrome: 设置 → 隐私和安全 → 清除浏览数据
- 选择"Cookie和其他网站数据"
- 时间范围选择"全部时间"
- 点击"清除数据"

# 步骤2: 使用隐私模式测试
- Chrome: Ctrl+Shift+N (Windows) 或 Cmd+Shift+N (Mac)
- 访问 https://www.alphapercept.com
- 登录并测试添加自选股

# 步骤3: 检查Clerk Dashboard
- 确认域名已保存
- 查看Status页面是否有错误提示
```

### Q2: 如何确认域名配置正确？

在Clerk Dashboard中检查：

**位置**: Settings → Domains 或 Configure → Allowed Origins

**应该看到**:
```
Allowed Origins:
✅ www.alphapercept.com (Active)
✅ alphapercept.com (Active)
```

**Frontend API应该显示**:
```
Frontend API: https://clerk.alphapercept.com
或
Frontend API: https://[app-name].clerk.accounts.dev
```

### Q3: Cookie的Domain字段应该是什么？

正确的Cookie配置：

| Cookie名称 | Domain | Path | Secure | HttpOnly |
|-----------|--------|------|--------|----------|
| `__session` | `.alphapercept.com` | `/` | ✅ Yes | ✅ Yes |
| `__clerk_db_jwt` | `.alphapercept.com` | `/` | ✅ Yes | ❌ No |

**注意**:
- Domain前面的点(`.`)表示包含所有子域名
- 如果Domain是 `www.alphapercept.com` (无点)，则仅在www子域名有效
- **推荐配置**: `.alphapercept.com` (带点)

### Q4: 本地开发可以，生产环境不行？

这是典型的域名配置问题：

**本地开发**:
- 使用 `localhost:3000`
- Clerk自动允许localhost
- 测试密钥(pk_test_)支持localhost

**生产环境**:
- 使用 `www.alphapercept.com`
- 必须在Clerk Dashboard明确添加
- 生产密钥(pk_live_)仅支持配置的域名

**解决**: 在Clerk Dashboard添加生产域名（见"解决步骤"）

### Q5: 如何检查使用的密钥是否正确？

**检查Vercel环境变量**:
```bash
# 在本地运行
vercel env pull .env.check --environment production

# 检查密钥
grep "CLERK" .env.check
```

**应该看到**:
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."  # ✅ 生产密钥
CLERK_SECRET_KEY="sk_live_***..."                  # ✅ 生产密钥
```

**如果看到**:
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."  # ❌ 测试密钥
CLERK_SECRET_KEY="sk_test_..."                  # ❌ 测试密钥
```
则需要更新为生产密钥。

## 技术背景

### Clerk域名验证机制

```
用户访问 www.alphapercept.com
         ↓
浏览器加载Clerk SDK
         ↓
SDK检查当前域名: www.alphapercept.com
         ↓
SDK从pk_live密钥中解码允许的域名
         ↓
    匹配检查
    ↙        ↘
  匹配         不匹配
   ↓            ↓
设置cookie    拒绝设置cookie
   ↓            ↓
API调用成功   返回401错误
```

### Publishable Key编码的信息

Clerk的pk_live密钥是Base64编码的，包含：
1. 应用ID
2. 允许的域名列表
3. 其他配置信息

**示例解码**:
```bash
# 当前的密钥
pk_live_Y2xlcmsuYWxwaGFwZXJjZXB0LmNvbSQ

# Base64解码后
clerk.alphapercept.co$
         ↑
     配置的域名（.co而不是.com）
```

### 为什么Cookie很重要？

Clerk的认证流程依赖Cookie：

1. **登录时**: Clerk设置 `__session` cookie
2. **API调用时**: 浏览器自动发送cookie到同域API
3. **后端验证**: `auth()`函数从cookie中提取session token
4. **返回用户信息**: 验证成功，返回userId

**如果cookie未设置或未发送**:
```typescript
// app/api/watchlist/route.ts
const { userId } = await auth();  // ← userId为null
if (!userId) {
  return new Response("Authentication required", { status: 401 });
}
```

## 下一步

完成域名配置后：

1. ✅ 清除浏览器缓存
2. ✅ 重新登录
3. ✅ 测试添加自选股
4. ✅ 验证所有认证功能正常

如果仍然有问题，请提供：
- Clerk Dashboard的Domains配置截图
- 浏览器Console的错误信息
- Network标签中POST /api/watchlist的完整请求/响应

---

**文档创建时间**: 2026-03-01
**问题追踪**: WATCHLIST-AUTH-DOMAIN-MISMATCH
**优先级**: P0 (Critical)
