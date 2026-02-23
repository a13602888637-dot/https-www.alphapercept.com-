#!/bin/bash

# Alpha-Quant-Copilot Vercel部署脚本
# 作者: Alpha-Quant-Copilot Team
# 日期: 2026-02-23

set -e

echo "=========================================="
echo "Alpha-Quant-Copilot Vercel部署脚本"
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

# 检查Vercel CLI
echo "🔍 检查Vercel CLI..."
if ! command -v vercel &> /dev/null; then
    echo "⚠️  Vercel CLI未安装，正在安装..."
    npm install -g vercel
    echo "✅ Vercel CLI已安装"
else
    echo "✅ Vercel CLI已安装"
fi

# 显示Vercel版本
vercel --version

echo ""
echo "=========================================="
echo "部署步骤说明"
echo "=========================================="
echo ""
echo "1. 登录Vercel:"
echo "   vercel login"
echo "   使用Google账号: a13602888637@gmail.com"
echo "   密码: Dicky.666"
echo ""
echo "2. 链接项目到Vercel:"
echo "   vercel link"
echo "   选择配置:"
echo "   - 选择 'Link to existing project'"
echo "   - 创建新项目: 'alpha-quant-copilot'"
echo "   - 选择框架: Next.js"
echo "   - 输出目录: .next"
echo ""
echo "3. 设置环境变量:"
echo "   vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
echo "   vercel env add CLERK_SECRET_KEY"
echo "   vercel env add CLERK_WEBHOOK_SECRET"
echo "   vercel env add DATABASE_URL"
echo "   vercel env add DIRECT_URL"
echo "   vercel env add DEEPSEEK_API_KEY"
echo "   vercel env add TUSHARE_TOKEN"
echo "   vercel env add NEXT_PUBLIC_APP_URL"
echo ""
echo "4. 预览部署:"
echo "   vercel"
echo ""
echo "5. 生产部署:"
echo "   vercel --prod"
echo ""
echo "=========================================="
echo "环境变量参考值 (从 .env.local 复制)"
echo "=========================================="
echo ""
echo "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:"
echo "pk_test_Z2xvcmlvdXMta3JpbGwtOTUuY2xlcmsuYWNjb3VudHMuZGV2JA"
echo ""
echo "CLERK_SECRET_KEY:"
echo "sk_test_FIjXZ1CCRi1IzsSQ03E5OW2leNxOd00N6EaG6i5pkR"
echo ""
echo "CLERK_WEBHOOK_SECRET:"
echo "whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
echo ""
echo "DATABASE_URL:"
echo "postgresql://postgres.wgjlpdgdbnrrtrajnumj:%24%2BE%2EVH6Lbcm%2F5Bb@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
echo ""
echo "DIRECT_URL:"
echo "postgresql://postgres.wgjlpdgdbnrrtrajnumj:%24%2BE%2EVH6Lbcm%2F5Bb@aws-0-us-west-2.pooler.supabase.com:5432/postgres"
echo ""
echo "DEEPSEEK_API_KEY:"
echo "sk-8adbfb73172d44fd9e85b515627dc8ad"
echo ""
echo "TUSHARE_TOKEN:"
echo "ca1d64ce2eea8ee0adc5f1acc52faf7dfb30e73d163f66ee5bd81a8a"
echo ""
echo "NEXT_PUBLIC_APP_URL:"
echo "https://alpha-quant-copilot.vercel.app"
echo ""
echo "=========================================="
echo "部署验证步骤"
echo "=========================================="
echo ""
echo "部署完成后，请验证以下功能:"
echo "1. 访问生产环境URL"
echo "2. 测试登录/注册功能 (Clerk认证)"
echo "3. 测试自选股添加功能"
echo "4. 访问设置页面"
echo "5. 测试实时数据功能"
echo ""
echo "如果需要帮助，请参考文档:"
echo "- docs/clerk-webhook-setup.md"
echo "- docs/realtime-system-architecture.md"
echo "- docs/stock-price-storage-system.md"
echo ""
echo "=========================================="