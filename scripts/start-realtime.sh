#!/bin/bash

# Alpha-Quant-Copilot 实时数据推送系统启动脚本
# 作者: Alpha-Quant-Copilot Team
# 日期: 2026-02-22

set -e

echo "=========================================="
echo "Alpha-Quant-Copilot 实时数据推送系统"
echo "=========================================="
echo ""

# 检查Node.js版本
echo "🔍 检查Node.js版本..."
NODE_VERSION=$(node --version | cut -d'v' -f2)
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)

if [ $NODE_MAJOR -lt 18 ]; then
    echo "❌ 错误: Node.js版本需要 >= 18.0.0，当前版本: $NODE_VERSION"
    exit 1
fi
echo "✅ Node.js版本: $NODE_VERSION"

# 检查npm
echo "🔍 检查npm..."
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: npm未安装"
    exit 1
fi
echo "✅ npm已安装"

# 安装依赖
echo "📦 安装依赖..."
if [ ! -d "node_modules" ]; then
    echo "正在安装依赖，这可能需要几分钟..."
    npm install
else
    echo "依赖已安装，跳过..."
fi

# 检查TypeScript配置
echo "🔍 检查TypeScript配置..."
if [ ! -f "tsconfig.json" ]; then
    echo "❌ 错误: tsconfig.json不存在"
    exit 1
fi
echo "✅ TypeScript配置正常"

# 检查Next.js配置
echo "🔍 检查Next.js配置..."
if [ ! -f "next.config.js" ]; then
    echo "❌ 错误: next.config.js不存在"
    exit 1
fi
echo "✅ Next.js配置正常"

# 检查数据抓取引擎
echo "🔍 检查数据抓取引擎..."
if [ ! -f "skills/data_crawler.ts" ]; then
    echo "❌ 错误: 数据抓取引擎不存在"
    exit 1
fi
echo "✅ 数据抓取引擎正常"

# 检查API路由
echo "🔍 检查API路由..."
if [ ! -f "app/api/sse/route.ts" ]; then
    echo "❌ 错误: SSE API路由不存在"
    exit 1
fi
if [ ! -f "app/api/websocket/route.ts" ]; then
    echo "❌ 错误: WebSocket API路由不存在"
    exit 1
fi
echo "✅ API路由正常"

# 检查客户端组件
echo "🔍 检查客户端组件..."
if [ ! -f "components/live-feed/LiveMarketFeed.tsx" ]; then
    echo "❌ 错误: 实时数据推送组件不存在"
    exit 1
fi
echo "✅ 客户端组件正常"

# 检查页面
echo "🔍 检查页面..."
if [ ! -f "app/live-feed/page.tsx" ]; then
    echo "❌ 错误: 实时数据推送页面不存在"
    exit 1
fi
echo "✅ 页面正常"

# 启动开发服务器
echo ""
echo "🚀 启动实时数据推送系统..."
echo ""
echo "=========================================="
echo "系统信息:"
echo "------------------------------------------"
echo "• 应用名称: Alpha-Quant-Copilot"
echo "• 版本: 1.0.0"
echo "• 数据源: 新浪财经/腾讯财经API"
echo "• 推送方式: SSE (主) / WebSocket (备)"
echo "• 更新频率: 5秒/次"
echo "• 默认监控: 000001,600000,000002,600036"
echo "=========================================="
echo ""
echo "🌐 访问地址:"
echo "• 实时数据推送: http://localhost:3000/live-feed"
echo "• SSE API: http://localhost:3000/api/sse"
echo "• WebSocket API: ws://localhost:3000/api/websocket"
echo ""
echo "📋 可用命令:"
echo "• Ctrl+C 停止服务器"
echo "• R 重新加载页面"
echo "• L 查看日志"
echo ""
echo "=========================================="

# 启动Next.js开发服务器
npm run next:dev