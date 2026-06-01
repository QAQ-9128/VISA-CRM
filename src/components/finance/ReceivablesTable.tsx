import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ReceivablesItemsArea } from './ReceivablesItemsArea'
import { getCustomerPaymentColor, CUSTOMER_PAYMENT_TEXT_CLASS, receivableStatus } from '../../lib/finance'
import type { ReceivableRow, ReceivableTotals } from '../../lib/finance'

const fmt = (n: number) => n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// 合并角色淡化为灰字；只有主申/副申用小标签
const ROLE_TAG: Record<string, string> = {
  primary: 'bg-blue-100 text-blue-700',
  secondary: 'bg-violet-100 text-violet-700',
}
const STATUS_CLASS: Record<string, string> = {
  unset: 'bg-slate-100 text-slate-500',
  settled: 'bg-emerald-100 text-emerald-700',
  owing: 'bg-rose-100 text-rose-700',
}

/** 4px 进度条：已付/应收。应收=0 不画。 */
function ProgressBar({ paid, receivable }: { paid: number; receivable: number }) {
  if (receivable <= 0) return null
  const pct = Math.max(0, Math.min(100, (paid / receivable) * 100))
  return (
    <div className="mt-1 h-1 w-full overflow-hidden rounded bg-slate-100">
      <div className="h-full rounded bg-emerald-500" style={{ width: `${pct}%` }} />
    </div>
  )
}

function StatusChip({ receivable, unpaid }: { receivable: number; unpaid: number }) {
  const s = receivableStatus({ receivable, unpaid })
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[s.kind]}`}>{s.label}</span>
}

/** 已付 / 应收 分数（已付绿） */
function PaidFraction({ paid, receivable, muted = false }: { paid: number; receivable: number; muted?: boolean }) {
  return (
    <span className={`tabular-nums ${muted ? 'text-slate-600' : 'text-slate-900'}`}>
      <span className="text-emerald-700">{fmt(paid)}</span> <span className="text-slate-300">/</span> {fmt(receivable)}
    </span>
  )
}

function ReceivableRowItem({ row }: { row: ReceivableRow }) {
  const [editing, setEditing] = useState(false) // 记账▾ 编辑器
  const [stagesOpen, setStagesOpen] = useState(false) // 分 N 期 折叠（默认折叠）
  const nameColor = getCustomerPaymentColor(row.receivable, row.paid, row.unpaid)
  const showStages = row.staged && row.stages.length >= 2

  return (
    <>
      <tr className="border-b border-slate-100">
        {/* 客户 · 案件 */}
        <td className={`py-2.5 pr-3 ${row.role === 'secondary' ? 'pl-5' : ''}`}>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            {row.role === 'secondary' && (
              <span className="select-none font-mono text-slate-300" aria-hidden>└─</span>
            )}
            <Link
              to={`/cases/${row.caseId}`}
              state={{ from: 'finance' }}
              className={`font-medium hover:underline ${nameColor === 'default' ? 'text-indigo-600' : CUSTOMER_PAYMENT_TEXT_CLASS[nameColor]}`}
            >
              {row.customerName || '（未知客户）'}
            </Link>
            {row.role === 'merged' && row.coApplicantNames.length > 0 && (
              <span className="text-slate-400">＋ {row.coApplicantNames.join('、')}</span>
            )}
            {row.role === 'merged' ? (
              <span className="text-xs text-slate-300">合并</span>
            ) : (
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ROLE_TAG[row.role]}`}>
                {row.role === 'primary' ? '主申' : '副申'}
              </span>
            )}
            <span className="text-slate-400">· {row.visaSubclass}</span>
            {showStages && (
              <button
                type="button"
                onClick={() => setStagesOpen((v) => !v)}
                className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600 hover:bg-indigo-100"
              >
                分 {row.stages.length} 期 <span aria-hidden>{stagesOpen ? '▴' : '▾'}</span>
              </button>
            )}
          </div>
        </td>

        {/* 已付 / 应收 + 进度条 */}
        <td className="py-2.5 px-3 text-right">
          <div className="text-right">
            <PaidFraction paid={row.paid} receivable={row.receivable} />
          </div>
          <ProgressBar paid={row.paid} receivable={row.receivable} />
        </td>

        {/* 未付 / 状态 */}
        <td className="py-2.5 px-3 text-right">
          <StatusChip receivable={row.receivable} unpaid={row.unpaid} />
        </td>

        {/* 记账 */}
        <td className="py-2.5 pl-3 text-right">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded-md px-2 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
          >
            {editing ? '收起' : '记账 ▾'}
          </button>
        </td>
      </tr>

      {/* 分 N 期 展开：各阶段只读子行（阶段名 / 已付·应收 / 状态） */}
      {showStages && stagesOpen &&
        row.stages.map((s) => (
          <tr key={s.stageId} className="border-b border-slate-100 bg-slate-50/40">
            <td className="py-1.5 pr-3 pl-8 text-xs text-slate-600">{s.name}</td>
            <td className="py-1.5 px-3 text-right text-xs">
              <PaidFraction paid={s.paid} receivable={s.receivable} muted />
            </td>
            <td className="py-1.5 px-3 text-right">
              <StatusChip receivable={s.receivable} unpaid={s.unpaid} />
            </td>
            <td className="py-1.5 pl-3"></td>
          </tr>
        ))}

      {/* 记账▾ 编辑器（不改） */}
      {editing && (
        <tr className="border-b border-slate-100 bg-slate-50/40">
          <td colSpan={4} className="px-2 py-3">
            <ReceivablesItemsArea caseId={row.caseId} planId={row.planId} applicantId={row.applicantId} staged={row.staged} />
          </td>
        </tr>
      )}
    </>
  )
}

export function ReceivablesTable({ rows, totals }: { rows: ReceivableRow[]; totals: ReceivableTotals }) {
  if (rows.length === 0) {
    return <p className="py-2 text-sm text-slate-400">暂无案件（先在客户下建案件，再来这里记账）</p>
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            <th className="py-2 pr-3 font-medium">客户 · 案件</th>
            <th className="py-2 px-3 text-right font-medium">已付 / 应收</th>
            <th className="py-2 px-3 text-right font-medium">未付 / 状态</th>
            <th className="py-2 pl-3 text-right font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <ReceivableRowItem key={`${r.caseId}:${r.applicantId ?? 'merged'}`} row={r} />
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300 font-semibold text-slate-900">
            <td className="py-2.5 pr-3">合计</td>
            <td className="py-2.5 px-3 text-right">
              <PaidFraction paid={totals.paid} receivable={totals.receivable} />
            </td>
            <td className="py-2.5 px-3 text-right">
              <StatusChip receivable={totals.receivable} unpaid={totals.unpaid} />
            </td>
            <td className="py-2.5 pl-3"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
