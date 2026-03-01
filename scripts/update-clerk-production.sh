#!/bin/bash

# ============================================
# Clerk生产域名配置自动化脚本
# ============================================
# 用途: 为生产域名 www.alphapercept.com 配置正确的Clerk密钥
# ============================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo ""
    echo "============================================"
    echo "$1"
    echo "============================================"
    echo ""
}

# ============================================
# 步骤1: 检查当前配置
# ============================================
print_header "步骤1: 检查当前配置"

print_info "检查Vercel CLI..."
if ! command -v vercel &> /dev/null; then
    print_error "未找到Vercel CLI，请先安装: npm install -g vercel"
    exit 1
fi
print_success "Vercel CLI已安装"

print_info "检查当前Vercel环境变量..."
vercel env pull .env.current-prod --environment production --yes > /dev/null 2>&1 || true

if [ -f .env.current-prod ]; then
    CURRENT_PK=$(grep "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" .env.current-prod | cut -d'"' -f2)
    CURRENT_SK=$(grep "CLERK_SECRET_KEY" .env.current-prod | cut -d'"' -f2)

    echo "当前配置的Clerk密钥:"
    echo "  Publishable Key: ${CURRENT_PK:0:20}..."
    echo "  Secret Key: ${CURRENT_SK:0:20}..."

    # 检查是否是测试密钥
    if [[ $CURRENT_PK == pk_test_* ]]; then
        print_warning "当前使用的是测试密钥(pk_test_)，需要更新为生产密钥(pk_live_)"
    elif [[ $CURRENT_PK == pk_live_* ]]; then
        # 解码密钥查看域名
        DOMAIN=$(echo "$CURRENT_PK" | sed 's/pk_live_//' | base64 -d 2>/dev/null || echo "无法解码")
        echo "  配置的域名: $DOMAIN"

        if [[ $DOMAIN == *"alphapercept.co"* ]]; then
            print_warning "域名配置为 .co，需要更新为 .com"
        fi
    fi

    rm -f .env.current-prod
else
    print_warning "无法获取当前配置"
fi

echo ""

# ============================================
# 步骤2: 获取新的Clerk密钥
# ============================================
print_header "步骤2: 获取新的Clerk密钥"

echo "请按照以下步骤获取新的Clerk密钥："
echo ""
echo "方案A: 在现有应用中添加域名（推荐）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. 访问 Clerk Dashboard: https://dashboard.clerk.com/"
echo "2. 选择你的应用"
echo "3. 进入 Settings → Domains"
echo "4. 点击 '+ Add domain'"
echo "5. 添加以下域名："
echo "   • www.alphapercept.com"
echo "   • alphapercept.com"
echo "6. 点击 Save"
echo "7. 密钥不需要更改，按 Ctrl+C 退出此脚本"
echo ""
echo "方案B: 创建新的Clerk应用"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. 访问 Clerk Dashboard: https://dashboard.clerk.com/"
echo "2. 点击 'Create Application'"
echo "3. 应用名称: Alpha-Quant-Copilot Production"
echo "4. 生产URL: https://www.alphapercept.com"
echo "5. 创建后，进入 API Keys 页面"
echo "6. 复制以下密钥:"
echo "   • Publishable Key (pk_live_...)"
echo "   • Secret Key (sk_live_...)"
echo ""

read -p "如果选择方案A，请按 Ctrl+C 退出。如果选择方案B，请按 Enter 继续..."

echo ""
print_info "请输入新的Clerk密钥"
echo ""

# 读取Publishable Key
while true; do
    read -p "Publishable Key (pk_live_...): " NEW_PK

    if [[ $NEW_PK == pk_live_* ]]; then
        print_success "Publishable Key格式正确"
        break
    elif [[ $NEW_PK == pk_test_* ]]; then
        print_error "请使用生产密钥(pk_live_)，而不是测试密钥(pk_test_)"
    else
        print_error "密钥格式不正确，应该以 pk_live_ 开头"
    fi
done

# 读取Secret Key
while true; do
    read -sp "Secret Key (sk_live_...): " NEW_SK
    echo ""

    if [[ $NEW_SK == sk_live_* ]]; then
        print_success "Secret Key格式正确"
        break
    elif [[ $NEW_SK == sk_test_* ]]; then
        print_error "请使用生产密钥(sk_live_)，而不是测试密钥(sk_test_)"
    else
        print_error "密钥格式不正确，应该以 sk_live_ 开头"
    fi
done

echo ""

# ============================================
# 步骤3: 验证密钥的域名配置
# ============================================
print_header "步骤3: 验证密钥配置"

print_info "解析Publishable Key中的域名..."
ENCODED_DOMAIN=$(echo "$NEW_PK" | sed 's/pk_live_//')
DECODED_DOMAIN=$(echo "$ENCODED_DOMAIN" | base64 -d 2>/dev/null || echo "")

if [ -z "$DECODED_DOMAIN" ]; then
    print_warning "无法解码域名，但将继续配置"
else
    echo "检测到的域名: $DECODED_DOMAIN"

    if [[ $DECODED_DOMAIN == *"alphapercept.com"* ]]; then
        print_success "域名配置正确 (alphapercept.com)"
    else
        print_warning "域名配置为: $DECODED_DOMAIN"
        print_warning "请确认这是正确的生产域名"
        read -p "确认继续？(y/n): " confirm
        if [[ $confirm != "y" && $confirm != "Y" ]]; then
            print_error "已取消"
            exit 1
        fi
    fi
fi

echo ""

# ============================================
# 步骤4: 更新Vercel环境变量
# ============================================
print_header "步骤4: 更新Vercel环境变量"

print_info "准备更新Vercel生产环境变量..."

# 创建临时文件存储密钥
TEMP_PK_FILE=$(mktemp)
TEMP_SK_FILE=$(mktemp)
echo "$NEW_PK" > "$TEMP_PK_FILE"
echo "$NEW_SK" > "$TEMP_SK_FILE"

# 删除旧的环境变量
print_info "删除旧的NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY..."
vercel env rm NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production --yes 2>/dev/null || true

print_info "删除旧的CLERK_SECRET_KEY..."
vercel env rm CLERK_SECRET_KEY production --yes 2>/dev/null || true

# 添加新的环境变量
print_info "添加新的NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY..."
cat "$TEMP_PK_FILE" | vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production

print_info "添加新的CLERK_SECRET_KEY..."
cat "$TEMP_SK_FILE" | vercel env add CLERK_SECRET_KEY production

# 清理临时文件
rm -f "$TEMP_PK_FILE" "$TEMP_SK_FILE"

print_success "环境变量更新成功！"

echo ""

# ============================================
# 步骤5: 重新部署到Vercel
# ============================================
print_header "步骤5: 重新部署到Vercel"

read -p "是否立即部署到生产环境？(y/n): " deploy_confirm

if [[ $deploy_confirm == "y" || $deploy_confirm == "Y" ]]; then
    print_info "开始部署到Vercel生产环境..."

    vercel --prod --yes

    print_success "部署完成！"
else
    print_warning "已跳过部署"
    print_info "稍后可以手动部署: vercel --prod"
fi

echo ""

# ============================================
# 步骤6: 验证指南
# ============================================
print_header "步骤6: 验证新配置"

echo "请按照以下步骤验证配置是否成功："
echo ""
echo "1️⃣  清除浏览器缓存（重要！）"
echo "   • Chrome: Ctrl+Shift+Delete"
echo "   • 选择 'Cookie和其他网站数据'"
echo "   • 时间范围: '全部时间'"
echo "   • 点击 '清除数据'"
echo ""
echo "2️⃣  访问生产网站"
echo "   • URL: https://www.alphapercept.com"
echo ""
echo "3️⃣  检查Clerk Cookies"
echo "   • 打开开发者工具 (F12)"
echo "   • Application → Cookies → www.alphapercept.com"
echo "   • 应该看到: __session cookie"
echo "   • Domain应该是: .alphapercept.com"
echo ""
echo "4️⃣  重新登录"
echo "   • 点击登录按钮"
echo "   • 使用你的账户登录"
echo ""
echo "5️⃣  测试添加自选股"
echo "   • 访问自选股页面"
echo "   • 点击 '添加股票'"
echo "   • 搜索并添加一只股票 (如: 600000 浦发银行)"
echo "   • ✅ 应该成功添加，不再报401错误"
echo ""
echo "6️⃣  检查Network请求"
echo "   • 开发者工具 → Network标签"
echo "   • 添加自选股时，查看 POST /api/watchlist 请求"
echo "   • Request Headers应该包含: Cookie: __session=..."
echo "   • 响应状态应该是: 200 (成功) 或 409 (已存在)"
echo ""

print_success "配置完成！"
echo ""
print_info "如果仍然遇到问题，请检查:"
echo "  • docs/CLERK_DOMAIN_FIX_GUIDE.md (详细故障排查指南)"
echo "  • Clerk Dashboard → Settings → Domains (确认域名已添加)"
echo "  • 浏览器控制台的错误信息"
echo ""
print_info "技术支持文档:"
echo "  • docs/WATCHLIST_AUTH_FIX_2026-03-01.md (CORS修复)"
echo "  • docs/CLERK_DOMAIN_FIX_GUIDE.md (域名配置)"
echo ""

# 清理
rm -f .env.current-prod

print_success "脚本执行完成！"
