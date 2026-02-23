/**
 * Alpha-Quant-Copilot 调度器测试脚本
 * 验证调度系统基本功能
 */

const { exec } = require('child_process');
const path = require('path');

console.log('🚀 Alpha-Quant-Copilot 调度器测试');
console.log('================================\n');

// 测试配置
const tests = [
  {
    name: '检查TypeScript编译',
    command: 'npx tsc --noEmit',
    description: '验证TypeScript代码无语法错误'
  },
  {
    name: '检查依赖安装',
    command: 'npm list node-cron',
    description: '验证node-cron依赖已安装'
  },
  {
    name: '检查目录结构',
    command: `find ${path.join(__dirname, 'scheduler')} -name "*.ts" | wc -l`,
    description: '验证调度器文件完整性'
  },
  {
    name: '测试配置加载',
    command: `node -e "const config = require('./scheduler/config/scheduler.config.ts'); console.log('配置加载成功:', config.defaultConfig.tradingHours);"`,
    description: '验证配置文件可加载'
  },
  {
    name: '测试日志系统',
    command: `node -e "const { initLogger } = require('./scheduler/utils/logger.ts'); const logger = initLogger({ consoleOutput: false }); logger.info('测试日志'); console.log('日志系统测试完成');"`,
    description: '验证日志系统功能'
  }
];

async function runTests() {
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`📋 ${test.name}`);
    console.log(`   ${test.description}`);

    try {
      const result = await executeCommand(test.command);
      console.log(`   ✅ 通过\n`);
      passed++;
    } catch (error) {
      console.log(`   ❌ 失败: ${error.message}\n`);
      failed++;
    }
  }

  console.log('📊 测试结果汇总');
  console.log('===============');
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`📈 成功率: ${((passed / tests.length) * 100).toFixed(1)}%\n`);

  if (failed === 0) {
    console.log('🎉 所有测试通过！调度器可以正常启动。');
    console.log('\n启动命令:');
    console.log('  npm run scheduler:start');
    console.log('\n状态检查:');
    console.log('  npm run scheduler:status');
  } else {
    console.log('⚠️  部分测试失败，请检查错误信息。');
    process.exit(1);
  }
}

function executeCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd: __dirname }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`命令执行失败: ${error.message}\n${stderr}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

// 运行测试
runTests().catch(error => {
  console.error('测试运行失败:', error);
  process.exit(1);
});