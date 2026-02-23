#!/bin/bash

# Vercel部署验证脚本
# 作者: Alpha-Quant-Copilot Team
# 日期: 2026-02-23

set -e

echo "=========================================="
echo "Vercel部署验证脚本"
echo "=========================================="
echo ""

# 检查是否已登录Vercel
echo "🔍 检查Vercel登录状态..."
if ! vercel whoami &> /dev/null; then
    echo "❌ 未登录Vercel"
    exit 1
fi
echo "✅ 已登录Vercel"

# 获取项目信息
echo "🔍 获取项目信息..."
PROJECT_INFO=$(vercel projects 2>/dev/null | grep alpha-quant-copilot || true)

if [ -z "$PROJECT_INFO" ]; then
    echo "❌ 项目 'alpha-quant-copilot' 未找到"
    exit 1
fi
echo "✅ 项目已找到: $PROJECT_INFO"

# 获取部署列表
echo "🔍 获取部署列表..."
DEPLOYMENTS=$(vercel list alpha-quant-copilot 2>/dev/null | head -5 || true)

if [ -z "$DEPLOYMENTS" ]; then
    echo "❌ 没有找到部署"
    exit 1
fi

echo "📋 最近部署:"
echo "$DEPLOYMENTS"
echo ""

# 获取最新部署URL
echo "🔍 获取最新部署URL..."
LATEST_URL=$(echo "$DEPLOYMENTS" | grep -E "https://[a-zA-Z0-9.-]+\.vercel\.app" | head -1 | awk '{print $2}')

if [ -z "$LATEST_URL" ]; then
    echo "❌ 无法获取部署URL"
    exit 1
fi

echo "✅ 最新部署URL: $LATEST_URL"
echo ""

echo "=========================================="
echo "开始验证部署"
echo "=========================================="
echo ""

# 测试主页访问
echo "🌐 测试主页访问..."
if curl -s -o /dev/null -w "%{http_code}" "$LATEST_URL" | grep -q "200\|302"; then
    echo "✅ 主页访问正常"
else
    echo "❌ 主页访问失败"
fi

# 测试API路由
echo "🔌 测试API路由..."
API_URL="$LATEST_URL/api/health"
if curl -s -o /dev/null -w "%{http_code}" "$API_URL" | grep -q "200\|404\|500"; then
    echo "✅ API路由响应正常"
else
    echo "❌ API路由无响应"
fi

# 测试静态资源
echo "📦 测试静态资源..."
STATIC_URL="$LATEST_URL/_next/static"
if curl -s -o /dev/null -w "%{http_code}" "$STATIC_URL" | grep -q "200\|403\|404"; then
    echo "✅ 静态资源可访问"
else
    echo "❌ 静态资源访问异常"
fi

# 检查环境变量
echo "🔧 检查环境变量配置..."
ENV_VARS=$(vercel env ls alpha-quant-copilot 2>/dev/null | wc -l || echo "0")

if [ "$ENV_VARS" -gt 5 ]; then
    echo "✅ 环境变量已配置 ($ENV_VARS 个)"
else
    echo "⚠️  环境变量配置较少 ($ENV_VARS 个)"
fi

echo ""
echo "=========================================="
echo "功能测试指南"
echo "=========================================="
echo ""
echo "请手动测试以下功能:"
echo ""
echo "1. 🔐 Clerk认证系统"
echo "   - 访问: $LATEST_URL"
echo "   - 点击登录/注册按钮"
echo "   - 测试Google OAuth登录"
echo "   - 验证用户仪表板访问"
echo ""
echo "2. 📈 自选股管理"
echo "   - 登录后访问仪表板"
echo "   - 测试添加自选股功能"
echo "   - 验证自选股列表显示"
echo ""
echo "3. ⚡ 实时数据功能"
echo "   - 访问: $LATEST_URL/live-feed"
echo "   - 验证实时数据推送"
echo "   - 测试股票搜索功能"
echo ""
echo "4. ⚙️  设置页面"
echo "   - 访问: $LATEST_URL/settings"
echo "   - 验证用户设置加载"
echo "   - 测试主题切换功能"
echo ""
echo "5. 🤖 AI助手功能"
echo "   - 访问: $LATEST_URL/ai-assistant"
echo "   - 测试AI对话功能"
echo "   - 验证股票分析响应"
echo ""
echo "=========================================="
echo "常见问题排查"
echo "=========================================="
echo ""
echo "如果遇到问题，请检查:"
echo ""
echo "1. 🔑 Clerk密钥配置"
echo "   - 确保NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY正确"
echo "   - 确保CLERK_SECRET_KEY正确"
echo "   - 在Clerk Dashboard添加Allowed Origins:"
echo "     - $LATEST_URL"
echo "     - https://alpha-quant-copilot.vercel.app"
echo ""
echo "2. 🗄️  数据库连接"
echo "   - 确保DATABASE_URL正确"
echo "   - 确保Supabase数据库可访问"
echo "   - 检查Prisma迁移状态"
echo ""
echo "3. 🌐 CORS配置"
echo "   - 检查next.config.js中的CORS设置"
echo "   - 确保API路由允许跨域请求"
echo ""
echo "4. 📦 构建问题"
echo "   - 运行: vercel logs alpha-quant-copilot"
echo "   - 查看构建错误日志"
echo "   - 检查TypeScript编译错误"
echo ""
echo "=========================================="
echo "部署状态命令"
echo "=========================================="
echo ""
echo "📊 查看部署: vercel list alpha-quant-copilot"
echo "📝 查看日志: vercel logs alpha-quant-copilot"
echo "🔧 环境变量: vercel env ls alpha-quant-copilot"
echo "🔄 重新部署: vercel --prod"
echo "🗑️  删除部署: vercel remove alpha-quant-copilot"
echo ""
echo "=========================================="