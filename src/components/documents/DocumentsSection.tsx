import { useState } from 'react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { ExpiryBadge } from './ExpiryBadge'
import { DocumentForm } from './DocumentForm'
import {
  useArchiveDocument,
  useDocumentsByCase,
  useDocumentsByCustomer,
} from '../../hooks/queries/useDocuments'
import { getDocumentSignedUrl } from '../../api/documents'
import { DOC_TYPE_LABELS } from '../../types/domain'
import type { CaseDocument } from '../../types/models'

function DownloadButton({ path }: { path: string }) {
  const [loading, setLoading] = useState(false)
  async function open() {
    setLoading(true)
    try {
      const url = await getDocumentSignedUrl(path)
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      window.alert('打开失败：' + (e instanceof Error ? e.message : '未知错误'))
    } finally {
      setLoading(false)
    }
  }
  return (
    <Button variant="ghost" onClick={open} disabled={loading}>
      {loading ? '打开中…' : '下载'}
    </Button>
  )
}

function DocRow({ doc }: { doc: CaseDocument }) {
  const archive = useArchiveDocument()
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 py-3 last:border-0">
      <Badge>{DOC_TYPE_LABELS[doc.doc_type]}</Badge>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
        {doc.title || doc.file_name || '（未命名）'}
      </span>
      <ExpiryBadge expiryDate={doc.expiry_date} />
      <span className="text-xs text-slate-400">
        {doc.expiry_date ? `到期 ${doc.expiry_date}` : doc.issue_date ? `签发 ${doc.issue_date}` : ''}
      </span>
      {doc.storage_path && <DownloadButton path={doc.storage_path} />}
      <Button
        variant="ghost"
        disabled={archive.isPending}
        onClick={() => {
          if (window.confirm('归档该文件？归档后默认不显示。')) archive.mutate(doc.id)
        }}
      >
        归档
      </Button>
    </li>
  )
}

/** 文件区：在客户详情（按客户）或案件详情（按案件）复用。customerId 始终需要（上传归属客户）。 */
export function DocumentsSection({
  customerId,
  caseId,
}: {
  customerId: string
  caseId?: string
}) {
  const [adding, setAdding] = useState(false)
  // 两个 hook 都无条件调用，仅启用相关的一个
  const byCase = useDocumentsByCase(caseId)
  const byCustomer = useDocumentsByCustomer(caseId ? undefined : customerId)
  const query = caseId ? byCase : byCustomer

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">文件</h2>
        {!adding && (
          <Button variant="secondary" onClick={() => setAdding(true)}>
            + 上传 / 登记文件
          </Button>
        )}
      </div>

      {adding && (
        <DocumentForm customerId={customerId} caseId={caseId ?? null} onDone={() => setAdding(false)} />
      )}

      {query.isPending ? (
        <p className="text-sm text-slate-400">加载文件…</p>
      ) : query.data && query.data.length > 0 ? (
        <ul className="rounded-xl border border-slate-200 bg-white px-3">
          {query.data.map((d) => (
            <DocRow key={d.id} doc={d} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">暂无文件</p>
      )}
    </section>
  )
}
