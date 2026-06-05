import { useMemo, useState } from 'react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { TextField } from '../ui/TextField'
import { useRecordsByCase, useCreateRecord, useUpdateRecord, useDeleteRecord } from '../../hooks/queries/useRecords'
import { useDocumentsByCase } from '../../hooks/queries/useDocuments'
import { selectCaseTodos } from '../../lib/caseTodos'
import { sortRecords } from '../../lib/records'
import { todayYmd, isPastYmd } from '../../lib/dateRules'
import { toastError } from '../../store/ui'
import { FOLLOW_UP_EMOJIS, DEFAULT_FOLLOW_UP_EMOJI } from '../../types/domain'
import type { Case } from '../../types/models'

const TODO_TONE: Record<string, string> = {
  amber: 'text-amber-700',
  rose: 'text-rose-600',
  default: 'text-body',
}

/**
 * 「+ 添加」本案记录（与原记录 tab 同一 flow）：要么记一条**待办**（内容 + 可选截止日，
 * 默认指派给当前用户），要么记一条**带 emoji 的跟进**。保存走现有 useCreateRecord。
 */
function AddCaseRecordForm({ caseId, customerId, onDone }: { caseId: string; customerId: string; onDone: () => void }) {
  const create = useCreateRecord()
  const [type, setType] = useState<'task' | 'follow_up'>('task')
  const [content, setContent] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [emoji, setEmoji] = useState<string>(DEFAULT_FOLLOW_UP_EMOJI)
  const canSave = content.trim() !== ''

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    // 待办截止日是计划 → 禁过去日期（min 属性 + 此处兜底拦手输）
    if (type === 'task' && isPastYmd(dueDate)) {
      toastError('截止日不能是过去的日期')
      return
    }
    create.mutate(
      {
        customer_id: customerId,
        case_id: caseId,
        type,
        content: content.trim(),
        due_date: type === 'task' ? dueDate || null : null,
        emoji_marker: type === 'follow_up' ? emoji : null,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form onSubmit={save} className="mt-3 space-y-2.5 rounded-[14px] border border-brand-100 bg-brand-50/40 p-3">
      {/* 类型段控：待办 / 跟进（emoji） */}
      <div className="inline-flex gap-1 rounded-full bg-surface-2 p-1">
        {(
          [
            { v: 'task', label: '记待办' },
            { v: 'follow_up', label: '记跟进' },
          ] as const
        ).map(({ v, label }) => (
          <button
            key={v}
            type="button"
            onClick={() => setType(v)}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
              type === v ? 'bg-brand-700 text-white' : 'text-muted hover:text-body'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {type === 'follow_up' && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="跟进标记">
          {FOLLOW_UP_EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => setEmoji(em)}
              aria-pressed={emoji === em}
              className={`grid size-9 place-items-center rounded-full text-base transition-colors ${
                emoji === em ? 'bg-[var(--color-lime-soft)] ring-1 ring-[var(--color-lime-d)]' : 'bg-surface-2 hover:bg-brand-50'
              }`}
            >
              {em}
            </button>
          ))}
        </div>
      )}

      <TextField
        label={type === 'task' ? '待办内容 *' : '跟进内容 *'}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={type === 'task' ? '如：递交签证申请' : '如：已电话沟通补件清单'}
      />
      {type === 'task' && (
        <TextField label="截止日（可选，不能选过去）" type="date" min={todayYmd()} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      )}

      {create.isError && <p className="text-sm text-[var(--color-coral)]">保存失败，请重试。</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={!canSave || create.isPending}>
          {create.isPending ? '保存中…' : '保存'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>取消</Button>
      </div>
    </form>
  )
}

/**
 * 「本案待办 · 要做的事」卡 —— 案件详情页与客户详情页共用（功能一模一样）：
 *   待办清单（记录/文件到期/TRT 派生）+「+ 添加」（记待办 / 记 emoji 跟进）
 *   + 待办行内 完成/删除 + 近期跟进列表（可删）。全部复用现有 records flow。
 * 切换案件时请在使用处加 key={caseRow.id}。
 */
export function CaseTodosCard({ caseRow, trt }: { caseRow: Case; trt: { show: boolean; months: number } }) {
  const records = useRecordsByCase(caseRow.id)
  const docs = useDocumentsByCase(caseRow.id)
  const updateRecord = useUpdateRecord()
  const deleteRecord = useDeleteRecord()
  const [adding, setAdding] = useState(false)

  const todos = useMemo(
    () => selectCaseTodos({ records: records.data ?? [], docs: docs.data ?? [], trt }),
    [records.data, docs.data, trt],
  )
  const followUps = useMemo(
    () => sortRecords(records.data ?? []).filter((r) => r.type === 'follow_up').slice(0, 5),
    [records.data],
  )

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="border-l-[3px] border-brand pl-2 font-serif text-[16px] font-bold text-ink">本案待办 · 要做的事</h2>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="shrink-0 rounded-full border border-dashed border-brand/55 px-3 py-1 text-[12px] font-semibold text-brand-700 transition-colors hover:bg-brand-50"
          >
            + 添加
          </button>
        )}
      </div>

      {/* + 添加：要么记待办，要么记带 emoji 的跟进（复用原记录 flow） */}
      {adding && <AddCaseRecordForm caseId={caseRow.id} customerId={caseRow.customer_id} onDone={() => setAdding(false)} />}

      {todos.length === 0 ? (
        <p className="mt-3 text-sm text-faint">本案暂无待办</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {todos.map((t) => {
            const recordId = t.kind === 'task' ? t.id.slice('task-'.length) : null
            return (
              <li key={t.id} className="flex items-center gap-2.5 text-[14px]">
                <span aria-hidden>{t.kind === 'trt' ? '⚠️' : t.kind === 'expiry' ? '📎' : '☑️'}</span>
                <span className={`min-w-0 flex-1 truncate font-medium ${TODO_TONE[t.tone]}`}>
                  {t.text}
                  {t.sub && <span className="text-[11.5px] text-faint"> · {t.sub}</span>}
                </span>
                {t.badge ? (
                  <span className={`shrink-0 text-[12px] font-semibold ${t.tone === 'rose' ? 'text-rose-600' : 'text-faint'}`}>{t.badge}</span>
                ) : (
                  <span className="shrink-0 rounded-full bg-[var(--color-mute-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-mute-tx)]">待办</span>
                )}
                {/* 待办（记录派生）行内操作：完成 / 删除（复用原记录 flow） */}
                {recordId && (
                  <span className="flex shrink-0 items-center gap-2 text-[12px] font-semibold">
                    <button
                      type="button"
                      disabled={updateRecord.isPending}
                      onClick={() => updateRecord.mutate({ id: recordId, patch: { is_done: true, done_at: new Date().toISOString() } })}
                      className="text-brand hover:text-brand-600 disabled:opacity-50"
                    >
                      完成
                    </button>
                    <button
                      type="button"
                      disabled={deleteRecord.isPending}
                      onClick={() => { if (window.confirm('删除这条待办？')) deleteRecord.mutate(recordId) }}
                      className="text-faint hover:text-[var(--color-coral)] disabled:opacity-50"
                    >
                      删除
                    </button>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* 近期跟进（带 emoji 的记录） */}
      {followUps.length > 0 && (
        <div className="mt-3 border-t border-line pt-2.5">
          <h3 className="text-[12px] font-bold text-muted">近期跟进</h3>
          <ul className="mt-1.5 space-y-1.5">
            {followUps.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-[13px]">
                <span aria-hidden>{r.emoji_marker || DEFAULT_FOLLOW_UP_EMOJI}</span>
                <span className="min-w-0 flex-1 truncate text-body">{r.content}</span>
                <span className="shrink-0 text-[11px] text-faint tabular-nums">{(r.created_at ?? '').slice(0, 10)}</span>
                <button
                  type="button"
                  disabled={deleteRecord.isPending}
                  onClick={() => { if (window.confirm('删除这条跟进？')) deleteRecord.mutate(r.id) }}
                  className="shrink-0 text-[12px] font-semibold text-faint hover:text-[var(--color-coral)] disabled:opacity-50"
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
