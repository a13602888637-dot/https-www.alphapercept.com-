// 测试股票搜索API
async function testSearchAPI() {
  console.log('测试股票搜索API...')

  // 测试空查询
  console.log('\n1. 测试空查询:')
  const emptyResponse = await fetch('http://localhost:3000/api/stocks/search?q=')
  const emptyData = await emptyResponse.json()
  console.log('状态:', emptyResponse.status)
  console.log('数据:', JSON.stringify(emptyData, null, 2))

  // 测试平安银行查询
  console.log('\n2. 测试"平安"查询:')
  const pinganResponse = await fetch('http://localhost:3000/api/stocks/search?q=平安')
  const pinganData = await pinganResponse.json()
  console.log('状态:', pinganResponse.status)
  console.log('数据:', JSON.stringify(pinganData, null, 2))

  // 测试代码查询
  console.log('\n3. 测试"000001"查询:')
  const codeResponse = await fetch('http://localhost:3000/api/stocks/search?q=000001')
  const codeData = await codeResponse.json()
  console.log('状态:', codeResponse.status)
  console.log('数据:', JSON.stringify(codeData, null, 2))

  // 测试市场查询
  console.log('\n4. 测试"SZ"查询:')
  const marketResponse = await fetch('http://localhost:3000/api/stocks/search?q=SZ')
  const marketData = await marketResponse.json()
  console.log('状态:', marketResponse.status)
  console.log('数据:', JSON.stringify(marketData, null, 2))
}

// 运行测试
testSearchAPI().catch(console.error)