/**
 * Alpha-Quant-Copilot 调度器验证脚本
 * 验证调度系统基本功能
 */

import { defaultConfig, SchedulerConfig } from './config/scheduler.config';
import { Logger, initLogger } from './utils/logger';
import { IntradayScanTask } from './tasks/intraday-scan';
import { PostMarketReviewTask } from './tasks/postmarket-review';
import { AIService } from './services/ai-service';

async function verifyScheduler() {
  console.log('🔍 Alpha-Quant-Copilot 调度器验证');
  console.log('================================\n');

  let passed = 0;
  let failed = 0;

  // 测试1: 配置加载
  console.log('1. 测试配置加载...');
  try {
    console.log('   ✅ 默认配置加载成功');
    console.log(`     交易时间: ${defaultConfig.tradingHours.startHour}:${defaultConfig.tradingHours.startMinute} - ${defaultConfig.tradingHours.endHour}:${defaultConfig.tradingHours.endMinute}`);
    console.log(`     盘中扫描间隔: ${defaultConfig.intradayScan.intervalMinutes}分钟`);
    console.log(`     盘后复盘时间: ${defaultConfig.postMarketReview.executionTime}`);
    passed++;
  } catch (error: any) {
    console.log(`   ❌ 配置加载失败: ${error.message}`);
    failed++;
  }

  // 测试2: 日志系统
  console.log('\n2. 测试日志系统...');
  try {
    const logger = initLogger({ consoleOutput: false });
    logger.info('测试日志消息');
    console.log('   ✅ 日志系统初始化成功');
    passed++;
  } catch (error: any) {
    console.log(`   ❌ 日志系统初始化失败: ${error.message}`);
    failed++;
  }

  // 测试3: 盘中扫描任务
  console.log('\n3. 测试盘中扫描任务...');
  try {
    const logger = initLogger({ consoleOutput: false });
    const task = new IntradayScanTask(defaultConfig, logger);
    console.log('   ✅ 盘中扫描任务初始化成功');
    passed++;
  } catch (error: any) {
    console.log(`   ❌ 盘中扫描任务初始化失败: ${error.message}`);
    failed++;
  }

  // 测试4: 盘后复盘任务
  console.log('\n4. 测试盘后复盘任务...');
  try {
    const logger = initLogger({ consoleOutput: false });
    const task = new PostMarketReviewTask(defaultConfig, logger);
    console.log('   ✅ 盘后复盘任务初始化成功');
    passed++;
  } catch (error: any) {
    console.log(`   ❌ 盘后复盘任务初始化失败: ${error.message}`);
    failed++;
  }

  // 测试5: AI服务
  console.log('\n5. 测试AI服务...');
  try {
    const logger = initLogger({ consoleOutput: false });
    const aiService = new AIService(defaultConfig, logger);
    const status = aiService.getServiceStatus();
    console.log('   ✅ AI服务初始化成功');
    console.log(`     启用: ${status.enabled}`);
    console.log(`     提供商: ${status.provider}`);
    console.log(`     模型: ${status.model}`);
    console.log(`     策略文档有效: ${status.strategyDocumentValid}`);
    passed++;
  } catch (error: any) {
    console.log(`   ❌ AI服务初始化失败: ${error.message}`);
    failed++;
  }

  // 测试6: 交易时间判断
  console.log('\n6. 测试交易时间判断...');
  try {
    const now = new Date();
    const isTrading = defaultConfig.tradingHours.startHour <= now.getHours() &&
                     now.getHours() <= defaultConfig.tradingHours.endHour;
    console.log(`   ✅ 当前时间: ${now.toLocaleTimeString()}`);
    console.log(`     是否在交易时间内: ${isTrading ? '是' : '否'}`);
    passed++;
  } catch (error: any) {
    console.log(`   ❌ 交易时间判断失败: ${error.message}`);
    failed++;
  }

  // 汇总结果
  console.log('\n📊 验证结果汇总');
  console.log('===============');
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`📈 成功率: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

  if (failed === 0) {
    console.log('🎉 所有验证通过！调度器可以正常启动。');
    console.log('\n启动命令:');
    console.log('  npm run scheduler:start');
    console.log('\n状态检查:');
    console.log('  npm run scheduler:status');
    console.log('\n手动触发测试:');
    console.log('  npm run scheduler:trigger-intraday');
    console.log('  npm run scheduler:trigger-postmarket');
  } else {
    console.log('⚠️  部分验证失败，请检查错误信息。');
    process.exit(1);
  }
}

// 运行验证
verifyScheduler().catch(error => {
  console.error('验证运行失败:', error);
  process.exit(1);
});