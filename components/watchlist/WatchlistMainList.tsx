"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  SortAsc,
  SortDesc,
  X,
  Plus,
  RefreshCw,
  AlertCircle,
  Grid3x3,
  List,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWatchlistStore, WatchlistItem as WatchlistItemType } from "@/lib/store";
import { WatchlistItem } from "./WatchlistItem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// 手势组件
import { DragReorderProvider, DragReorderContainer, DragReorderItemWrapper } from "./gestures/DragReorderProvider";
import { SwipeActions } from "./gestures/SwipeActions";
import { LongPressPreview } from "./gestures/LongPressPreview";

export interface WatchlistMainListProps {
  // 显示模式
  displayMode?: "list" | "grid";
  // 是否显示搜索框
  showSearch?: boolean;
  // 是否显示过滤器
  showFilters?: boolean;
  // 是否显示排序选项
  showSortOptions?: boolean;
  // 是否启用手势交互
  enableGestures?: boolean;
  // 是否显示分组
  showGroups?: boolean;
  // 是否显示统计信息
  showStats?: boolean;
  // 是否启用虚拟滚动（长列表优化）
  enableVirtualScroll?: boolean;
  // 自定义类名
  className?: string;
  // 点击项目回调
  onItemClick?: (item: WatchlistItemType) => void;
  // 添加项目回调
  onAddItem?: () => void;
  // 刷新数据回调
  onRefresh?: () => void;
}

// 排序选项类型
type SortOption = "name" | "code" | "price" | "change" | "changePercent" | "custom";
type SortDirection = "asc" | "desc";

// 过滤选项类型
interface FilterOptions {
  priceChange: "all" | "up" | "down" | "neutral";
  hasNotes: boolean;
  hasTargetPrice: boolean;
  hasStopLoss: boolean;
}

/**
 * Watchlist主列表组件
 * 集成zustand store、手势交互、搜索过滤排序功能
 */
export function WatchlistMainList({
  displayMode = "list",
  showSearch = true,
  showFilters = true,
  showSortOptions = true,
  enableGestures = true,
  showGroups = false,
  showStats = true,
  enableVirtualScroll = false,
  className,
  onItemClick,
  onAddItem,
  onRefresh,
}: WatchlistMainListProps) {
  // 从store获取数据
  const store = useWatchlistStore();
  const items = store.getFavoriteItems();
  const isLoading = store.isLoading;
  const error = store.error;
  const itemOrder = store.itemOrder;
  const groups = store.groups;

  // 本地状态
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("custom");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    priceChange: "all",
    hasNotes: false,
    hasTargetPrice: false,
    hasStopLoss: false,
  });
  const [activeGroup, setActiveGroup] = useState<string | "all">("all");
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  // 处理项目点击
  const handleItemClick = useCallback((item: WatchlistItemType) => {
    setSelectedItem(item.stockCode);
    onItemClick?.(item);
  }, [onItemClick]);

  // 处理删除项目
  const handleDeleteItem = useCallback((stockCode: string) => {
    store.removeItemOptimistic(stockCode);
    toast.success("已从自选股移除");
  }, [store]);

  // 处理编辑项目
  const handleEditItem = useCallback((item: WatchlistItemType) => {
    toast.info(`编辑 ${item.stockName} (${item.stockCode})`);
    // 这里可以打开编辑对话框
  }, []);

  // 处理查看详情
  const handleViewDetails = useCallback((item: WatchlistItemType) => {
    toast.info(`查看 ${item.stockName} (${item.stockCode}) 详情`);
    // 这里可以导航到详情页面
  }, []);

  // 处理刷新
  const handleRefresh = useCallback(() => {
    store.syncWithServer();
    onRefresh?.();
  }, [store, onRefresh]);

  // 处理添加项目
  const handleAddItem = useCallback(() => {
    onAddItem?.();
  }, [onAddItem]);

  // 处理重新排序
  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    // 更新store中的顺序
    const newOrder = [...itemOrder];
    const [movedItem] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedItem);
    store.reorderItems(newOrder);
    toast.success("顺序已调整");
  }, [itemOrder, store]);

  // 处理滑动操作 - 移除
  const handleSwipeRemove = useCallback((stockCode: string, stockName: string) => {
    store.removeItemOptimistic(stockCode);
    toast.success(`已移除 ${stockName} (${stockCode})`);
  }, [store]);

  // 处理滑动操作 - 设置提醒
  const handleSwipeSetReminder = useCallback((stockCode: string, stockName: string) => {
    toast.info(`为 ${stockName} (${stockCode}) 设置价格提醒`);
  }, []);

  // 处理滑动操作 - 买入
  const handleSwipeBuy = useCallback((stockCode: string, stockName: string) => {
    toast.info(`准备买入 ${stockName} (${stockCode})`);
  }, []);

  // 处理滑动操作 - 卖出
  const handleSwipeSell = useCallback((stockCode: string, stockName: string) => {
    toast.info(`准备卖出 ${stockName} (${stockCode})`);
  }, []);

  // 处理滑动操作 - 分析
  const handleSwipeAnalyze = useCallback((stockCode: string, stockName: string) => {
    toast.info(`正在分析 ${stockName} (${stockCode})`);
  }, []);

  // 处理长按预览
  const handlePreviewOpen = useCallback((stockCode: string) => {
    console.log(`预览打开: ${stockCode}`);
  }, []);

  const handlePreviewClose = useCallback((stockCode: string) => {
    console.log(`预览关闭: ${stockCode}`);
  }, []);

  // 过滤和排序项目
  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    // 应用搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.stockCode.toLowerCase().includes(query) ||
        item.stockName.toLowerCase().includes(query) ||
        (item.notes && item.notes.toLowerCase().includes(query))
      );
    }

    // 应用价格变化过滤
    if (filterOptions.priceChange !== "all") {
      result = result.filter(item => {
        if (!item.priceChangePercent) return false;
        if (filterOptions.priceChange === "up") return item.priceChangePercent > 0;
        if (filterOptions.priceChange === "down") return item.priceChangePercent < 0;
        if (filterOptions.priceChange === "neutral") return item.priceChangePercent === 0;
        return true;
      });
    }

    // 应用备注过滤
    if (filterOptions.hasNotes) {
      result = result.filter(item => item.notes && item.notes.trim().length > 0);
    }

    // 应用目标价过滤
    if (filterOptions.hasTargetPrice) {
      result = result.filter(item => item.targetPrice != null);
    }

    // 应用止损价过滤
    if (filterOptions.hasStopLoss) {
      result = result.filter(item => item.stopLossPrice != null);
    }

    // 应用分组过滤
    if (activeGroup !== "all") {
      const group = groups.find(g => g.id === activeGroup);
      if (group) {
        result = result.filter(item => group.itemIds.includes(item.id));
      }
    }

    // 应用排序
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortOption) {
        case "name":
          comparison = a.stockName.localeCompare(b.stockName);
          break;
        case "code":
          comparison = a.stockCode.localeCompare(b.stockCode);
          break;
        case "price":
          comparison = (a.currentPrice || 0) - (b.currentPrice || 0);
          break;
        case "change":
          comparison = (a.priceChange || 0) - (b.priceChange || 0);
          break;
        case "changePercent":
          comparison = (a.priceChangePercent || 0) - (b.priceChangePercent || 0);
          break;
        case "custom":
          // 使用store中的顺序
          const indexA = itemOrder.indexOf(a.stockCode);
          const indexB = itemOrder.indexOf(b.stockCode);
          comparison = indexA - indexB;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [items, searchQuery, filterOptions, activeGroup, groups, sortOption, sortDirection, itemOrder]);

  // 计算统计信息
  const stats = useMemo(() => {
    const total = items.length;
    const filtered = filteredAndSortedItems.length;
    const upCount = items.filter(item => (item.priceChangePercent || 0) > 0).length;
    const downCount = items.filter(item => (item.priceChangePercent || 0) < 0).length;
    const neutralCount = items.filter(item => (item.priceChangePercent || 0) === 0).length;
    const withNotesCount = items.filter(item => item.notes && item.notes.trim().length > 0).length;
    const withTargetPriceCount = items.filter(item => item.targetPrice != null).length;
    const withStopLossCount = items.filter(item => item.stopLossPrice != null).length;

    return {
      total,
      filtered,
      upCount,
      downCount,
      neutralCount,
      withNotesCount,
      withTargetPriceCount,
      withStopLossCount,
      searchActive: searchQuery.trim().length > 0,
      filterActive: filterOptions.priceChange !== "all" || filterOptions.hasNotes || filterOptions.hasTargetPrice || filterOptions.hasStopLoss,
    };
  }, [items, filteredAndSortedItems, searchQuery, filterOptions]);

  // 渲染单个项目（带手势包装）
  const renderItemWithGestures = useCallback((item: WatchlistItemType, index: number) => {
    const isSelected = selectedItem === item.stockCode;

    const itemContent = (
      <WatchlistItem
        item={item}
        isSelected={isSelected}
        onClick={handleItemClick}
        onDelete={handleDeleteItem}
        onEdit={handleEditItem}
        onViewDetails={handleViewDetails}
        className="mb-4"
      />
    );

    if (!enableGestures) {
      return itemContent;
    }

    return (
      <DragReorderItemWrapper key={item.id} index={index}>
        <SwipeActions
          stockCode={item.stockCode}
          stockName={item.stockName}
          onRemove={handleSwipeRemove}
          onSetReminder={handleSwipeSetReminder}
          onBuy={handleSwipeBuy}
          onSell={handleSwipeSell}
          onAnalyze={handleSwipeAnalyze}
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
            {itemContent}
          </LongPressPreview>
        </SwipeActions>
      </DragReorderItemWrapper>
    );
  }, [
    selectedItem,
    enableGestures,
    handleItemClick,
    handleDeleteItem,
    handleEditItem,
    handleViewDetails,
    handleSwipeRemove,
    handleSwipeSetReminder,
    handleSwipeBuy,
    handleSwipeSell,
    handleSwipeAnalyze,
    handlePreviewOpen,
    handlePreviewClose,
  ]);

  // 渲染加载状态
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>自选股</CardTitle>
          <CardDescription>正在加载您的自选股...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">请稍候...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 渲染错误状态
  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>自选股</CardTitle>
          <CardDescription>加载自选股时发生错误</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              重试
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* 统计信息卡片 */}
      {showStats && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">总数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.upCount}</div>
                <div className="text-sm text-muted-foreground">上涨</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.downCount}</div>
                <div className="text-sm text-muted-foreground">下跌</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{stats.neutralCount}</div>
                <div className="text-sm text-muted-foreground">平盘</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.withNotesCount}</div>
                <div className="text-sm text-muted-foreground">有备注</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.withTargetPriceCount}</div>
                <div className="text-sm text-muted-foreground">有目标价</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.withStopLossCount}</div>
                <div className="text-sm text-muted-foreground">有止损价</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 主卡片 */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>自选股</CardTitle>
              <CardDescription>
                管理您的自选股票，实时跟踪价格变化
                {stats.searchActive && ` • 找到 ${stats.filtered} 个结果`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={isLoading}
                title="刷新数据"
              >
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
              <Button onClick={handleAddItem}>
                <Plus className="h-4 w-4 mr-2" />
                添加股票
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* 搜索和过滤区域 */}
            <div className="space-y-4">
              {/* 搜索框 */}
              {showSearch && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索股票代码、名称或备注..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}

              {/* 过滤和排序工具栏 */}
              {(showFilters || showSortOptions) && (
                <div className="flex flex-wrap items-center gap-2">
                  {/* 分组选择器 */}
                  {showGroups && groups.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Grid3x3 className="h-4 w-4 mr-2" />
                          {activeGroup === "all" ? "所有分组" : groups.find(g => g.id === activeGroup)?.name || "选择分组"}
                          <ChevronDown className="h-4 w-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setActiveGroup("all")}>
                          所有分组 ({items.length})
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {groups.map(group => (
                          <DropdownMenuItem
                            key={group.id}
                            onClick={() => setActiveGroup(group.id)}
                          >
                            {group.name} ({group.itemIds.length})
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {/* 价格变化过滤器 */}
                  {showFilters && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Filter className="h-4 w-4 mr-2" />
                          价格变化
                          <ChevronDown className="h-4 w-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setFilterOptions(prev => ({ ...prev, priceChange: "all" }))}>
                          全部
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFilterOptions(prev => ({ ...prev, priceChange: "up" }))}>
                          上涨
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFilterOptions(prev => ({ ...prev, priceChange: "down" }))}>
                          下跌
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFilterOptions(prev => ({ ...prev, priceChange: "neutral" }))}>
                          平盘
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {/* 其他过滤器 */}
                  {showFilters && (
                    <>
                      <Button
                        variant={filterOptions.hasNotes ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilterOptions(prev => ({ ...prev, hasNotes: !prev.hasNotes }))}
                      >
                        有备注
                      </Button>
                      <Button
                        variant={filterOptions.hasTargetPrice ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilterOptions(prev => ({ ...prev, hasTargetPrice: !prev.hasTargetPrice }))}
                      >
                        有目标价
                      </Button>
                      <Button
                        variant={filterOptions.hasStopLoss ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilterOptions(prev => ({ ...prev, hasStopLoss: !prev.hasStopLoss }))}
                      >
                        有止损价
                      </Button>
                    </>
                  )}

                  {/* 排序选项 */}
                  {showSortOptions && (
                    <div className="flex items-center gap-1 ml-auto">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            {sortOption === "name" && "名称"}
                            {sortOption === "code" && "代码"}
                            {sortOption === "price" && "价格"}
                            {sortOption === "change" && "涨跌额"}
                            {sortOption === "changePercent" && "涨跌幅"}
                            {sortOption === "custom" && "自定义"}
                            <ChevronDown className="h-4 w-4 ml-2" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => setSortOption("custom")}>
                            自定义顺序
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSortOption("name")}>
                            按名称排序
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSortOption("code")}>
                            按代码排序
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSortOption("price")}>
                            按价格排序
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSortOption("change")}>
                            按涨跌额排序
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSortOption("changePercent")}>
                            按涨跌幅排序
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setSortDirection(prev => prev === "asc" ? "desc" : "asc")}
                      >
                        {sortDirection === "asc" ? (
                          <SortAsc className="h-4 w-4" />
                        ) : (
                          <SortDesc className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* 活动过滤器标签 */}
              {(stats.searchActive || stats.filterActive) && (
                <div className="flex flex-wrap items-center gap-2">
                  {stats.searchActive && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      搜索: {searchQuery}
                      <button onClick={() => setSearchQuery("")} className="ml-1">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {filterOptions.priceChange !== "all" && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      价格: {filterOptions.priceChange === "up" ? "上涨" : filterOptions.priceChange === "down" ? "下跌" : "平盘"}
                      <button onClick={() => setFilterOptions(prev => ({ ...prev, priceChange: "all" }))} className="ml-1">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {filterOptions.hasNotes && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      有备注
                      <button onClick={() => setFilterOptions(prev => ({ ...prev, hasNotes: false }))} className="ml-1">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {filterOptions.hasTargetPrice && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      有目标价
                      <button onClick={() => setFilterOptions(prev => ({ ...prev, hasTargetPrice: false }))} className="ml-1">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {filterOptions.hasStopLoss && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      有止损价
                      <button onClick={() => setFilterOptions(prev => ({ ...prev, hasStopLoss: false }))} className="ml-1">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {(stats.searchActive || stats.filterActive) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchQuery("");
                        setFilterOptions({
                          priceChange: "all",
                          hasNotes: false,
                          hasTargetPrice: false,
                          hasStopLoss: false,
                        });
                      }}
                    >
                      清除所有
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* 列表内容 */}
            <AnimatePresence mode="wait">
              {filteredAndSortedItems.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="text-center py-12"
                >
                  <div className="text-muted-foreground mb-4">
                    {stats.searchActive || stats.filterActive
                      ? "未找到匹配的股票"
                      : "暂无自选股票"}
                  </div>
                  {!stats.searchActive && !stats.filterActive && (
                    <Button onClick={handleAddItem}>
                      <Plus className="h-4 w-4 mr-2" />
                      添加第一只股票
                    </Button>
                  )}
                  {(stats.searchActive || stats.filterActive) && (
                    <Button variant="outline" onClick={() => {
                      setSearchQuery("");
                      setFilterOptions({
                        priceChange: "all",
                        hasNotes: false,
                        hasTargetPrice: false,
                        hasStopLoss: false,
                      });
                    }}>
                      清除搜索和过滤
                    </Button>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {/* 拖拽排序容器 */}
                  {enableGestures ? (
                    <DragReorderProvider
                      items={filteredAndSortedItems.map((item, index) => ({
                        id: item.id,
                        index,
                        height: 180, // 估计高度
                      }))}
                      onReorder={handleReorder}
                      enabled={sortOption === "custom"} // 只有在自定义排序时才启用拖拽
                    >
                      <DragReorderContainer className="space-y-4">
                        {filteredAndSortedItems.map((item, index) =>
                          renderItemWithGestures(item, index)
                        )}
                      </DragReorderContainer>
                    </DragReorderProvider>
                  ) : (
                    <div className="space-y-4">
                      {filteredAndSortedItems.map((item, index) =>
                        renderItemWithGestures(item, index)
                      )}
                    </div>
                  )}

                  {/* 列表统计信息 */}
                  <div className="mt-6 pt-4 border-t text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>
                        显示 {filteredAndSortedItems.length} 个项目
                        {stats.searchActive && `（共 ${stats.total} 个）`}
                      </span>
                      {sortOption !== "custom" && enableGestures && (
                        <span className="text-xs">
                          提示：切换到"自定义顺序"可启用拖拽排序
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}