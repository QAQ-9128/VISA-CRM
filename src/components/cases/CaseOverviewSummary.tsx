import type { ReactNode } from 'react'
import { Card, CardHead } from '../ui/Card'
import { DocIcon } from '../ui/icons'
import { formatMoney } from '../../lib/money'
import { DOC_TYPE_LABELS } from '../../types/domain'
import type { CaseStage } from '../../types/domain'
import type { CaseDocument, RecordRow } from '../../types/models'

export type OverviewTab = '付款' | '记录' | '文件'

interface CaseTotals {
  totalDue: number
  totalPaid: number
  totalUnpaid: number
}

/** 金额格小卡：完整显示，不截断（窄时折行）。 */
function MiniPay({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-[12px] bg-surface-2 px-3 py-2.5">
      <div className="text-[11.5px] text-muted">{label}</div>
      <div className={`mt-0.5 text-[14.5px] font-bold tabular-nums ${cls}`}>{value}</div>
    </div>
  )
}

function TabLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-brand hover:text-brand-600"
    >
      {children} ›
    </button>
  )
}

/**
 * 案件「概览」摘要 dashboard：付款摘要 / 下一步提醒 / 最近记录 / 文件。
 * 纯展示——所有数据由 props 传入，按现有数据渲染，空数据不崩。
 */
export function CaseOverviewSummary({
  syncTracking,
  payTotals,
  instTotal,
  instPaid,
  instPct,
  records,
  openTasks,
  docs,
  docCount,
  currentStage,
  showTrt,
  trtMonths,
  onTab,
}: {
  syncTracking: boolean
  payTotals: CaseTotals
  instTotal: number
  instPaid: number
  instPct: number
  /** 最近记录（已截取） */
  records: RecordRow[]
  /** 未完成待办（已截取） */
  openTasks: RecordRow[]
  /** 最近文件（已截取，未归档） */
  docs: CaseDocument[]
  /** 未归档文件总数 */
  docCount: number
  currentStage: CaseStage
  showTrt: boolean
  trtMonths: number
  onTab: (t: OverviewTab) => void
}) {
  const noNext = !showTrt && currentStage !== 'docs_requested' && openTasks.length === 0
  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
      {/* 付款摘要 */}
      <Card>
        <CardHead title="付款摘要" action={<TabLink onClick={() => onTab('付款')}>查看付款详情</TabLink>} />
        {syncTracking ? (
          <>
            <div className="flex gap-2.5">
              <MiniPay label="应收" value={formatMoney(payTotals.totalDue)} cls="text-ink" />
              <MiniPay label="已付" value={formatMoney(payTotals.totalPaid)} cls="text-emerald-600" />
              <MiniPay label="未付" value={formatMoney(Math.max(0, payTotals.totalUnpaid))} cls="text-rose-600" />
            </div>
            {instTotal > 0 && (
              <div className="mt-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">分期进度</span>
                  <span className="font-semibold tabular-nums text-body">{instPaid}/{instTotal} 期</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line-2">
                  <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${instPct}%` }} />
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">本案件按申请人分开核算，详见「付款」标签。</p>
        )}
      </Card>

      {/* 下一步 / 提醒 */}
      <Card>
        <CardHead title="下一步 / 提醒" />
        <ul className="space-y-2.5 text-sm">
          {showTrt && (
            <li className="flex items-start gap-2 text-amber-800">
              <span aria-hidden>⚠️</span>
              <span>可办 186 TRT 永居（下签 {trtMonths} 个月）</span>
            </li>
          )}
          {currentStage === 'docs_requested' && (
            <li className="flex items-start gap-2 text-body">
              <span aria-hidden>📎</span>
              <span>移民局要求补件，待补充材料</span>
            </li>
          )}
          {openTasks.map((t) => (
            <li key={t.id} className="flex items-start gap-2 text-body">
              <span aria-hidden>☑️</span>
              <span className="min-w-0">
                {t.content}
                {t.due_date && <span className="text-xs text-faint"> · 截止 {t.due_date}</span>}
              </span>
            </li>
          ))}
          {noNext && <li className="text-faint">暂无待办提醒</li>}
        </ul>
      </Card>

      {/* 最近记录 */}
      <Card>
        <CardHead title="最近记录" action={<TabLink onClick={() => onTab('记录')}>添加记录</TabLink>} />
        {records.length === 0 ? (
          <p className="text-sm text-faint">暂无记录</p>
        ) : (
          <ul className="space-y-2.5">
            {records.map((r) => (
              <li key={r.id} className="flex items-start gap-2 text-sm">
                <span aria-hidden>{r.emoji_marker || (r.type === 'task' ? '☑️' : '💬')}</span>
                <div className="min-w-0 flex-1">
                  <p className={r.is_done ? 'text-faint line-through' : 'text-body'}>{r.content}</p>
                  <p className="text-xs text-faint">
                    {r.type === 'task' ? '待办' : '跟进'}
                    {r.due_date ? ` · 截止 ${r.due_date}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 文件 */}
      <Card>
        <CardHead title="文件" sub={`共 ${docCount} 个`} action={<TabLink onClick={() => onTab('文件')}>查看 / 上传</TabLink>} />
        {docs.length === 0 ? (
          <p className="text-sm text-faint">暂无文件</p>
        ) : (
          <ul className="space-y-2">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-sm text-body">
                <DocIcon className="size-4 shrink-0 text-faint" />
                <span className="min-w-0 flex-1 truncate">{d.file_name || DOC_TYPE_LABELS[d.doc_type]}</span>
                {d.expiry_date && <span className="shrink-0 text-xs text-faint">到期 {d.expiry_date}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
