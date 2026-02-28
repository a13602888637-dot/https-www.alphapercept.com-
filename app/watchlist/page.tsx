"use client";

import { useState } from "react";
import { WatchlistManager } from "@/components/watchlist/WatchlistManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { toast } from "sonner";

export default function WatchlistPage() {
  const [activeTab, setActiveTab] = useState("main");

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
    <div className="container mx-auto py-6 px-4">
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

          {/* 主列表标签页 - 使用WatchlistManager组件 */}
          <TabsContent value="main" className="space-y-6">
            <WatchlistManager />
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
      </div>
    </div>
  );
}