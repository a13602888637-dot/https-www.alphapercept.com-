# Clerk子域名配置检查清单

## 你已完成的配置

✅ 在Clerk Dashboard启用了 "Enable allowed subdomains"
✅ 添加了 www.alphapercept.com 作为允许的子域名

## 配置验证清单

### 1. Clerk Dashboard配置检查

访问：https://dashboard.clerk.com/ → 你的应用 → Settings → Domains

**应该看到**：

```
Production Domain Settings:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Primary domain:
  alphapercept.com

☑️  Enable allowed subdomains

Allowed subdomains:
  • www.alphapercept.com
  (或者可能是通配符: *.alphapercept.com)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**重要提示**：
- 如果你勾选了 "Enable allowed subdomains"，Clerk应该自动允许 `*.alphapercept.com` 下的所有子域名
- 这意味着 `www.alphapercept.com`、`app.alphapercept.com` 等都应该可以工作

### 2. 浏览器Cookie检查（测试时）

**位置**：开发者工具 (F12) → Application → Cookies → https://www.alphapercept.com

**应该看到的Cookies**：

| Cookie名称 | Domain | Path | Secure | HttpOnly | SameSite |
|-----------|--------|------|--------|----------|----------|
| `__session` | `.alphapercept.com` | `/` | ✅ Yes | ✅ Yes | Lax |
| `__clerk_db_jwt` | `.alphapercept.com` | `/` | ✅ Yes | ❌ No | Lax |

**关键点**：
- Domain应该是 `.alphapercept.com`（注意前面的点）
- 前面的点表示Cookie在所有子域名下都有效
- 如果Domain是 `www.alphapercept.com`（无点），则只在www子域名有效

### 3. Network请求检查（添加自选股时）

**位置**：开发者工具 (F12) → Network 标签

**操作**：点击"添加股票"，观察 `POST /api/watchlist` 请求

**Request Headers应该包含**：
```http
Cookie: __session=eyJhbGciOiJSUzI1NiI...（很长的token）
```

**Response应该是**：
- ✅ `200 OK` - 成功添加
- ✅ `409 Conflict` - 股票已存在
- ❌ `401 Unauthorized` - 认证失败（如果还是这个，继续往下看）

### 4. Clerk配置生效时间

**正常情况**：
- 域名配置保存后，1-2分钟内生效
- 最长可能需要5-10分钟

**如果超过10分钟还不生效**：
1. 刷新Clerk Dashboard页面，确认配置已保存
2. 检查Clerk Status页面：https://status.clerk.com/
3. 可能需要联系Clerk支持

### 5. 常见配置问题

#### 问题A: Cookie的Domain字段不正确

**症状**：登录成功但Cookie的Domain是错误的

**检查**：
```javascript
// 在浏览器控制台运行
document.cookie.split(';').forEach(c => {
    if (c.includes('__session')) {
        console.log('Session cookie:', c);
    }
});
```

**解决**：
- 如果Domain是 `www.alphapercept.com`（无点），Cookie只在www子域名有效
- Clerk应该自动设置为 `.alphapercept.com`（有点）
- 如果不是，可能需要在Clerk中设置 "Cookie domain" 选项

#### 问题B: 浏览器阻止了第三方Cookie

**症状**：无法看到 `__session` cookie

**解决**：
1. 检查浏览器设置：Chrome → 设置 → 隐私和安全 → Cookie和其他网站数据
2. 确保不是 "阻止第三方Cookie"
3. 将 `alphapercept.com` 添加到允许列表

#### 问题C: HTTPS配置问题

**症状**：Cookie的Secure标志为true，但网站使用HTTP

**检查**：
- 确保访问的是 `https://www.alphapercept.com`（注意https）
- 不是 `http://www.alphapercept.com`

**Vercel默认强制HTTPS**，应该不会有这个问题。

### 6. 高级诊断

如果上述都检查了还是不行，运行完整诊断脚本：

**在浏览器控制台粘贴运行**：

```javascript
(async function clerkDiagnostics() {
    console.clear();
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #2196F3');
    console.log('%c🔬 Clerk 完整诊断', 'font-size: 18px; font-weight: bold; color: #2196F3');
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #2196F3');
    console.log('');

    // 1. 基本信息
    console.log('%c1️⃣ 基本信息', 'font-weight: bold; color: #4CAF50');
    console.log('  域名:', window.location.hostname);
    console.log('  协议:', window.location.protocol);
    console.log('  完整URL:', window.location.href);
    console.log('');

    // 2. Cookie检查
    console.log('%c2️⃣ Cookie检查', 'font-weight: bold; color: #4CAF50');
    const allCookies = document.cookie.split(';').map(c => c.trim());
    const clerkCookies = allCookies.filter(c =>
        c.startsWith('__session') ||
        c.includes('clerk')
    );

    if (clerkCookies.length === 0) {
        console.log('%c  ❌ 未找到Clerk cookies', 'color: red; font-weight: bold');
        console.log('  这是问题所在！');
    } else {
        console.log('%c  ✅ 找到Clerk cookies:', 'color: green');
        clerkCookies.forEach(c => {
            const [name] = c.split('=');
            console.log(`    • ${name}`);
        });
    }
    console.log('');

    // 3. Clerk客户端状态
    console.log('%c3️⃣ Clerk客户端状态', 'font-weight: bold; color: #4CAF50');
    if (window.Clerk) {
        const user = await window.Clerk.user;
        if (user) {
            console.log('%c  ✅ 用户已登录', 'color: green');
            console.log('    用户ID:', user.id);
            console.log('    邮箱:', user.primaryEmailAddress?.emailAddress);
        } else {
            console.log('%c  ❌ 用户未登录', 'color: red');
        }
    } else {
        console.log('%c  ⚠️ Clerk客户端未加载', 'color: orange');
        console.log('  这可能是配置问题');
    }
    console.log('');

    // 4. API测试
    console.log('%c4️⃣ API认证测试', 'font-weight: bold; color: #4CAF50');
    console.log('  正在调用 GET /api/watchlist...');

    try {
        const response = await fetch('/api/watchlist', {
            method: 'GET',
            credentials: 'include'
        });

        console.log('  响应状态:', response.status);

        if (response.status === 200) {
            console.log('%c  ✅ API认证成功！', 'color: green; font-weight: bold');
            const data = await response.json();
            console.log('  自选股数量:', data.watchlist?.length || 0);
        } else if (response.status === 401) {
            console.log('%c  ❌ API认证失败 (401)', 'color: red; font-weight: bold');
            const data = await response.json();
            console.log('  错误信息:', data.error);
            console.log('  详情:', data.details);
        } else {
            console.log('  响应:', await response.text());
        }
    } catch (error) {
        console.log('%c  ❌ API调用失败:', 'color: red', error.message);
    }
    console.log('');

    // 5. 诊断结论
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #2196F3');
    console.log('%c📊 诊断结论', 'font-size: 16px; font-weight: bold; color: #2196F3');
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #2196F3');
    console.log('');

    const hasCookies = clerkCookies.length > 0;
    const hasClerkClient = !!window.Clerk;

    if (hasCookies && hasClerkClient) {
        console.log('%c✅ 配置正确', 'color: green; font-size: 14px; font-weight: bold');
        console.log('  Cookie和Clerk客户端都正常。');
        console.log('  如果API仍然失败，可能是后端配置问题。');
    } else if (!hasCookies) {
        console.log('%c❌ Cookie未设置', 'color: red; font-size: 14px; font-weight: bold');
        console.log('');
        console.log('  可能的原因:');
        console.log('  1. Clerk域名配置未生效（等待5-10分钟）');
        console.log('  2. 浏览器缓存未清除');
        console.log('  3. 需要重新登录');
        console.log('');
        console.log('  解决步骤:');
        console.log('  1. 清除浏览器缓存 (Ctrl+Shift+Delete)');
        console.log('  2. 退出登录');
        console.log('  3. 重新登录');
        console.log('  4. 再次运行此诊断');
    }

    console.log('');
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #2196F3');
    console.log('诊断完成');
})();
```

这个脚本会：
- ✅ 检查域名和协议
- ✅ 检查所有Clerk相关的cookies
- ✅ 检查Clerk客户端状态
- ✅ 测试API认证
- ✅ 给出诊断结论和建议

## 最后的手段：验证Clerk配置截图

如果以上都检查了还是不行，请提供以下信息：

1. **Clerk Dashboard截图**：
   - Settings → Domains 页面
   - API Keys 页面（隐藏密钥的敏感部分）

2. **浏览器截图**：
   - Application → Cookies 页面
   - Network → POST /api/watchlist 请求详情

3. **错误信息**：
   - 浏览器Console的完整错误信息

这样我可以精确定位问题。

## 成功标志

配置成功后，你应该看到：

1. ✅ 浏览器Application标签有 `__session` cookie
2. ✅ Cookie的Domain是 `.alphapercept.com`
3. ✅ API调用返回200或409，不是401
4. ✅ 可以成功添加自选股

---

**创建时间**: 2026-03-01
**问题类型**: Clerk子域名配置
**状态**: 配置已完成，等待生效验证
