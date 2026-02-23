/**
 * Alpha-Quant-Copilot 爬虫使用示例（简化版）
 * 演示如何使用 data_crawler 和 news_crawler
 */

// 由于TypeScript模块导入问题，我们使用动态导入
async function runExample() {
  console.log('Alpha-Quant-Copilot 爬虫使用示例\n');

  try {
    // 动态导入模块
    const dataCrawler = await import('./data_crawler.js');
    const newsCrawler = await import('./news_crawler.js');

    console.log('=== 股票市场数据示例 ===\n');

    // 1. 使用回退机制获取单个股票数据
    console.log('1. 获取单个股票数据 (使用回退机制)...');
    try {
      const stockData = await dataCrawler.fetchMarketDataWithFallback('000001.SZ');
      console.log('股票数据:', {
        代码: stockData.symbol,
        名称: stockData.name,
        当前价格: stockData.currentPrice,
        最高价: stockData.highPrice,
        最低价: stockData.lowPrice,
        更新时间: stockData.lastUpdateTime,
        涨跌: stockData.change,
        涨跌幅: (stockData.changePercent || 0) + '%'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log('⚠️  股票数据获取失败（可能是TUSHARE_TOKEN未设置）:', errorMessage);
      console.log('提示: 请检查.env.local文件中的TUSHARE_TOKEN配置');
    }

    // 2. 获取模拟新闻数据
    console.log('\n=== 财经新闻数据示例 ===\n');

    const newsConfig = {
      useMockData: true, // 使用模拟数据避免网络问题
      timeout: 10000,
      maxRetries: 2,
      logLevel: 'info' as const
    };

    console.log('1. 获取模拟新闻数据...');
    const newsItems = await newsCrawler.fetchNewsFromMultipleSources(
      ['A股', '市场', '投资'],
      ['sina', 'eastmoney'],
      newsConfig
    );
    console.log(`获取到 ${newsItems.length} 条模拟新闻`);

    if (newsItems.length > 0) {
      console.log('最新新闻示例:', {
        标题: newsItems[0].title,
        来源: newsItems[0].source,
        情感: newsItems[0].sentiment,
        影响级别: newsItems[0].impactLevel,
        相关股票: newsItems[0].relatedStocks
      });
    }

    // 3. 分析新闻摘要
    console.log('\n2. 分析新闻摘要...');
    const analysis = newsCrawler.analyzeNewsSummary(newsItems.slice(0, 10));
    console.log('新闻分析结果:');
    console.log('- 总体情感:', analysis.overallSentiment);
    console.log('- 关键主题:', analysis.keyThemes.slice(0, 5));
    console.log('- 高影响新闻数量:', analysis.highImpactNews.length);

    // 4. 按股票代码获取新闻
    console.log('\n3. 按股票代码获取新闻...');
    const stockNews = await newsCrawler.fetchNewsByStockCode('000001', newsConfig);
    console.log(`股票 000001 相关新闻: ${stockNews.length} 条`);

    console.log('\n=== 整合分析示例 ===\n');

    // 简单的整合分析
    console.log('假设分析结果:');
    console.log('1. 如果股价上涨且新闻情感积极 → 考虑买入');
    console.log('2. 如果股价下跌且新闻情感消极 → 考虑卖出或观望');
    console.log('3. 如果信号矛盾 → 需要进一步分析');
    console.log('\n实际决策应结合更多技术指标和基本面分析。');

    console.log('\n=== 运行测试 ===\n');

    // 运行测试
    console.log('运行数据爬虫测试...');
    try {
      const dataTestResult = await dataCrawler.testDataCrawler();
      console.log(`数据爬虫测试: ${dataTestResult ? '通过' : '失败'}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`数据爬虫测试失败: ${errorMessage}`);
    }

    console.log('\n运行新闻爬虫测试...');
    try {
      const newsTestResult = await newsCrawler.testNewsCrawler();
      console.log(`新闻爬虫测试: ${newsTestResult ? '通过' : '失败'}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`新闻爬虫测试失败: ${errorMessage}`);
    }

    console.log('\n=== 使用说明 ===\n');
    console.log('1. 配置环境变量:');
    console.log('   - 在 .env.local 中设置 TUSHARE_TOKEN');
    console.log('   - 格式: TUSHARE_TOKEN=your_token_here');
    console.log('\n2. 运行数据爬虫测试:');
    console.log('   npx ts-node skills/data_crawler.ts');
    console.log('\n3. 运行新闻爬虫测试:');
    console.log('   npx ts-node skills/news_crawler.ts');
    console.log('\n4. 在代码中使用:');
    console.log('   import { fetchMarketDataWithFallback } from "./skills/data_crawler";');
    console.log('   import { fetchNewsFromMultipleSources } from "./skills/news_crawler";');

    console.log('\n=== 示例运行完成 ===');

  } catch (error) {
    console.error('示例运行出错:', error);
    console.log('\n常见问题解决:');
    console.log('1. 确保已安装依赖: npm install');
    console.log('2. 确保TypeScript配置正确');
    console.log('3. 检查文件路径和导入语句');
  }
}

// 运行示例
runExample().catch(error => {
  console.error('程序执行出错:', error);
  process.exit(1);
});