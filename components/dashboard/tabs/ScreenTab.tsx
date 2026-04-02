"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Loader2, Zap } from "lucide-react"
import SignalCard from "./SignalCard"
import type { DabanSharedProps, AlphaSignal } from "../DabanPanel"

interface ScreenTabProps extends DabanSharedProps {
  showLogic: boolean
  isLockdown: boolean
  refreshKey: number
  onSignalCountChange: (count: number) => void
}

export default function ScreenTab({
  acceptedSymbols,
  dismissed,
  isLockdown,
  showLogic,
  refreshKey,
  onAccept,
  onDismiss,
  onCancelTrack,
  onSignalCountChange,
}: ScreenTabProps) {
  const [screenSignals, setScreenSignals] = useState<AlphaSignal[]>([])
  const [screenLoading, setScreenLoading] = useState(false)
  const [screenTime, setScreenTime] = useState("")
  const [screenConditions, setScreenConditions] = useState<string[]>([])

  const fetchScreen = useCallback(async () => {
    setScreenLoading(true)
    try {
      const res = await fetch("/api/strategy-recommendation/screen")
      if (!res.ok) throw new Error("Failed to fetch screen")
      const data = await res.json()
      const signals = data.signals ?? []
      setScreenSignals(signals)
      setScreenTime(data.screenTime ?? "")
      setScreenConditions(data.conditions ?? [])
      onSignalCountChange(signals.length)
    } catch {
      toast.error("选股扫描失败")
    } finally {
      setScreenLoading(false)
    }
  }, [onSignalCountChange])

  // Initial load
  useEffect(() => {
    fetchScreen()
  }, [fetchScreen])

  // Refresh trigger from parent
  useEffect(() => {
    if (refreshKey > 0) {
      fetchScreen()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const visibleSignals = screenSignals.filter((s) => !dismissed.has(s.symbol))
  const allProcessed = visibleSignals.length === 0 && screenSignals.length > 0

  return (
    <>
      {/* Conditions Bar */}
      {screenConditions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          {screenConditions.map((c) => (
            <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a2035] text-gray-400 border border-[#2a3045]">
              {c}
            </span>
          ))}
          {screenTime && (
            <span className="text-[10px] text-gray-600 ml-2">
              扫描时间: {screenTime}
            </span>
          )}
        </div>
      )}

      {/* Logic Whitebox Panel */}
      {showLogic && (
        <div className="bg-[#0d1117] border border-[#1a2035] rounded-lg p-4 mb-5 text-xs space-y-3">
          <h3 className="text-gray-300 font-medium text-sm mb-2">完整逻辑清单（白盒化）</h3>

          {/* 一、数据源 */}
          <div className="space-y-2">
            <div className="text-gray-400 font-medium">一、数据源与扫描范围</div>
            <div className="space-y-1 text-gray-500 pl-3">
              <div>行情数据: 东方财富推送API（push2.eastmoney.com）</div>
              <div>扫描范围: 全A股（沪主板+深主板+创业板+科创板+中小板）</div>
              <div>候选池: 按涨幅降序取前200只 → 过滤后取前30只查MA → 最终输出≤20只</div>
              <div>K线/均线: 东方财富K线API，取最近20日收盘价计算MA5/MA10/MA20</div>
              <div>涨停池: 东方财富涨停池API（getTopicZTPool），计算溢价率和连板高度</div>
            </div>
          </div>

          {/* 二、基础筛选 */}
          <div className="space-y-2">
            <div className="text-gray-400 font-medium">二、基础筛选（交易时段）</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-gray-500 pl-3">
              <span>涨跌幅 &gt; 3%</span>
              <span>流通市值 &gt; 50亿</span>
              <span>量比 &gt; 1.5（放量确认）</span>
              <span>换手率 3%~15%（活跃度）</span>
              <span>排除 ST / *ST / 退市股</span>
              <span>排除 920 新股板块</span>
              <span>排除涨停封死（现价≥昨收×1.097，买不到）</span>
              <span>价格 &gt; 0（有效数据）</span>
            </div>
          </div>

          {/* 三、非交易时段 */}
          <div className="space-y-2">
            <div className="text-gray-400 font-medium">三、非交易时段降级规则</div>
            <div className="space-y-1 text-gray-500 pl-3">
              <div>判定: 有效股票数 &lt; 10 或涨跌幅全为0 → 进入非交易时段模式</div>
              <div>放宽: 涨跌幅≥2%（交易时段3%）、市值≥30亿（交易时段50亿）</div>
              <div>跳过: MA多头排列验证、VWAP验证均跳过</div>
              <div>兜底: 无信号时自动读取数据库缓存（最近交易日结果）</div>
            </div>
          </div>

          {/* 四、技术面验证 */}
          <div className="space-y-2">
            <div className="text-gray-400 font-medium">四、技术面验证（仅交易时段）</div>
            <div className="space-y-1 text-gray-500 pl-3">
              <div>多头排列: 价格 &gt; MA5 &gt; MA10 &gt; MA20（MA数据可用时）</div>
              <div>VWAP: 价格 &gt; 成交额÷成交量÷100（均价线上方 = 买方力量强）</div>
            </div>
          </div>

          {/* 五、诱多检测 */}
          <div className="space-y-2">
            <div className="text-amber-400/80 font-medium">五、疑似诱多检测 ⚠️</div>
            <div className="space-y-1 text-gray-500 pl-3">
              <div>尾盘急拉: 开盘涨幅&lt;1%，但尾盘贡献&gt;涨幅的60%</div>
              <div>振幅异常: 振幅 &gt; 涨幅×2.5 且 振幅 &gt; 5%</div>
              <div>盘中破昨收: 最低价 &lt; 昨收，但收盘涨 &gt; 3%</div>
              <div>炸板回落: 最高价触及涨停(≥昨收×1.097)但现价回落&gt;3%</div>
              <div className="text-yellow-500/60">触发任一条 → 标记"疑似诱多" + 评分扣30分</div>
            </div>
          </div>

          {/* 六、确认上攻 */}
          <div className="space-y-2">
            <div className="text-emerald-400/80 font-medium">六、确认上攻 ✅（全部满足）</div>
            <div className="space-y-1 text-gray-500 pl-3">
              <div>非诱多（未触发第五条任何规则）</div>
              <div>量比 ≥ 2.0（显著放量）</div>
              <div>换手率 3%~8%（活跃但不过度换手）</div>
              <div>开盘涨幅 ≥ 1%（开盘即强势，低开拉升次日回落概率高）</div>
              <div>最低价 ≥ 昨收（全天未跌破昨收 = 无恐慌抛压）</div>
              <div>振幅 &lt; 涨幅×1.8（走势更平稳）</div>
              <div>价格 &gt; MA5 &gt; MA10 &gt; MA20（严格多头排列，MA可用时）</div>
            </div>
          </div>

          {/* 七、爆发打板 */}
          <div className="space-y-2">
            <div className="text-purple-400/80 font-medium">七、爆发打板 ⚡（全部满足）</div>
            <div className="space-y-1 text-gray-500 pl-3">
              <div>非诱多（未触发第五条任何规则）</div>
              <div>涨幅 ≥ 9.5%（接近涨停，9%太松易误判）</div>
              <div>流通市值 50~300亿（游资偏好中盘股）</div>
              <div>量比 ≥ 2.5（资金集中涌入）</div>
              <div>最低价 ≥ 昨收（封板力度强）</div>
              <div>开盘涨幅 ≥ 1%（排除低开拉板）</div>
              <div>现价 ≥ 昨收×1.095（确认封板未炸）</div>
            </div>
          </div>

          {/* 八、强烈推荐 */}
          <div className="space-y-2">
            <div className="text-amber-300 font-medium">八、强烈推荐 🔥 = 确认上攻 ∩ 爆发打板</div>
            <div className="text-gray-500 pl-3">同时满足第六条和第七条的全部条件</div>
          </div>

          {/* 九、综合评分 */}
          <div className="space-y-2">
            <div className="text-gray-400 font-medium">九、综合评分（0-100分）</div>
            <div className="space-y-1 text-gray-500 pl-3">
              <div>涨幅: min(25, 涨幅% × 2.5) → 0~25分</div>
              <div>量比: min(20, 量比 × 5) → 0~20分</div>
              <div>换手率: 以5.5%为最佳，偏离越大扣越多 → 0~15分</div>
              <div>开盘强度: min(15, 开盘涨幅% × 5) → 0~15分</div>
              <div>均线排列: 严格多头+15 / 部分多头+8 / 否则+0 → 0~15分</div>
              <div>走势平稳: 振幅&lt;涨幅×1.5→+10 / &lt;×2→+5 / 否则+0 → 0~10分</div>
              <div className="text-yellow-500/60">疑似诱多: 总分扣30分（最低0分）</div>
            </div>
          </div>

          {/* 十、情绪面板 & 冰点锁定 */}
          <div className="space-y-2">
            <div className="text-red-400/80 font-medium">十、情绪面板 & 冰点锁定</div>
            <div className="space-y-1 text-gray-500 pl-3">
              <div>溢价率 = 昨日涨停股今日开盘均价偏离昨收的百分比</div>
              <div>连板高度 = 涨停池中最大连续涨停天数</div>
              <div>冰点锁定: 溢价率 &lt; 0 → 清空全部信号，显示"空仓防守"横幅</div>
              <div className="text-red-400/60">冰点期间所有信号卡片变灰且不可操作</div>
            </div>
          </div>

          {/* 十一、市场环境判定 */}
          <div className="space-y-2">
            <div className="text-cyan-400/80 font-medium">十一、市场环境自动判定</div>
            <div className="space-y-1 text-gray-500 pl-3">
              <div>牛市: 溢价率 &gt; 2% 且 连板高度 ≥ 4</div>
              <div>熊市: 溢价率 &lt; -1% 或 连板高度 ≤ 1</div>
              <div>震荡市: 其他情况</div>
              <div className="text-gray-600">市场环境影响: 止损线宽度、回撤离场线、仓位情绪系数</div>
            </div>
          </div>

          {/* 十二、仓位管理 */}
          <div className="space-y-2">
            <div className="text-cyan-400/80 font-medium">十二、仓位管理</div>
            <div className="space-y-1 text-gray-500 pl-3">
              <div>基础仓位: 🔥15% / ⚡10% / ✅8% / 高风险5% / ⚠️诱多0%</div>
              <div>情绪系数: 溢价率&gt;3%→×1.2 / 0~3%→×1.0 / -2~0%→×0.5 / &lt;-2%→×0</div>
              <div>胜率系数: &gt;60%→×1.2 / 50-60%→×1.0 / 40-50%→×0.7 / &lt;40%或样本&lt;10→×0.5</div>
              <div>硬上限: 单股不超过总资金20%，结果保留1位小数</div>
              <div className="text-gray-600">公式: 仓位 = min(20, 基础 × 情绪系数 × 胜率系数)</div>
              <div className="text-gray-600">胜率数据来源: BoardTrack 数据库中该信号类型的历史跟踪记录</div>
            </div>
          </div>

          {/* 十三、止盈止损 */}
          <div className="space-y-2">
            <div className="text-pink-400/80 font-medium">十三、止盈止损策略（按市场环境动态调整）</div>
            <div className="space-y-1 text-gray-500 pl-3">
              <div>止损线（牛/震荡/熊）:</div>
              <div className="pl-3">🔥 -7% / -5% / -3%</div>
              <div className="pl-3">⚡ -5% / -3% / -2%</div>
              <div className="pl-3">✅ -6% / -4% / -3%</div>
              <div className="pl-3">高风险 -3% / -2% / -1.5%</div>
              <div>高点回撤离场线（牛/震荡/熊）:</div>
              <div className="pl-3">🔥 -5% / -3% / -2%</div>
              <div className="pl-3">⚡ -3% / -2% / -1.5%</div>
              <div className="pl-3">✅ -4% / -3% / -2%</div>
              <div className="pl-3">高风险 -2% / -1.5% / -1%</div>
              <div className="text-gray-400">不设硬性最大持有天数，未触发止损/回撤线可继续持有</div>
            </div>
            <div className="space-y-1 text-gray-500 pl-3 border-l-2 border-[#1a2035] ml-1">
              <div className="text-gray-400">按信号类型的止盈策略:</div>
              <div>🔥连板预期: 高开&gt;3%持有追踪 / 0~3%卖半仓锁利 / 低开触发止损线离场</div>
              <div>⚡快进快出: 高开&gt;5%集合竞价直接卖出 / 0~5%开盘30分钟内卖 / 低开立即止损</div>
              <div>✅趋势跟踪: 持有追踪回撤离场 / 跌破MA5次日开盘卖 / 破止损线止损</div>
              <div>高风险: 开盘30分钟内卖出 / 再封涨停例外可持有到次日 / 严格止损</div>
            </div>
          </div>

          {/* 十四、排序规则 */}
          <div className="space-y-2">
            <div className="text-gray-400 font-medium">十四、排序与输出</div>
            <div className="space-y-1 text-gray-500 pl-3">
              <div>优先级: 🔥强烈推荐 &gt; ⚡爆发打板 &gt; ✅确认上攻 &gt; 普通 &gt; ⚠️疑似诱多</div>
              <div>同级排序: 按综合评分降序</div>
              <div>条件选股Tab: 最多输出20只信号</div>
              <div>涨幅扫描Tab: 扫描30只蓝筹标的，最多输出12只，标签: 强势冲板(≥8.5%) / 加速上攻(≥5%) / 异动关注(&lt;5%) / 盘后回顾(非交易时段)</div>
            </div>
          </div>

          {/* 十五、接受联动 */}
          <div className="space-y-2">
            <div className="text-blue-400/80 font-medium">十五、接受操作联动流程</div>
            <div className="space-y-1 text-gray-500 pl-3">
              <div>1. 写入投资组合: 数量100股，类型LIMIT_UP_PAPER，状态T+1锁定</div>
              <div>2. 加入自选股: 附带买入价，重复(409)不报错</div>
              <div>3. 保存跟踪记录: 记录入场价、信号标签、评分 → 等待Cron次日跟踪</div>
              <div>卡片状态: 接受后显示"✓ 已接受 · 跟踪中"，忽略后本次会话隐藏</div>
            </div>
          </div>

          {/* 十六、胜率跟踪闭环 */}
          <div className="space-y-2">
            <div className="text-green-400/80 font-medium">十六、胜率跟踪闭环</div>
            <div className="space-y-1 text-gray-500 pl-3">
              <div>Cron: 每交易日15:30 CST自动执行，批量查询（每50只一批）</div>
              <div>计算: 次日收益% = (次日收盘价 - 入场价) / 入场价 × 100</div>
              <div>状态流转: pending → tracked（获取到数据） / failed（3天无数据）</div>
              <div>统计维度: 按信号标签分组 → 胜率、平均收益、最大收益、最大亏损</div>
              <div className="text-green-400/60">闭环: 历史胜率 → 反哺Kelly公式的胜率和盈亏比</div>
            </div>
          </div>

          {/* 十七、Kelly公式仓位引擎 */}
          <div className="space-y-2">
            <div className="text-orange-400/80 font-medium">十七、Kelly公式仓位引擎（替代固定仓位表）</div>
            <div className="space-y-1 text-gray-500 pl-3">
              <div>公式: f = (b×p - q) / b</div>
              <div className="pl-3">p = 胜率, q = 1-p, b = 盈亏比(平均盈利%/平均亏损%)</div>
              <div>使用半凯利: 建议仓位 = min(20%, f/2 × 100%)</div>
              <div>Kelly≤0: 建议仓位0%，显示"数学不支持买入"</div>
              <div>降级: 样本&lt;20条 → 使用固定仓位表(15/10/8/5%)</div>
              <div>数据源: BoardTrack数据库中该signalTag的已跟踪记录</div>
              <div className="text-orange-400/60">意义: 胜率40%+盈亏比1.5时Kelly=0，数学告诉你不应该下注</div>
            </div>
          </div>

          {/* 十八、游资微观结构加分 */}
          <div className="space-y-2">
            <div className="text-violet-400/80 font-medium">十八、游资微观结构加分（打板增强）</div>
            <div className="space-y-1 text-gray-500 pl-3">
              <div>游资偏好市值: 30~80亿→+10分，80~150亿→+3分（最易拉升区间）</div>
              <div>资金强势攻入: 量比&gt;3 且 涨幅&gt;5%→+5分</div>
              <div>板块效应: 同代码前缀≥3只异动→"板块共振"+8分</div>
              <div>孤军深入: 同前缀仅1只→-5分（无板块呼应）</div>
            </div>
            <div className="space-y-1 text-gray-600 pl-3 border-l-2 border-[#1a2035] ml-1">
              <div>未来迭代（数据源限制暂不可行）:</div>
              <div>· 基金持仓占比过滤（需天天基金API）</div>
              <div>· 股性活跃度-60日涨停次数（需扩展K线查询）</div>
              <div>· 内外盘比精确值（需腾讯L2数据）</div>
              <div>· NLP新闻词频爆发检测（需DeepSeek+新闻源）</div>
              <div>· HMM隐马尔可夫状态检测（需Python ML服务）</div>
            </div>
          </div>

          {/* 十九、左侧交易引擎 */}
          <div className="space-y-2">
            <div className="text-emerald-400/80 font-medium">十九、左侧交易引擎（独立Tab）</div>
            <div className="space-y-1 text-gray-500 pl-3">
              <div className="text-gray-400">Layer 1 — 价值底座（硬过滤）:</div>
              <div className="pl-3">PE(TTM) 5~25 + PB &lt; 3.0 + 流通市值 &gt; 100亿 + 排除ST</div>
              <div className="text-gray-400">Layer 2 — 技术面超卖检测（≥2项确认）:</div>
              <div className="pl-3">地量: 20日均量 &lt; 120日均量×40%</div>
              <div className="pl-3">RSI(14) &lt; 30（极度超卖）</div>
              <div className="pl-3">偏离250日均线 &gt; -20%（绝对超跌）</div>
              <div className="pl-3">MACD底背离: 价格新低但柱状体缩短</div>
              <div className="text-gray-400">Layer 3 — 反转触发器（≥2项确认）:</div>
              <div className="pl-3">RSI拐头: 从&lt;35区域连续2日上升</div>
              <div className="pl-3">量能回暖: 5日均量 &gt; 10日均量（地量后放量）</div>
              <div className="pl-3">站上MA5: 收盘价 &gt; 5日均线</div>
            </div>
            <div className="space-y-1 text-gray-500 pl-3">
              <div className="text-gray-400">信号标签:</div>
              <div className="pl-3">🌱反转萌芽 = L1+L2+L3 / 💎价值洼地 = L1+L2 / 👁观察等待 = 仅L1</div>
              <div className="text-gray-400">左侧仓位策略（与打板不同）:</div>
              <div className="pl-3">反转萌芽8% / 价值洼地5% / 止损-12% / 回撤-8%</div>
              <div className="pl-3">目标: +30% 或 回到250日均线上方</div>
              <div className="pl-3">DCA: 每跌5%可加仓，单股累计≤15%</div>
            </div>
          </div>

          {/* 二十、趋势跟踪引擎 V3 */}
          <div className="space-y-2">
            <div className="text-cyan-400/80 font-medium">二十、趋势跟踪引擎 V3 — 全A股扫描+动态板块</div>
            <div className="space-y-1 text-gray-500 pl-3">
              <div className="text-gray-400">架构: 全A股涨幅前500快筛 → 多层过滤 → 反查行业板块校验</div>
              <div className="pl-3">不从固定板块出发（避免板块归属错误），而是先找好股再验板块</div>
              <div className="text-gray-400">L1 板块面板（18个固定+动态扩展）:</div>
              <div className="pl-3">固定: 黄金/有色/石油/煤炭/航运/电力/军工/半导体/医药/银行/证券</div>
              <div className="pl-3">概念: 创新药/电网设备/商业航天/AI算力/机器人/低空经济/新能源汽车</div>
              <div className="pl-3">板块指数 &gt; MA20 且 &gt; MA60 → ✓多头（标绿）</div>
              <div className="pl-3">板块指数 &lt; MA20 或 &lt; MA60 → ✗弱势（标红，不否决仅标注）</div>
              <div className="pl-3 text-gray-600">信号中出现新行业 → 自动加入面板并校验</div>
            </div>
            <div className="space-y-1 text-gray-500 pl-3">
              <div className="text-gray-400">L2 Stage 2 底座:</div>
              <div className="pl-3">价 &gt; MA150 &gt; MA200, MA50 &gt; MA150, MA150拐头向上</div>
              <div className="pl-3 text-gray-600">机构完成底仓配置，舞台搭好</div>
              <div className="text-gray-400">L2.5 RS相对强度:</div>
              <div className="pl-3">120日涨幅 &gt; 30%（近似85百分位，只抓龙头）</div>
              <div className="text-gray-400">L2.6 回撤熔断:</div>
              <div className="pl-3">距120日最高回撤 &gt; 20% → 踢出（套牢盘太重）</div>
              <div className="text-gray-400">L3 VCP 波动率收敛（核心绝杀）:</div>
              <div className="pl-3">10日振幅 &lt; 3% + 近3日量 &lt; 50日均量50%</div>
              <div className="pl-3 text-gray-600">爆发前必有宁静，浮筹洗净卖盘枯竭</div>
              <div className="text-gray-400">L4 右侧突破:</div>
              <div className="pl-3">涨 &gt; 2% + 量比 &gt; 1.5 = 带量跨越阻力位</div>
            </div>
            <div className="space-y-1 text-gray-500 pl-3">
              <div className="text-red-400/80 font-medium">L4.5 出货检测（V2.1新增）:</div>
              <div className="pl-3">高换手滞涨: 换手&gt;15% + 涨&lt;5% + 未封板 → ⚠️高位滞涨 -50分</div>
              <div className="pl-3">放量破均价: 量&gt;5日均量3倍 + 收&lt;VWAP → ⚠️放量破均价 -40分</div>
              <div className="pl-3">筹码松动: 振幅/涨幅&gt;3（涨&gt;2%时） → ⚠️筹码松动 -30分</div>
              <div className="pl-3 text-gray-600">物理含义: 成交量爆表但价格推不动 = 阻力过载 = 主力出货</div>
            </div>
            <div className="space-y-1 text-gray-500 pl-3">
              <div className="text-emerald-400/80 font-medium">资金流向探针（内外盘）:</div>
              <div className="pl-3">外盘(f34)=主动买, 内盘(f35)=主动卖</div>
              <div className="pl-3">(内盘-外盘)/总量 &gt; 15% → 🔴资金流出 -15分</div>
              <div className="pl-3">(外盘-内盘)/总量 &gt; 15% → 💰资金流入 +5分</div>
              <div className="pl-3 text-gray-600">内盘&gt;外盘 = 卖出订单被主动砸出，即便涨也是且打且退</div>
            </div>
            <div className="space-y-1 text-gray-500 pl-3">
              <div className="text-gray-400">信号标签:</div>
              <div className="pl-3">趋势突破(L2+L3+L4) / VCP收敛(L2+L3) / 放量异动(L2+L4) / Stage2观察</div>
              <div className="pl-3 text-red-400/60">⚠️高位滞涨 / ⚠️放量破均价 / ⚠️筹码松动 — 出货警告优先于其他标签</div>
              <div className="text-gray-400">风控:</div>
              <div className="pl-3">止损: max(阳线最低, -5%) | 止盈: 跟踪MA20,跌破且次日不收回→清仓</div>
              <div className="pl-3">仓位: 趋势突破10% / VCP8% / 放量异动6% / 观察3%</div>
            </div>
          </div>

          <div className="border-t border-[#1a2035] pt-2 text-[10px] text-gray-600 space-y-1">
            <div>数据源: 东方财富推送API(含f34外盘/f35内盘) + K线API(250日) + 板块指数K线 + BoardTrack</div>
            <div>限制: 内外盘数据盘后可能清零(次日开盘恢复) | RS用固定阈值30%近似85百分位</div>
          </div>
        </div>
      )}

      {/* Signal Cards Grid */}
      <div className="mb-8">
        {screenLoading ? (
          <div className="bg-[#0d1117] border border-[#1a2035] rounded-lg py-16 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">正在扫描全A股...</p>
          </div>
        ) : screenSignals.length === 0 ? (
          <div className="bg-[#0d1117] border border-[#1a2035] rounded-lg py-16 text-center">
            <Zap className="h-8 w-8 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              当前无符合条件的股票（非交易时段数据可能不完整）
            </p>
          </div>
        ) : allProcessed ? (
          <div className="bg-[#0d1117] border border-[#1a2035] rounded-lg py-16 text-center">
            <p className="text-gray-500 text-sm">今日信号已处理完毕</p>
          </div>
        ) : (
          <div
            className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${
              isLockdown ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            {visibleSignals.map((signal) => (
              <SignalCard
                key={signal.symbol}
                signal={signal}
                isAccepted={acceptedSymbols.has(signal.symbol)}
                isLockdown={isLockdown}
                onAccept={onAccept}
                onDismiss={onDismiss}
                onCancelTrack={onCancelTrack}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
