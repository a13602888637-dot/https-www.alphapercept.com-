"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageLayout } from "@/components/layout/page-layout";
import { BackNavigation } from "@/components/layout/back-navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  BarChart3,
  Calendar,
  DollarSign,
  Percent,
  Volume2,
  Clock,
  ExternalLink,
  Plus
} from "lucide-react";
import { toast } from "sonner";

interface StockData {
  symbol: string;
  name: string;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  volume: number;
  marketCap: number;
  peRatio: number;
  dividendYield: number;
  sector: string;
  industry: string;
}

export default function StockDetailPage({ params }: { params: { symbol: string } }) {
  const router = useRouter();
  const { symbol } = params;
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [error, setError] = useState<string | null>(null);

  // 验证股票代码格式
  useEffect(() => {
    if (!symbol || typeof symbol !== 'string') {
      setError("无效的股票代码");
      toast.error("股票代码格式错误");
      router.push("/watchlist");
      return;
    }

    // 简单的股票代码格式验证（支持A股、港股、美股）
    const stockCodeRegex = /^[A-Za-z0-9]{1,10}$/;
    if (!stockCodeRegex.test(symbol)) {
      setError(`股票代码格式无效: ${symbol}`);
      toast.error("股票代码格式错误，请检查后重试");
      router.push("/watchlist");
      return;
    }
  }, [symbol, router]);

  // 模拟获取股票数据
  useEffect(() => {
    const fetchStockData = async () => {
      setLoading(true);
      try {
        // 模拟API调用
        await new Promise(resolve => setTimeout(resolve, 500));

        // 模拟数据
        const mockData: StockData = {
          symbol: symbol.toUpperCase(),
          name: symbol === "000001" ? "平安银行" :
                symbol === "000002" ? "万科A" :
                symbol === "600519" ? "贵州茅台" : `${symbol}公司`,
          currentPrice: Math.random() * 100 + 50,
          priceChange: (Math.random() - 0.5) * 10,
          priceChangePercent: (Math.random() - 0.5) * 5,
          open: Math.random() * 100 + 50,
          high: Math.random() * 110 + 60,
          low: Math.random() * 90 + 40,
          previousClose: Math.random() * 100 + 50,
          volume: Math.floor(Math.random() * 10000000) + 1000000,
          marketCap: Math.floor(Math.random() * 100000000000) + 10000000000,
          peRatio: Math.random() * 50 + 10,
          dividendYield: Math.random() * 5,
          sector: symbol === "000001" ? "金融" :
                  symbol === "000002" ? "房地产" :
                  symbol === "600519" ? "消费" : "其他",
          industry: symbol === "000001" ? "银行" :
                    symbol === "000002" ? "房地产开发" :
                    symbol === "600519" ? "白酒" : "制造业",
        };

        setStockData(mockData);
      } catch (error) {
        console.error("获取股票数据失败:", error);
        toast.error("获取股票数据失败");
      } finally {
        setLoading(false);
      }
    };

    fetchStockData();
  }, [symbol]);

  // 添加到自选股
  const handleAddToWatchlist = () => {
    toast.success(`已添加 ${symbol} 到自选股`);
  };

  // 格式化数字
  const formatNumber = (num: number) => {
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(2) + 'B';
    }
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(2) + 'K';
    }
    return num.toFixed(2);
  };

  // 格式化货币
  const formatCurrency = (num: number) => {
    return `¥${num.toFixed(2)}`;
  };

  if (error) {
    return (
      <PageLayout title="股票详情">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <BackNavigation />
            <div>
              <h1 className="text-2xl font-bold text-red-600">错误</h1>
              <p className="text-gray-600 mt-1">{error}</p>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>股票代码验证失败</CardTitle>
              <CardDescription>无法加载股票详情，请检查股票代码格式</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-700">
                  股票代码 <code className="bg-gray-100 px-2 py-1 rounded">{symbol}</code> 格式无效。
                </p>
                <div className="space-y-2">
                  <p className="font-medium">支持的股票代码格式：</p>
                  <ul className="list-disc pl-5 space-y-1 text-gray-600">
                    <li>A股：000001、600519</li>
                    <li>港股：00700、00941</li>
                    <li>美股：AAPL、TSLA、GOOGL</li>
                    <li>其他：1-10位字母数字组合</li>
                  </ul>
                </div>
                <Button onClick={() => router.push("/watchlist")} className="mt-4">
                  返回自选股列表
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    );
  }

  if (loading) {
    return (
      <PageLayout title="股票详情">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <BackNavigation />
            <div>
              <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-48 bg-gray-200 rounded animate-pulse mt-2"></div>
            </div>
          </div>
          <Card>
            <CardHeader>
              <div className="h-6 w-48 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-64 bg-gray-200 rounded animate-pulse mt-2"></div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-8 w-32 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    );
  }

  if (!stockData) {
    return (
      <PageLayout title="股票详情">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">股票数据未找到</h2>
          <p className="text-muted-foreground mb-6">无法找到股票代码: {symbol}</p>
          <Button onClick={() => router.back()}>返回</Button>
        </div>
      </PageLayout>
    );
  }

  const isPositive = stockData.priceChangePercent > 0;

  return (
    <PageLayout title={`${stockData.symbol} - ${stockData.name}`}>
      <div className="space-y-6">
        {/* 头部导航和操作 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <BackNavigation />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{stockData.symbol}</h1>
              <p className="text-muted-foreground">{stockData.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              外部链接
            </Button>
            <Button onClick={handleAddToWatchlist}>
              <Plus className="h-4 w-4 mr-2" />
              加入自选
            </Button>
          </div>
        </div>

        {/* 价格卡片 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <div className="text-4xl font-bold mb-2">
                  {formatCurrency(stockData.currentPrice)}
                </div>
                <div className={`flex items-center gap-2 text-xl font-semibold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isPositive ? (
                    <ArrowUpRight className="h-5 w-5" />
                  ) : (
                    <ArrowDownRight className="h-5 w-5" />
                  )}
                  <span>{isPositive ? '+' : ''}{stockData.priceChange.toFixed(2)}</span>
                  <span>({isPositive ? '+' : ''}{stockData.priceChangePercent.toFixed(2)}%)</span>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">开盘</div>
                  <div className="font-medium">{formatCurrency(stockData.open)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">最高</div>
                  <div className="font-medium">{formatCurrency(stockData.high)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">最低</div>
                  <div className="font-medium">{formatCurrency(stockData.low)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">昨收</div>
                  <div className="font-medium">{formatCurrency(stockData.previousClose)}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 标签页内容 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              概览
            </TabsTrigger>
            <TabsTrigger value="financials" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              财务
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              分析
            </TabsTrigger>
            <TabsTrigger value="news" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              新闻
            </TabsTrigger>
          </TabsList>

          {/* 概览标签页 */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">基本信息</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">行业</span>
                    <Badge variant="outline">{stockData.industry}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">板块</span>
                    <span className="font-medium">{stockData.sector}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">市值</span>
                    <span className="font-medium">¥{formatNumber(stockData.marketCap)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">市盈率(PE)</span>
                    <span className="font-medium">{stockData.peRatio.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">股息率</span>
                    <span className="font-medium">{stockData.dividendYield.toFixed(2)}%</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">交易数据</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Volume2 className="h-4 w-4" />
                      成交量
                    </span>
                    <span className="font-medium">{formatNumber(stockData.volume)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">换手率</span>
                    <span className="font-medium">{((stockData.volume / (stockData.marketCap / stockData.currentPrice)) * 100).toFixed(2)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">振幅</span>
                    <span className="font-medium">{(((stockData.high - stockData.low) / stockData.previousClose) * 100).toFixed(2)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">量比</span>
                    <span className="font-medium">{(stockData.volume / 1000000).toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">公司简介</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {stockData.name}是一家在{stockData.sector}行业领先的公司，专注于{stockData.industry}领域。
                  公司拥有强大的市场地位和稳健的财务表现，为投资者提供长期价值增长机会。
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 财务标签页 */}
          <TabsContent value="financials" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">财务指标</CardTitle>
                <CardDescription>最近四个季度的财务数据</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 font-medium">指标</th>
                        <th className="text-right py-3 font-medium">Q4</th>
                        <th className="text-right py-3 font-medium">Q3</th>
                        <th className="text-right py-3 font-medium">Q2</th>
                        <th className="text-right py-3 font-medium">Q1</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-3">营业收入(亿元)</td>
                        <td className="text-right py-3">{(Math.random() * 100 + 50).toFixed(1)}</td>
                        <td className="text-right py-3">{(Math.random() * 100 + 50).toFixed(1)}</td>
                        <td className="text-right py-3">{(Math.random() * 100 + 50).toFixed(1)}</td>
                        <td className="text-right py-3">{(Math.random() * 100 + 50).toFixed(1)}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-3">净利润(亿元)</td>
                        <td className="text-right py-3">{(Math.random() * 20 + 10).toFixed(1)}</td>
                        <td className="text-right py-3">{(Math.random() * 20 + 10).toFixed(1)}</td>
                        <td className="text-right py-3">{(Math.random() * 20 + 10).toFixed(1)}</td>
                        <td className="text-right py-3">{(Math.random() * 20 + 10).toFixed(1)}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-3">毛利率(%)</td>
                        <td className="text-right py-3">{(Math.random() * 20 + 30).toFixed(1)}</td>
                        <td className="text-right py-3">{(Math.random() * 20 + 30).toFixed(1)}</td>
                        <td className="text-right py-3">{(Math.random() * 20 + 30).toFixed(1)}</td>
                        <td className="text-right py-3">{(Math.random() * 20 + 30).toFixed(1)}</td>
                      </tr>
                      <tr>
                        <td className="py-3">净利率(%)</td>
                        <td className="text-right py-3">{(Math.random() * 10 + 15).toFixed(1)}</td>
                        <td className="text-right py-3">{(Math.random() * 10 + 15).toFixed(1)}</td>
                        <td className="text-right py-3">{(Math.random() * 10 + 15).toFixed(1)}</td>
                        <td className="text-right py-3">{(Math.random() * 10 + 15).toFixed(1)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 分析标签页 */}
          <TabsContent value="analysis" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">技术分析</CardTitle>
                <CardDescription>关键技术水平</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">支撑位</div>
                    <div className="font-medium">{formatCurrency(stockData.currentPrice * 0.95)}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">阻力位</div>
                    <div className="font-medium">{formatCurrency(stockData.currentPrice * 1.05)}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">20日均线</div>
                    <div className="font-medium">{formatCurrency(stockData.currentPrice * 1.02)}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">60日均线</div>
                    <div className="font-medium">{formatCurrency(stockData.currentPrice * 1.01)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 新闻标签页 */}
          <TabsContent value="news" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">最新新闻</CardTitle>
                <CardDescription>相关公司新闻和市场动态</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium">公司发布季度业绩报告</h4>
                      <span className="text-sm text-muted-foreground">2小时前</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {stockData.name}发布了最新的季度财务报告，显示公司业绩稳健增长...
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 风险提示 */}
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-amber-800 mb-1">⚠️ 风险提示</div>
                <div className="text-sm text-amber-700 space-y-1">
                  <div>• 股市有风险，投资需谨慎</div>
                  <div>• 本页面数据仅供参考，不构成投资建议</div>
                  <div>• 请根据自身风险承受能力进行投资决策</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}