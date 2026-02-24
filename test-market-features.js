/**
 * Test script for market index and northbound capital features
 */

const { fetchMultipleStocks } = require('./skills/data_crawler.ts');

async function testMarketFeatures() {
  console.log('=== Testing Market Index and Northbound Capital Features ===\n');

  try {
    // Test A-share indices
    console.log('1. Testing A-share indices...');
    const indices = ['000001', '399001', '399006'];
    const indexResults = await fetchMultipleStocks(indices, 1);

    indexResults.forEach((data, index) => {
      console.log(`  ${['上证指数', '深证成指', '创业板指'][index]}:`);
      console.log(`    Symbol: ${data.symbol}`);
      console.log(`    Name: ${data.name}`);
      console.log(`    Price: ${data.currentPrice}`);
      console.log(`    Change: ${data.change} (${data.changePercent}%)`);
      console.log(`    Time: ${data.lastUpdateTime}`);
      console.log('');
    });

    // Test northbound capital
    console.log('2. Testing northbound capital data...');
    const northboundResult = await fetchMultipleStocks(['NORTHBOUND'], 1);
    const northboundData = northboundResult[0];

    console.log(`  ${northboundData.name}:`);
    console.log(`    Symbol: ${northboundData.symbol}`);
    console.log(`    Net Flow: ${northboundData.currentPrice}亿`);
    console.log(`    Shanghai Net: ${northboundData.volume}亿`);
    console.log(`    Shenzhen Net: ${northboundData.turnover}亿`);
    console.log(`    Change: ${northboundData.change}`);
    console.log(`    Time: ${northboundData.lastUpdateTime}`);
    console.log('');

    // Test market status
    console.log('3. Testing market status...');
    const { isMarketOpen } = require('./lib/market-indicators.ts');
    const marketOpen = isMarketOpen();
    console.log(`  Market is ${marketOpen ? 'OPEN' : 'CLOSED'}`);
    console.log('');

    console.log('=== Test Completed Successfully ===');

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run test
testMarketFeatures();