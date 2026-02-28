# K线数据服务快速启动指南

## 5分钟快速开始

### 1. 启动开发服务器

```bash
npm run dev
```

### 2. 测试API端点

打开浏览器访问：

```
http://localhost:3000/api/kline?code=600519&timeframe=daily&limit=10
```

应该看到类似的响应：

```json
{
  "success": true,
  "data": [
    {
      "time": "2024-02-28",
      "open": 1680.00,
      "high": 1698.50,
      "low": 1675.20,
      "close": 1690.30,
      "volume": 125000
    }
  ],
  "source": "sina",
  "cached": false
}
```

### 3. 在组件中使用

创建一个简单的测试页面 `app/test-kline/page.tsx`：

```typescript
'use client';

import { useEffect, useState } from 'react';

export default function TestKLinePage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/kline?code=600519&timeframe=daily&limit=10')
      .then(res => res.json())
      .then(setData);
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">K线数据测试</h1>
      <pre className="bg-gray-100 p-4 rounded">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
```

访问：http://localhost:3000/test-kline

### 4. 支持的时间周期

- `5m` - 5分钟K线
- `15m` - 15分钟K线
- `30m` - 30分钟K线
- `60m` - 60分钟K线
- `daily` - 日K线（默认）
- `weekly` - 周K线
- `monthly` - 月K线

### 5. 常用股票代码

测试时可以使用：

- `600519` - 贵州茅台
- `000001` - 平安银行
- `000333` - 美的集团
- `300750` - 宁德时代
- `002415` - 海康威视
- `601318` - 中国平安

### 6. 验证缓存功能

连续两次访问同一URL，第二次应该更快：

```bash
# 第一次（调用API）
time curl "http://localhost:3000/api/kline?code=600519&timeframe=daily&limit=50"

# 第二次（使用缓存）
time curl "http://localhost:3000/api/kline?code=600519&timeframe=daily&limit=50"
```

第二次应该显示 `"cached": true`。

### 7. 查看服务器日志

开发服务器会输出详细日志：

```
[Sina API] Fetching: http://money.finance.sina.com.cn/...
[Sina API] Fetched 200 data points for 600519
[Cache] Set: 600519:daily (TTL: 1800s, points: 200)
[Cache] Hit: 600519:daily (age: 5s)
```

### 8. 常见问题

**Q: API返回Mock数据？**

A: 检查：
1. 网络连接是否正常
2. 新浪财经API是否可访问
3. 查看服务器错误日志

**Q: 缓存不生效？**

A: 确保：
1. stockCode和timeFrame完全一致
2. 缓存未过期（查看TTL）
3. 服务器未重启

**Q: 数据格式错误？**

A: 验证：
1. 响应包含success字段
2. data是数组
3. 每个数据点包含time, open, high, low, close, volume

## 下一步

- 阅读 [README.md](./README.md) 了解详细API文档
- 查看 [usage-example.tsx](./usage-example.tsx) 学习组件集成
- 参考 [TESTING.md](./TESTING.md) 进行完整测试
- 查看 [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) 了解实现细节

## 快速命令参考

```bash
# 测试日K
curl "http://localhost:3000/api/kline?code=600519&timeframe=daily&limit=10"

# 测试周K
curl "http://localhost:3000/api/kline?code=600519&timeframe=weekly&limit=10"

# 测试5分钟K
curl "http://localhost:3000/api/kline?code=600519&timeframe=5m&limit=10"

# 测试错误处理
curl "http://localhost:3000/api/kline"
curl "http://localhost:3000/api/kline?code=600519&timeframe=invalid"
```

---

**准备好了吗？** 现在你可以开始集成K线数据到你的图表组件了！
