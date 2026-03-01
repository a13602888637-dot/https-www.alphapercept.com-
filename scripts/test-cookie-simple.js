// 快速检查Clerk Cookie - 在浏览器控制台运行
// 使用方法：
// 1. 访问 https://www.alphapercept.com
// 2. 登录后，按 F12 打开开发者工具
// 3. 进入 Console 标签
// 4. 粘贴此代码并回车

console.clear();
console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #4CAF50');
console.log('%c🔍 Clerk Cookie 快速检查', 'font-size: 16px; font-weight: bold; color: #4CAF50');
console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #4CAF50');
console.log('');

// 检查Cookie
const cookies = document.cookie.split(';').map(c => c.trim());
const hasSession = cookies.some(c => c.startsWith('__session='));

console.log('📍 当前域名:', window.location.hostname);
console.log('');

if (hasSession) {
    console.log('%c✅ 找到Clerk session cookie!', 'color: green; font-size: 14px; font-weight: bold');
    console.log('');
    console.log('现在测试添加自选股应该可以工作了！');
} else {
    console.log('%c❌ 未找到 __session cookie', 'color: red; font-size: 14px; font-weight: bold');
    console.log('');
    console.log('请执行以下操作:');
    console.log('1. 退出登录');
    console.log('2. 清除浏览器缓存');
    console.log('3. 重新登录');
    console.log('4. 再次运行此脚本检查');
}

console.log('');
console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #4CAF50');
