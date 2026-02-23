#!/usr/bin/env node

/**
 * Clerk Webhook 测试脚本
 * 用于测试用户数据同步功能
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');

// 配置
const CONFIG = {
  webhookUrl: 'http://localhost:3000/api/webhooks/clerk',
  webhookSecret: process.env.CLERK_WEBHOOK_SECRET || 'whsec_test_secret',
  testEndpoint: 'http://localhost:3000/api/webhooks/clerk/test',
  port: 3000,
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function logInfo(message) {
  console.log(`${colors.blue}[INFO]${colors.reset} ${message}`);
}

function logSuccess(message) {
  console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`);
}

function logError(message) {
  console.log(`${colors.red}[ERROR]${colors.reset} ${message}`);
}

function logStep(message) {
  console.log(`${colors.magenta}[STEP]${colors.reset} ${message}`);
}

function printHeader(title) {
  console.log(`\n${colors.cyan}========================================${colors.reset}`);
  console.log(`${colors.cyan}  ${title}${colors.reset}`);
  console.log(`${colors.cyan}========================================${colors.reset}\n`);
}

// 生成 Svix 签名
function generateSignature(payload, secret, timestamp) {
  const svixId = crypto.randomUUID();
  const toSign = `${svixId}.${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(toSign)
    .digest('base64');

  return {
    'svix-id': svixId,
    'svix-timestamp': timestamp.toString(),
    'svix-signature': `v1,${signature}`,
  };
}

// 测试用户数据
const TEST_USERS = {
  created: {
    type: 'user.created',
    data: {
      id: 'user_test_' + Date.now(),
      email_addresses: [
        {
          email_address: `test${Date.now()}@example.com`,
          verification: { status: 'verified' }
        }
      ],
      username: `testuser${Date.now()}`,
      first_name: 'Test',
      last_name: 'User',
      image_url: 'https://example.com/avatar.jpg',
      public_metadata: { test: true },
      private_metadata: { internal_id: 'test-123' },
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000),
    }
  },
  updated: {
    type: 'user.updated',
    data: {
      id: 'user_test_existing', // 需要先创建的用户
      email_addresses: [
        {
          email_address: 'updated@example.com',
          verification: { status: 'verified' }
        }
      ],
      username: 'updateduser',
      first_name: 'Updated',
      last_name: 'User',
      image_url: 'https://example.com/updated-avatar.jpg',
      public_metadata: { test: true, updated: true },
      updated_at: Math.floor(Date.now() / 1000),
    }
  },
  deleted: {
    type: 'user.deleted',
    data: {
      id: 'user_test_to_delete',
    }
  }
};

// 发送 HTTP 请求
function sendRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const protocol = options.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: responseData,
        });
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(data);
    }

    req.end();
  });
}

// 测试端点状态
async function testEndpointStatus() {
  logStep("测试 Webhook 端点状态");

  try {
    const response = await sendRequest({
      protocol: 'http:',
      hostname: 'localhost',
      port: CONFIG.port,
      path: CONFIG.testEndpoint.replace('http://localhost:3000', ''),
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.statusCode === 200) {
      const result = JSON.parse(response.data);
      logSuccess(`端点状态: ${result.status}`);
      logInfo(`数据库连接: ${result.database.connected ? '正常' : '异常'}`);
      logInfo(`用户数量: ${result.database.userCount}`);
      return true;
    } else {
      logError(`端点返回状态码: ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    logError(`测试端点失败: ${error.message}`);
    return false;
  }
}

// 发送 Webhook 测试事件
async function sendWebhookEvent(eventType, testData) {
  logStep(`发送 ${eventType} 事件`);

  const payload = JSON.stringify({
    type: eventType,
    data: testData.data,
  });

  const timestamp = Math.floor(Date.now() / 1000);
  const signatures = generateSignature(payload, CONFIG.webhookSecret, timestamp);

  try {
    const response = await sendRequest({
      protocol: 'http:',
      hostname: 'localhost',
      port: CONFIG.port,
      path: '/api/webhooks/clerk',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'svix-id': signatures['svix-id'],
        'svix-timestamp': signatures['svix-timestamp'],
        'svix-signature': signatures['svix-signature'],
      },
    }, payload);

    console.log(`响应状态码: ${response.statusCode}`);
    console.log(`响应数据: ${response.data}`);

    if (response.statusCode === 200) {
      logSuccess(`${eventType} 事件处理成功`);
      return true;
    } else {
      logError(`${eventType} 事件处理失败`);
      return false;
    }
  } catch (error) {
    logError(`发送事件失败: ${error.message}`);
    return false;
  }
}

// 完整测试流程
async function runFullTest() {
  printHeader("Clerk Webhook 完整测试");

  console.log(`测试配置:`);
  console.log(`- Webhook URL: ${CONFIG.webhookUrl}`);
  console.log(`- 测试端点: ${CONFIG.testEndpoint}`);
  console.log(`- 端口: ${CONFIG.port}\n`);

  // 1. 检查环境变量
  logStep("检查环境变量");
  if (!process.env.CLERK_WEBHOOK_SECRET) {
    logWarning("CLERK_WEBHOOK_SECRET 环境变量未设置，使用测试密钥");
  } else {
    logSuccess("CLERK_WEBHOOK_SECRET 环境变量已设置");
  }

  // 2. 测试端点状态
  const endpointOk = await testEndpointStatus();
  if (!endpointOk) {
    logError("端点测试失败，请确保服务器正在运行");
    return false;
  }

  // 3. 测试 user.created 事件
  const createdOk = await sendWebhookEvent('user.created', TEST_USERS.created);

  // 4. 测试 user.updated 事件
  // 注意：需要先创建用户才能测试更新
  const updatedOk = await sendWebhookEvent('user.updated', TEST_USERS.updated);

  // 5. 测试 user.deleted 事件
  const deletedOk = await sendWebhookEvent('user.deleted', TEST_USERS.deleted);

  // 6. 生成测试报告
  printHeader("测试结果汇总");

  const results = {
    '端点状态': endpointOk,
    '用户创建': createdOk,
    '用户更新': updatedOk,
    '用户删除': deletedOk,
  };

  let allPassed = true;
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? '通过' : '失败'}`);
    if (!passed) allPassed = false;
  });

  console.log('');

  if (allPassed) {
    logSuccess("所有测试通过！Clerk Webhook 功能正常。");
  } else {
    logWarning("部分测试失败，请检查服务器日志和配置。");

    console.log('\n🔧 故障排除建议:');
    console.log('1. 确保开发服务器正在运行: npm run dev');
    console.log('2. 检查环境变量 CLERK_WEBHOOK_SECRET 是否正确');
    console.log('3. 查看服务器控制台日志');
    console.log('4. 验证数据库连接和表结构');
    console.log('5. 检查 Prisma 迁移状态');
  }

  return allPassed;
}

// 快速测试（仅检查端点）
async function runQuickTest() {
  printHeader("Clerk Webhook 快速测试");
  return await testEndpointStatus();
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'full';

  try {
    if (mode === 'quick') {
      await runQuickTest();
    } else if (mode === 'full') {
      await runFullTest();
    } else {
      console.log(`用法: node scripts/test-clerk-webhook.js [mode]`);
      console.log(`模式:`);
      console.log(`  full  - 完整测试（默认）`);
      console.log(`  quick - 快速测试（仅检查端点）`);
    }
  } catch (error) {
    logError(`测试过程中发生错误: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(error => {
    console.error('未捕获的错误:', error);
    process.exit(1);
  });
}

module.exports = {
  testEndpointStatus,
  sendWebhookEvent,
  runFullTest,
  runQuickTest,
};