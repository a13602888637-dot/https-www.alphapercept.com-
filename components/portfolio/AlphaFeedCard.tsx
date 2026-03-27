"use client"

import { motion, useMotionValue, useTransform } from "framer-motion"
import { X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export interface AlphaSignal {
  symbol: string
  name: string
  currentPrice: number
  changePercent: number
  volumeRatio: number
  reason: string
}

interface AlphaFeedCardProps {
  signal: AlphaSignal
  onAccept: (signal: AlphaSignal) => void
  onReject: (signal: AlphaSignal) => void
  disabled?: boolean
}

export function AlphaFeedCard({ signal, onAccept, onReject, disabled }: AlphaFeedCardProps) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 0, 200], [-12, 0, 12])
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 0.8, 1, 0.8, 0.5])

  // Glow colors based on drag direction
  const greenGlow = useTransform(x, [0, 100, 200], [0, 0.3, 0.6])
  const redGlow = useTransform(x, [-200, -100, 0], [0.6, 0.3, 0])

  const isPositive = signal.changePercent >= 0

  return (
    <motion.div
      style={{ x, rotate, opacity }}
      drag={disabled ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => {
        if (disabled) return
        if (info.offset.x > 100) {
          onAccept(signal)
        } else if (info.offset.x < -100) {
          onReject(signal)
        }
      }}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: disabled ? 0.5 : 1 }}
      exit={{ opacity: 0, x: 200, transition: { duration: 0.3 } }}
      className={`absolute inset-0 cursor-grab active:cursor-grabbing ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <motion.div
        className="relative h-full rounded-xl border border-white/[0.06] bg-white/[0.03] p-6 flex flex-col justify-between overflow-hidden"
        style={{
          boxShadow: useTransform(
            greenGlow,
            (v) => `0 0 ${v * 40}px rgba(52, 211, 153, ${v * 0.5})`
          ),
        }}
      >
        {/* Red glow overlay */}
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            boxShadow: useTransform(
              redGlow,
              (v) => `inset 0 0 ${v * 40}px rgba(248, 113, 113, ${v * 0.3})`
            ),
          }}
        />

        {/* Card content */}
        <div className="relative z-10">
          {/* Stock name + code */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-zinc-100">{signal.name}</h3>
            <span className="text-sm text-zinc-500">{signal.symbol}</span>
          </div>

          {/* Price + change */}
          <div className="mb-4">
            <div className={`text-3xl font-bold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
              {signal.currentPrice.toFixed(2)}
            </div>
            <div className={`text-sm font-medium ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
              {isPositive ? "+" : ""}{signal.changePercent.toFixed(2)}%
            </div>
          </div>

          {/* Volume ratio badge */}
          <div className="mb-4">
            <Badge variant="outline" className="text-amber-400 border-amber-400/50 text-xs">
              量比 {signal.volumeRatio.toFixed(1)}
            </Badge>
          </div>

          {/* Reason */}
          <p className="text-sm text-zinc-400 leading-relaxed">{signal.reason}</p>
        </div>

        {/* Bottom buttons */}
        <div className="relative z-10 flex items-center justify-center gap-6 mt-6">
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full border-red-400/50 text-red-400 hover:bg-red-400/10 hover:text-red-300"
            onClick={() => !disabled && onReject(signal)}
            disabled={disabled}
          >
            <X className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full border-emerald-400/50 text-emerald-400 hover:bg-emerald-400/10 hover:text-emerald-300"
            onClick={() => !disabled && onAccept(signal)}
            disabled={disabled}
          >
            <Check className="h-5 w-5" />
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
