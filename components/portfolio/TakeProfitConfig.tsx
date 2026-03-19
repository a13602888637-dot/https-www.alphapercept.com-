"use client"

import { useMemo } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type TakeProfitMethod = "trailing" | "atr_multiple" | "fixed"

interface TakeProfitConfigProps {
  method: TakeProfitMethod
  params: Record<string, number>
  buyPrice: number | null
  currentPrice?: number | null
  computedPrice?: number | null
  computeStatus?: string | null
  highWaterMark?: number | null
  onMethodChange: (method: TakeProfitMethod) => void
  onParamsChange: (params: Record<string, number>) => void
}

const METHODS: { value: TakeProfitMethod; label: string; desc: string }[] = [
  { value: "trailing", label: "动态追踪", desc: "最高价回撤 N% 止盈" },
  { value: "atr_multiple", label: "ATR 目标", desc: "买入价 + N 倍 ATR" },
  { value: "fixed", label: "手动设定", desc: "自定义固定目标价" },
]

const DEFAULT_PARAMS: Record<TakeProfitMethod, Record<string, number>> = {
  trailing: { trailPercent: 5 },
  atr_multiple: { atrMultiple: 3, atrPeriod: 14 },
  fixed: { fixedPrice: 0 },
}

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  live: { text: "LIVE", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  low_freq: { text: "低频推演", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  cached: { text: "缓存", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  awaiting_data: { text: "数据等待", color: "bg-red-500/20 text-red-400 border-red-500/30" },
}

export function TakeProfitConfig({
  method,
  params,
  buyPrice,
  currentPrice,
  computedPrice,
  computeStatus,
  highWaterMark,
  onMethodChange,
  onParamsChange,
}: TakeProfitConfigProps) {
  const handleMethodSwitch = (m: TakeProfitMethod) => {
    onMethodChange(m)
    onParamsChange({ ...DEFAULT_PARAMS[m] })
  }

  const handleParamChange = (key: string, value: string) => {
    const num = parseFloat(value)
    if (!isNaN(num) && num >= 0) {
      onParamsChange({ ...params, [key]: num })
    }
  }

  const distancePercent = useMemo(() => {
    if (!computedPrice || !currentPrice || currentPrice === 0) return null
    return ((computedPrice - currentPrice) / currentPrice * 100).toFixed(2)
  }, [computedPrice, currentPrice])

  const statusInfo = computeStatus ? STATUS_LABELS[computeStatus] : null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">止盈方法</Label>
        {statusInfo && (
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", statusInfo.color)}>
            {statusInfo.text}
          </Badge>
        )}
      </div>

      {/* Method selector */}
      <div className="grid grid-cols-3 gap-1.5">
        {METHODS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => handleMethodSwitch(m.value)}
            className={cn(
              "text-left px-2.5 py-1.5 rounded border text-xs transition-all",
              method === m.value
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                : "border-gray-200 hover:border-gray-300 text-gray-600"
            )}
          >
            <div className="font-medium">{m.label}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{m.desc}</div>
          </button>
        ))}
      </div>

      {/* Params per method */}
      <div className="space-y-2">
        {method === "trailing" && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-gray-500 w-20 shrink-0">回撤比例%</Label>
            <Input
              type="number"
              value={params.trailPercent ?? 5}
              onChange={(e) => handleParamChange("trailPercent", e.target.value)}
              min={1} max={20} step={0.5}
              className="h-7 text-xs"
            />
          </div>
        )}
        {method === "atr_multiple" && (
          <>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-gray-500 w-20 shrink-0">ATR 倍数</Label>
              <Input
                type="number"
                value={params.atrMultiple ?? 3}
                onChange={(e) => handleParamChange("atrMultiple", e.target.value)}
                min={1} max={8} step={0.5}
                className="h-7 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-gray-500 w-20 shrink-0">ATR 周期</Label>
              <Input
                type="number"
                value={params.atrPeriod ?? 14}
                onChange={(e) => handleParamChange("atrPeriod", e.target.value)}
                min={5} max={50} step={1}
                className="h-7 text-xs"
              />
            </div>
          </>
        )}
        {method === "fixed" && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-gray-500 w-20 shrink-0">目标价</Label>
            <Input
              type="number"
              value={params.fixedPrice ?? ""}
              onChange={(e) => handleParamChange("fixedPrice", e.target.value)}
              min={0} step={0.01}
              placeholder={buyPrice ? `如 ${(buyPrice * 1.15).toFixed(2)}` : "输入目标价"}
              className="h-7 text-xs"
            />
          </div>
        )}
      </div>

      {/* High water mark info for trailing */}
      {method === "trailing" && highWaterMark != null && highWaterMark > 0 && (
        <div className="text-[10px] text-gray-400 px-2.5">
          最高价: ¥{highWaterMark.toFixed(2)}
        </div>
      )}

      {/* Computed price preview */}
      {computedPrice != null && computedPrice > 0 && (
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-emerald-50 border border-emerald-100">
          <span className="text-xs text-emerald-600 font-medium">
            目标价: ¥{computedPrice.toFixed(2)}
          </span>
          {distancePercent && (
            <span className="text-[10px] text-emerald-400">
              距现价 {parseFloat(distancePercent) >= 0 ? "+" : ""}{distancePercent}%
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export { DEFAULT_PARAMS as TP_DEFAULT_PARAMS }
