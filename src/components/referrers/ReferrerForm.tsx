import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Textarea } from '../ui/Textarea'
import type { Referrer, ReferrerInsert } from '../../types/models'

export type ReferrerFormValues = ReferrerInsert & { name: string }

const trimOrNull = (s: string) => (s.trim() === '' ? null : s.trim())

interface Props {
  initial?: Referrer
  submitting?: boolean
  error?: string | null
  onSubmit: (values: ReferrerFormValues) => void
  onCancel: () => void
}

export function ReferrerForm({ initial, submitting, error, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [contactPhone, setContactPhone] = useState(initial?.contact_phone ?? '')
  const [contactEmail, setContactEmail] = useState(initial?.contact_email ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit({
      name: name.trim(),
      contact_phone: trimOrNull(contactPhone),
      contact_email: trimOrNull(contactEmail),
      notes: trimOrNull(notes),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <TextField label="介绍人姓名 *" required value={name} onChange={(e) => setName(e.target.value)} placeholder="如 王经理 / XX 移民工作室" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField label="联系电话" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        <TextField label="联系邮箱" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
      </div>
      <Textarea label="备注" value={notes} onChange={(e) => setNotes(e.target.value)} />

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="flex gap-3 pt-2">
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
