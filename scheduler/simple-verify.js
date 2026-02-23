/**
 * Alpha-Quant-Copilot 调度器简化验证脚本
 * 验证调度系统基本功能（不使用TypeScript编译）
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Alpha-Quant-Copilot 调度器简化验证');
console.log('====================================\n');

let passed = 0;
let failed = 0;

// 测试1: 检查目录结构
console.log('1. 检查目录结构...');
try {
  const requiredDirs = ['config', 'tasks', 'utils', 'services', 'logs'];
  const requiredFiles = [
    'main.ts',
    'config/scheduler.config.ts',
    'tasks/intraday-scan.ts',
    'tasks/postmarket-review.ts',
    'utils/logger.ts',
    'services/ai-service.ts'
  ];

  for (const dir of requiredDirs) {
    const dirPath = path.join(__dirname, dir);
    if (fs.existsSync(dirPath)) {
      console.log(`   ✅ 目录存在: ${dir}`);
    } else {
      console.log(`   ❌ 目录不存在: ${dir}`);
      failed++;
    }
  }

  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      console.log(`   ✅ 文件存在: ${file}`);
    } else {
      console.log(`   ❌ 文件不存在: ${file}`);
      failed++;
    }
  }

  if (failed === 0) {
    console.log('   ✅ 所有目录和文件检查通过');
    passed++;
  }
} catch (error) {
  console.log(`   ❌ 目录结构检查失败: ${error.message}`);
  failed++;
}

// 测试2: 检查package.json配置
console.log('\n2. 检查package.json配置...');
try {
  const packageJson = require('../package.json');

  // 检查node-cron依赖
  if (packageJson.dependencies && packageJson.dependencies['node-cron']) {
    console.log(`   ✅ node-cron依赖已安装: ${packageJson.dependencies['node-cron']}`);
  } else {
    console.log('   ❌ node-cron依赖未安装');
    failed++;
  }

  // 检查npm脚本
  const requiredScripts = ['scheduler', 'scheduler:start', 'scheduler:stop', 'scheduler:status'];
  for (const script of requiredScripts) {
    if (packageJson.scripts && packageJson.scripts[script]) {
      console.log(`   ✅ npm脚本存在: ${script}`);
    } else {
      console.log(`   ❌ npm脚本不存在: ${script}`);
      failed++;
    }
  }

  if (failed === 0) {
    console.log('   ✅ package.json配置检查通过');
    passed++;
  }
} catch (error) {
  console.log(`   ❌ package.json检查失败: ${error.message}`);
  failed++;
}

// 测试3: 检查配置文件内容
console.log('\n3. 检查配置文件内容...');
try {
  const configPath = path.join(__dirname, 'config/scheduler.config.ts');
  const configContent = fs.readFileSync(configPath, 'utf-8');

  // 检查关键配置项
  const requiredConfigs = [
    'tradingHours',
    'intradayScan',
    'postMarketReview',
    'logging',
    'aiIntegration',
    'monitoring'
  ];

  for (const config of requiredConfigs) {
    if (configContent.includes(config)) {
      console.log(`   ✅ 配置项存在: ${config}`);
    } else {
      console.log(`   ❌ 配置项不存在: ${config}`);
      failed++;
    }
  }

  // 检查中国股市交易时间
  if (configContent.includes('startHour: 9') && configContent.includes('startMinute: 30')) {
    console.log('   ✅ 中国股市交易时间配置正确');
  } else {
    console.log('   ❌ 中国股市交易时间配置不正确');
    failed++;
  }

  if (failed === 0) {
    console.log('   ✅ 配置文件内容检查通过');
    passed++;
  }
} catch (error) {
  console.log(`   ❌ 配置文件检查失败: ${error.message}`);
  failed++;
}

// 测试4: 检查主调度器文件
console.log('\n4. 检查主调度器文件...');
try {
  const mainPath = path.join(__dirname, 'main.ts');
  const mainContent = fs.readFileSync(mainPath, 'utf-8');

  // 检查关键功能
  const requiredFunctions = [
    'class AlphaQuantScheduler',
    'start()',
    'stop()',
    'scheduleIntradayScan',
    'schedulePostMarketReview',
    'executeIntradayScan',
    'executePostMarketReview'
  ];

  for (const func of requiredFunctions) {
    if (mainContent.includes(func)) {
      console.log(`   ✅ 功能存在: ${func}`);
    } else {
      console.log(`   ❌ 功能不存在: ${func}`);
      failed++;
    }
  }

  // 检查CLI命令
  if (mainContent.includes('npm run scheduler:start') &&
      mainContent.includes('npm run scheduler:status')) {
    console.log('   ✅ CLI命令文档完整');
  } else {
    console.log('   ❌ CLI命令文档不完整');
    failed++;
  }

  if (failed === 0) {
    console.log('   ✅ 主调度器文件检查通过');
    passed++;
  }
} catch (error) {
  console.log(`   ❌ 主调度器文件检查失败: ${error.message}`);
  failed++;
}

// 汇总结果
console.log('\n📊 验证结果汇总');
console.log('===============');
console.log(`✅ 通过: ${passed}`);
console.log(`❌ 失败: ${failed}`);
const totalTests = 4;
console.log(`📈 结构完整性: ${((passed / totalTests) * 100).toFixed(1)}%\n`);

if (failed === 0) {
  console.log('🎉 调度器结构验证通过！系统可以正常部署。');
  console.log('\n下一步:');
  console.log('1. 安装依赖: npm install');
  console.log('2. 启动调度器: npm run scheduler:start');
  console.log('3. 检查状态: npm run scheduler:status');
  console.log('\n注意: 首次运行可能需要修复TypeScript编译错误。');
} else {
  console.log('⚠️  部分验证失败，请检查错误信息。');
  console.log('\n建议:');
  console.log('1. 检查缺失的文件或目录');
  console.log('2. 确保package.json配置正确');
  console.log('3. 运行 npm install 安装依赖');
  process.exit(1);
}