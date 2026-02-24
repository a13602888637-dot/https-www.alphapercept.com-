# 搜索API代理中间层

## 概述

搜索API代理中间层是Alpha-Quant-Copilot项目的核心组件，用于解决海外IP访问中国金融数据API的限制问题。通过智能路由、多数据源支持和本地缓存，提供稳定可靠的股票搜索服务。

## 功能特性

### 1. 多数据源支持
- **新浪财经**：主数据源，覆盖全面
- **雪球**：备用数据源，对海外IP友好
- **东方财富**：备用数据源，数据准确
- **腾讯财经**：备用数据源，响应快速

### 2. 智能路由
- 根据客户端IP地理位置选择最优数据源
- 自动故障转移和重试机制
- 数据源健康状态监控

### 3. 代理服务
- 支持直接连接、HTTP代理、云函数代理
- 解决海外IP限制问题
- 可配置的超时和重试策略

### 4. 本地缓存
- 内存缓存，减少API调用
- 可配置的缓存时间和大小
- 自动清理过期缓存

### 5. 监控管理
- 服务状态查询
- 缓存管理
- 性能监控

## 架构设计

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   前端应用      │    │  搜索API代理     │    │   数据源API     │
│   (Vercel)      │───▶│   中间层         │───▶│   (新浪/雪球等) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                        ┌─────────────┐
                        │   本地缓存   │
                        └─────────────┘
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制环境变量模板：

```bash
cp lib/search-proxy/.env.example .env.local
```

编辑 `.env.local` 文件，配置开发环境：

```env
# 开发环境使用直接连接
SEARCH_PROXY_TYPE=direct

# 启用所有数据源
SEARCH_SOURCE_SINA_ENABLED=true
SEARCH_SOURCE_XUEQIU_ENABLED=true
SEARCH_SOURCE_EASTMONEY_ENABLED=true
SEARCH_SOURCE_TENCENT_ENABLED=true

# 启用缓存
SEARCH_CACHE_ENABLED=true
SEARCH_CACHE_TTL=300000
SEARCH_CACHE_MAX_SIZE=1000
```

### 运行测试

```bash
# 运行完整测试
npm run search:test

# 查看服务状态
npm run search:status
```

### 启动开发服务器

```bash
npm run dev
```

## API接口

### 搜索股票

```
GET /api/stocks/search?q={query}&source={source}
```

**参数**：
- `q`：搜索关键词（必需）
- `source`：指定数据源（可选，如：sina、xueqiu、tencent）

**响应**：
```json
{
  "success": true,
  "data": [
    {
      "code": "600519",
      "name": "贵州茅台",
      "market": "SH"
    }
  ],
  "count": 1,
  "query": "茅台",
  "source": "sina",
  "cached": false,
  "metadata": {
    "responseTime": 120,
    "sourcesTried": ["sina"],
    "fallbackUsed": false
  }
}
```

### 管理端点

```
POST /api/stocks/search?action={action}
```

**支持的操作**：
- `status`：获取服务状态
- `clear-cache`：清空缓存
- `cleanup-cache`：清理过期缓存

## 配置说明

### 数据源配置

在 `lib/search-proxy/config.ts` 中配置数据源：

```typescript
export const SEARCH_SOURCES: Record<string, SearchSourceConfig> = {
  sina: {
    name: 'sina',
    url: 'https://suggest3.sinajs.cn/quotes/v1/sugg',
    enabled: true,
    priority: 1,
    timeout: 8000,
    retryCount: 2,
    headers: { /* ... */ },
    parser: parseSinaResponse,
  },
  // 其他数据源...
};
```

### 缓存配置

```typescript
export const CACHE_CONFIG: CacheConfig = {
  enabled: true,
  ttl: 5 * 60 * 1000, // 5分钟
  maxSize: 1000, // 最多缓存1000个查询
};
```

### 代理配置

```typescript
export const PROXY_CONFIG: ProxyConfig = {
  enabled: true,
  type: 'cloud-function', // direct, proxy, cloud-function
  cloudFunctionUrl: 'https://your-cloud-function.com/api/search-proxy',
  timeout: 10000,
};
```

## 部署指南

### 云函数代理部署

1. **选择云服务商**：阿里云、腾讯云、华为云等
2. **部署云函数**：参考 `DEPLOYMENT.md`
3. **配置域名**：绑定自定义域名和SSL证书
4. **设置环境变量**：配置数据源和安全性

### 生产环境配置

在Vercel项目设置中添加环境变量：

```env
# 代理配置
SEARCH_PROXY_TYPE=cloud-function
SEARCH_PROXY_CLOUD_FUNCTION_URL=https://proxy.yourdomain.com/api/search-proxy

# 数据源配置
SEARCH_SOURCE_SINA_ENABLED=true
SEARCH_SOURCE_XUEQIU_ENABLED=true

# 缓存配置
SEARCH_CACHE_ENABLED=true
SEARCH_CACHE_TTL=300000
```

## 性能优化

### 缓存策略

1. **热点数据预加载**：预加载热门搜索词
2. **缓存分级**：根据查询频率设置不同TTL
3. **分布式缓存**：生产环境使用Redis

### 代理优化

1. **代理池**：使用多个代理服务器轮换
2. **智能选择**：根据响应时间选择最优代理
3. **健康检查**：定期检查代理服务器状态

### 数据源优化

1. **地理位置路由**：根据用户位置选择最近的数据源
2. **负载均衡**：在多个数据源间分配请求
3. **降级策略**：优雅降级到本地数据

## 监控告警

### 关键指标

1. **成功率**：`成功请求数 / 总请求数`
2. **响应时间**：P50、P95、P99响应时间
3. **缓存命中率**：`缓存命中数 / 总请求数`
4. **数据源健康度**：各数据源的成功率

### 告警规则

1. **成功率下降**：成功率 < 95% 持续5分钟
2. **响应时间增加**：P95响应时间 > 2000ms
3. **缓存命中率低**：命中率 < 50% 持续10分钟
4. **数据源故障**：某个数据源连续失败10次

## 故障排除

### 常见问题

#### 1. 搜索无结果

**可能原因**：
- 数据源API限制
- 网络连接问题
- 查询格式错误

**解决方案**：
- 检查数据源配置
- 查看网络连接
- 验证查询参数

#### 2. 响应缓慢

**可能原因**：
- 数据源API响应慢
- 网络延迟高
- 缓存未命中

**解决方案**：
- 启用更多数据源
- 优化代理配置
- 调整缓存策略

#### 3. 代理连接失败

**可能原因**：
- 代理服务器故障
- 网络防火墙限制
- 配置错误

**解决方案**：
- 检查代理服务器状态
- 验证网络配置
- 更新代理配置

### 调试方法

1. **查看日志**：
```bash
# 查看搜索服务日志
npm run search:test

# 查看API响应详情
curl -v "https://alpha-quant-copilot.vercel.app/api/stocks/search?q=茅台"
```

2. **检查状态**：
```bash
# 查看服务状态
npm run search:status

# 检查缓存状态
curl -X POST "https://alpha-quant-copilot.vercel.app/api/stocks/search?action=status"
```

3. **清理缓存**：
```bash
# 清理缓存
curl -X POST "https://alpha-quant-copilot.vercel.app/api/stocks/search?action=clear-cache"
```

## 版本历史

### v1.0.0 (2026-02-24)
- 初始版本发布
- 支持多数据源搜索
- 实现智能路由和缓存
- 提供代理服务解决海外IP限制

### v1.1.0 (计划中)
- 支持Redis分布式缓存
- 添加数据源健康检查
- 实现请求限流和熔断
- 添加详细监控指标

## 贡献指南

### 开发流程

1. **创建分支**：`git checkout -b feature/your-feature`
2. **开发测试**：编写代码和测试用例
3. **代码审查**：提交Pull Request
4. **合并部署**：通过审查后合并到主分支

### 代码规范

1. **TypeScript**：使用严格类型检查
2. **代码风格**：遵循项目ESLint配置
3. **测试覆盖**：新增功能需包含测试用例
4. **文档更新**：更新相关文档

### 提交规范

```
feat: 添加新功能
fix: 修复bug
docs: 更新文档
style: 代码格式调整
refactor: 代码重构
test: 添加测试
chore: 构建过程或辅助工具变动
```

## 许可证

MIT License

## 联系方式

- **项目仓库**：https://github.com/your-repo/alpha-quant-copilot
- **问题反馈**：https://github.com/your-repo/alpha-quant-copilot/issues
- **文档网站**：https://alpha-quant-copilot-docs.vercel.app

---

**最后更新**：2026-02-24
**维护团队**：Alpha-Quant-Copilot开发团队