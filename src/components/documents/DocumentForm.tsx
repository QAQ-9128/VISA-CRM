import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { useAddDocument } from '../../hooks/queries/useDocuments'
import { DOC_TYPES, DOC_TYPE_LABELS } from '../../types/domain'
import type { DocType } from '../../types/domain'

/** 新增文件：可上传文件，也可只登记到期日（不传文件）。 */
export function DocumentForm({
  customerId,
  caseId,
  onDone,
}: {
  customerId: string
  caseId?: string | null
  onDone: () => void
}) {
  const add = useAddDocument()
  const [docType, setDocType] = useState<DocType>('passport')
  const [title, setTitle] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    add.mutate(
      {
        file,
        customer_id: customerId,
        case_id: caseId ?? null,
        doc_type: docType,
        title: title.trim() || null,
        issue_date: issueDate || null,
        expiry_date: expiryDate || null,
        note: note.trim() || null,
      },
      { onSuccess: onDone },
    )
  }

  const typeOptions = DOC_TYPES.map((t) => ({ value: t, label: DOC_TYPE_LABELS[t] }))

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Select
          label="文件类型"
          options={typeOptions}
          value={docType}
          onChange={(e) => setDocType(e.target.value as DocType)}
        />
        <TextField label="标签" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如 IELTS 成绩单" />
        <TextField label="签发日期" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        <TextField label="到期日期" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-slate-700">文件（可选，不传则仅登记到期日）</span>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-indigo-700"
        />
      </div>

      <Textarea label="备注" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />

      {add.isError && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {add.error instanceof Error ? add.error.message : '保存失败'}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? '保存中…' : '保存'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          取消
        </Button>
      </div>
    </form>
  )
}
