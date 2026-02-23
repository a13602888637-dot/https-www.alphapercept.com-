#!/usr/bin/env node

/**
 * 测试自选股实时数据存储系统
 */

const https = require('https');
const http = require('http');

const API_BASE = 'http://localhost:3000/api';

async function testStockPriceAPI() {
  console.log('🚀 测试自选股实时数据存储系统\n');

  try {
    // 1. 测试获取股票价格（同时会存储到数据库）
    console.log('1. 测试获取股票价格API...');
    const symbols = ['000001', '600000', '000002'];
    const priceResponse = await fetch(`${API_BASE}/stock-prices?symbols=${symbols.join(',')}`);

    if (priceResponse.ok) {
      const priceData = await priceResponse.json();
      console.log(`✅ 成功获取 ${Object.keys(priceData.prices).length} 个股票价格`);
      console.log(`   时间戳: ${priceData.timestamp}`);
      console.log(`   存储状态: ${priceData.success ? '✅ 已存储到数据库' : '❌ 存储失败'}`);

      // 显示价格信息
      Object.entries(priceData.prices).forEach(([symbol, data]) => {
        console.log(`   ${symbol}: ¥${data.price} (${data.changePercent > 0 ? '+' : ''}${data.changePercent}%)`);
      });
    } else {
      console.log('❌ 获取股票价格失败:', await priceResponse.text());
    }

    console.log('\n2. 测试股票价格历史API...');
    // 2. 测试获取历史价格数据
    const historyResponse = await fetch(`${API_BASE}/stock-price-history?stockCode=000001&interval=day&limit=10`);

    if (historyResponse.ok) {
      const historyData = await historyResponse.json();
      console.log(`✅ 成功获取 ${historyData.stockCode} 的历史价格数据`);
      console.log(`   数据点数量: ${historyData.data.length}`);
      console.log(`   时间范围: ${historyData.dateRange.start} 到 ${historyData.dateRange.end}`);

      if (historyData.data.length > 0) {
        const latest = historyData.data[historyData.data.length - 1];
        console.log(`   最新数据: ${latest.timestamp} - ¥${latest.price}`);

        // 显示趋势分析
        console.log(`   趋势分析: ${historyData.analysis.trend} (强度: ${historyData.analysis.strength})`);
        console.log(`   支撑位: ${historyData.analysis.support || '无'}`);
        console.log(`   阻力位: ${historyData.analysis.resistance || '无'}`);
      }
    } else {
      console.log('❌ 获取历史价格失败:', await historyResponse.text());
    }

    console.log('\n3. 测试自选股API...');
    // 3. 测试自选股功能（需要认证，这里只测试接口是否存在）
    const watchlistResponse = await fetch(`${API_BASE}/watchlist`);

    if (watchlistResponse.status === 401) {
      console.log('✅ 自选股API需要认证（正常）');
    } else if (watchlistResponse.ok) {
      const watchlistData = await watchlistResponse.json();
      console.log(`✅ 成功获取自选股，数量: ${watchlistData.watchlist.length}`);
    } else {
      console.log('⚠️  自选股API返回:', watchlistResponse.status, await watchlistResponse.text());
    }

    console.log('\n🎉 测试完成！');
    console.log('\n📋 下一步:');
    console.log('   1. 启动调度器: npm run scheduler:start');
    console.log('   2. 查看调度器状态: npm run scheduler:status');
    console.log('   3. 手动触发价格更新: node scheduler/main.ts trigger-watchlist-price');
    console.log('   4. 访问历史价格API: http://localhost:3000/api/stock-price-history?stockCode=000001');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.log('\n🔧 故障排除:');
    console.log('   1. 确保服务器正在运行: npm run next:dev');
    console.log('   2. 检查数据库连接');
    console.log('   3. 检查环境变量配置');
  }
}

// 简单的fetch实现
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const response = {
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          text: () => Promise.resolve(data),
          json: () => Promise.resolve(JSON.parse(data))
        };
        resolve(response);
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

// 运行测试
if (require.main === module) {
  testStockPriceAPI().catch(console.error);
}

module.exports = { testStockPriceAPI };