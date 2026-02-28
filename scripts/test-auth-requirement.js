/**
 * 测试认证要求
 * 验证修复前后的行为
 */

async function testAuthRequirement() {
  console.log('🧪 测试自选股API认证要求\n');

  const baseUrl = 'http://localhost:3001';

  // 测试1: GET请求（应该返回空列表，不需要认证）
  console.log('Test 1: GET /api/watchlist (无认证)');
  try {
    const res = await fetch(`${baseUrl}/api/watchlist`);
    const data = await res.json();
    console.log(`  状态: ${res.status}`);
    console.log(`  响应:`, data);
    console.log(`  预期: 200 OK，返回空列表`);
    console.log(`  结果: ${res.status === 200 && Array.isArray(data.watchlist) ? '✓ 通过' : '✗ 失败'}\n`);
  } catch (error) {
    console.log(`  ✗ 错误: ${error.message}\n`);
  }

  // 测试2: POST请求（应该返回401）
  console.log('Test 2: POST /api/watchlist (无认证)');
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
    console.log(`  状态: ${res.status}`);
    console.log(`  响应:`, data);
    console.log(`  预期: 401 Unauthorized`);
    console.log(`  结果: ${res.status === 401 ? '✓ 通过' : '✗ 失败'}\n`);
  } catch (error) {
    console.log(`  ✗ 错误: ${error.message}\n`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📋 问题分析:');
  console.log('  当前middleware.ts将/api/watchlist设置为publicRoutes');
  console.log('  这导致Clerk不会注入认证上下文');
  console.log('  API内部的await auth()返回null');
  console.log('  所有需要认证的操作(POST/PUT/DELETE)都失败\n');

  console.log('💡 修复方案:');
  console.log('  从middleware.ts的publicRoutes中移除/api/watchlist');
  console.log('  这样Clerk会正确处理认证');
  console.log('  已登录用户可以正常操作自选股\n');
}

testAuthRequirement().catch(console.error);
