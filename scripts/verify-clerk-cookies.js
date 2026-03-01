// 在浏览器控制台运行此脚本，检查Clerk Cookie配置
// 使用方法：
// 1. 访问 https://www.alphapercept.com
// 2. 打开开发者工具 (F12)
// 3. 进入 Console 标签
// 4. 复制粘贴此脚本并回车

console.clear();
console.log('%c🔍 Clerk Cookie 诊断工具', 'font-size: 16px; font-weight: bold; color: #4CAF50');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

// 1. 检查当前域名
console.log('📍 当前访问信息:');
console.log('  域名:', window.location.hostname);
console.log('  完整URL:', window.location.href);
console.log('  协议:', window.location.protocol);
console.log('');

// 2. 检查所有Cookies
console.log('🍪 当前页面的Cookies:');
const cookies = document.cookie.split(';').map(c => c.trim());
if (cookies.length === 0 || cookies[0] === '') {
    console.log('%c  ❌ 没有找到任何Cookie！', 'color: red; font-weight: bold');
    console.log('  这可能是问题所在。');
} else {
    cookies.forEach(cookie => {
        const [name, value] = cookie.split('=');
        if (name.includes('clerk') || name === '__session') {
            console.log(`%c  ✅ ${name}`, 'color: green', `= ${value.substring(0, 50)}...`);
        } else {
            console.log(`  ${name} = ${value.substring(0, 30)}...`);
        }
    });
}
console.log('');

// 3. 检查Clerk特定的Cookies
console.log('🔐 Clerk认证Cookies检查:');
const clerkCookies = cookies.filter(c =>
    c.includes('__session') ||
    c.includes('__clerk') ||
    c.includes('clerk')
);

if (clerkCookies.length === 0) {
    console.log('%c  ❌ 未找到Clerk认证Cookie (__session)', 'color: red; font-weight: bold');
    console.log('');
    console.log('  可能的原因:');
    console.log('  1. 用户未登录');
    console.log('  2. Clerk域名配置不包含当前域名 (www.alphapercept.com)');
    console.log('  3. Cookie被浏览器阻止');
    console.log('');
    console.log('  解决方案:');
    console.log('  • 在Clerk Dashboard添加域名: www.alphapercept.com');
    console.log('  • 添加后，清除浏览器缓存并重新登录');
} else {
    console.log('%c  ✅ 找到Clerk认证Cookie!', 'color: green; font-weight: bold');
    clerkCookies.forEach(cookie => {
        console.log(`    ${cookie.split('=')[0]}`);
    });
}
console.log('');

// 4. 测试API调用
console.log('🌐 测试API认证:');
console.log('  正在调用 GET /api/watchlist...');

fetch('/api/watchlist', {
    method: 'GET',
    credentials: 'include'
})
.then(response => {
    console.log('  响应状态码:', response.status);

    if (response.status === 200) {
        console.log('%c  ✅ API认证成功！', 'color: green; font-weight: bold');
        return response.json();
    } else if (response.status === 401) {
        console.log('%c  ❌ API认证失败 (401 Unauthorized)', 'color: red; font-weight: bold');
        console.log('');
        console.log('  这确认了认证问题。');
        console.log('  请在Clerk Dashboard添加 www.alphapercept.com');
        return response.json();
    } else {
        console.log('  响应状态:', response.status, response.statusText);
        return response.json();
    }
})
.then(data => {
    console.log('  响应数据:', data);
    console.log('');

    // 给出诊断结果
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('%c📊 诊断结果', 'font-size: 14px; font-weight: bold; color: #2196F3');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const hasClerkCookie = clerkCookies.length > 0;
    const apiSuccess = data.success === true;

    if (hasClerkCookie && apiSuccess) {
        console.log('%c✅ 认证配置正确！', 'color: green; font-size: 14px; font-weight: bold');
        console.log('  Cookie已设置，API调用成功。');
        console.log('  可以正常使用添加自选股功能。');
    } else if (!hasClerkCookie) {
        console.log('%c❌ Cookie未设置', 'color: red; font-size: 14px; font-weight: bold');
        console.log('');
        console.log('  修复步骤:');
        console.log('  1. 打开 Clerk Dashboard: https://dashboard.clerk.com/');
        console.log('  2. Settings → Domains');
        console.log('  3. 添加域名: www.alphapercept.com');
        console.log('  4. 保存配置');
        console.log('  5. 清除浏览器缓存并重新登录');
    } else {
        console.log('%c⚠️ Cookie已设置但API认证失败', 'color: orange; font-size: 14px; font-weight: bold');
        console.log('  这可能是后端配置问题。');
    }
})
.catch(error => {
    console.log('%c  ❌ API调用失败:', 'color: red; font-weight: bold', error.message);
});

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('💡 提示: 等待API调用完成以查看完整诊断结果');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
