# 搜索API代理中间层部署指南

## 概述

搜索API代理中间层用于解决Alpha-Quant-Copilot项目中搜索API的海外IP限制问题。通过国内服务器或第三方代理中转搜索请求，支持多个备用搜索源，实现智能路由和本地缓存。

## 架构设计

```
前端应用 (Vercel) → 搜索API代理中间层 → 国内云函数代理 → 数据源API
                              ↓
                          本地缓存
                              ↓
                         智能路由引擎
```

## 部署步骤

### 1. 本地开发环境配置

#### 1.1 环境变量配置

复制环境变量模板文件：

```bash
cp lib/search-proxy/.env.example .env.local
```

编辑 `.env.local` 文件，配置开发环境变量：

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

# 日志级别
SEARCH_LOG_LEVEL=debug
```

#### 1.2 安装依赖

确保项目依赖已安装：

```bash
npm install
```

#### 1.3 启动开发服务器

```bash
npm run dev
```

### 2. 云函数代理部署（生产环境）

#### 2.1 选择云服务提供商

推荐使用以下国内云服务：

1. **阿里云函数计算**：https://www.aliyun.com/product/fc
2. **腾讯云函数**：https://cloud.tencent.com/product/scf
3. **华为云函数**：https://www.huaweicloud.com/product/functiongraph.html

#### 2.2 部署云函数

##### 方案A：使用Serverless Framework（推荐）

1. 安装Serverless Framework：

```bash
npm install -g serverless
```

2. 创建 `serverless.yml` 配置文件：

```yaml
# serverless.yml
service: search-proxy

provider:
  name: aliyun
  runtime: nodejs18
  region: cn-hangzhou
  credentials: ~/.aliyun/credentials

functions:
  proxy:
    handler: index.handler
    events:
      - http:
          path: /api/search-proxy
          method: post
      - http:
          path: /health
          method: get
      - http:
          path: /test
          method: get

plugins:
  - serverless-aliyun-function-compute
```

3. 创建云函数入口文件 `index.js`：

```javascript
// index.js - 云函数入口文件
const { cloudFunctionHandler, healthCheckHandler, testHandler } = require('./lib/search-proxy/cloud-function');

exports.handler = async (req, res) => {
  const { path, method, body } = req;

  try {
    let result;

    switch (path) {
      case '/api/search-proxy':
        if (method === 'POST') {
          const request = {
            method: 'POST',
            headers: req.headers,
            json: () => Promise.resolve(body),
          };
          result = await cloudFunctionHandler(request);
        } else {
          result = { status: 405, body: { error: 'Method not allowed' } };
        }
        break;

      case '/health':
        result = await healthCheckHandler();
        break;

      case '/test':
        result = await testHandler();
        break;

      default:
        result = { status: 404, body: { error: 'Not found' } };
    }

    res.setStatusCode(result.status || 200);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(result.body || result));

  } catch (error) {
    res.setStatusCode(500);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ error: error.message }));
  }
};
```

4. 部署云函数：

```bash
serverless deploy
```

##### 方案B：使用云服务商控制台

1. 登录云服务商控制台
2. 创建函数计算服务
3. 上传代码包（包含 `lib/search-proxy` 目录）
4. 配置函数入口
5. 设置环境变量
6. 配置HTTP触发器

#### 2.3 配置云函数环境变量

在云函数控制台设置环境变量：

```env
# 安全配置
NODE_ENV=production
SEARCH_API_KEY=your-secure-api-key

# 数据源配置
SEARCH_SOURCE_SINA_ENABLED=true
SEARCH_SOURCE_XUEQIU_ENABLED=true
SEARCH_SOURCE_EASTMONEY_ENABLED=true
SEARCH_SOURCE_TENCENT_ENABLED=true

# CORS配置
SEARCH_ALLOWED_ORIGINS=https://alpha-quant-copilot.vercel.app

# 日志配置
SEARCH_LOG_LEVEL=info
```

#### 2.4 绑定自定义域名

1. 申请域名（如 `proxy.yourdomain.com`）
2. 配置DNS解析到云函数
3. 申请SSL证书（免费证书推荐Let's Encrypt）
4. 在云函数配置中绑定域名和证书

#### 2.5 获取云函数地址

部署完成后，获取云函数的公网访问地址，如：
- `https://proxy.yourdomain.com/api/search-proxy`

### 3. 主应用配置更新

#### 3.1 更新环境变量

在Vercel项目设置中，添加以下环境变量：

```env
# 搜索代理配置
SEARCH_PROXY_TYPE=cloud-function
SEARCH_PROXY_CLOUD_FUNCTION_URL=https://proxy.yourdomain.com/api/search-proxy
SEARCH_PROXY_TIMEOUT=10000

# 缓存配置
SEARCH_CACHE_ENABLED=true
SEARCH_CACHE_TTL=300000
SEARCH_CACHE_MAX_SIZE=1000

# 数据源配置
SEARCH_SOURCE_SINA_ENABLED=true
SEARCH_SOURCE_XUEQIU_ENABLED=true
SEARCH_SOURCE_EASTMONEY_ENABLED=true
SEARCH_SOURCE_TENCENT_ENABLED=true
```

#### 3.2 重新部署主应用

```bash
# 提交代码
git add .
git commit -m "feat: 集成搜索API代理中间层"
git push

# Vercel会自动部署
```

### 4. 测试部署

#### 4.1 测试云函数代理

访问健康检查端点：
```
GET https://proxy.yourdomain.com/health
```

测试代理功能：
```
GET https://proxy.yourdomain.com/test
```

#### 4.2 测试搜索API

使用curl测试搜索API：

```bash
# 测试搜索功能
curl "https://alpha-quant-copilot.vercel.app/api/stocks/search?q=茅台"

# 测试指定数据源
curl "https://alpha-quant-copilot.vercel.app/api/stocks/search?q=茅台&source=xueqiu"

# 测试管理端点
curl -X POST "https://alpha-quant-copilot.vercel.app/api/stocks/search?action=status"
```

#### 4.3 监控日志

查看云函数日志：
- 阿里云：函数计算控制台 → 日志查询
- 腾讯云：云函数控制台 → 日志管理
- 华为云：函数工作流控制台 → 日志

查看Vercel日志：
- Vercel Dashboard → 项目 → 函数日志

## 故障排除

### 常见问题

#### 1. 云函数连接超时

**症状**：搜索API返回超时错误
**解决方案**：
- 检查云函数是否正常运行
- 检查网络连接是否正常
- 增加超时时间配置

#### 2. CORS错误

**症状**：浏览器控制台显示CORS错误
**解决方案**：
- 检查 `SEARCH_ALLOWED_ORIGINS` 配置
- 确保云函数返回正确的CORS头
- 检查域名配置

#### 3. 数据源API限制

**症状**：某些数据源返回403或429错误
**解决方案**：
- 降低请求频率
- 启用更多备用数据源
- 使用代理轮换

#### 4. 缓存不生效

**症状**：每次请求都调用数据源API
**解决方案**：
- 检查 `SEARCH_CACHE_ENABLED` 配置
- 检查缓存TTL设置
- 查看缓存统计信息

### 监控指标

建议监控以下指标：

1. **成功率**：搜索请求的成功率
2. **响应时间**：平均响应时间
3. **缓存命中率**：缓存命中比例
4. **数据源使用情况**：各数据源的使用频率
5. **错误率**：各数据源的错误率

### 性能优化建议

1. **缓存优化**：
   - 根据查询频率调整缓存TTL
   - 使用分布式缓存（如Redis）替代内存缓存
   - 实现缓存预热机制

2. **代理优化**：
   - 使用多个代理服务器轮换
   - 实现智能代理选择
   - 监控代理服务器健康状态

3. **数据源优化**：
   - 根据地理位置选择最优数据源
   - 实现数据源健康检查
   - 配置数据源权重

## 维护指南

### 日常维护

1. **监控日志**：定期检查错误日志
2. **清理缓存**：定期清理过期缓存
3. **更新数据源**：及时更新数据源配置
4. **备份配置**：定期备份环境变量配置

### 版本升级

1. **测试环境**：先在测试环境验证新版本
2. **灰度发布**：逐步切换流量到新版本
3. **回滚计划**：准备快速回滚方案
4. **文档更新**：更新部署和维护文档

### 安全维护

1. **API密钥轮换**：定期轮换API密钥
2. **访问控制**：限制云函数访问权限
3. **日志审计**：定期审计访问日志
4. **漏洞扫描**：定期进行安全扫描

## 成本估算

### 云函数成本（以阿里云为例）

- **调用次数**：假设每天10,000次搜索
- **执行时间**：每次平均500ms
- **内存配置**：512MB
- **月成本**：约 $5-10

### 域名和证书成本

- **域名**：$10-20/年
- **SSL证书**：免费（Let's Encrypt）

### 总成本估算

- **月成本**：$5-15
- **年成本**：$60-180

## 联系方式

如有问题，请联系：

- **项目负责人**：[姓名]
- **技术支持**：[邮箱]
- **紧急联系人**：[电话]

---

**文档版本**：1.0
**最后更新**：2026-02-24
**更新记录**：初始版本