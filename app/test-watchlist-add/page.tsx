"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StockSearchInput } from "@/components/watchlist/StockSearchInput";
import { toast } from "sonner";

export default function TestWatchlistAddPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newStock, setNewStock] = useState({
    stockCode: "",
    stockName: "",
  });

  const [testLog, setTestLog] = useState<string[]>([]);

  const addLog = (message: string) => {
    setTestLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleAddStock = async () => {
    addLog(`handleAddStock called - code: "${newStock.stockCode}", name: "${newStock.stockName}"`);

    if (!newStock.stockCode || !newStock.stockName) {
      const errorMsg = "请输入股票代码和名称";
      toast.error(errorMsg);
      addLog(`❌ 验证失败: ${errorMsg}`);
      return;
    }

    addLog(`✅ 验证通过，准备添加股票`);
    toast.success(`模拟添加: ${newStock.stockName} (${newStock.stockCode})`);
    setIsAddDialogOpen(false);
  };

  return (
    <div className="container mx-auto p-8 space-y-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">自选股添加功能测试页面</h1>
        <p className="text-muted-foreground mb-6">
          用于诊断和测试自选股添加功能的独立测试页面
        </p>

        {/* 测试区域 */}
        <div className="space-y-4">
          {/* 测试1: 简化版对话框 */}
          <div className="border rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold">测试1: 简化版添加对话框</h2>
            <p className="text-sm text-muted-foreground">
              与实际WatchlistManager组件相同的结构，但增加了调试日志
            </p>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => addLog('打开添加对话框')}>
                  打开添加对话框
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>添加自选股（测试）</DialogTitle>
                  <DialogDescription>
                    搜索股票代码或名称快速添加
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* 搜索框 */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">搜索股票</label>
                    <StockSearchInput
                      onSelect={(stock) => {
                        addLog(`搜索选择: ${stock.name} (${stock.code})`);
                        setNewStock({
                          stockCode: stock.code,
                          stockName: stock.name
                        });
                      }}
                      placeholder="输入股票代码或名称搜索（如：000001 或 平安银行）"
                    />
                    {!newStock.stockCode && (
                      <p className="text-xs text-muted-foreground mt-1">
                        💡 请先在上方搜索框中搜索并选择股票
                      </p>
                    )}
                  </div>

                  {/* 手动输入 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">股票代码 *</label>
                      <Input
                        value={newStock.stockCode}
                        onChange={(e) => {
                          const value = e.target.value;
                          addLog(`代码输入: "${value}"`);
                          setNewStock({ ...newStock, stockCode: value });
                        }}
                        placeholder="如：000001"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">股票名称 *</label>
                      <Input
                        value={newStock.stockName}
                        onChange={(e) => {
                          const value = e.target.value;
                          addLog(`名称输入: "${value}"`);
                          setNewStock({ ...newStock, stockName: value });
                        }}
                        placeholder="如：平安银行"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      addLog('点击取消');
                      setIsAddDialogOpen(false);
                    }}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={() => {
                      addLog('点击添加按钮');
                      handleAddStock();
                    }}
                  >
                    添加
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* 测试2: 按钮状态测试 */}
          <div className="border rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold">测试2: 按钮状态测试</h2>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm mb-2">正常按钮（无disabled）</p>
                <Button onClick={() => toast.success('正常按钮可以点击')}>
                  正常按钮
                </Button>
              </div>

              <div>
                <p className="text-sm mb-2">禁用按钮（disabled=true）</p>
                <Button disabled onClick={() => toast.error('这个不应该触发')}>
                  禁用按钮
                </Button>
              </div>

              <div>
                <p className="text-sm mb-2">条件禁用（缺少输入）</p>
                <Button
                  disabled={!newStock.stockCode || !newStock.stockName}
                  onClick={() => toast.success('条件满足，可以点击')}
                >
                  {(!newStock.stockCode || !newStock.stockName)
                    ? '需要填写代码和名称'
                    : '可以点击'}
                </Button>
              </div>
            </div>
          </div>

          {/* 当前表单状态 */}
          <div className="border rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold">当前表单状态</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">股票代码:</span>
                <span className={`ml-2 ${newStock.stockCode ? 'text-green-600' : 'text-red-600'}`}>
                  {newStock.stockCode || '(空)'}
                </span>
              </div>
              <div>
                <span className="font-medium">股票名称:</span>
                <span className={`ml-2 ${newStock.stockName ? 'text-green-600' : 'text-red-600'}`}>
                  {newStock.stockName || '(空)'}
                </span>
              </div>
            </div>
            <div>
              <span className="font-medium">添加按钮状态:</span>
              <span className={`ml-2 ${newStock.stockCode && newStock.stockName ? 'text-green-600' : 'text-orange-600'}`}>
                {newStock.stockCode && newStock.stockName
                  ? '✅ 满足条件（可点击，会执行添加）'
                  : '⚠️ 不满足条件（可点击，但会显示错误提示）'}
              </span>
            </div>
          </div>

          {/* 操作日志 */}
          <div className="border rounded-lg p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">操作日志</h2>
              <Button variant="outline" size="sm" onClick={() => setTestLog([])}>
                清除日志
              </Button>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded p-4 max-h-96 overflow-y-auto">
              {testLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无日志</p>
              ) : (
                <div className="space-y-1 font-mono text-xs">
                  {testLog.map((log, index) => (
                    <div key={index}>{log}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 诊断说明 */}
          <div className="border rounded-lg p-6 space-y-4 bg-blue-50 dark:bg-blue-950">
            <h2 className="text-xl font-semibold">🔍 诊断说明</h2>
            <div className="space-y-2 text-sm">
              <p><strong>预期行为：</strong></p>
              <ol className="list-decimal ml-6 space-y-1">
                <li>点击"打开添加对话框"按钮</li>
                <li>在搜索框输入"000001"或"平安银行"</li>
                <li>点击搜索结果中的股票</li>
                <li>代码和名称会自动填入（观察"当前表单状态"）</li>
                <li>点击"添加"按钮 → 应该显示成功toast并关闭对话框</li>
              </ol>

              <p className="mt-4"><strong>或者手动输入：</strong></p>
              <ol className="list-decimal ml-6 space-y-1">
                <li>点击"打开添加对话框"按钮</li>
                <li>忽略搜索框，直接在"股票代码"输入"600519"</li>
                <li>在"股票名称"输入"贵州茅台"</li>
                <li>点击"添加"按钮 → 应该显示成功toast并关闭对话框</li>
              </ol>

              <p className="mt-4"><strong>测试点击无效情况：</strong></p>
              <ol className="list-decimal ml-6 space-y-1">
                <li>打开对话框但不填写任何内容</li>
                <li>直接点击"添加"按钮 → 应该显示错误toast "请输入股票代码和名称"</li>
                <li>查看"操作日志"确认点击事件被触发</li>
              </ol>

              <p className="mt-4 text-orange-700 dark:text-orange-400">
                <strong>⚠️ 如果点击"添加"按钮完全没有反应（日志中没有记录点击），说明：</strong>
              </p>
              <ul className="list-disc ml-6 space-y-1">
                <li>按钮被其他元素覆盖</li>
                <li>z-index层级问题</li>
                <li>CSS pointer-events设置不当</li>
                <li>事件监听器未绑定</li>
              </ul>
            </div>
          </div>

          {/* 浏览器Console诊断脚本 */}
          <div className="border rounded-lg p-6 space-y-4 bg-yellow-50 dark:bg-yellow-950">
            <h2 className="text-xl font-semibold">🛠️ 浏览器Console诊断</h2>
            <p className="text-sm">如果按钮无法点击，请在浏览器开发者工具Console中运行：</p>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded overflow-x-auto text-xs">
{`// 1. 检查对话框和按钮
const dialog = document.querySelector('[role="dialog"]');
const addButton = dialog ? Array.from(dialog.querySelectorAll('button')).find(
  btn => btn.textContent.includes('添加') && !btn.textContent.includes('取消')
) : null;

console.log('对话框:', dialog);
console.log('添加按钮:', addButton);
console.log('按钮disabled:', addButton?.disabled);

// 2. 检查按钮样式
if (addButton) {
  const styles = window.getComputedStyle(addButton);
  console.log('pointer-events:', styles.pointerEvents);
  console.log('z-index:', styles.zIndex);
  console.log('position:', styles.position);
}

// 3. 检查覆盖层
if (addButton) {
  const rect = addButton.getBoundingClientRect();
  const elementAtPoint = document.elementFromPoint(
    rect.left + rect.width / 2,
    rect.top + rect.height / 2
  );
  console.log('按钮被覆盖:', elementAtPoint !== addButton);
  console.log('覆盖元素:', elementAtPoint);
}

// 4. 手动触发点击
if (addButton) {
  console.log('尝试模拟点击...');
  addButton.click();
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
