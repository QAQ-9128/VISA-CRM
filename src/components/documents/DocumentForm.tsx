import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { useAddDocument } from '../../hooks/queries/useDocuments'
import { UPLOAD_LIMIT_HINT, uploadSizeError } from '../../lib/upload'
import { toastError } from '../../store/ui'
import { DOC_TYPES, DOC_TYPE_LABELS } from '../../types/domain'
import type { DocType } from '../../types/domain'

/** 新增文件：可上传文件，也可只登记到期日（不传文件）。 */
export function DocumentForm({
  customerId,
  caseId,
  onDone,
  initialFile = null,
}: {
  customerId: string
  caseId?: string | null
  onDone: () => void
  /** 预填文件（如从拖拽区拖入）；可选。 */
  initialFile?: File | null
}) {
  const add = useAddDocument()
  const [docType, setDocType] = useState<DocType>('passport')
  const [title, setTitle] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(initialFile)

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
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-brand-100 bg-brand-50/40 p-3">
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
        <span className="block text-sm font-semibold text-body">
          文件（可选，不传则仅登记到期日）
          <span className="ml-2 font-normal text-faint">{UPLOAD_LIMIT_HINT}</span>
        </span>
        <input
          type="file"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            // 选中即校验（不等提交才报）：超限提示并清空选择；上传咽喉 uploadFile 还有兜底
            const err = f && uploadSizeError(f)
            if (err) {
              toastError(err)
              e.target.value = ''
              setFile(null)
              return
            }
            setFile(f)
          }}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-600"
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
