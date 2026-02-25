/**
 * 测试Clerk认证修复的脚本
 * 这个脚本模拟测试修复后的API端点
 */

const API_ENDPOINTS = [
  {
    name: "analyze-watchlist GET",
    url: "http://localhost:3000/api/analyze-watchlist",
    method: "GET",
    requiresAuth: false
  },
  {
    name: "intelligence-feed GET",
    url: "http://localhost:3000/api/intelligence-feed",
    method: "GET",
    requiresAuth: false
  },
  {
    name: "watchlist GET",
    url: "http://localhost:3000/api/watchlist",
    method: "GET",
    requiresAuth: false
  },
  {
    name: "users/sync GET",
    url: "http://localhost:3000/api/users/sync",
    method: "GET",
    requiresAuth: false
  }
];

async function testEndpoint(endpoint) {
  console.log(`\n测试 ${endpoint.name}...`);
  console.log(`URL: ${endpoint.url}`);
  console.log(`方法: ${endpoint.method}`);

  try {
    const response = await fetch(endpoint.url, {
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();

    console.log(`状态码: ${response.status}`);
    console.log(`响应:`, JSON.stringify(data, null, 2));

    // 验证响应
    if (endpoint.requiresAuth) {
      if (response.status === 401) {
        console.log(`✓ 认证要求正确执行`);
      } else {
        console.log(`✗ 预期401状态码，但收到${response.status}`);
      }
    } else {
      if (response.status === 200) {
        console.log(`✓ GET端点正确处理未认证请求`);
      } else {
        console.log(`✗ 预期200状态码，但收到${response.status}`);
      }
    }

    return { success: response.status === (endpoint.requiresAuth ? 401 : 200) };
  } catch (error) {
    console.log(`✗ 请求失败: ${error.message}`);
    return { success: false, error };
  }
}

async function runTests() {
  console.log("开始测试Clerk认证修复...");
  console.log("=".repeat(50));

  let passed = 0;
  let failed = 0;

  for (const endpoint of API_ENDPOINTS) {
    const result = await testEndpoint(endpoint);
    if (result.success) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`测试完成: ${passed} 通过, ${failed} 失败`);

  if (failed > 0) {
    console.log("\n建议:");
    console.log("1. 确保开发服务器正在运行 (npm run dev)");
    console.log("2. 检查middleware.ts中的publicRoutes配置");
    console.log("3. 验证每个端点的认证逻辑");
    process.exit(1);
  } else {
    console.log("\n✓ 所有测试通过！Clerk认证修复成功。");
    process.exit(0);
  }
}

// 运行测试
runTests().catch(console.error);