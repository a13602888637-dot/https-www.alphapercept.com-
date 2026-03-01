#!/usr/bin/env node

/**
 * 自选股UI诊断脚本
 *
 * 用途：在浏览器Console中运行，诊断自选股添加功能的UI状态
 *
 * 使用方法：
 * 1. 访问 http://localhost:3000/watchlist
 * 2. 点击"添加股票"按钮打开对话框
 * 3. 打开浏览器开发者工具（F12）
 * 4. 切换到Console标签
 * 5. 复制粘贴本脚本内容并回车
 */

console.log('🔍 开始自选股UI诊断...\n');

// 1. 检查对话框是否打开
console.log('1️⃣ 检查对话框状态:');
const dialog = document.querySelector('[role="dialog"]');
if (dialog) {
  console.log('   ✅ 对话框已打开');
  console.log('   对话框元素:', dialog);
} else {
  console.log('   ❌ 对话框未打开');
  console.log('   ⚠️  请先点击"添加股票"按钮');
}

// 2. 检查输入框状态
console.log('\n2️⃣ 检查输入框状态:');
const inputs = dialog ? dialog.querySelectorAll('input') : [];
if (inputs.length > 0) {
  console.log(`   找到 ${inputs.length} 个输入框:`);
  inputs.forEach((input, index) => {
    const label = input.previousElementSibling?.textContent || `输入框${index + 1}`;
    const isDisabled = input.disabled;
    const value = input.value;
    const placeholder = input.placeholder;

    console.log(`   ${index + 1}. ${label}:`);
    console.log(`      - 禁用状态: ${isDisabled ? '❌ 是' : '✅ 否'}`);
    console.log(`      - 当前值: "${value}"`);
    console.log(`      - 占位符: "${placeholder}"`);

    if (isDisabled) {
      console.log(`      ⚠️  输入框被禁用！`);
    }
  });
} else {
  console.log('   ❌ 未找到输入框');
}

// 3. 检查搜索框
console.log('\n3️⃣ 检查搜索框:');
const searchInput = dialog ? dialog.querySelector('input[placeholder*="搜索"]') : null;
if (searchInput) {
  console.log('   ✅ 搜索框存在');
  console.log('   - 值:', searchInput.value);
  console.log('   - 禁用:', searchInput.disabled ? '是' : '否');
} else {
  console.log('   ❌ 未找到搜索框');
}

// 4. 检查添加按钮
console.log('\n4️⃣ 检查添加按钮:');
const buttons = dialog ? dialog.querySelectorAll('button') : [];
let addButton = null;

buttons.forEach(btn => {
  if (btn.textContent.includes('添加') && !btn.textContent.includes('取消')) {
    addButton = btn;
  }
});

if (addButton) {
  console.log('   ✅ 找到添加按钮');
  console.log('   - 文本:', addButton.textContent);
  console.log('   - 禁用状态:', addButton.disabled ? '❌ 是' : '✅ 否');
  console.log('   - aria-disabled:', addButton.getAttribute('aria-disabled'));
  console.log('   - 类名:', addButton.className);

  // 检查是否有pointer-events: none
  const computedStyle = window.getComputedStyle(addButton);
  console.log('   - pointer-events:', computedStyle.pointerEvents);
  console.log('   - cursor:', computedStyle.cursor);
  console.log('   - opacity:', computedStyle.opacity);

  if (addButton.disabled) {
    console.log('   ⚠️  按钮被禁用！');
  }
  if (computedStyle.pointerEvents === 'none') {
    console.log('   ⚠️  pointer-events设置为none，阻止了点击事件！');
  }
} else {
  console.log('   ❌ 未找到添加按钮');
  console.log('   可用按钮:', buttons.length);
  buttons.forEach((btn, i) => {
    console.log(`   ${i + 1}. "${btn.textContent}"`);
  });
}

// 5. 检查React状态（通过输入框值）
console.log('\n5️⃣ 检查表单数据:');
const codeInput = dialog ? Array.from(dialog.querySelectorAll('input')).find(
  input => input.placeholder?.includes('000001') ||
           input.previousElementSibling?.textContent?.includes('股票代码')
) : null;

const nameInput = dialog ? Array.from(dialog.querySelectorAll('input')).find(
  input => input.placeholder?.includes('平安银行') ||
           input.previousElementSibling?.textContent?.includes('股票名称')
) : null;

if (codeInput && nameInput) {
  const hasCode = codeInput.value.trim().length > 0;
  const hasName = nameInput.value.trim().length > 0;

  console.log(`   股票代码: "${codeInput.value}" ${hasCode ? '✅' : '❌'}`);
  console.log(`   股票名称: "${nameInput.value}" ${hasName ? '✅' : '❌'}`);

  if (!hasCode || !hasName) {
    console.log(`   ⚠️  缺少必填项，这可能是按钮无法点击的原因`);
    console.log(`   💡 请搜索并选择股票，或手动填写代码和名称`);
  } else {
    console.log(`   ✅ 必填项都已填写`);
  }
}

// 6. 测试点击事件
console.log('\n6️⃣ 测试点击事件监听器:');
if (addButton) {
  const hasClickListener = addButton.onclick !== null;
  console.log(`   onClick处理器: ${hasClickListener ? '✅ 已绑定' : '❌ 未绑定'}`);

  // 尝试获取React事件监听器（仅供参考，可能不准确）
  const reactKey = Object.keys(addButton).find(key => key.startsWith('__reactProps'));
  if (reactKey) {
    console.log('   React Props:', addButton[reactKey]);
  }
}

// 7. 检查是否有覆盖层
console.log('\n7️⃣ 检查是否有覆盖层:');
if (addButton) {
  const rect = addButton.getBoundingClientRect();
  const elementAtPoint = document.elementFromPoint(
    rect.left + rect.width / 2,
    rect.top + rect.height / 2
  );

  if (elementAtPoint === addButton) {
    console.log('   ✅ 没有元素覆盖按钮');
  } else {
    console.log('   ⚠️  按钮被其他元素覆盖:');
    console.log('   覆盖元素:', elementAtPoint);
  }
}

// 8. 检查shadcn/ui Button组件样式
console.log('\n8️⃣ 检查Button组件状态:');
if (addButton) {
  const isDisabledByClass = addButton.className.includes('disabled') ||
                            addButton.className.includes('pointer-events-none');
  console.log(`   CSS禁用类: ${isDisabledByClass ? '❌ 有' : '✅ 无'}`);

  if (isDisabledByClass) {
    console.log('   ⚠️  通过CSS类禁用了按钮');
    console.log('   可能的类:', addButton.className);
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📋 诊断完成！');
console.log('\n💡 建议操作:');
console.log('1. 如果搜索框存在，请输入股票代码或名称进行搜索');
console.log('2. 点击搜索结果选择股票');
console.log('3. 检查股票代码和名称是否自动填入');
console.log('4. 如果仍无法点击，请将上面的诊断输出发送给开发者');
console.log('\n📸 请截图本诊断输出！');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// 额外：提供手动模拟点击的函数
window.debugAddStock = function() {
  console.log('🔧 尝试手动触发添加操作...');
  if (addButton) {
    addButton.click();
    console.log('✅ 已触发点击事件');
  } else {
    console.log('❌ 未找到添加按钮');
  }
};

console.log('💡 提示: 可以在Console中运行 debugAddStock() 来手动触发添加操作');
