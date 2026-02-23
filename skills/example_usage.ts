/**
 * Alpha-Quant-Copilot 爬虫使用示例
 * 演示如何使用 data_crawler 和 news_crawler
 */

// 使用动态导入来避免TypeScript模块问题
async function getDataCrawler() {
  return await import('./data_crawler.js');
}

async function getNewsCrawler() {
  return await import('./news_crawler.js');
}

/**
 * 示例1: 获取股票市场数据
 */
async function exampleStockData() {
  console.log('=== 股票市场数据示例 ===\n');

  try {
    // 获取data_crawler模块
    const dataCrawler = await getDataCrawler();
    const {
      fetchMarketDataWithFallback,
      fetchMultipleStocks,
      fetchTencentStockData
    } = dataCrawler;

    // 1. 使用回退机制获取单个股票数据
    console.log('1. 获取单个股票数据 (使用回退机制)...');
    const stockData = await fetchMarketDataWithFallback('000001.SZ');
    console.log('股票数据:', {
      代码: stockData.symbol,
      名称: stockData.name,
      当前价格: stockData.currentPrice,
      最高价: stockData.highPrice,
      最低价: stockData.lowPrice,
      更新时间: stockData.lastUpdateTime,
      涨跌: stockData.change,
      涨跌幅: stockData.changePercent + '%'
    });

    // 2. 获取多只股票数据
    console.log('\n2. 获取多只股票数据...');
    const multipleStocks = await fetchMultipleStocks(['000001', '600000', '000002']);
    console.log(`获取到 ${multipleStocks.length} 只股票数据`);
    multipleStocks.forEach((stock, index) => {
      console.log(`股票 ${index + 1}:`, {
        代码: stock.symbol,
        名称: stock.name,
        当前价格: stock.currentPrice,
        涨跌幅: stock.changePercent + '%',
        更新时间: stock.lastUpdateTime
      });
    });

    // 3. 测试腾讯API作为备用数据源
    console.log('\n3. 测试腾讯API数据...');
    try {
      const tencentData = await fetchTencentStockData('sh600000');
      console.log('腾讯API数据:', {
        代码: tencentData.symbol,
        名称: tencentData.name,
        当前价格: tencentData.currentPrice,
        最高价: tencentData.highPrice,
        最低价: tencentData.lowPrice,
        涨跌幅: tencentData.changePercent + '%'
      });
    } catch (error) {
      console.warn('腾讯API测试失败:', error instanceof Error ? error.message : String(error));
    }

  } catch (error) {
    console.error('股票数据示例出错:', error);
  }
}

/**
 * 示例2: 获取和分析新闻数据
 */
async function exampleNewsData() {
  console.log('\n=== 财经新闻数据示例 ===\n');

  try {
    // 配置新闻爬虫
    const newsConfig: NewsCrawlerConfig = {
      useMockData: true, // 设置为 false 使用真实API
      timeout: 10000,
      maxRetries: 2,
      logLevel: 'info'
    };

    // 1. 获取多源新闻
    console.log('1. 获取多源财经新闻...');
    const newsItems = await fetchNewsFromMultipleSources(
      ['A股', '市场', '投资'],
      ['sina', 'eastmoney'],
      newsConfig
    );
    console.log(`获取到 ${newsItems.length} 条新闻`);

    // 2. 按股票代码获取新闻
    console.log('\n2. 按股票代码获取新闻...');
    const stockNews = await fetchNewsByStockCode('000001', newsConfig);
    console.log(`股票 000001 相关新闻: ${stockNews.length} 条`);
    if (stockNews.length > 0) {
      console.log('最新相关新闻:', {
        标题: stockNews[0].title,
        来源: stockNews[0].source,
        情感: stockNews[0].sentiment,
        影响级别: stockNews[0].impactLevel,
        相关股票: stockNews[0].relatedStocks
      });
    }

    // 3. 按行业获取新闻
    console.log('\n3. 按行业获取新闻...');
    const industryNews = await fetchNewsByIndustry('人工智能', newsConfig);
    console.log(`人工智能行业新闻: ${industryNews.length} 条`);

    // 4. 分析新闻摘要
    console.log('\n4. 分析新闻摘要...');
    const analysis = analyzeNewsSummary(newsItems.slice(0, 20));
    console.log('新闻分析结果:');
    console.log('- 总体情感:', analysis.overallSentiment);
    console.log('- 关键主题:', analysis.keyThemes.slice(0, 5));
    console.log('- 高影响新闻数量:', analysis.highImpactNews.length);

    if (analysis.highImpactNews.length > 0) {
      console.log('- 高影响新闻示例:', analysis.highImpactNews[0].title);
    }

    // 5. 显示股票影响
    console.log('\n5. 股票影响分析:');
    const topStocks = Object.entries(analysis.stockImpact)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    topStocks.forEach(([stock, data]) => {
      console.log(`  ${stock}: ${data.count}条新闻，情感倾向: ${data.sentiment}`);
    });

  } catch (error) {
    console.error('新闻数据示例出错:', error);
  }
}

/**
 * 示例3: 整合数据与新闻分析
 */
async function exampleIntegratedAnalysis() {
  console.log('\n=== 数据与新闻整合分析示例 ===\n');

  try {
    // 获取data_crawler模块
    const dataCrawler = await getDataCrawler();
    const { fetchMarketDataWithFallback } = dataCrawler;

    // 获取股票数据
    console.log('获取股票数据...');
    const stockData = await fetchMarketDataWithFallback('000001.SZ');

    // 获取相关新闻
    console.log('获取相关新闻...');
    const newsConfig: NewsCrawlerConfig = { useMockData: true };
    const relatedNews = await fetchNewsByStockCode('000001', newsConfig);

    // 分析新闻情感
    const newsAnalysis = analyzeNewsSummary(relatedNews);

    // 整合分析报告
    console.log('\n整合分析报告:');
    console.log('='.repeat(50));
    console.log(`股票: ${stockData.name} (${stockData.symbol})`);
    console.log(`当前价格: ${stockData.currentPrice}`);
    console.log(`涨跌幅: ${stockData.changePercent || 0}%`);
    console.log(`相关新闻数量: ${relatedNews.length}条`);
    console.log(`新闻总体情感: ${newsAnalysis.overallSentiment}`);

    if (newsAnalysis.highImpactNews.length > 0) {
      console.log('\n高影响新闻:');
      newsAnalysis.highImpactNews.slice(0, 3).forEach((news, index) => {
        console.log(`  ${index + 1}. ${news.title}`);
        console.log(`     来源: ${news.source}, 情感: ${news.sentiment}`);
      });
    }

    // 投资建议（简单示例）
    console.log('\n初步分析建议:');
    const changePercent = stockData.changePercent || 0;
    if (changePercent > 0 && newsAnalysis.overallSentiment === 'positive') {
      console.log('✅ 正面信号: 股价上涨且新闻情感积极');
    } else if (changePercent < 0 && newsAnalysis.overallSentiment === 'negative') {
      console.log('⚠️  负面信号: 股价下跌且新闻情感消极');
    } else {
      console.log('➖ 中性信号: 需进一步分析');
    }

  } catch (error) {
    console.error('整合分析示例出错:', error);
  }
}

/**
 * 运行所有示例
 */
async function runAllExamples() {
  console.log('Alpha-Quant-Copilot 爬虫使用示例\n');

  await exampleStockData();
  await exampleNewsData();
  await exampleIntegratedAnalysis();

  console.log('\n=== 示例运行完成 ===');
}

/**
 * 运行测试
 */
async function runTests() {
  console.log('运行爬虫测试...\n');

  console.log('1. 测试数据爬虫...');
  const dataTestResult = await testDataCrawler();
  console.log(`数据爬虫测试: ${dataTestResult ? '通过' : '失败'}`);

  console.log('\n2. 测试新闻爬虫...');
  const newsTestResult = await testNewsCrawler();
  console.log(`新闻爬虫测试: ${newsTestResult ? '通过' : '失败'}`);

  console.log('\n=== 测试完成 ===');
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--test')) {
    await runTests();
  } else if (args.includes('--example')) {
    await runAllExamples();
  } else {
    console.log('使用方法:');
    console.log('  npm run dev -- --example    # 运行使用示例');
    console.log('  npm run dev -- --test       # 运行测试');
    console.log('\n或直接运行: node skills/example_usage.ts --example');
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch(error => {
    console.error('程序执行出错:', error);
    process.exit(1);
  });
}

// 导出函数供其他模块使用
export {
  runAllExamples,
  runTests,
  exampleStockData,
  exampleNewsData,
  exampleIntegratedAnalysis
};