// 测试CORS代理API
async function testStockProxyAPI() {
  console.log('测试股票数据代理API...\n');

  // 测试1: 正常请求
  console.log('测试1: 正常请求 (上证指数)');
  try {
    const response = await fetch('http://localhost:3000/api/stock?symbol=000001');
    console.log(`状态码: ${response.status}`);
    console.log(`CORS头: ${response.headers.get('Access-Control-Allow-Origin')}`);

    const data = await response.json();
    console.log(`成功: ${data.success}`);
    console.log(`符号: ${data.symbol} -> ${data.yahooSymbol}`);
    console.log(`数据源: ${data.source}`);
    console.log('---\n');
  } catch (error) {
    console.error('测试1失败:', error.message);
  }

  // 测试2: 缺少参数
  console.log('测试2: 缺少symbol参数');
  try {
    const response = await fetch('http://localhost:3000/api/stock');
    console.log(`状态码: ${response.status}`);
    console.log(`CORS头: ${response.headers.get('Access-Control-Allow-Origin')}`);

    const data = await response.json();
    console.log(`错误: ${data.error}`);
    console.log('---\n');
  } catch (error) {
    console.error('测试2失败:', error.message);
  }

  // 测试3: OPTIONS预检请求
  console.log('测试3: OPTIONS预检请求');
  try {
    const response = await fetch('http://localhost:3000/api/stock', {
      method: 'OPTIONS'
    });
    console.log(`状态码: ${response.status}`);
    console.log(`CORS头: ${response.headers.get('Access-Control-Allow-Origin')}`);
    console.log(`允许的方法: ${response.headers.get('Access-Control-Allow-Methods')}`);
    console.log(`允许的头部: ${response.headers.get('Access-Control-Allow-Headers')}`);
    console.log('---\n');
  } catch (error) {
    console.error('测试3失败:', error.message);
  }

  // 测试4: 深圳股票
  console.log('测试4: 深圳股票 (平安银行)');
  try {
    const response = await fetch('http://localhost:3000/api/stock?symbol=000001.SZ');
    console.log(`状态码: ${response.status}`);
    console.log(`CORS头: ${response.headers.get('Access-Control-Allow-Origin')}`);

    const data = await response.json();
    console.log(`成功: ${data.success}`);
    console.log(`符号: ${data.symbol} -> ${data.yahooSymbol}`);
    console.log('---\n');
  } catch (error) {
    console.error('测试4失败:', error.message);
  }

  console.log('测试完成！');
}

// 运行测试
testStockProxyAPI().catch(console.error);