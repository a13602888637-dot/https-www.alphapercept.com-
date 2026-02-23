"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, Save, X, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface WatchlistItem {
  id: string;
  stockCode: string;
  stockName: string;
  buyPrice: number | null;
  stopLossPrice: number | null;
  targetPrice: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StockPriceData {
  price: number;
  change?: number;
  changePercent?: number;
  high?: number;
  low?: number;
  volume?: number;
  turnover?: number;
  lastUpdate?: string;
  name?: string;
}

interface WatchlistCardProps {
  item: WatchlistItem;
  onUpdate: (id: string, data: Partial<WatchlistItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  priceData?: StockPriceData;
}

export function WatchlistCard({ item, onUpdate, onDelete, priceData }: WatchlistCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    buyPrice: item.buyPrice?.toString() || "",
    stopLossPrice: item.stopLossPrice?.toString() || "",
    targetPrice: item.targetPrice?.toString() || "",
    notes: item.notes || "",
  });

  const calculateProfitLoss = () => {
    if (!item.buyPrice || !priceData?.price) return null;
    const profit = ((priceData.price - item.buyPrice) / item.buyPrice) * 100;
    return profit;
  };

  const calculateTargetProfit = () => {
    if (!item.buyPrice || !item.targetPrice) return null;
    const profit = ((item.targetPrice - item.buyPrice) / item.buyPrice) * 100;
    return profit;
  };

  const calculateStopLossRisk = () => {
    if (!item.buyPrice || !item.stopLossPrice) return null;
    const risk = ((item.buyPrice - item.stopLossPrice) / item.buyPrice) * 100;
    return risk;
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await onUpdate(item.id, {
        buyPrice: formData.buyPrice ? parseFloat(formData.buyPrice) : null,
        stopLossPrice: formData.stopLossPrice ? parseFloat(formData.stopLossPrice) : null,
        targetPrice: formData.targetPrice ? parseFloat(formData.targetPrice) : null,
        notes: formData.notes || null,
      });
      setIsEditing(false);
      toast.success("自选股已更新");
    } catch (error) {
      toast.error("更新失败");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("确定要删除这只股票吗？")) return;

    setIsLoading(true);
    try {
      await onDelete(item.id);
      toast.success("自选股已删除");
    } catch (error) {
      toast.error("删除失败");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const profitLoss = calculateProfitLoss();
  const targetProfit = calculateTargetProfit();
  const stopLossRisk = calculateStopLossRisk();

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">
              {item.stockCode} - {item.stockName}
            </CardTitle>
            <CardDescription>
              添加于 {new Date(item.createdAt).toLocaleDateString("zh-CN")}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditing(true)}
                  disabled={isLoading}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDelete}
                  disabled={isLoading}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSave}
                  disabled={isLoading}
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      buyPrice: item.buyPrice?.toString() || "",
                      stopLossPrice: item.stopLossPrice?.toString() || "",
                      targetPrice: item.targetPrice?.toString() || "",
                      notes: item.notes || "",
                    });
                  }}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">买入成本</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.buyPrice}
                  onChange={(e) => setFormData({ ...formData, buyPrice: e.target.value })}
                  placeholder="买入价格"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">止损价</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.stopLossPrice}
                  onChange={(e) => setFormData({ ...formData, stopLossPrice: e.target.value })}
                  placeholder="止损价格"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">目标价</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.targetPrice}
                  onChange={(e) => setFormData({ ...formData, targetPrice: e.target.value })}
                  placeholder="目标价格"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">备注</label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="添加备注..."
                rows={2}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">买入成本</div>
                <div className="text-lg font-semibold">
                  {item.buyPrice ? `¥${item.buyPrice.toFixed(2)}` : "未设置"}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">止损价</div>
                <div className="text-lg font-semibold">
                  {item.stopLossPrice ? `¥${item.stopLossPrice.toFixed(2)}` : "未设置"}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">目标价</div>
                <div className="text-lg font-semibold">
                  {item.targetPrice ? `¥${item.targetPrice.toFixed(2)}` : "未设置"}
                </div>
              </div>
            </div>

            {priceData?.price && item.buyPrice && (
              <div className="pt-3 border-t">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">当前盈亏</div>
                  <Badge
                    variant={profitLoss && profitLoss >= 0 ? "default" : "destructive"}
                    className="flex items-center gap-1"
                  >
                    {profitLoss && profitLoss >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {profitLoss ? `${profitLoss.toFixed(2)}%` : "N/A"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <div>
                    <div className="text-sm text-muted-foreground">当前价格</div>
                    <div className="text-lg font-semibold">¥{priceData.price.toFixed(2)}</div>
                  </div>
                  {priceData.changePercent !== undefined && (
                    <div>
                      <div className="text-sm text-muted-foreground">今日涨跌</div>
                      <div className={`text-lg font-semibold ${priceData.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {priceData.changePercent >= 0 ? '+' : ''}{priceData.changePercent.toFixed(2)}%
                      </div>
                    </div>
                  )}
                </div>
                {priceData.lastUpdate && (
                  <div className="text-xs text-muted-foreground">
                    更新时间: {new Date(priceData.lastUpdate).toLocaleString('zh-CN')}
                  </div>
                )}
              </div>
            )}

            {(targetProfit || stopLossRisk) && (
              <div className="pt-3 border-t">
                <div className="grid grid-cols-2 gap-4">
                  {targetProfit && (
                    <div>
                      <div className="text-sm font-medium mb-1">目标盈利</div>
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        {targetProfit.toFixed(2)}%
                      </Badge>
                    </div>
                  )}
                  {stopLossRisk && (
                    <div>
                      <div className="text-sm font-medium mb-1">止损风险</div>
                      <Badge variant="outline" className="bg-red-50 text-red-700">
                        {stopLossRisk.toFixed(2)}%
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            )}

            {item.notes && (
              <div className="pt-3 border-t">
                <div className="text-sm font-medium mb-1">备注</div>
                <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                  {item.notes}
                </div>
              </div>
            )}

            {item.stopLossPrice && priceData?.price && priceData.price <= item.stopLossPrice && (
              <div className="pt-3">
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-2 rounded">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">已触及止损价！</span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}