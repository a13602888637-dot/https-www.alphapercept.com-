/**
 * 验证自选股修复
 * 测试修复后的行为
 */

async function verifyFix() {
  console.log('🧪 验证自选股功能修复\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const baseUrl = 'http://localhost:3001';

  // 测试1: 未认证的GET请求（应该返回空列表或401）
  console.log('📋 Test 1: GET /api/watchlist (无认证)');
  console.log('─────────────────────────────────────────────────────');
  try {
    const res = await fetch(`${baseUrl}/api/watchlist`);
    const data = await res.json();
    console.log(`状态码: ${res.status}`);
    console.log(`响应:`, JSON.stringify(data, null, 2));

    if (res.status === 200 && data.watchlist?.length === 0) {
      console.log('✓ 修复后行为：返回空列表（未登录）\n');
    } else if (res.status === 401) {
      console.log('✓ 修复后行为：要求认证\n');
    } else {
      console.log('⚠️  意外响应\n');
    }
  } catch (error) {
    console.log(`✗ 错误: ${error.message}\n`);
  }

  // 测试2: 未认证的POST请求（应该返回401）
  console.log('📋 Test 2: POST /api/watchlist (无认证)');
  console.log('─────────────────────────────────────────────────────');
  try {
    const res = await fetch(`${baseUrl}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stockCode: '000001',
        stockName: '平安银行'
      })
    });
    const data = await res.json();
    console.log(`状态码: ${res.status}`);
    console.log(`响应:`, JSON.stringify(data, null, 2));

    if (res.status === 401) {
      console.log('✓ 修复后行为：正确要求认证\n');
    } else {
      console.log('✗ 修复失败：应该返回401\n');
    }
  } catch (error) {
    console.log(`✗ 错误: ${error.message}\n`);
  }

  // 验证middleware配置
  console.log('📋 Test 3: Middleware配置验证');
  console.log('─────────────────────────────────────────────────────');

  const fs = require('fs');
  const path = require('path');
  const middlewarePath = path.join(__dirname, '../middleware.ts');
  const content = fs.readFileSync(middlewarePath, 'utf-8');

  const hasWatchlistInPublic = content.includes('"/api/watchlist(.*)"') &&
                                !content.includes('// "/api/watchlist(.*)"');

  if (!hasWatchlistInPublic) {
    console.log('✓ /api/watchlist 已从publicRoutes移除');
    console.log('  Clerk将正确处理认证\n');
  } else {
    console.log('✗ /api/watchlist 仍在publicRoutes中');
    console.log('  需要手动修复\n');
  }

  // 最终结论
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 修复验证总结:\n');

  console.log('✅ 修复内容:');
  console.log('   1. 从middleware.ts的publicRoutes中移除/api/watchlist');
  console.log('   2. 从middleware.ts的publicRoutes中移除/api/users/sync');
  console.log('   3. Clerk现在会正确注入认证上下文\n');

  console.log('✅ 预期效果:');
  console.log('   1. 未登录用户访问API → 401 Unauthorized');
  console.log('   2. 已登录用户访问API → 正常操作');
  console.log('   3. GET请求返回该用户的自选股列表');
  console.log('   4. POST请求成功添加股票\n');

  console.log('💡 下一步:');
  console.log('   1. 用真实用户账号登录测试');
  console.log('   2. 提交代码到Git');
  console.log('   3. 部署到Vercel');
  console.log('   4. 在生产环境验证\n');
}

verifyFix().catch(console.error);
