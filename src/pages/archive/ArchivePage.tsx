import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useArchiveFiles, useDeleteArchiveFile } from '../../hooks/queries/useArchive'
import {
  filterArchiveFiles,
  sortArchiveFiles,
  type ArchiveFile,
  type ArchiveSortKey,
  type SortDir,
} from '../../lib/archive'
import { getDocumentSignedUrl } from '../../api/documents'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Select } from '../../components/ui/Select'
import { TextField } from '../../components/ui/TextField'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'
import { DOC_TYPES, DOC_TYPE_LABELS } from '../../types/domain'

const TYPE_OPTIONS = [
  { value: 'all', label: '全部类型' },
  { value: 'invoice', label: '发票' },
  ...DOC_TYPES.map((t) => ({ value: t, label: DOC_TYPE_LABELS[t] })),
]

const typeBadgeClass = (typeKey: string) =>
  typeKey === 'invoice' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '—')

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

/** 关联：客户名（链接）+ 案件（签证类别，链接） */
function LinkedTo({ file }: { file: ArchiveFile }) {
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
      {file.customerId ? (
        <Link to={`/customers/${file.customerId}`} className="font-semibold text-brand hover:underline">
          {file.customerName || '（未知客户）'}
        </Link>
      ) : (
        <span className="text-faint">（未知客户）</span>
      )}
      {file.caseId && file.customerId && (
        <Link
          to={`/customers/${file.customerId}?case=${file.caseId}`}
          state={{ from: 'archive' }}
          className="text-faint hover:text-brand hover:underline"
        >
          · {file.visaSubclass || '案件'}
        </Link>
      )}
    </span>
  )
}

export function ArchivePage() {
  const { isPending, isError, files, customers } = useArchiveFiles()
  const del = useDeleteArchiveFile()

  const [search, setSearch] = useState('')
  const [typeKey, setTypeKey] = useState('all')
  const [customerId, setCustomerId] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortKey, setSortKey] = useState<ArchiveSortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const customerOptions = useMemo(
    () => [
      { value: 'all', label: '全部客户' },
      ...[...customers]
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
        .map((c) => ({ value: c.id, label: c.full_name })),
    ],
    [customers],
  )

  const rows = useMemo(() => {
    const filtered = filterArchiveFiles(files, { search, typeKey, customerId, dateFrom, dateTo })
    return sortArchiveFiles(filtered, sortKey, sortDir)
  }, [files, search, typeKey, customerId, dateFrom, dateTo, sortKey, sortDir])

  function toggleSort(key: ArchiveSortKey) {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'date' ? 'desc' : 'asc')
    }
  }
  const arrow = (key: ArchiveSortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '')

  if (isPending) return <LoadingBlock />
  if (isError) return <ErrorBlock error={new Error('档案数据加载失败，请刷新重试')} />

  const isDeleting = (f: ArchiveFile) => del.isPending && del.variables?.key === f.key

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">档案库</h1>
          <p className="mt-0.5 text-sm text-muted">所有上传文件（发票 + 客户/案件文件）统一查看与下载</p>
        </div>
        <span className="text-sm text-faint">共 {rows.length} 个文件</span>
      </div>

      {/* 筛选 / 搜索 */}
      <div className="grid grid-cols-1 gap-3 rounded-card bg-white p-[18px] shadow-soft sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2 lg:col-span-1">
          <TextField
            label="搜索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="文件名 / 客户名"
          />
        </div>
        <Select label="类型" options={TYPE_OPTIONS} value={typeKey} onChange={(e) => setTypeKey(e.target.value)} />
        <Select label="客户" options={customerOptions} value={customerId} onChange={(e) => setCustomerId(e.target.value)} />
        <TextField label="起始日期" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <TextField label="结束日期" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-card bg-white py-10 text-center text-sm text-faint shadow-soft">
          没有符合条件的文件
        </p>
      ) : (
        <>
          {/* 桌面端：表格 */}
          <div className="hidden overflow-x-auto rounded-card bg-white shadow-soft md:block">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold tracking-[0.04em] text-faint uppercase">
                  <th className="px-4 pt-3 pb-3">文件名</th>
                  <th className="px-3 pt-3 pb-3">
                    <button type="button" onClick={() => toggleSort('type')} className="hover:text-body">
                      类型{arrow('type')}
                    </button>
                  </th>
                  <th className="px-3 pt-3 pb-3">
                    <button type="button" onClick={() => toggleSort('customer')} className="hover:text-body">
                      关联到{arrow('customer')}
                    </button>
                  </th>
                  <th className="px-3 pt-3 pb-3">
                    <button type="button" onClick={() => toggleSort('date')} className="hover:text-body">
                      上传日期{arrow('date')}
                    </button>
                  </th>
                  <th className="px-3 pt-3 pb-3">上传人</th>
                  <th className="px-3 pt-3 pb-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.key} className="border-t border-line hover:bg-surface-2">
                    <td className="max-w-[18rem] truncate px-4 py-3 font-semibold text-ink" title={f.fileName}>
                      {f.fileName}
                    </td>
                    <td className="px-3 py-3">
                      <Badge className={typeBadgeClass(f.typeKey)}>{f.typeLabel}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <LinkedTo file={f} />
                    </td>
                    <td className="px-3 py-3 tabular-nums text-muted">{day(f.uploadedAt)}</td>
                    <td className="px-3 py-3 text-muted">{f.uploadedByName}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <DownloadButton path={f.storagePath} />
                      <Button variant="ghost" disabled={isDeleting(f)} onClick={() => del.mutate(f)}>
                        {isDeleting(f) ? '删除中…' : '删除'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 移动端：紧凑卡片 */}
          <ul className="space-y-3 md:hidden">
            {rows.map((f) => (
              <li key={f.key} className="rounded-card bg-white p-4 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink" title={f.fileName}>
                    {f.fileName}
                  </span>
                  <Badge className={typeBadgeClass(f.typeKey)}>{f.typeLabel}</Badge>
                </div>
                <div className="mt-1.5">
                  <LinkedTo file={f} />
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-faint">
                  <span className="tabular-nums">{day(f.uploadedAt)}</span>
                  <span>上传人：{f.uploadedByName}</span>
                </div>
                <div className="mt-2 flex justify-end gap-1 border-t border-line pt-1.5">
                  <DownloadButton path={f.storagePath} />
                  <Button variant="ghost" disabled={isDeleting(f)} onClick={() => del.mutate(f)}>
                    {isDeleting(f) ? '删除中…' : '删除'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
