import { receivableStatus } from '../../lib/finance'

/** 应收/已付/未付 紧凑展示原子，供「近期案件」行与「分期阶段」行共用，保证两处列网格一致。 */

const fmt = (n: number) => n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_CLASS: Record<string, string> = {
  unset: 'bg-slate-100 text-slate-500',
  settled: 'bg-emerald-100 text-emerald-700',
  owing: 'bg-rose-100 text-rose-700',
}

/** 4px 进度条：已付/应收。应收=0 不画（不报错）。 */
export function ProgressBar({ paid, receivable }: { paid: number; receivable: number }) {
  if (receivable <= 0) return null
  const pct = Math.max(0, Math.min(100, (paid / receivable) * 100))
  return (
    <div className="mt-1 h-1 w-full overflow-hidden rounded bg-slate-100">
      <div className="h-full rounded bg-emerald-500" style={{ width: `${pct}%` }} />
    </div>
  )
}

/** 未付 / 状态 chip：未设应收(灰) / 已结清(绿) / 欠X(红)。 */
export function StatusChip({ receivable, unpaid }: { receivable: number; unpaid: number }) {
  const s = receivableStatus({ receivable, unpaid })
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[s.kind]}`}>{s.label}</span>
}

/** 已付 / 应收 分数（已付绿）。 */
export function PaidFraction({ paid, receivable, muted = false }: { paid: number; receivable: number; muted?: boolean }) {
  return (
    <span className={`tabular-nums ${muted ? 'text-slate-600' : 'text-slate-900'}`}>
      <span className="text-emerald-700">{fmt(paid)}</span> <span className="text-slate-300">/</span> {fmt(receivable)}
    </span>
  )
}
