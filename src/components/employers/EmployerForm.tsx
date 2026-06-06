import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Textarea } from '../ui/Textarea'
import type { Employer, EmployerInsert } from '../../types/models'

export type EmployerFormValues = EmployerInsert & { name: string }

const trimOrNull = (s: string) => (s.trim() === '' ? null : s.trim())

interface Props {
  initial?: Employer
  submitting?: boolean
  error?: string | null
  onSubmit: (values: EmployerFormValues) => void
  onCancel: () => void
}

export function EmployerForm({ initial, submitting, error, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [abn, setAbn] = useState(initial?.abn ?? '')
  const [contactName, setContactName] = useState(initial?.contact_name ?? '')
  const [contactPhone, setContactPhone] = useState(initial?.contact_phone ?? '')
  const [contactEmail, setContactEmail] = useState(initial?.contact_email ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit({
      name: name.trim(),
      abn: trimOrNull(abn),
      contact_name: trimOrNull(contactName),
      contact_phone: trimOrNull(contactPhone),
      contact_email: trimOrNull(contactEmail),
      notes: trimOrNull(notes),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 红色必填星号由 required 自动渲染，label 里别再写 *（否则双星号） */}
      <TextField label="雇主名称" required value={name} onChange={(e) => setName(e.target.value)} placeholder="如 ACME Pty Ltd" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField label="ABN（澳洲企业号）" value={abn} onChange={(e) => setAbn(e.target.value)} />
        <TextField label="联系人" value={contactName} onChange={(e) => setContactName(e.target.value)} />
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
