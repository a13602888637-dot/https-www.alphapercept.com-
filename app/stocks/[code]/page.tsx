"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { StockChart } from "@/components/charts/StockChart";
import { TechnicalIndicators } from "@/components/charts/TechnicalIndicators";
import { ChatInterface } from "@/components/ai-chat/ChatInterface";

interface StockDetail {
  symbol: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  turnover: number;
  lastUpdate: string;
}

interface IntelligenceAnalysis {
  eventSummary: string;
  industryTrend: string;
  trapProbability: number;
  actionSignal: string;
  targetPrice: number | null;
  stopLoss: number | null;
  logicChain: any;
  createdAt: string;
}

export default function StockDetailPage() {
  const params = useParams();
  const router = useRouter();
  const stockCode = params.code as string;

  const [stockDetail, setStockDetail] = useState<StockDetail | null>(null);
  const [analysis, setAnalysis] = useState<IntelligenceAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [isAddingToWatchlist, setIsAddingToWatchlist] = useState(false);

  useEffect(() => {
    if (stockCode) {
      fetchStockDetail();
      fetchAnalysis();
      checkWatchlistStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockCode]);

  const fetchStockDetail = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/stock-prices?symbols=${stockCode}`);
      if (!response.ok) {
        throw new Error("Failed to fetch stock details");
      }
      const data = await response.json();

      if (data.success && data.prices && data.prices[stockCode]) {
        const priceData = data.prices[stockCode];
        setStockDetail({
          symbol: stockCode,
          name: priceData.name || stockCode,
          currentPrice: priceData.price,
          change: priceData.change || 0,
          changePercent: priceData.changePercent || 0,
          high: priceData.high || priceData.price,
          low: priceData.low || priceData.price,
          volume: priceData.volume || 0,
          turnover: priceData.turnover || 0,
          lastUpdate: priceData.lastUpdate || new Date().toISOString()
        });
      } else {
        throw new Error("Stock data not available");
      }
    } catch (error) {
      console.error("Error fetching stock detail:", error);
      toast.error("获取股票详情失败");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAnalysis = async () => {
    try {
      const response = await fetch(`/api/intelligence-feed?stockCode=${stockCode}&limit=1`);
      if (!response.ok) {
        console.warn("No analysis available yet");
        return;
      }
      const data = await response.json();

      if (data.success && data.feed && data.feed.length > 0) {
        const feed = data.feed[0];
        setAnalysis({
          eventSummary: feed.eventSummary,
          industryTrend: feed.industryTrend,
          trapProbability: feed.trapProbability,
          actionSignal: feed.actionSignal,
          targetPrice: feed.targetPrice,
          stopLoss: feed.stopLoss,
          logicChain: feed.logicChain,
          createdAt: feed.createdAt
        });
      }
    } catch (error) {
      console.error("Error fetching analysis:", error);
    }
  };

  const checkWatchlistStatus = async () => {
    try {
      const response = await fetch("/api/watchlist");
      if (!response.ok) return;

      const data = await response.json();
      if (data.success && data.watchlist) {
        const exists = data.watchlist.some((item: any) => item.stockCode === stockCode);
        setIsInWatchlist(exists);
      }
    } catch (error) {
      console.error("Error checking watchlist status:", error);
    }
  };

  const handleAddToWatchlist = async () => {
    if (!stockDetail) return;

    setIsAddingToWatchlist(true);
    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stockCode: stockDetail.symbol,
          stockName: stockDetail.name,
          buyPrice: stockDetail.currentPrice,
          targetPrice: analysis?.targetPrice || null,
          stopLossPrice: analysis?.stopLoss || null,
          notes: `添加于 ${new Date().toLocaleString()}`
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "添加失败");
      }

      const data = await response.json();
      if (data.success) {
        toast.success("已添加到自选股");
        setIsInWatchlist(true);
      } else {
        throw new Error(data.error || "添加失败");
      }
    } catch (error) {
      console.error("Error adding to watchlist:", error);
      toast.error(error instanceof Error ? error.message : "添加到自选股失败");
    } finally {
      setIsAddingToWatchlist(false);
    }
  };

  const handleTriggerAnalysis = async () => {
    try {
      toast.info("正在触发AI分析，这可能需要10-30秒...");
      const response = await fetch("/api/analyze-watchlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stockSymbols: [stockCode]
        }),
      });

      if (!response.ok) {
        throw new Error("分析请求失败");
      }

      const data = await response.json();
      if (data.success) {
        toast.success("AI分析完成！");
        await fetchAnalysis();
      } else {
        throw new Error(data.error || "分析失败");
      }
    } catch (error) {
      console.error("Error triggering analysis:", error);
      toast.error(error instanceof Error ? error.message : "触发AI分析失败");
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex flex-col items-center justify-center h-96 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">正在加载股票详情...</p>
        </div>
      </div>
    );
  }

  if (!stockDetail) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>股票详情</CardTitle>
            <CardDescription>未找到股票信息</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              无法加载股票代码 {stockCode} 的详细信息
            </p>
            <Button onClick={() => router.back()} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const priceChangeColor = stockDetail.change >= 0 ? "text-green-600" : "text-red-600";
  const priceChangeIcon = stockDetail.change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTriggerAnalysis}>刷新AI分析</Button>
          {!isInWatchlist ? (
            <Button onClick={handleAddToWatchlist} disabled={isAddingToWatchlist}>
              {isAddingToWatchlist ? "添加中..." : (<><Plus className="mr-2 h-4 w-4" />添加到自选股</>)}
            </Button>
          ) : (
            <Button variant="secondary" disabled><Check className="mr-2 h-4 w-4" />已在自选股中</Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-3xl">{stockDetail.name}</CardTitle>
              <CardDescription className="text-lg mt-1">{stockDetail.symbol}</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold">¥{stockDetail.currentPrice.toFixed(2)}</div>
              <div className={`flex items-center justify-end gap-2 mt-2 ${priceChangeColor}`}>
                {priceChangeIcon}
                <span className="text-xl font-semibold">
                  {stockDetail.change >= 0 ? "+" : ""}{stockDetail.change.toFixed(2)}
                  ({stockDetail.changePercent >= 0 ? "+" : ""}{stockDetail.changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><div className="text-sm text-muted-foreground">最高</div><div className="text-lg font-semibold">¥{stockDetail.high.toFixed(2)}</div></div>
            <div><div className="text-sm text-muted-foreground">最低</div><div className="text-lg font-semibold">¥{stockDetail.low.toFixed(2)}</div></div>
            <div><div className="text-sm text-muted-foreground">成交量</div><div className="text-lg font-semibold">{(stockDetail.volume / 10000).toFixed(2)}万手</div></div>
            <div><div className="text-sm text-muted-foreground">成交额</div><div className="text-lg font-semibold">¥{(stockDetail.turnover / 100000000).toFixed(2)}亿</div></div>
          </div>
          <div className="mt-4 text-sm text-muted-foreground">更新时间: {new Date(stockDetail.lastUpdate).toLocaleString()}</div>
        </CardContent>
      </Card>

      {/* K线图 - Apple + Robinhood风格 */}
      <Card>
        <CardContent className="pt-6">
          <StockChart
            stockCode={stockCode}
            stockName={stockDetail.name}
            currentPrice={stockDetail.currentPrice}
            changePercent={stockDetail.changePercent}
          />
        </CardContent>
      </Card>

      {/* 技术指标 */}
      <TechnicalIndicators stockCode={stockCode} stockName={stockDetail.name} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div><CardTitle>AI智能分析</CardTitle><CardDescription>基于五大投资流派的深度分析</CardDescription></div>
            {analysis && (<Badge variant={analysis.trapProbability > 50 ? "destructive" : analysis.trapProbability > 30 ? "default" : "secondary"}>{analysis.actionSignal}</Badge>)}
          </div>
        </CardHeader>
        <CardContent>
          {analysis ? (
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="summary">概要</TabsTrigger>
                <TabsTrigger value="signals">交易信号</TabsTrigger>
                <TabsTrigger value="logic">逻辑链</TabsTrigger>
                <TabsTrigger value="chat">💬 AI对话</TabsTrigger>
              </TabsList>
              <TabsContent value="summary" className="space-y-4">
                <div><h3 className="font-semibold mb-2">事件摘要</h3><p className="text-sm text-muted-foreground">{analysis.eventSummary}</p></div>
                <div><h3 className="font-semibold mb-2">行业趋势</h3><p className="text-sm text-muted-foreground">{analysis.industryTrend}</p></div>
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <AlertTriangle className={`h-6 w-6 ${analysis.trapProbability > 50 ? "text-red-600" : analysis.trapProbability > 30 ? "text-yellow-600" : "text-green-600"}`} />
                  <div><div className="font-semibold">陷阱概率</div><div className="text-2xl font-bold">{analysis.trapProbability}%</div></div>
                </div>
              </TabsContent>
              <TabsContent value="signals" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">交易信号</div><div className="text-2xl font-bold mt-2">{analysis.actionSignal}</div></CardContent></Card>
                  <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">目标价</div><div className="text-2xl font-bold mt-2">{analysis.targetPrice ? `¥${analysis.targetPrice.toFixed(2)}` : "未设定"}</div></CardContent></Card>
                  <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">止损价</div><div className="text-2xl font-bold mt-2">{analysis.stopLoss ? `¥${analysis.stopLoss.toFixed(2)}` : "未设定"}</div></CardContent></Card>
                </div>
              </TabsContent>
              <TabsContent value="logic" className="space-y-4">
                <div className="p-4 bg-muted rounded-lg"><h3 className="font-semibold mb-4">完整推理逻辑链</h3><pre className="text-xs overflow-x-auto whitespace-pre-wrap">{JSON.stringify(analysis.logicChain, null, 2)}</pre></div>
                <div className="text-sm text-muted-foreground">分析时间: {new Date(analysis.createdAt).toLocaleString()}</div>
              </TabsContent>
              <TabsContent value="chat">
                <ChatInterface
                  stockCode={stockCode}
                  stockName={stockDetail.name}
                  initialContext={{
                    currentPrice: stockDetail.currentPrice,
                    changePercent: stockDetail.changePercent,
                  }}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">暂无AI分析数据</p>
              <Button onClick={handleTriggerAnalysis} variant="outline">立即生成AI分析</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
