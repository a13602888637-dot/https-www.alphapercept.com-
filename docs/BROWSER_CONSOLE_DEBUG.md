# 浏览器控制台调试脚本

## 紧急诊断

请在浏览器中执行以下步骤：

### 步骤1: 打开开发者工具

1. 访问 https://www.alphapercept.com/watchlist
2. 按 `F12` 或 右键→检查
3. 点击 `Console` 标签

### 步骤2: 清除缓存并强制刷新

**方法1 (推荐)**:
- Windows: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

**方法2**:
- 打开开发者工具
- 右键点击刷新按钮
- 选择"清空缓存并硬性重新加载"

### 步骤3: 运行诊断脚本

在Console中复制粘贴以下代码并回车：

```javascript
// 自选股功能诊断脚本
console.log('🔍 开始诊断自选股功能...\n');

// 1. 检查登录状态
console.log('1️⃣ 检查登录状态:');
const clerkLoaded = typeof window.Clerk !== 'undefined';
console.log(`   Clerk加载: ${clerkLoaded ? '✅' : '❌'}`);

if (clerkLoaded && window.Clerk.user) {
  console.log(`   登录状态: ✅ 已登录`);
  console.log(`   用户ID: ${window.Clerk.user.id}`);
} else {
  console.log(`   登录状态: ❌ 未登录`);
  console.log(`   ⚠️  您需要先登录才能使用自选股功能！`);
}

// 2. 测试API (GET)
console.log('\n2️⃣ 测试API获取自选股:');
fetch('/api/watchlist')
  .then(res => res.json())
  .then(data => {
    console.log(`   状态: ${data.success ? '✅' : '❌'}`);
    console.log(`   数据:`, data);
    if (data.watchlist) {
      console.log(`   自选股数量: ${data.watchlist.length}`);
    }
  })
  .catch(err => console.error(`   错误:`, err));

// 3. 检查页面元素
console.log('\n3️⃣ 检查页面元素:');
setTimeout(() => {
  const addButton = document.querySelector('button:has-text("添加股票")') ||
                    Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('添加股票'));
  const inputs = document.querySelectorAll('input[disabled]');

  console.log(`   "添加股票"按钮: ${addButton ? '✅ 存在' : '❌ 未找到'}`);
  console.log(`   禁用的输入框数量: ${inputs.length}`);

  if (inputs.length > 0) {
    console.log(`   ⚠️  仍有 ${inputs.length} 个输入框被禁用`);
    console.log(`   这可能是缓存问题，请强制刷新页面（Ctrl+Shift+R）`);
  }
}, 1000);

// 4. 测试添加功能（如果已登录）
console.log('\n4️⃣ 测试添加功能:');
if (clerkLoaded && window.Clerk.user) {
  console.log('   正在测试添加股票API...');
  fetch('/api/watchlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stockCode: 'TEST001',
      stockName: '测试股票'
    })
  })
  .then(res => {
    console.log(`   响应状态: ${res.status}`);
    return res.json();
  })
  .then(data => {
    console.log(`   响应数据:`, data);
    if (data.success) {
      console.log(`   ✅ API工作正常！`);
      // 清理测试数据
      if (data.item && data.item.id) {
        fetch(`/api/watchlist?id=${data.item.id}`, { method: 'DELETE' })
          .then(() => console.log('   已清理测试数据'));
      }
    } else {
      console.log(`   ❌ API返回错误: ${data.error}`);
    }
  })
  .catch(err => console.error(`   ❌ 请求失败:`, err));
} else {
  console.log('   ⚠️  未登录，无法测试添加功能');
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📋 诊断完成！请将上面的输出截图反馈给开发者。');
```

### 步骤4: 手动测试

1. **登录检查**:
   - 确认右上角显示您的用户名/头像
   - 如果未登录，请先登录

2. **强制刷新**:
   - Windows: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

3. **尝试添加**:
   - 点击"添加股票"按钮
   - 尝试以下两种方式：

   **方式A: 搜索**
   ```
   1. 在搜索框输入：000001
   2. 等待下拉列表出现
   3. 点击列表中的"平安银行"
   4. 查看代码和名称框是否自动填充
   5. 点击"添加"按钮
   ```

   **方式B: 手动输入**
   ```
   1. 不使用搜索框
   2. 直接在"股票代码"框输入：600519
   3. 直接在"股票名称"框输入：贵州茅台
   4. 点击"添加"按钮
   ```

4. **查看Network**:
   - 打开开发者工具的"Network"标签
   - 执行添加操作
   - 查找 `watchlist` 请求
   - 检查:
     - Status Code: 应该是 200
     - Response: 应该包含 `{"success": true}`

### 步骤5: 提供反馈

请截图以下内容：

1. ✅ Console标签的诊断输出
2. ✅ Network标签的watchlist请求详情
3. ✅ 页面截图（显示对话框状态）
4. ✅ 描述具体问题：
   - "按钮是灰色的无法点击"
   - "可以点击但没有反应"
   - "显示错误提示：___"
   - "其他：___"

---

## 常见问题快速解决

### Q: 按钮是灰色的，无法点击

**原因**: 股票代码或名称未填写

**解决**:
1. 确保两个输入框都有内容
2. 可以通过搜索选择，或直接手动输入

### Q: 输入框无法输入（灰色背景）

**原因**: 浏览器缓存了旧版本

**解决**:
1. 强制刷新：`Ctrl + Shift + R` (Windows) 或 `Cmd + Shift + R` (Mac)
2. 或者清除浏览器缓存后刷新

### Q: 点击按钮后没有任何反应

**原因**: 可能是JavaScript错误

**解决**:
1. 打开Console查看是否有红色错误
2. 截图Console内容反馈

### Q: 显示"请先登录"

**原因**: 未登录或session过期

**解决**:
1. 点击右上角登录按钮
2. 完成登录流程
3. 返回自选股页面重试

---

## 开发者检查项

如果您是开发者，请检查：

1. **Vercel部署**:
   ```bash
   vercel ls
   # 确认最新部署的commit是 bd0d172
   ```

2. **生产环境代码**:
   ```bash
   curl -s 'https://www.alphapercept.com/watchlist' | grep -A5 -B5 'disabled'
   # 检查是否还有disabled属性
   ```

3. **Middleware配置**:
   ```bash
   curl -s 'https://raw.githubusercontent.com/a13602888637-dot/https-www.alphapercept.com-/main/middleware.ts' | grep 'watchlist'
   # 确认publicRoutes中没有/api/watchlist
   ```

---

**创建时间**: 2026-02-28
**最新部署**: bd0d172
**预期行为**: 输入框可编辑，添加按钮在填写必填项后可点击
