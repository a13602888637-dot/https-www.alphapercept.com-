/**
 * 完整自选股功能诊断脚本
 * 测试完整的数据流：前端 → API → 数据库
 */

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

console.log('🔍 自选股功能完整诊断\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function diagnoseWatchlist() {
  // Layer 1: 检查API端点是否可访问
  console.log('📋 Layer 1: API端点检查');
  console.log('─────────────────────────────────────────────────────');

  try {
    // GET测试
    console.log('\n🔹 测试 GET /api/watchlist');
    const getResponse = await fetch(`${baseUrl}/api/watchlist`);
    const getData = await getResponse.json();

    console.log(`   状态码: ${getResponse.status}`);
    console.log(`   响应数据:`, JSON.stringify(getData, null, 2));

    if (getResponse.ok) {
      console.log(`   ✓ GET请求成功`);
      console.log(`   当前自选股数量: ${getData.watchlist?.length || 0}`);
      if (getData.watchlist?.length > 0) {
        console.log(`   已有股票:`, getData.watchlist.map(item => `${item.stockName}(${item.stockCode})`).join(', '));
      }
    } else {
      console.log(`   ✗ GET请求失败`);
      if (getResponse.status === 401) {
        console.log(`   ⚠️  需要认证 - 这是关键问题！`);
      }
    }
  } catch (error) {
    console.log(`   ✗ GET请求异常: ${error.message}`);
  }

  // Layer 2: 测试POST添加（需要认证）
  console.log('\n📋 Layer 2: POST添加测试（需要认证）');
  console.log('─────────────────────────────────────────────────────');

  try {
    console.log('\n🔹 测试 POST /api/watchlist (未认证)');
    const postResponse = await fetch(`${baseUrl}/api/watchlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        stockCode: '000001',
        stockName: '平安银行',
        buyPrice: 10.5,
        notes: '测试添加'
      })
    });

    const postData = await postResponse.json();
    console.log(`   状态码: ${postResponse.status}`);
    console.log(`   响应数据:`, JSON.stringify(postData, null, 2));

    if (postResponse.status === 401) {
      console.log(`   ✓ 正确返回401 - 需要认证`);
      console.log(`   ⚠️  这说明API需要登录，但前端可能没有正确传递认证信息！`);
    } else if (postResponse.ok) {
      console.log(`   ✓ POST请求成功（已认证）`);
    } else {
      console.log(`   ✗ POST请求失败: ${postData.error || '未知错误'}`);
    }
  } catch (error) {
    console.log(`   ✗ POST请求异常: ${error.message}`);
  }

  // Layer 3: 检查数据库连接
  console.log('\n📋 Layer 3: 数据库连接检查');
  console.log('─────────────────────────────────────────────────────');

  const fs = require('fs');
  const path = require('path');

  // 检查环境变量
  const envPath = path.join(__dirname, '../.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const hasDatabaseUrl = envContent.includes('DATABASE_URL');
    const hasClerkKeys = envContent.includes('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');

    console.log(`   ✓ .env.local 文件存在`);
    console.log(`   DATABASE_URL: ${hasDatabaseUrl ? '✓ 已配置' : '✗ 未配置'}`);
    console.log(`   Clerk Keys: ${hasClerkKeys ? '✓ 已配置' : '✗ 未配置'}`);

    if (!hasDatabaseUrl || !hasClerkKeys) {
      console.log(`   ⚠️  缺少必要的环境变量！`);
    }
  } else {
    console.log(`   ✗ .env.local 文件不存在`);
  }

  // Layer 4: 检查Clerk认证配置
  console.log('\n📋 Layer 4: Clerk认证配置检查');
  console.log('─────────────────────────────────────────────────────');

  // 检查middleware
  const middlewarePath = path.join(__dirname, '../middleware.ts');
  if (fs.existsSync(middlewarePath)) {
    const middlewareContent = fs.readFileSync(middlewarePath, 'utf-8');
    console.log(`   ✓ middleware.ts 存在`);

    // 检查是否保护了/api/watchlist路径
    const hasWatchlistProtection = middlewareContent.includes('/api/watchlist') ||
                                   middlewareContent.includes('/api/(.*)');
    console.log(`   API路由保护: ${hasWatchlistProtection ? '✓ 已配置' : '⚠️  可能未配置'}`);
  }

  // 最终诊断
  console.log('\n📋 诊断结论');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n🔍 可能的问题：');
  console.log('   1. ⚠️  前端未正确传递Clerk认证令牌');
  console.log('   2. ⚠️  Clerk配置问题（publishable key或domain）');
  console.log('   3. ⚠️  数据库用户表为空（Clerk webhook未同步）');
  console.log('   4. ⚠️  环境变量配置不一致');

  console.log('\n💡 建议的调查方向：');
  console.log('   1. 检查浏览器控制台的Network标签，看API请求是否包含Authorization header');
  console.log('   2. 检查Vercel环境变量是否正确配置');
  console.log('   3. 检查用户是否真正登录（Clerk session）');
  console.log('   4. 检查数据库中是否有用户记录');

  console.log('\n');
}

// 运行诊断
diagnoseWatchlist().catch(console.error);
