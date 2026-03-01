// 紧急诊断脚本 - 在浏览器控制台运行
// 复制整段代码，粘贴到浏览器控制台（F12 → Console），然后回车

(async function emergencyDiagnostics() {
    console.clear();
    console.log('%c═════════════════════════════════════════════════════════', 'color: #f44336; font-weight: bold');
    console.log('%c🚨 紧急诊断工具 - 401错误排查', 'font-size: 20px; color: #f44336; font-weight: bold');
    console.log('%c═════════════════════════════════════════════════════════', 'color: #f44336; font-weight: bold');
    console.log('');

    const results = {
        domain: window.location.hostname,
        protocol: window.location.protocol,
        hasCookies: false,
        hasClerkSession: false,
        clerkLoaded: false,
        apiStatus: null,
        apiError: null,
    };

    // 1. 基本信息
    console.log('%c━━━ 1. 页面信息 ━━━', 'color: #2196F3; font-weight: bold');
    console.log('  当前域名:', results.domain);
    console.log('  协议:', results.protocol);
    console.log('  完整URL:', window.location.href);

    if (results.protocol !== 'https:') {
        console.log('%c  ⚠️ 警告: 未使用HTTPS!', 'color: orange; font-weight: bold');
    }
    console.log('');

    // 2. Cookie检查
    console.log('%c━━━ 2. Cookie检查 ━━━', 'color: #2196F3; font-weight: bold');
    const allCookies = document.cookie;
    console.log('  所有Cookies:', allCookies || '(空)');

    if (!allCookies) {
        console.log('%c  ❌ 没有任何Cookie!', 'color: red; font-weight: bold');
        console.log('  这可能是问题所在！');
    } else {
        results.hasCookies = true;

        const cookieList = allCookies.split(';').map(c => c.trim());
        console.log('  Cookie数量:', cookieList.length);

        const hasSession = cookieList.some(c => c.startsWith('__session='));
        const hasClerkDb = cookieList.some(c => c.startsWith('__clerk_db_jwt='));

        if (hasSession) {
            console.log('%c  ✅ 找到 __session cookie', 'color: green; font-weight: bold');
            results.hasClerkSession = true;
        } else {
            console.log('%c  ❌ 未找到 __session cookie', 'color: red; font-weight: bold');
            console.log('  这是401错误的直接原因！');
        }

        if (hasClerkDb) {
            console.log('  ✅ 找到 __clerk_db_jwt cookie');
        }

        console.log('');
        console.log('  所有Cookie名称:');
        cookieList.forEach(c => {
            const name = c.split('=')[0];
            const isClerk = name.includes('clerk') || name === '__session';
            const prefix = isClerk ? '    🔐 ' : '    • ';
            console.log(prefix + name);
        });
    }
    console.log('');

    // 3. Clerk客户端检查
    console.log('%c━━━ 3. Clerk客户端检查 ━━━', 'color: #2196F3; font-weight: bold');

    if (typeof window.Clerk !== 'undefined') {
        console.log('%c  ✅ Clerk SDK已加载', 'color: green');
        results.clerkLoaded = true;

        try {
            const user = await window.Clerk.user;
            if (user) {
                console.log('%c  ✅ Clerk显示用户已登录', 'color: green; font-weight: bold');
                console.log('    用户ID:', user.id);
                console.log('    邮箱:', user.primaryEmailAddress?.emailAddress || '(无)');

                // 如果Clerk显示已登录但没有cookie，这是关键问题
                if (!results.hasClerkSession) {
                    console.log('');
                    console.log('%c  ⚠️⚠️⚠️ 关键问题发现！', 'color: orange; font-size: 16px; font-weight: bold');
                    console.log('%c  Clerk显示已登录，但浏览器没有__session cookie!', 'color: orange; font-weight: bold');
                    console.log('');
                    console.log('  这说明Cookie无法在当前域名设置。');
                    console.log('  可能的原因:');
                    console.log('    1. Clerk域名配置未生效（需要等待15-20分钟）');
                    console.log('    2. 浏览器Cookie设置阻止了第三方Cookie');
                    console.log('    3. Clerk配置的域名与当前域名不匹配');
                }
            } else {
                console.log('%c  ❌ Clerk显示用户未登录', 'color: red; font-weight: bold');
                console.log('  请先登录！');
            }
        } catch (error) {
            console.log('%c  ❌ 获取Clerk用户信息失败:', 'color: red', error.message);
        }
    } else {
        console.log('%c  ❌ Clerk SDK未加载', 'color: red; font-weight: bold');
        console.log('  这可能是配置问题或网络问题');
        console.log('  请检查浏览器Console是否有其他错误');
    }
    console.log('');

    // 4. API测试
    console.log('%c━━━ 4. API认证测试 ━━━', 'color: #2196F3; font-weight: bold');
    console.log('  正在调用 GET /api/watchlist...');

    try {
        const response = await fetch('/api/watchlist', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        results.apiStatus = response.status;
        console.log('  响应状态码:', response.status);

        const data = await response.json();

        if (response.status === 200) {
            console.log('%c  ✅ API认证成功!', 'color: green; font-weight: bold');
            console.log('    自选股数量:', data.watchlist?.length || 0);
        } else if (response.status === 401) {
            console.log('%c  ❌ API认证失败 (401 Unauthorized)', 'color: red; font-weight: bold');
            console.log('    错误:', data.error);
            console.log('    详情:', data.details);
            results.apiError = data;
        } else {
            console.log('    响应:', data);
        }
    } catch (error) {
        console.log('%c  ❌ API调用失败:', 'color: red', error.message);
        results.apiError = error.message;
    }
    console.log('');

    // 5. 浏览器环境检查
    console.log('%c━━━ 5. 浏览器环境检查 ━━━', 'color: #2196F3; font-weight: bold');
    console.log('  User Agent:', navigator.userAgent);
    console.log('  语言:', navigator.language);
    console.log('  Cookie启用:', navigator.cookieEnabled ? '✅ 是' : '❌ 否');

    if (!navigator.cookieEnabled) {
        console.log('%c  ❌ Cookie被禁用!', 'color: red; font-weight: bold');
        console.log('  请在浏览器设置中启用Cookie');
    }
    console.log('');

    // 6. 诊断总结
    console.log('%c═════════════════════════════════════════════════════════', 'color: #f44336; font-weight: bold');
    console.log('%c📊 诊断总结', 'font-size: 18px; color: #f44336; font-weight: bold');
    console.log('%c═════════════════════════════════════════════════════════', 'color: #f44336; font-weight: bold');
    console.log('');

    // 分析问题
    if (!navigator.cookieEnabled) {
        console.log('%c🔴 根本原因: Cookie被浏览器禁用', 'color: red; font-size: 16px; font-weight: bold');
        console.log('');
        console.log('  解决方法:');
        console.log('  1. Chrome: 设置 → 隐私和安全 → Cookie和其他网站数据');
        console.log('  2. 选择: "允许所有Cookie" 或 "阻止第三方Cookie"');
        console.log('  3. 确保 www.alphapercept.com 不在阻止列表中');
    } else if (!results.hasCookies) {
        console.log('%c🔴 根本原因: 浏览器没有任何Cookie', 'color: red; font-size: 16px; font-weight: bold');
        console.log('');
        console.log('  可能原因:');
        console.log('  1. 浏览器隐私设置过于严格');
        console.log('  2. 浏览器扩展阻止了Cookie');
        console.log('  3. 使用了无痕模式但未允许Cookie');
    } else if (!results.hasClerkSession && results.clerkLoaded) {
        console.log('%c🔴 根本原因: Clerk无法设置session cookie', 'color: red; font-size: 16px; font-weight: bold');
        console.log('');
        console.log('  这是最常见的问题。可能原因:');
        console.log('');
        console.log('  1️⃣ Clerk域名配置未生效（最可能）');
        console.log('     • Clerk Dashboard配置保存后需要15-20分钟生效');
        console.log('     • 请等待一段时间后重新登录');
        console.log('');
        console.log('  2️⃣ Clerk配置的域名不匹配');
        console.log('     当前域名: ' + results.domain);
        console.log('     需要在Clerk Dashboard确认:');
        console.log('     Settings → Domains → 确认包含 www.alphapercept.com');
        console.log('');
        console.log('  3️⃣ 浏览器Cookie策略');
        console.log('     • Chrome设置 → 隐私和安全 → Cookie');
        console.log('     • 确保不是"阻止所有Cookie"');
        console.log('     • 将 alphapercept.com 添加到允许列表');
    } else if (!results.clerkLoaded) {
        console.log('%c🔴 根本原因: Clerk SDK未加载', 'color: red; font-size: 16px; font-weight: bold');
        console.log('');
        console.log('  可能原因:');
        console.log('  1. 网络问题导致Clerk脚本加载失败');
        console.log('  2. Clerk公钥配置错误');
        console.log('  3. 浏览器扩展阻止了Clerk脚本');
    } else if (results.hasClerkSession && results.apiStatus === 401) {
        console.log('%c🔴 根本原因: Cookie存在但API仍然返回401', 'color: red; font-size: 16px; font-weight: bold');
        console.log('');
        console.log('  这是后端配置问题。可能原因:');
        console.log('  1. Vercel环境变量配置错误');
        console.log('  2. Clerk Secret Key不匹配');
        console.log('  3. Middleware配置问题');
        console.log('');
        console.log('  需要检查服务器日志');
    }

    console.log('');
    console.log('%c═════════════════════════════════════════════════════════', 'color: #f44336; font-weight: bold');
    console.log('');

    // 输出详细结果供分析
    console.log('%c📋 诊断数据（请复制以下内容发给技术支持）', 'font-weight: bold');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        domain: results.domain,
        protocol: results.protocol,
        cookieEnabled: navigator.cookieEnabled,
        hasCookies: results.hasCookies,
        hasClerkSession: results.hasClerkSession,
        clerkLoaded: results.clerkLoaded,
        apiStatus: results.apiStatus,
        apiError: results.apiError,
        userAgent: navigator.userAgent.substring(0, 100),
    }, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return results;
})();
