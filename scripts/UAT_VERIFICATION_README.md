# Alpha-Quant-Copilot UAT验证脚本使用说明

## 概述

`verify_uat.sh` 是一个完整的用户验收测试（UAT）验证脚本，用于验证Alpha-Quant-Copilot系统的完整数据流转。该脚本模拟从数据采集到前端显示的完整流程，确保系统各组件正常工作。

## 功能特性

### 1. 环境检查
- Node.js版本验证（>= v18.0.0）
- npm依赖检查
- 项目结构验证
- 环境变量配置检查

### 2. 数据库验证
- 数据库连接测试
- 数据库迁移执行
- 数据读写操作验证

### 3. 数据采集验证
- 股票数据爬虫功能测试
- 新闻数据采集测试
- API连接验证

### 4. AI推演验证
- DeepSeek AI代理功能测试
- 智能情报流水线验证
- 策略文档读取测试

### 5. 调度器验证
- 调度器配置检查
- 任务触发逻辑测试
- 定时任务模拟

### 6. 前端验证
- API端点检查
- 前端页面验证
- 数据拉取功能测试

### 7. 完整数据闭环测试
- 端到端数据流转测试
- 模拟用户旅程
- 系统集成验证

## 使用方式

### 基本用法

```bash
# 显示帮助信息
./scripts/verify_uat.sh -h

# 快速验证模式（仅检查核心功能）
./scripts/verify_uat.sh -m quick

# 完整验证模式
./scripts/verify_uat.sh -m full

# CI验证模式（完整验证但不启动服务）
./scripts/verify_uat.sh -m ci
```

### 高级选项

```bash
# 启动开发服务器
./scripts/verify_uat.sh -m full -s

# 跳过数据库测试
./scripts/verify_uat.sh --skip-db

# 使用模拟数据模式
./scripts/verify_uat.sh --use-mock

# 显示详细输出
./scripts/verify_uat.sh -v

# 组合使用
./scripts/verify_uat.sh -m full -s --use-mock -v
```

## 验证模式说明

### 1. 快速验证模式 (`-m quick`)
- 仅检查核心功能
- 跳过数据库测试
- 使用模拟数据
- 不启动服务
- 适合快速系统状态检查

### 2. 完整验证模式 (`-m full`)
- 验证所有功能模块
- 包含数据库测试
- 可选的服务器启动
- 生成详细报告
- 适合部署前验证

### 3. CI验证模式 (`-m ci`)
- 完整功能验证
- 不启动交互式服务
- 适合持续集成环境
- 返回明确的退出代码

## 输出说明

### 1. 控制台输出
- 彩色编码的状态指示
- 详细的测试步骤
- 实时进度显示
- 最终验证报告

### 2. 日志文件
- 所有操作记录到 `/tmp/alpha_quant_uat_*.log`
- 包含时间戳和日志级别
- 可用于问题诊断

### 3. 测试报告
- 测试结果摘要
- 通过率统计
- 修复建议
- 下一步操作指南

## 环境要求

### 必需软件
- Node.js >= 18.0.0
- npm >= 8.0.0
- TypeScript >= 5.0.0

### 环境变量
```bash
# 必需的环境变量
export DATABASE_URL="postgresql://user:password@localhost:5432/stock_analysis"
export DEEPSEEK_API_KEY="your_deepseek_api_key"
export TUSHARE_TOKEN="your_tushare_token"

# 可选的环境变量
export CLERK_PUBLISHABLE_KEY="pk_test_..."
export CLERK_SECRET_KEY="sk_test_..."
export REDIS_URL="redis://localhost:6379"
```

### 项目结构
确保以下文件存在：
```
package.json
tsconfig.json
next.config.js
skills/data_crawler.ts
skills/deepseek_agent.ts
lib/db.ts
app/api/intelligence-feed/route.ts
app/dashboard/page.tsx
```

## 常见问题

### 1. 数据库连接失败
```bash
# 检查数据库服务
sudo systemctl status postgresql

# 检查连接字符串
echo $DATABASE_URL

# 使用模拟模式跳过数据库测试
./scripts/verify_uat.sh --skip-db
```

### 2. API密钥未设置
```bash
# 创建.env.local文件
cp .env.example .env.local

# 编辑.env.local文件
vim .env.local

# 使用模拟模式
./scripts/verify_uat.sh --use-mock
```

### 3. 依赖安装失败
```bash
# 清理并重新安装
rm -rf node_modules package-lock.json
npm install

# 检查网络连接
npm config get registry
```

### 4. TypeScript编译错误
```bash
# 检查TypeScript配置
npx tsc --noEmit

# 修复类型错误
npm run build
```

## 集成到工作流

### 1. 开发环境
```bash
# 每日开发前验证
./scripts/verify_uat.sh -m quick

# 提交前完整验证
./scripts/verify_uat.sh -m full --skip-db
```

### 2. 持续集成
```yaml
# GitHub Actions示例
name: UAT Verification
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: ./scripts/verify_uat.sh -m ci
```

### 3. 部署流程
```bash
# 部署前验证
./scripts/verify_uat.sh -m full

# 启动生产服务
npm run next:build
npm run next:start
```

## 退出代码

| 代码 | 说明 |
|------|------|
| 0 | 验证通过 |
| 1 | 验证失败 |
| 2 | 参数错误 |

## 维护说明

### 1. 更新验证脚本
当系统架构变化时，需要更新验证脚本：
- 添加新的验证步骤
- 更新环境检查逻辑
- 调整测试阈值

### 2. 扩展验证功能
可以扩展脚本以支持：
- 性能测试
- 安全扫描
- 负载测试
- 兼容性测试

### 3. 自定义验证
根据具体需求调整：
```bash
# 修改验证阈值
编辑 scripts/verify_uat.sh 中的相关变量

# 添加自定义测试
在相应函数中添加新的验证逻辑

# 调整输出格式
修改日志和报告生成函数
```

## 联系支持

如有问题或建议，请：
1. 查看日志文件：`/tmp/alpha_quant_uat_*.log`
2. 检查环境配置
3. 参考项目文档
4. 提交Issue到项目仓库

---

**最后更新**: 2026-02-23
**版本**: 1.0.0
**作者**: Alpha-Quant-Copilot Team