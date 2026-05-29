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
        <Link to={`/customers/${file.customerId}`} className="font-medium text-indigo-600 hover:underline">
          {file.customerName || '（未知客户）'}
        </Link>
      ) : (
        <span className="text-slate-400">（未知客户）</span>
      )}
      {file.caseId && (
        <Link to={`/cases/${file.caseId}`} className="text-slate-400 hover:text-indigo-600 hover:underline">
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
          <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">档案库</h1>
          <p className="mt-0.5 text-sm text-slate-500">所有上传文件（发票 + 客户/案件文件）统一查看与下载</p>
        </div>
        <span className="text-sm text-slate-400">共 {rows.length} 个文件</span>
      </div>

      {/* 筛选 / 搜索 */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-5">
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
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          没有符合条件的文件
        </p>
      ) : (
        <>
          {/* 桌面端：表格 */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="px-4 py-2.5 font-medium">文件名</th>
                  <th className="px-3 py-2.5 font-medium">
                    <button type="button" onClick={() => toggleSort('type')} className="hover:text-slate-900">
                      类型{arrow('type')}
                    </button>
                  </th>
                  <th className="px-3 py-2.5 font-medium">
                    <button type="button" onClick={() => toggleSort('customer')} className="hover:text-slate-900">
                      关联到{arrow('customer')}
                    </button>
                  </th>
                  <th className="px-3 py-2.5 font-medium">
                    <button type="button" onClick={() => toggleSort('date')} className="hover:text-slate-900">
                      上传日期{arrow('date')}
                    </button>
                  </th>
                  <th className="px-3 py-2.5 font-medium">上传人</th>
                  <th className="px-3 py-2.5 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="max-w-[18rem] truncate px-4 py-2.5 font-medium text-slate-900" title={f.fileName}>
                      {f.fileName}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge className={typeBadgeClass(f.typeKey)}>{f.typeLabel}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <LinkedTo file={f} />
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-600">{day(f.uploadedAt)}</td>
                    <td className="px-3 py-2.5 text-slate-600">{f.uploadedByName}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
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
          <ul className="space-y-2 md:hidden">
            {rows.map((f) => (
              <li key={f.key} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900" title={f.fileName}>
                    {f.fileName}
                  </span>
                  <Badge className={typeBadgeClass(f.typeKey)}>{f.typeLabel}</Badge>
                </div>
                <div className="mt-1.5">
                  <LinkedTo file={f} />
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-400">
                  <span className="tabular-nums">{day(f.uploadedAt)}</span>
                  <span>上传人：{f.uploadedByName}</span>
                </div>
                <div className="mt-2 flex justify-end gap-1 border-t border-slate-100 pt-1.5">
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
