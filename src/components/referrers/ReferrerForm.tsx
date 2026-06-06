import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Textarea } from '../ui/Textarea'
import { Select } from '../ui/Select'
import { REFERRER_KINDS, REFERRER_KIND_LABELS } from '../../types/domain'
import type { ReferrerKind } from '../../types/domain'
import type { Referrer, ReferrerInsert } from '../../types/models'

export type ReferrerFormValues = ReferrerInsert & { name: string }

const trimOrNull = (s: string) => (s.trim() === '' ? null : s.trim())

interface Props {
  initial?: Referrer
  /** 新建时的默认类型（列表页开关带过来）；编辑时以 initial.kind 为准 */
  defaultKind?: ReferrerKind
  submitting?: boolean
  error?: string | null
  onSubmit: (values: ReferrerFormValues) => void
  onCancel: () => void
}

export function ReferrerForm({ initial, defaultKind = 'referrer', submitting, error, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  // 一表两用：介绍人 / 归属人（编辑可改，改类型不影响已挂靠客户的关联）
  const [kind, setKind] = useState<ReferrerKind>(initial?.kind ?? defaultKind)
  const [contactPhone, setContactPhone] = useState(initial?.contact_phone ?? '')
  const [contactEmail, setContactEmail] = useState(initial?.contact_email ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit({
      name: name.trim(),
      kind,
      contact_phone: trimOrNull(contactPhone),
      contact_email: trimOrNull(contactEmail),
      notes: trimOrNull(notes),
    })
  }

  const kindLabel = REFERRER_KIND_LABELS[kind]

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* 红色必填星号由 required 自动渲染，label 里别再写 *（否则双星号） */}
        <TextField label={`${kindLabel}姓名`} required value={name} onChange={(e) => setName(e.target.value)} placeholder="如 王经理 / XX 移民工作室" />
        <div>
          <Select
            label="类型"
            options={REFERRER_KINDS.map((k) => ({ value: k, label: REFERRER_KIND_LABELS[k] }))}
            value={kind}
            onChange={(e) => setKind(e.target.value as ReferrerKind)}
          />
          <p className="mt-1.5 text-[12px] text-faint">改类型不影响已挂靠客户的关联，只决定 TA 出现在哪个下拉里</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField label="联系电话" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        <TextField label="联系邮箱" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
      </div>
      <Textarea label="备注" value={notes} onChange={(e) => setNotes(e.target.value)} />

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" disabled={submitting || name.trim() === ''}>
          {submitting ? '保存中…' : '保存'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          取消
        </Button>
      </div>
    </form>
  )
}
