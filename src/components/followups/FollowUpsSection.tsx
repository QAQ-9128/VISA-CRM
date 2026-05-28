import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { Badge } from '../ui/Badge'
import {
  useCreateFollowUp,
  useDeleteFollowUp,
  useFollowUpsByCase,
  useFollowUpsByCustomer,
} from '../../hooks/queries/useFollowUps'
import { FOLLOW_UP_CHANNELS, FOLLOW_UP_CHANNEL_LABELS } from '../../types/domain'
import type { FollowUpChannel } from '../../types/domain'

/** 跟进时间线（倒序）+ 添加。客户详情按客户、案件详情按案件。 */
export function FollowUpsSection({ customerId, caseId }: { customerId: string; caseId?: string }) {
  const byCase = useFollowUpsByCase(caseId)
  const byCustomer = useFollowUpsByCustomer(caseId ? undefined : customerId)
  const query = caseId ? byCase : byCustomer
  const create = useCreateFollowUp()
  const del = useDeleteFollowUp()

  const [adding, setAdding] = useState(false)
  const [channel, setChannel] = useState<FollowUpChannel>('call')
  const [content, setContent] = useState('')

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    create.mutate(
      { customer_id: customerId, case_id: caseId ?? null, channel, content: content.trim() },
      {
        onSuccess: () => {
          setContent('')
          setAdding(false)
        },
      },
    )
  }

  const channelOptions = FOLLOW_UP_CHANNELS.map((c) => ({ value: c, label: FOLLOW_UP_CHANNEL_LABELS[c] }))

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">跟进</h2>
        {!adding && (
          <Button variant="secondary" onClick={() => setAdding(true)}>
            + 加跟进
          </Button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
          <Select
            label="渠道"
            options={channelOptions}
            value={channel}
            onChange={(e) => setChannel(e.target.value as FollowUpChannel)}
          />
          <Textarea label="内容" value={content} onChange={(e) => setContent(e.target.value)} rows={2} />
          <div className="flex gap-2">
            <Button type="submit" disabled={create.isPending || content.trim() === ''}>
              保存
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              取消
            </Button>
          </div>
        </form>
      )}

      {query.isPending ? (
        <p className="text-sm text-slate-400">加载跟进…</p>
      ) : query.data && query.data.length > 0 ? (
        <ol className="space-y-3">
          {query.data.map((f) => (
            <li key={f.id} className="flex gap-3">
              <div className="mt-1.5 size-2 shrink-0 rounded-full bg-indigo-400" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <Badge>{FOLLOW_UP_CHANNEL_LABELS[f.channel]}</Badge>
                  <button
                    type="button"
                    className="text-xs text-slate-400 hover:text-rose-600"
                    onClick={() => {
                      if (window.confirm('删除这条跟进记录？')) del.mutate(f.id)
                    }}
                  >
                    删除
                  </button>
                </div>
                <p className="mt-1 text-sm whitespace-pre-wrap text-slate-800">{f.content}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {new Date(f.created_at).toLocaleString('zh-CN')}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-slate-400">暂无跟进记录</p>
      )}
    </section>
  )
}
