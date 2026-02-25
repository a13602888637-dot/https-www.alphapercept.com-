"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Plus, Filter } from "lucide-react";
import { toast } from "sonner";

// 手势组件
import { DragReorderProvider, DragReorderContainer, DragReorderItemWrapper, DragReorderIndicator } from "./DragReorderProvider";
import { SwipeActions } from "./SwipeActions";
import { LongPressPreview, LongPressPreviewIndicator } from "./LongPressPreview";

// 模拟数据
const mockWatchlistItems = [
  {
    id: "1",
    stockCode: "000001",
    stockName: "平安银行",
    currentPrice: 15.42,
    priceChange: 0.32,
    priceChangePercent: 2.12,
    buyPrice: 14.50,
    stopLossPrice: 13.80,
    targetPrice: 16.80,
    notes: "金融科技龙头，数字化转型领先",
    sparklineData: [14.8, 15.0, 15.2, 15.1, 15.4, 15.3, 15.42],
  },
  {
    id: "2",
    stockCode: "000858",
    stockName: "五粮液",
    currentPrice: 185.60,
    priceChange: -2.40,
    priceChangePercent: -1.28,
    buyPrice: 175.00,
    stopLossPrice: 168.00,
    targetPrice: 210.00,
    notes: "高端白酒龙头，品牌价值突出",
    sparklineData: [188.0, 187.5, 186.8, 186.0, 185.8, 186.2, 185.6],
  },
  {
    id: "3",
    stockCode: "300750",
    stockName: "宁德时代",
    currentPrice: 245.80,
    priceChange: 8.20,
    priceChangePercent: 3.45,
    buyPrice: 230.00,
    stopLossPrice: 215.00,
    targetPrice: 280.00,
    notes: "动力电池全球龙头，技术领先",
    sparklineData: [237.0, 239.5, 242.0, 243.5, 244.0, 245.0, 245.8],
  },
  {
    id: "4",
    stockCode: "600519",
    stockName: "贵州茅台",
    currentPrice: 1980.50,
    priceChange: 25.50,
    priceChangePercent: 1.30,
    buyPrice: 1950.00,
    stopLossPrice: 1880.00,
    targetPrice: 2200.00,
    notes: "白酒行业绝对龙头，稀缺性显著",
    sparklineData: [1955.0, 1960.0, 1965.0, 1970.0, 1975.0, 1980.0, 1980.5],
  },
  {
    id: "5",
    stockCode: "002415",
    stockName: "海康威视",
    currentPrice: 38.20,
    priceChange: -0.80,
    priceChangePercent: -2.05,
    buyPrice: 40.00,
    stopLossPrice: 36.00,
    targetPrice: 45.00,
    notes: "安防监控龙头，AI赋能转型",
    sparklineData: [39.0, 38.8, 38.6, 38.4, 38.3, 38.2, 38.2],
  },
];

/**
 * 集成手势功能的Watchlist示例组件
 * 展示如何将拖拽排序、滑动操作和长按预览集成到Watchlist中
 */
export function WatchlistWithGestures() {
  const [items, setItems] = useState(mockWatchlistItems);
  const [searchQuery, setSearchQuery] = useState("");

  // 转换为拖拽排序需要的格式
  const dragReorderItems = items.map((item, index) => ({
    id: item.id,
    index,
    height: 180, // 卡片高度估计值
  }));

  // 处理项目重新排序
  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    setItems((prevItems) => {
      const newItems = [...prevItems];
      const [movedItem] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, movedItem);
      return newItems;
    });
    toast.success("顺序已调整");
  }, []);

  // 处理移除操作
  const handleRemove = useCallback((stockCode: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.stockCode !== stockCode));
  }, []);

  // 处理设置提醒操作
  const handleSetReminder = useCallback((stockCode: string, stockName: string) => {
    toast.info(`为 ${stockName} (${stockCode}) 设置价格提醒`);
  }, []);

  // 处理买入操作
  const handleBuy = useCallback((stockCode: string, stockName: string) => {
    toast.info(`准备买入 ${stockName} (${stockCode})`);
  }, []);

  // 处理卖出操作
  const handleSell = useCallback((stockCode: string, stockName: string) => {
    toast.info(`准备卖出 ${stockName} (${stockCode})`);
  }, []);

  // 处理分析操作
  const handleAnalyze = useCallback((stockCode: string, stockName: string) => {
    toast.info(`正在分析 ${stockName} (${stockCode})`);
  }, []);

  // 处理长按预览打开
  const handlePreviewOpen = useCallback((stockCode: string) => {
    console.log(`预览打开: ${stockCode}`);
  }, []);

  // 处理长按预览关闭
  const handlePreviewClose = useCallback((stockCode: string) => {
    console.log(`预览关闭: ${stockCode}`);
  }, []);

  // 渲染单个Watchlist项目
  const renderWatchlistItem = (item: typeof mockWatchlistItems[0], index: number) => {
    const profitLoss = item.buyPrice
      ? ((item.currentPrice - item.buyPrice) / item.buyPrice) * 100
      : null;

    return (
      <DragReorderItemWrapper key={item.id} index={index}>
        <SwipeActions
          stockCode={item.stockCode}
          stockName={item.stockName}
          onRemove={handleRemove}
          onSetReminder={handleSetReminder}
          onBuy={handleBuy}
          onSell={handleSell}
          onAnalyze={handleAnalyze}
          className="mb-4"
        >
          <LongPressPreview
            stockCode={item.stockCode}
            stockName={item.stockName}
            currentPrice={item.currentPrice}
            priceChange={item.priceChange}
            priceChangePercent={item.priceChangePercent}
            sparklineData={item.sparklineData}
            buyPrice={item.buyPrice}
            stopLossPrice={item.stopLossPrice}
            targetPrice={item.targetPrice}
            notes={item.notes}
            onPreviewOpen={() => handlePreviewOpen(item.stockCode)}
            onPreviewClose={() => handlePreviewClose(item.stockCode)}
          >
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {item.stockCode} - {item.stockName}
                    </CardTitle>
                    <div className="text-sm text-muted-foreground">
                      拖拽排序 • 滑动操作 • 长按预览
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">¥{item.currentPrice.toFixed(2)}</div>
                    <div
                      className={`text-sm font-medium flex items-center justify-end gap-1 ${
                        item.priceChangePercent >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {item.priceChangePercent >= 0 ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      {item.priceChangePercent >= 0 ? "+" : ""}
                      {item.priceChangePercent.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* 关键指标 */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">买入成本</div>
                      <div className="font-semibold">
                        {item.buyPrice ? `¥${item.buyPrice.toFixed(2)}` : "未设置"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">止损价</div>
                      <div className="font-semibold">
                        {item.stopLossPrice ? `¥${item.stopLossPrice.toFixed(2)}` : "未设置"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">目标价</div>
                      <div className="font-semibold">
                        {item.targetPrice ? `¥${item.targetPrice.toFixed(2)}` : "未设置"}
                      </div>
                    </div>
                  </div>

                  {/* 盈亏状态 */}
                  {profitLoss !== null && (
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">当前盈亏</div>
                        <Badge
                          variant={profitLoss >= 0 ? "default" : "destructive"}
                          className="flex items-center gap-1"
                        >
                          {profitLoss >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {profitLoss >= 0 ? "+" : ""}
                          {profitLoss.toFixed(2)}%
                        </Badge>
                      </div>
                    </div>
                  )}

                  {/* 备注预览 */}
                  {item.notes && (
                    <div className="pt-2 border-t">
                      <div className="text-xs text-muted-foreground truncate">
                        {item.notes}
                      </div>
                    </div>
                  )}

                  {/* 手势提示 */}
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span>左滑操作</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>右滑操作</span>
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full border border-muted-foreground" />
                        <span>长按预览</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </LongPressPreview>
        </SwipeActions>
      </DragReorderItemWrapper>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>自选股管理（手势交互版）</CardTitle>
              <div className="text-sm text-muted-foreground">
                体验物理引擎级别的交互手势：拖拽排序、滑动操作、长按预览
              </div>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              添加股票
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 手势功能说明 */}
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">拖拽排序</div>
                  <div className="text-sm text-muted-foreground">
                    长按卡片后拖拽调整顺序
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">滑动操作</div>
                  <div className="text-sm text-muted-foreground">
                    左右滑动显示快捷操作
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600">长按预览</div>
                  <div className="text-sm text-muted-foreground">
                    长按卡片查看详细信息
                  </div>
                </div>
              </div>
              <LongPressPreviewIndicator />
            </div>

            {/* 搜索和过滤 */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="搜索股票代码、名称..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 pl-10 rounded-lg border bg-background"
                />
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <Button variant="outline" onClick={() => setSearchQuery("")}>
                清除
              </Button>
            </div>

            {/* 拖拽排序容器 */}
            <DragReorderProvider
              items={dragReorderItems}
              onReorder={handleReorder}
              enabled={true}
            >
              <DragReorderContainer className="space-y-4">
                {items.map((item, index) => renderWatchlistItem(item, index))}
              </DragReorderContainer>
              <DragReorderIndicator />
            </DragReorderProvider>

            {/* 空状态 */}
            {items.length === 0 && (
              <div className="text-center py-12">
                <div className="text-muted-foreground mb-4">暂无自选股票</div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  添加第一只股票
                </Button>
              </div>
            )}

            {/* 使用提示 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm text-blue-800">
                <div className="font-medium mb-2">💡 使用提示：</div>
                <ul className="space-y-1 list-disc list-inside">
                  <li>长按任意卡片2秒后开始拖拽排序</li>
                  <li>左右滑动卡片显示快捷操作面板</li>
                  <li>长按卡片不松手查看详细信息预览</li>
                  <li>拖拽时具有物理阻尼和弹性效果</li>
                  <li>滑动操作超过阈值自动触发</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}