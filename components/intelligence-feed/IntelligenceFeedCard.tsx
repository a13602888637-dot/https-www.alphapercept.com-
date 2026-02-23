import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, TrendingUp, TrendingDown, Minus, AlertCircle } from "lucide-react"

interface IntelligenceFeedCardProps {
  id: string
  stockCode: string
  stockName: string
  eventSummary: string
  industryTrend: string
  trapProbability: number
  actionSignal: "BUY" | "SELL" | "HOLD"
  targetPrice?: number
  stopLoss?: number
  logicChain?: any
  createdAt: Date
}

export function IntelligenceFeedCard({
  stockCode,
  stockName,
  eventSummary,
  industryTrend,
  trapProbability,
  actionSignal,
  targetPrice,
  stopLoss,
  createdAt
}: IntelligenceFeedCardProps) {
  const isHighRisk = trapProbability > 80

  const getSignalIcon = () => {
    switch (actionSignal) {
      case "BUY":
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case "SELL":
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  const getSignalColor = () => {
    switch (actionSignal) {
      case "BUY":
        return "bg-green-100 text-green-800 border-green-200"
      case "SELL":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  return (
    <Card className={`relative overflow-hidden ${isHighRisk ? "border-red-300 bg-red-50/50" : ""}`}>
      {isHighRisk && (
        <div className="absolute top-0 left-0 w-2 h-full bg-red-500" />
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg">
                {stockName} ({stockCode})
              </CardTitle>
              {isHighRisk && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  高风险
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Badge className={getSignalColor()}>
                <div className="flex items-center gap-1">
                  {getSignalIcon()}
                  {actionSignal}
                </div>
              </Badge>

              <Badge variant={trapProbability > 60 ? "destructive" : "outline"}>
                陷阱概率: {trapProbability}%
              </Badge>

              <span className="text-sm text-muted-foreground">
                {formatDate(createdAt)}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <h4 className="font-medium text-sm text-muted-foreground mb-1">事件摘要</h4>
          <p className="text-sm">{eventSummary}</p>
        </div>

        <div>
          <h4 className="font-medium text-sm text-muted-foreground mb-1">行业趋势</h4>
          <p className="text-sm">{industryTrend}</p>
        </div>

        {(targetPrice || stopLoss) && (
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            {targetPrice && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1">目标价格</h4>
                <p className="text-lg font-semibold text-green-600">¥{targetPrice.toFixed(2)}</p>
              </div>
            )}

            {stopLoss && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1">止损价格</h4>
                <p className="text-lg font-semibold text-red-600">¥{stopLoss.toFixed(2)}</p>
              </div>
            )}
          </div>
        )}

        {isHighRisk && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">高风险警告</p>
                <p className="text-xs text-red-700 mt-1">
                  陷阱概率超过80%，建议谨慎操作。此信号可能存在市场操纵、信息不对称或技术面陷阱风险。
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}