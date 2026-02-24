# 股票数据代理API使用指南

## API端点

```
GET /api/stock?symbol=<股票代码>
```

## 功能说明

该API是一个服务器端代理，用于解决前端直接调用Yahoo Finance API时的CORS（跨域资源共享）限制问题。通过在服务端执行fetch请求，避免了浏览器的同源策略限制。

## 参数说明

### 必需参数
- `symbol`: 股票代码（支持多种格式）

### 支持的股票代码格式
1. **纯数字代码**：`000001`（自动识别为上证指数）
2. **带交易所前缀**：`sh000001` 或 `sz000001`
3. **带交易所后缀**：`000001.SS` 或 `000001.SZ`
4. **Yahoo Finance格式**：`000001.SS` 或 `000001.SZ`

## 响应格式

### 成功响应 (200 OK)
```json
{
  "success": true,
  "data": { ... }, // Yahoo Finance原始数据
  "symbol": "000001", // 原始请求的股票代码
  "yahooSymbol": "000001.SS", // 转换后的Yahoo Finance格式
  "source": "yahoo-finance-proxy",
  "timestamp": "2026-02-24T10:30:00.000Z"
}
```

### 错误响应

#### 400 Bad Request (缺少参数)
```json
{
  "error": "Symbol parameter is required"
}
```

#### 500 Internal Server Error (代理失败)
```json
{
  "success": false,
  "error": "Failed to fetch data from Yahoo Finance",
  "details": "具体的错误信息",
  "timestamp": "2026-02-24T10:30:00.000Z"
}
```

## CORS支持

API完全支持CORS，设置了以下响应头：
- `Access-Control-Allow-Origin: *`（允许所有域名访问）
- `Access-Control-Allow-Methods: GET, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

### OPTIONS预检请求
API支持OPTIONS方法用于CORS预检请求，返回允许的HTTP方法和头部信息。

## 使用示例

### 前端调用示例
```javascript
// 使用fetch API
async function fetchStockData(symbol) {
  try {
    const response = await fetch(`/api/stock?symbol=${symbol}`);

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      // 处理Yahoo Finance数据
      console.log('股票数据:', data.data);
      return data.data;
    } else {
      throw new Error(data.error || '获取数据失败');
    }
  } catch (error) {
    console.error('获取股票数据失败:', error);
    throw error;
  }
}

// 使用示例
fetchStockData('000001'); // 上证指数
fetchStockData('sh000001'); // 带前缀的上证指数
fetchStockData('000001.SS'); // 带后缀的上证指数
```

### cURL测试
```bash
# 测试正常请求
curl "http://localhost:3000/api/stock?symbol=000001"

# 测试OPTIONS预检请求
curl -X OPTIONS "http://localhost:3000/api/stock" -H "Origin: http://example.com"

# 测试错误请求（缺少参数）
curl "http://localhost:3000/api/stock"
```

## 技术特点

1. **CORS解决方案**：完全解决浏览器跨域限制
2. **符号自动转换**：自动将中国A股代码转换为Yahoo Finance格式
3. **错误处理**：完善的错误处理和用户友好的错误信息
4. **超时控制**：30秒请求超时，避免长时间等待
5. **缓存控制**：设置60秒缓存，减少重复请求
6. **代理支持**：支持通过环境变量配置HTTP代理

## 环境变量配置

```bash
# 配置HTTP代理（如果需要）
HTTPS_PROXY=http://127.0.0.1:1087
```

## 注意事项

1. **API限制**：Yahoo Finance API可能有访问频率限制
2. **数据延迟**：Yahoo Finance数据可能有15分钟延迟
3. **错误处理**：建议前端添加适当的错误处理和重试机制
4. **缓存策略**：根据业务需求调整缓存时间

## 故障排除

### 常见问题

1. **CORS错误仍然出现**
   - 检查API是否正在运行
   - 检查响应头是否正确设置
   - 确保使用正确的API端点

2. **获取数据失败**
   - 检查网络连接
   - 验证股票代码格式
   - 检查Yahoo Finance API状态

3. **响应缓慢**
   - 可能是网络问题
   - Yahoo Finance API可能响应慢
   - 考虑增加超时时间

### 调试方法
```javascript
// 添加调试信息
fetch(`/api/stock?symbol=000001`)
  .then(response => {
    console.log('状态码:', response.status);
    console.log('响应头:', Object.fromEntries(response.headers.entries()));
    return response.json();
  })
  .then(data => console.log('响应数据:', data))
  .catch(error => console.error('请求错误:', error));
```

## 更新日志

### v1.0.0 (2026-02-24)
- 初始版本发布
- 实现基本的股票数据代理功能
- 完整的CORS支持
- 符号自动转换逻辑
- 错误处理和超时控制