#!/bin/bash

# Vercel环境变量设置脚本
# 作者: Alpha-Quant-Copilot Team
# 日期: 2026-02-23

set -e

echo "=========================================="
echo "Vercel环境变量设置脚本"
echo "=========================================="
echo ""

# 检查是否已登录Vercel
echo "🔍 检查Vercel登录状态..."
if ! vercel whoami &> /dev/null; then
    echo "❌ 未登录Vercel，请先运行: vercel login"
    echo "   使用Google账号: a13602888637@gmail.com"
    echo "   密码: Dicky.666"
    exit 1
fi
echo "✅ 已登录Vercel"

# 检查是否已链接项目
echo "🔍 检查项目链接状态..."
if [ ! -f ".vercel/project.json" ]; then
    echo "❌ 项目未链接到Vercel，请先运行: vercel link"
    echo "   选择配置:"
    echo "   - 选择 'Link to existing project'"
    echo "   - 创建新项目: 'alpha-quant-copilot'"
    echo "   - 选择框架: Next.js"
    echo "   - 输出目录: .next"
    exit 1
fi
echo "✅ 项目已链接到Vercel"

# 读取.env.local文件
ENV_FILE=".env.local"
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ 错误: $ENV_FILE 文件不存在"
    exit 1
fi

echo "📋 从 $ENV_FILE 读取环境变量..."
echo ""

# 解析环境变量
declare -A env_vars

while IFS='=' read -r key value || [ -n "$key" ]; do
    # 跳过注释行和空行
    if [[ $key =~ ^# ]] || [[ -z "$key" ]]; then
        continue
    fi

    # 去除引号
    value=$(echo "$value" | sed "s/^['\"]//;s/['\"]$//")

    # 存储到数组
    env_vars["$key"]="$value"

    echo "🔑 $key"
    echo "   $value"
    echo ""
done < "$ENV_FILE"

echo "=========================================="
echo "开始设置Vercel环境变量"
echo "=========================================="
echo ""

# 设置关键环境变量
critical_vars=(
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
    "CLERK_SECRET_KEY"
    "CLERK_WEBHOOK_SECRET"
    "DATABASE_URL"
    "DIRECT_URL"
    "DEEPSEEK_API_KEY"
    "TUSHARE_TOKEN"
)

for var in "${critical_vars[@]}"; do
    if [ -n "${env_vars[$var]}" ]; then
        echo "🔄 设置 $var..."
        echo "${env_vars[$var]}" | vercel env add "$var" production
        echo "✅ $var 已设置"
        echo ""
    else
        echo "⚠️  警告: $var 未在 .env.local 中找到"
        echo ""
    fi
done

# 设置应用URL
echo "🔄 设置 NEXT_PUBLIC_APP_URL..."
echo "https://alpha-quant-copilot.vercel.app" | vercel env add "NEXT_PUBLIC_APP_URL" production
echo "✅ NEXT_PUBLIC_APP_URL 已设置"
echo ""

# 设置其他可选环境变量
optional_vars=(
    "LOG_LEVEL"
    "NODE_ENV"
    "PORT"
    "NEXT_PUBLIC_API_URL"
)

for var in "${optional_vars[@]}"; do
    if [ -n "${env_vars[$var]}" ]; then
        echo "🔄 设置 $var..."
        echo "${env_vars[$var]}" | vercel env add "$var" production
        echo "✅ $var 已设置"
        echo ""
    fi
done

echo "=========================================="
echo "环境变量设置完成"
echo "=========================================="
echo ""
echo "📋 验证环境变量:"
echo "   vercel env ls"
echo ""
echo "🚀 预览部署:"
echo "   vercel"
echo ""
echo "🌐 生产部署:"
echo "   vercel --prod"
echo ""
echo "🔍 查看部署状态:"
echo "   vercel list"
echo ""
echo "=========================================="