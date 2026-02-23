import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, AlertCircle, ShieldAlert } from "lucide-react"

interface WarningCardProps {
  id: string
  stockCode: string
  stockName: string
  eventSummary: string
  trapProbability: number
  actionSignal: "BUY" | "SELL" | "HOLD"
  createdAt: Date
  onViewDetails?: () => void
}

export function WarningCard({
  stockCode,
  stockName,
  eventSummary,
  trapProbability,
  actionSignal,
  createdAt,
  onViewDetails
}: WarningCardProps) {
  const getRiskLevel = () => {
    if (trapProbability >= 90) return "极高风险"
    if (trapProbability >= 80) return "高风险"
    return "中等风险"
  }

  const getRiskColor = () => {
    if (trapProbability >= 90) return "bg-red-600"
    if (trapProbability >= 80) return "bg-red-500"
    return "bg-orange-500"
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
    <Card className="border-red-300 bg-gradient-to-r from-red-50/80 to-orange-50/80 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${getRiskColor()} text-white`}>
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                {stockName} ({stockCode})
              </CardTitle>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm font-semibold text-red-700">
                  {getRiskLevel()}警报
                </span>
                <span className="text-sm text-muted-foreground">
                  {formatDate(createdAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold text-red-600">
              {trapProbability}%
            </div>
            <div className="text-sm text-muted-foreground">陷阱概率</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="p-3 bg-red-100/50 border border-red-200 rounded-md">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800 mb-1">风险摘要</p>
              <p className="text-sm text-red-700">{eventSummary}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">信号类型</p>
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              actionSignal === "BUY"
                ? "bg-green-100 text-green-800"
                : actionSignal === "SELL"
                ? "bg-red-100 text-red-800"
                : "bg-gray-100 text-gray-800"
            }`}>
              {actionSignal}
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">风险等级</p>
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              trapProbability >= 90
                ? "bg-red-600 text-white"
                : trapProbability >= 80
                ? "bg-red-500 text-white"
                : "bg-orange-500 text-white"
            }`}>
              {getRiskLevel()}
            </div>
          </div>
        </div>

        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="w-full mt-4 py-2 text-sm font-medium text-red-700 hover:text-red-800 border border-red-300 hover:border-red-400 rounded-md transition-colors"
          >
            查看详细分析
          </button>
        )}
      </CardContent>
    </Card>
  )
}