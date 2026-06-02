import type { RevenueBar } from '../../lib/dashboard'

/** 柱顶数值：整数千分位、无货币前缀（卡副标已注明 AUD），0 值显示 0。 */
const barLabel = (v: number) => Math.round(v).toLocaleString('en-US')

/**
 * 月度收款条形图（手写，无图表库）。可读性增强：
 * 每根柱顶显示数值；当前月亮蓝实心 + 品牌阴影 + 加粗深色标值，其余月用中度蓝、灰标值；
 * 0 值月保留最小可见高度（4%）便于对照。
 */
export function BarChart({ data, height = 196 }: { data: RevenueBar[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex items-end gap-3.5 px-0.5 pt-[18px]" style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
          <div className={`text-[11.5px] font-bold tabular-nums ${d.hi ? 'text-brand' : 'text-muted'}`}>
            {barLabel(d.value)}
          </div>
          <div
            className="w-full max-w-[34px] rounded-[9px] transition-[height] duration-300"
            style={{
              height: `${Math.max(4, (d.value / max) * 100)}%`,
              background: d.hi ? '#3b6bff' : '#9db8ff',
              boxShadow: d.hi ? '0 14px 26px -10px rgba(59,107,255,.5)' : 'none',
            }}
          />
          <div className="text-[11.5px] text-faint">{d.label}</div>
        </div>
      ))}
    </div>
  )
}
