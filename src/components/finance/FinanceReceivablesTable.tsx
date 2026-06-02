import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../ui/Avatar'
import { Pill } from '../ui/Pill'
import type { PillTone } from '../ui/Pill'
import { PayCell } from './receivableCells'
import { RecMenu, StageExpandArea, RowModeArea } from './financeRowEdit'
import type { RowMode } from './financeRowEdit'
import { useBackSource } from '../../hooks/useBackSource'
import { getCustomerPaymentColor, CUSTOMER_PAYMENT_TEXT_CLASS } from '../../lib/finance'
import type { ReceivableTotals } from '../../lib/finance'
import type { FinanceTableRow, FinanceStatusKind } from '../../lib/financeRows'

const ROLE_TAG: Record<string, string> = {
  primary: 'bg-blue-100 text-blue-700',
  secondary: 'bg-violet-100 text-violet-700',
}

const STATUS_TONE: Record<FinanceStatusKind, PillTone> = {
  unset: 'slate',
  settled: 'emerald',
  overdue: 'rose',
  pending: 'amber',
}

const COLSPAN = 7

/** 总进度：已收/应收 + 绿色进度条 + 百分比。 */
function TotalProgress({ paid, receivable, percent }: { paid: number; receivable: number; percent: number }) {
  return (
    <div className="min-w-[170px]">
      <PayCell paid={paid} receivable={receivable} />
      {receivable > 0 && (
        <div className="mt-1.5 flex items-center gap-2">
          <span className="h-2 max-w-[150px] flex-1 overflow-hidden rounded-full bg-line-2">
            <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
          </span>
          <span className={`text-xs font-bold tabular-nums ${percent >= 100 ? 'text-emerald-600' : 'text-muted'}`}>
            {percent}%
          </span>
        </div>
      )}
    </div>
  )
}

/** 分期进度：实心/空心圆点 + x/N 期；无分期显「未设置」。 */
function InstallmentDots({ paid, total }: { paid: number; total: number }) {
  if (total === 0) return <span className="text-slate-300">未设置</span>
  return (
    <div className="flex items-center gap-2">
      <span className="flex flex-wrap items-center gap-[3px]">
        {Array.from({ length: total }).map((_, k) => (
          <i key={k} className={`size-2.5 rounded-full ${k < paid ? 'bg-emerald-500' : 'bg-line-2'}`} />
        ))}
      </span>
      <span className="text-[12.5px] font-semibold whitespace-nowrap text-muted">
        {paid}/{total} 期
      </span>
    </div>
  )
}

function FinanceRow({ entry }: { entry: FinanceTableRow }) {
  const { row, inst, status, percent } = entry
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<RowMode>(null)
  const source = useBackSource()
  const nameColor = getCustomerPaymentColor(row.receivable, row.paid, row.unpaid)
  const isStaged = row.staged

  return (
    <>
      <tr className={`border-b border-line align-top ${open || mode ? 'bg-surface-2' : ''}`}>
        {/* 客户 */}
        <td className={`py-3 pr-3 ${row.role === 'secondary' ? 'pl-5' : ''}`}>
          <div className="flex items-center gap-2.5">
            {row.role === 'secondary' && <span className="select-none font-mono text-slate-300" aria-hidden>└─</span>}
            <Avatar name={row.customerName || '客户'} seed={row.customerId} size={34} />
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <Link
                to={`/cases/${row.caseId}`}
                state={source}
                className={`text-sm font-semibold hover:underline ${nameColor === 'default' ? 'text-ink' : CUSTOMER_PAYMENT_TEXT_CLASS[nameColor]}`}
              >
                {row.customerName || '（未知客户）'}
              </Link>
              {row.role === 'merged' && row.coApplicantNames.length > 0 && (
                <span className="text-xs text-faint">＋ {row.coApplicantNames.join('、')}</span>
              )}
              {row.role === 'merged' ? (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">合并</span>
              ) : (
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ROLE_TAG[row.role]}`}>
                  {row.role === 'primary' ? '主申' : '副申'}
                </span>
              )}
            </div>
          </div>
        </td>

        {/* 案件（签证类别） */}
        <td className="px-3 py-3 font-semibold whitespace-nowrap text-muted">{row.visaSubclass}</td>

        {/* 总进度 */}
        <td className="px-3 py-3">
          <TotalProgress paid={row.paid} receivable={row.receivable} percent={percent} />
        </td>

        {/* 分期进度 */}
        <td className="px-3 py-3">
          <InstallmentDots paid={inst.paid} total={inst.total} />
        </td>

        {/* 下一期 */}
        <td className="px-3 py-3">
          {inst.next ? (
            <div>
              <div className="text-[13.5px] font-semibold text-ink">{inst.next.label}</div>
              <div className={`mt-0.5 text-xs ${inst.next.overdueDays > 0 ? 'font-semibold text-rose-600' : 'text-faint'}`}>
                {inst.next.overdueDays > 0 ? `已逾期 ${inst.next.overdueDays} 天` : inst.next.dueDate || '无日期'}
              </div>
            </div>
          ) : (
            <span className="text-slate-300">—</span>
          )}
        </td>

        {/* 状态 */}
        <td className="px-3 py-3">
          <Pill tone={STATUS_TONE[status.kind]} dot={false}>{status.label}</Pill>
        </td>

        {/* 操作 */}
        <td className="py-3 pl-3 text-right whitespace-nowrap">
          {isStaged ? (
            <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs font-semibold text-brand hover:underline">
              {open ? '收起' : '展开'}
            </button>
          ) : (
            <RecMenu onPick={(m) => { setOpen(false); setMode((cur) => (cur === m ? null : m)) }} />
          )}
        </td>
      </tr>

      {open && isStaged && (
        <tr className="border-b border-line bg-surface-2">
          <td colSpan={COLSPAN} className="px-3 py-4 pl-[60px]">
            <StageExpandArea row={row} />
          </td>
        </tr>
      )}

      {mode && (
        <tr className="border-b border-line bg-surface-2">
          <td colSpan={COLSPAN} className="px-3 py-3">
            <RowModeArea row={row} mode={mode} onClose={() => setMode(null)} />
          </td>
        </tr>
      )}
    </>
  )
}

/** 财务页「近期案件应收」富表：客户 / 案件 / 总进度 / 分期进度 / 下一期 / 状态 / 操作 + 展开 + 合计行。 */
export function FinanceReceivablesTable({ rows, totals }: { rows: FinanceTableRow[]; totals: ReceivableTotals }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[64rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line-2 text-left text-xs font-medium text-muted">
            <th className="py-2.5 pr-3">客户</th>
            <th className="px-3 py-2.5">案件</th>
            <th className="px-3 py-2.5">总进度</th>
            <th className="px-3 py-2.5">分期进度</th>
            <th className="px-3 py-2.5">下一期</th>
            <th className="px-3 py-2.5">状态</th>
            <th className="py-2.5 pl-3 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={COLSPAN} className="py-6 text-center text-sm text-faint">没有匹配的应收</td>
            </tr>
          ) : (
            rows.map((e) => <FinanceRow key={`${e.row.caseId}:${e.row.applicantId ?? 'merged'}`} entry={e} />)
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-line-2 font-semibold text-ink">
            <td className="py-3 pr-3">合计</td>
            <td />
            <td className="px-3 py-3">
              <PayCell paid={totals.paid} receivable={totals.receivable} />
            </td>
            <td />
            <td />
            <td className="px-3 py-3">
              {totals.unpaid > 0 ? (
                <Pill tone="rose" dot={false}>欠 {fmtMoney(totals.unpaid)}</Pill>
              ) : (
                <Pill tone="emerald" dot={false}>已结清</Pill>
              )}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

const fmtMoney = (n: number) => `AUD ${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
