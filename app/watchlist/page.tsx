"use client";

import { useState } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { WatchlistMainList } from "@/components/watchlist/WatchlistMainList";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Settings,
  Download,
  Share2,
  Bell,
  TrendingUp,
  BarChart3,
  Grid3x3,
  List,
  Filter,
  Search
} from "lucide-react";
import { toast } from "sonner";

export default function WatchlistPage() {
  const [activeTab, setActiveTab] = useState("main");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newStock, setNewStock] = useState({
    stockCode: "",
    stockName: "",
    buyPrice: "",
    stopLossPrice: "",
    targetPrice: "",
    notes: "",
  });

  // 处理添加股票
  const handleAddStock = () => {
    if (!newStock.stockCode || !newStock.stockName) {
      toast.error("请输入股票代码和名称");
      return;
    }

    // 这里应该调用store的addItemOptimistic方法
    toast.success(`已添加 ${newStock.stockName} (${newStock.stockCode}) 到自选股`);

    // 重置表单
    setNewStock({
      stockCode: "",
      stockName: "",
      buyPrice: "",
      stopLossPrice: "",
      targetPrice: "",
      notes: "",
    });
    setIsAddDialogOpen(false);
  };

  // 处理刷新
  const handleRefresh = () => {
    toast.info("正在刷新自选股数据...");
  };

  // 处理添加项目
  const handleAddItem = () => {
    setIsAddDialogOpen(true);
  };

  // 处理项目点击
  const handleItemClick = (item: any) => {
    toast.info(`点击了 ${item.stockName} (${item.stockCode})`);
    // 这里可以导航到股票详情页面
  };

  // 导出数据
  const handleExport = () => {
    toast.info("正在导出自选股数据...");
  };

  // 分享
  const handleShare = () => {
    toast.info("正在生成分享链接...");
  };

  // 设置提醒
  const handleSetReminders = () => {
    toast.info("打开价格提醒设置...");
  };

  return (
    <PageLayout title="自选股">
      <div className="space-y-6">
        {/* 页面标题和操作栏 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">自选股</h1>
            <p className="text-muted-foreground mt-1">
              管理您的自选股票，实时跟踪价格变化和设置交易提醒
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              分享
            </Button>
            <Button variant="outline" size="sm" onClick={handleSetReminders}>
              <Bell className="h-4 w-4 mr-2" />
              提醒
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              设置
            </Button>
          </div>
        </div>

        {/* 功能卡片区域 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">12</div>
                  <div className="text-sm text-muted-foreground">自选股票</div>
                </div>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-green-600">+3.2%</div>
                  <div className="text-sm text-muted-foreground">今日平均涨幅</div>
                </div>
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">8</div>
                  <div className="text-sm text-muted-foreground">设置提醒</div>
                </div>
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Bell className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 主内容区域 */}
        <Tabs defaultValue="main" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="main" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              主列表
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex items-center gap-2">
              <Grid3x3 className="h-4 w-4" />
              分组管理
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              分析视图
            </TabsTrigger>
          </TabsList>

          {/* 主列表标签页 */}
          <TabsContent value="main" className="space-y-6">
            <WatchlistMainList
              showSearch={true}
              showFilters={true}
              showSortOptions={true}
              enableGestures={true}
              showStats={true}
              onItemClick={handleItemClick}
              onAddItem={handleAddItem}
              onRefresh={handleRefresh}
            />
          </TabsContent>

          {/* 分组管理标签页 */}
          <TabsContent value="groups" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>分组管理</CardTitle>
                    <CardDescription>
                      创建和管理自选股分组，按行业、策略或关注度分类
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    新建分组
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { name: "科技龙头", count: 5, color: "bg-blue-500" },
                      { name: "消费白马", count: 4, color: "bg-green-500" },
                      { name: "新能源", count: 3, color: "bg-emerald-500" },
                      { name: "医药健康", count: 2, color: "bg-purple-500" },
                      { name: "金融地产", count: 3, color: "bg-amber-500" },
                      { name: "观察列表", count: 1, color: "bg-gray-500" },
                    ].map((group, index) => (
                      <Card key={index} className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-semibold">{group.name}</div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {group.count} 只股票
                              </div>
                            </div>
                            <div className={`w-3 h-3 rounded-full ${group.color}`} />
                          </div>
                          <div className="mt-4">
                            <Button variant="ghost" size="sm" className="w-full">
                              查看详情
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 分析视图标签页 */}
          <TabsContent value="analysis" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>分析视图</CardTitle>
                <CardDescription>
                  自选股整体表现分析和风险评估
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">行业分布</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {[
                            { name: "科技", count: 5, percent: 42, color: "bg-blue-500" },
                            { name: "消费", count: 4, percent: 33, color: "bg-green-500" },
                            { name: "新能源", count: 3, percent: 25, color: "bg-emerald-500" },
                          ].map((item, index) => (
                            <div key={index} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                                  <span className="text-sm">{item.name}</span>
                                </div>
                                <span className="text-sm font-medium">{item.count}只 ({item.percent}%)</span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${item.color}`}
                                  style={{ width: `${item.percent}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">涨跌分布</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {[
                            { name: "上涨", count: 8, percent: 67, color: "bg-green-500" },
                            { name: "下跌", count: 3, percent: 25, color: "bg-red-500" },
                            { name: "平盘", count: 1, percent: 8, color: "bg-gray-500" },
                          ].map((item, index) => (
                            <div key={index} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                                  <span className="text-sm">{item.name}</span>
                                </div>
                                <span className="text-sm font-medium">{item.count}只 ({item.percent}%)</span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${item.color}`}
                                  style={{ width: `${item.percent}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">风险评估</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">平均波动率</span>
                          <Badge variant="outline">中等</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">相关性风险</span>
                          <Badge variant="outline">较低</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">流动性风险</span>
                          <Badge variant="outline">低</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">整体风险等级</span>
                          <Badge className="bg-amber-500">中等偏低</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 添加股票对话框 */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>添加自选股</DialogTitle>
              <DialogDescription>
                输入股票信息并设置价格提醒
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stockCode">股票代码</Label>
                  <Input
                    id="stockCode"
                    value={newStock.stockCode}
                    onChange={(e) => setNewStock({ ...newStock, stockCode: e.target.value })}
                    placeholder="如：000001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stockName">股票名称</Label>
                  <Input
                    id="stockName"
                    value={newStock.stockName}
                    onChange={(e) => setNewStock({ ...newStock, stockName: e.target.value })}
                    placeholder="如：平安银行"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="buyPrice">买入成本</Label>
                  <Input
                    id="buyPrice"
                    type="number"
                    step="0.01"
                    value={newStock.buyPrice}
                    onChange={(e) => setNewStock({ ...newStock, buyPrice: e.target.value })}
                    placeholder="可选"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stopLossPrice">止损价</Label>
                  <Input
                    id="stopLossPrice"
                    type="number"
                    step="0.01"
                    value={newStock.stopLossPrice}
                    onChange={(e) => setNewStock({ ...newStock, stopLossPrice: e.target.value })}
                    placeholder="可选"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetPrice">目标价</Label>
                  <Input
                    id="targetPrice"
                    type="number"
                    step="0.01"
                    value={newStock.targetPrice}
                    onChange={(e) => setNewStock({ ...newStock, targetPrice: e.target.value })}
                    placeholder="可选"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">备注</Label>
                <Input
                  id="notes"
                  value={newStock.notes}
                  onChange={(e) => setNewStock({ ...newStock, notes: e.target.value })}
                  placeholder="添加备注..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleAddStock}>添加</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 使用提示 */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Bell className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-blue-800 mb-1">💡 使用提示</div>
                <div className="text-sm text-blue-700 space-y-1">
                  <div>• 长按列表项可拖拽调整顺序</div>
                  <div>• 左右滑动列表项显示快捷操作</div>
                  <div>• 使用搜索和过滤快速找到目标股票</div>
                  <div>• 设置价格提醒及时把握交易机会</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}