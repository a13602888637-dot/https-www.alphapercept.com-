/**
 * Alpha-Quant-Copilot 智能数据源选择器使用示例
 * 展示如何在应用中使用智能数据源选择器
 */

import {
  fetchStockDataSmart,
  fetchMultipleStocksSmart,
  getDataSourcePerformanceReport,
  performDataSourceHealthCheck,
  getDataSourceStats
} from '../skills/data_crawler';

import {
  dataSourceSelector,
  DataSourceType
} from '../skills/data_source_selector';

import {
  dataSourceConfigManager
} from '../skills/data_source_config';

/**
 * 示例1: 基本使用 - 获取单个股票数据
 */
async function exampleBasicUsage() {
  console.log('=== 示例1: 基本使用 ===');

  try {
    // 使用智能路由获取股票数据
    const stockData = await fetchStockDataSmart('000001');

    console.log('股票数据获取成功:');
    console.log(`  代码: ${stockData.symbol}`);
    console.log(`  名称: ${stockData.name}`);
    console.log(`  价格: ${stockData.currentPrice}`);
    console.log(`  涨跌: ${stockData.change} (${stockData.changePercent}%)`);
    console.log(`  更新时间: ${stockData.lastUpdateTime}`);

  } catch (error) {
    console.error('获取股票数据失败:', error);
  }
}

/**
 * 示例2: 批量获取 - 获取多个股票数据
 */
async function exampleBatchUsage() {
  console.log('\n=== 示例2: 批量获取 ===');

  try {
    const symbols = ['000001', '600000', '399001'];
    const stocksData = await fetchMultipleStocksSmart(symbols);

    console.log(`批量获取 ${stocksData.length} 只股票数据成功:`);

    stocksData.forEach((stock, index) => {
      console.log(`  ${index + 1}. ${stock.symbol} - ${stock.name}: ${stock.currentPrice}`);
    });

  } catch (error) {
    console.error('批量获取股票数据失败:', error);
  }
}

/**
 * 示例3: 监控和统计 - 查看数据源性能
 */
async function exampleMonitoring() {
  console.log('\n=== 示例3: 监控和统计 ===');

  try {
    // 获取性能报告
    const report = getDataSourcePerformanceReport();
    console.log('数据源性能报告:');
    console.log(report);

    // 获取统计数据
    const stats = getDataSourceStats();
    console.log('\n数据源统计数据:');
    console.log(JSON.stringify(stats, null, 2));

  } catch (error) {
    console.error('获取监控数据失败:', error);
  }
}

/**
 * 示例4: 健康检查 - 检查数据源状态
 */
async function exampleHealthCheck() {
  console.log('\n=== 示例4: 健康检查 ===');

  try {
    const healthChecks = await performDataSourceHealthCheck();

    console.log('数据源健康检查结果:');
    healthChecks.forEach((check: any) => {
      const status = check.isHealthy ? '✅ 健康' : '❌ 不健康';
      console.log(`  ${check.source}: ${status} (${check.latency}ms)`);
      if (check.error) {
        console.log(`    错误: ${check.error}`);
      }
    });

  } catch (error) {
    console.error('执行健康检查失败:', error);
  }
}

/**
 * 示例5: 配置管理 - 动态更新配置
 */
async function exampleConfigManagement() {
  console.log('\n=== 示例5: 配置管理 ===');

  try {
    // 获取当前配置
    const config = dataSourceConfigManager.getConfig();
    console.log('当前配置版本:', config.version);
    console.log('数据源数量:', config.dataSources.length);

    // 更新数据源配置
    console.log('\n更新新浪数据源配置...');
    dataSourceConfigManager.updateDataSourceConfig(DataSourceType.SINA, {
      priority: 95,
      timeout: 8000
    });

    console.log('配置更新成功');

    // 获取配置摘要
    const summary = dataSourceConfigManager.getConfigSummary();
    console.log('\n配置摘要:');
    console.log(summary);

  } catch (error) {
    console.error('配置管理失败:', error);
  }
}

/**
 * 示例6: 高级路由 - 自定义路由决策
 */
async function exampleAdvancedRouting() {
  console.log('\n=== 示例6: 高级路由 ===');

  try {
    const manager = dataSourceSelector.getManager();

    // 获取路由决策
    const decision = manager.makeRoutingDecision('000001', 'cn');

    console.log('智能路由决策:');
    console.log(`  选择的数据源: ${decision.selectedSource}`);
    console.log(`  备用数据源: ${decision.backupSources.join(', ')}`);
    console.log(`  置信度: ${(decision.confidence * 100).toFixed(1)}%`);
    console.log(`  预估延迟: ${decision.estimatedLatency}ms`);
    console.log(`  决策原因: ${decision.reason}`);

    // 获取所有数据源状态
    const allConfigs = manager.getAllConfigs();
    console.log('\n所有数据源状态:');
    allConfigs.forEach(config => {
      console.log(`  ${config.type}: ${config.enabled ? '启用' : '禁用'} (优先级: ${config.priority})`);
    });

  } catch (error) {
    console.error('高级路由失败:', error);
  }
}

/**
 * 示例7: 故障模拟 - 测试故障切换
 */
async function exampleFailureSimulation() {
  console.log('\n=== 示例7: 故障模拟 ===');

  try {
    const manager = dataSourceSelector.getManager();

    // 模拟新浪数据源故障
    console.log('模拟新浪数据源故障...');
    manager.recordRequestResult(DataSourceType.SINA, false, 5000);
    manager.recordRequestResult(DataSourceType.SINA, false, 5000);
    manager.recordRequestResult(DataSourceType.SINA, false, 5000);

    // 获取新的路由决策
    const decision = manager.makeRoutingDecision('000001');

    console.log('故障后的路由决策:');
    console.log(`  选择的数据源: ${decision.selectedSource}`);
    console.log(`  新浪数据源状态: ${decision.selectedSource === DataSourceType.SINA ? '仍在使用' : '已切换'}`);

    // 重置统计数据
    console.log('\n重置统计数据...');
    manager.resetStats(DataSourceType.SINA);

    console.log('统计数据已重置');

  } catch (error) {
    console.error('故障模拟失败:', error);
  }
}

/**
 * 示例8: 集成到现有应用
 */
async function exampleIntegration() {
  console.log('\n=== 示例8: 集成到现有应用 ===');

  // 场景1: 替换现有的数据获取逻辑
  console.log('场景1: 替换现有的数据获取逻辑');
  console.log(`
之前:
  import { fetchMarketDataWithFallback } from '../skills/data_crawler';
  const data = await fetchMarketDataWithFallback('000001');

之后:
  import { fetchStockDataSmart } from '../skills/data_crawler';
  const data = await fetchStockDataSmart('000001');
  `);

  // 场景2: 添加监控和报警
  console.log('\n场景2: 添加监控和报警');
  console.log(`
// 定期检查数据源健康状态
setInterval(async () => {
  const healthChecks = await performDataSourceHealthCheck();
  const unhealthySources = healthChecks.filter(h => !h.isHealthy);

  if (unhealthySources.length > 0) {
    console.warn('发现不健康的数据源:', unhealthySources.map(h => h.source));
    // 发送报警通知
  }
}, 60000); // 每分钟检查一次
  `);

  // 场景3: 动态调整配置
  console.log('\n场景3: 动态调整配置');
  console.log(`
// 根据时间段调整数据源优先级
function adjustPriorityByTime() {
  const hour = new Date().getHours();

  if (hour >= 9 && hour <= 15) {
    // 交易时间，提高国内数据源优先级
    dataSourceConfigManager.updateDataSourceConfig(DataSourceType.SINA, {
      priority: 95,
      weight: 90
    });
  } else {
    // 非交易时间，提高全球数据源优先级
    dataSourceConfigManager.updateDataSourceConfig(DataSourceType.YAHOO, {
      priority: 85,
      weight: 80
    });
  }
}
  `);
}

/**
 * 主函数 - 运行所有示例
 */
async function runAllExamples() {
  console.log('🚀 Alpha-Quant-Copilot 智能数据源选择器使用示例\n');

  try {
    await exampleBasicUsage();
    await exampleBatchUsage();
    await exampleMonitoring();
    await exampleHealthCheck();
    await exampleConfigManagement();
    await exampleAdvancedRouting();
    await exampleFailureSimulation();
    await exampleIntegration();

    console.log('\n🎉 所有示例运行完成！');
    console.log('\n下一步:');
    console.log('1. 查看 docs/DATA_SOURCE_SELECTOR.md 获取完整文档');
    console.log('2. 运行 npm run test:smart-selector 进行完整测试');
    console.log('3. 访问 /api/data-sources 查看数据源状态');
    console.log('4. 集成到你的应用中使用智能数据源选择器');

  } catch (error) {
    console.error('运行示例时发生错误:', error);
  }
}

// 运行示例
if (require.main === module) {
  runAllExamples().catch(console.error);
}

export {
  exampleBasicUsage,
  exampleBatchUsage,
  exampleMonitoring,
  exampleHealthCheck,
  exampleConfigManagement,
  exampleAdvancedRouting,
  exampleFailureSimulation,
  exampleIntegration,
  runAllExamples
};