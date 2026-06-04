import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../ui/Avatar'
import { PayCell, StatusPill } from './receivableCells'
import { RecMenu, StageExpandArea, RowModeArea } from './financeRowEdit'
import type { RowMode } from './financeRowEdit'
import { useBackSource } from '../../hooks/useBackSource'
import { getCustomerPaymentColor, CUSTOMER_PAYMENT_TEXT_CLASS } from '../../lib/finance'
import type { ReceivableRow, ReceivableTotals } from '../../lib/finance'

function ReceivableRowItem({ row }: { row: ReceivableRow }) {
  const [open, setOpen] = useState(false) // 分阶段展开
  const [mode, setMode] = useState<RowMode>(null) // 记账▾ 打开的编辑器
  const source = useBackSource()
  const nameColor = getCustomerPaymentColor(row.receivable, row.paid, row.unpaid)
  const isStaged = row.staged
  const showPhaseTag = row.stages.length >= 1

  return (
    <>
      <tr className={`border-b border-line ${open || mode ? 'bg-surface-2' : ''}`}>
        {/* 客户 · 案件（参与人平级，无主/副申标签、无缩进） */}
        <td className="py-2.5 pr-3">
          <div className="flex items-center gap-2.5">
            <Avatar name={row.customerName || '客户'} seed={row.customerId} size={34} />
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <Link
                to={`/customers/${row.customerId}?case=${row.caseId}`}
                state={source}
                className={`text-sm font-semibold hover:underline ${nameColor === 'default' ? 'text-brand' : CUSTOMER_PAYMENT_TEXT_CLASS[nameColor]}`}
              >
                {row.customerName || '（未知客户）'}
              </Link>
              {row.role === 'merged' && row.coApplicantNames.length > 0 && (
                <span className="text-xs text-faint">＋ {row.coApplicantNames.join('、')}</span>
              )}
              {row.role === 'merged' && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">合并</span>
              )}
              <span className="text-xs text-faint">· {row.visaSubclass}</span>
              {isStaged && showPhaseTag && (
                <button
                  type="button"
                  onClick={() => setOpen((v) => !v)}
                  className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand hover:bg-brand-100"
                >
                  分 {row.stages.length} 期 <span aria-hidden>{open ? '▴' : '▾'}</span>
                </button>
              )}
            </div>
          </div>
        </td>

        {/* 已付 / 应收 */}
        <td className="px-3 py-2.5 text-right">
          <PayCell paid={row.paid} receivable={row.receivable} />
        </td>

        {/* 未付 / 状态 */}
        <td className="px-3 py-2.5 text-right">
          <StatusPill receivable={row.receivable} unpaid={row.unpaid} />
        </td>

        {/* 操作：分阶段 → 展开/收起；否则 → 记账▾ */}
        <td className="py-2.5 pl-3 text-right whitespace-nowrap">
          {isStaged ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-xs font-semibold text-brand hover:underline"
            >
              {open ? '收起' : '展开'}
            </button>
          ) : (
            <RecMenu onPick={(m) => { setOpen(false); setMode((cur) => (cur === m ? null : m)) }} />
          )}
        </td>
      </tr>

      {/* 分阶段展开：阶段表(分阶段收费 + 新增阶段) + 计划级分期表 */}
      {open && isStaged && (
        <tr className="border-b border-line bg-surface-2">
          <td colSpan={4} className="px-3 py-4 pl-[60px]">
            <StageExpandArea row={row} />
          </td>
        </tr>
      )}

      {/* 记账▾ 打开的编辑器（非分阶段行） */}
      {mode && (
        <tr className="border-b border-line bg-surface-2">
          <td colSpan={4} className="px-3 py-3">
            <RowModeArea row={row} mode={mode} onClose={() => setMode(null)} />
          </td>
        </tr>
      )}
    </>
  )
}

export function ReceivablesTable({ rows, totals }: { rows: ReceivableRow[]; totals: ReceivableTotals }) {
  if (rows.length === 0) {
    return <p className="py-2 text-sm text-faint">暂无案件（先在客户下建案件，再来这里记账）</p>
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line-2 text-left text-xs font-medium text-muted">
            <th className="py-2 pr-3">客户 · 案件</th>
            <th className="px-3 py-2 text-right">已付 / 应收</th>
            <th className="px-3 py-2 text-right">未付 / 状态</th>
            <th className="py-2 pl-3 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <ReceivableRowItem key={`${r.caseId}:${r.applicantId ?? 'merged'}`} row={r} />
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-line-2 font-semibold text-ink">
            <td className="py-2.5 pr-3">合计</td>
            <td className="px-3 py-2.5 text-right">
              <PayCell paid={totals.paid} receivable={totals.receivable} />
            </td>
            <td className="px-3 py-2.5 text-right">
              <StatusPill receivable={totals.receivable} unpaid={totals.unpaid} />
            </td>
            <td className="py-2.5 pl-3"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
