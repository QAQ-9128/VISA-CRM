import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ReceivablesItemsArea } from './ReceivablesItemsArea'
import { getCustomerPaymentColor, CUSTOMER_PAYMENT_TEXT_CLASS } from '../../lib/finance'
import type { ReceivableRow, ReceivableTotals } from '../../lib/finance'

const fmt = (n: number) => n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const ROLE_LABEL: Record<string, string> = { merged: '合并', primary: '主申', secondary: '副申' }
const ROLE_TAG: Record<string, string> = {
  merged: 'bg-slate-100 text-slate-600',
  primary: 'bg-blue-100 text-blue-700',
  secondary: 'bg-violet-100 text-violet-700',
}

function ReceivableRowItem({ row }: { row: ReceivableRow }) {
  const [open, setOpen] = useState(false)
  const nameColor = getCustomerPaymentColor(row.receivable, row.paid, row.unpaid)

  return (
    <>
      <tr className="border-b border-slate-100">
        <td className={`py-2.5 pr-3 ${row.role === 'secondary' ? 'pl-5' : ''}`}>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            {row.role === 'secondary' && (
              <span className="select-none font-mono text-slate-300" aria-hidden>
                └─
              </span>
            )}
            <Link
              to={`/cases/${row.caseId}`}
              state={{ from: 'finance' }}
              className={`font-medium hover:underline ${
                nameColor === 'default' ? 'text-indigo-600' : CUSTOMER_PAYMENT_TEXT_CLASS[nameColor]
              }`}
            >
              {row.customerName || '（未知客户）'}
            </Link>
            {row.role === 'merged' && row.coApplicantNames.length > 0 && (
              <span className="text-slate-500">＋ {row.coApplicantNames.join('、')}</span>
            )}
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ROLE_TAG[row.role]}`}>
              {ROLE_LABEL[row.role]}
            </span>
            <span className="text-slate-400">· {row.visaSubclass}</span>
          </div>
        </td>
        <td className="py-2.5 px-3 text-right tabular-nums text-slate-900">{fmt(row.receivable)}</td>
        <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700">{fmt(row.paid)}</td>
        <td className={`py-2.5 px-3 text-right font-medium tabular-nums ${row.unpaid > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
          {fmt(row.unpaid)}
        </td>
        <td className="py-2.5 pl-3 text-right">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-md px-2 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
          >
            {open ? '收起' : '记账 ▾'}
          </button>
        </td>
      </tr>

      {open && (
        <tr className="border-b border-slate-100 bg-slate-50/40">
          <td colSpan={5} className="px-2 py-3">
            {/* 应收区：分阶段收费开关 + 阶段表/款项明细 */}
            <ReceivablesItemsArea
              caseId={row.caseId}
              planId={row.planId}
              applicantId={row.applicantId}
              staged={row.staged}
            />
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
            <th className="py-2 px-3 text-right font-medium">收款（应收）</th>
            <th className="py-2 px-3 text-right font-medium">已付</th>
            <th className="py-2 px-3 text-right font-medium">未付</th>
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
            <td className="py-2.5 px-3 text-right tabular-nums">{fmt(totals.receivable)}</td>
            <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700">{fmt(totals.paid)}</td>
            <td className="py-2.5 px-3 text-right tabular-nums text-rose-600">{fmt(totals.unpaid)}</td>
            <td className="py-2.5 pl-3"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
