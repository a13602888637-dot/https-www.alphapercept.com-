"use client"

import { useState, useEffect, useMemo } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type StopLossMethod = "atr" | "chandelier" | "ma" | "fixed"

interface StopLossConfigProps {
  method: StopLossMethod
  params: Record<string, number>
  buyPrice: number | null
  currentPrice?: number | null
  computedPrice?: number | null
  computeStatus?: string | null
  dataFrequency?: string | null
  onMethodChange: (method: StopLossMethod) => void
  onParamsChange: (params: Record<string, number>) => void
}

const METHODS: { value: StopLossMethod; label: string; desc: string }[] = [
  { value: "atr", label: "ATR 波动率", desc: "基于真实波幅自适应止损" },
  { value: "chandelier", label: "吊灯止损", desc: "最高价回撤 N 倍 ATR" },
  { value: "ma", label: "均线止损", desc: "跌破 N 日均线止损" },
  { value: "fixed", label: "手动设定", desc: "自定义固定止损价" },
]

const DEFAULT_PARAMS: Record<StopLossMethod, Record<string, number>> = {
  atr: { atrMultiplier: 3, atrPeriod: 14 },
  chandelier: { atrMultiplier: 3, atrPeriod: 22, period: 22 },
  ma: { maPeriod: 20 },
  fixed: { fixedPrice: 0 },
}

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  live: { text: "LIVE", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  low_freq: { text: "低频推演", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  cached: { text: "缓存", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  awaiting_data: { text: "数据等待", color: "bg-red-500/20 text-red-400 border-red-500/30" },
}

export function StopLossConfig({
  method,
  params,
  buyPrice,
  currentPrice,
  computedPrice,
  computeStatus,
  dataFrequency,
  onMethodChange,
  onParamsChange,
}: StopLossConfigProps) {
  const handleMethodSwitch = (m: StopLossMethod) => {
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
        <Label className="text-sm font-medium">止损方法</Label>
        {statusInfo && (
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", statusInfo.color)}>
            {statusInfo.text}
            {dataFrequency && dataFrequency !== "daily" && ` · ${dataFrequency === "weekly" ? "周线" : "月线"}`}
          </Badge>
        )}
      </div>

      {/* Method selector */}
      <div className="grid grid-cols-2 gap-1.5">
        {METHODS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => handleMethodSwitch(m.value)}
            className={cn(
              "text-left px-2.5 py-1.5 rounded border text-xs transition-all",
              method === m.value
                ? "border-blue-500 bg-blue-500/10 text-blue-600"
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
        {method === "atr" && (
          <>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-gray-500 w-20 shrink-0">ATR 倍数</Label>
              <Input
                type="number"
                value={params.atrMultiplier ?? 3}
                onChange={(e) => handleParamChange("atrMultiplier", e.target.value)}
                min={1} max={5} step={0.5}
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
        {method === "chandelier" && (
          <>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-gray-500 w-20 shrink-0">ATR 倍数</Label>
              <Input
                type="number"
                value={params.atrMultiplier ?? 3}
                onChange={(e) => handleParamChange("atrMultiplier", e.target.value)}
                min={1} max={5} step={0.5}
                className="h-7 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-gray-500 w-20 shrink-0">回看周期</Label>
              <Input
                type="number"
                value={params.period ?? 22}
                onChange={(e) => handleParamChange("period", e.target.value)}
                min={10} max={60} step={1}
                className="h-7 text-xs"
              />
            </div>
          </>
        )}
        {method === "ma" && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-gray-500 w-20 shrink-0">均线周期</Label>
            <Input
              type="number"
              value={params.maPeriod ?? 20}
              onChange={(e) => handleParamChange("maPeriod", e.target.value)}
              min={5} max={60} step={1}
              className="h-7 text-xs"
            />
          </div>
        )}
        {method === "fixed" && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-gray-500 w-20 shrink-0">止损价</Label>
            <Input
              type="number"
              value={params.fixedPrice ?? ""}
              onChange={(e) => handleParamChange("fixedPrice", e.target.value)}
              min={0} step={0.01}
              placeholder={buyPrice ? `如 ${(buyPrice * 0.92).toFixed(2)}` : "输入止损价"}
              className="h-7 text-xs"
            />
          </div>
        )}
      </div>

      {/* Computed price preview */}
      {computedPrice != null && computedPrice > 0 && (
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-red-50 border border-red-100">
          <span className="text-xs text-red-600 font-medium">
            止损价: ¥{computedPrice.toFixed(2)}
          </span>
          {distancePercent && (
            <span className="text-[10px] text-red-400">
              距现价 {parseFloat(distancePercent) >= 0 ? "+" : ""}{distancePercent}%
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export { DEFAULT_PARAMS as SL_DEFAULT_PARAMS }
