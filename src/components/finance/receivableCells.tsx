import { receivableStatus } from '../../lib/finance'
import { Pill } from '../ui/Pill'
import type { PillTone } from '../ui/Pill'

/** 应收/已付/未付 紧凑展示原子，供「近期案件」行与「分期阶段」行共用，保证两处列网格一致。 */

const fmt = (n: number) => n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 已付 / 应收：已付绿粗体 + 灰色应收，tabular。（设计去掉了进度条，靠数字+状态表达） */
export function PayCell({ paid, receivable }: { paid: number; receivable: number }) {
  return (
    <span className="tabular-nums text-[13.5px] whitespace-nowrap">
      <b className="font-semibold text-emerald-600">{fmt(paid)}</b>{' '}
      <span className="text-faint">/ {fmt(receivable)}</span>
    </span>
  )
}

const STATUS_TONE: Record<string, PillTone> = {
  unset: 'slate', // 未设应收
  settled: 'emerald', // 已结清
  owing: 'rose', // 欠款
}

/** 未付 / 状态 Pill：未设应收(灰) / 已结清(绿) / 欠X(红)。 */
export function StatusPill({ receivable, unpaid }: { receivable: number; unpaid: number }) {
  const s = receivableStatus({ receivable, unpaid })
  return (
    <Pill tone={STATUS_TONE[s.kind]} dot={false}>
      {s.label}
    </Pill>
  )
}
