import { useMemo, useState } from 'react'
import type { DragEvent, FormEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardHead } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { DocumentForm } from './DocumentForm'
import {
  DocIcon,
  AlertTriangleIcon,
  ClockIcon,
  SearchIcon,
  ChevronRightIcon,
  ArchiveIcon,
  PlusIcon,
} from '../ui/icons'
import {
  useArchiveDocument,
  useDocumentsByCase,
  useDocumentsByCustomer,
} from '../../hooks/queries/useDocuments'
import { useProfiles } from '../../hooks/queries/useProfiles'
import { useChecklist, useAddChecklistItem, useToggleChecklistItem } from '../../hooks/queries/useChecklist'
import { useAuth } from '../../hooks/useAuth'
import { useBackSource } from '../../hooks/useBackSource'
import { getDocumentSignedUrl } from '../../api/documents'
import { DOC_TYPE_LABELS } from '../../types/domain'
import type { DocType } from '../../types/domain'
import {
  docStatus,
  docDisplayName,
  selectDocCategories,
  filterDocs,
  recentUpload,
  resolveUploader,
} from '../../lib/documentsView'
import type { DocStatusKind } from '../../lib/documentsView'
import { errorMessage } from '../../lib/errorMessage'
import type { CaseDocument } from '../../types/models'

const PAGE_SIZE = 10

const STATUS_PILL: Record<DocStatusKind, string> = {
  pending: 'bg-amber-50 text-amber-700',
  overdue: 'bg-rose-50 text-rose-600',
  soon: 'bg-amber-50 text-amber-700',
  ok: 'bg-emerald-50 text-emerald-600',
}
const STATUS_OPTIONS: { value: DocStatusKind | 'all'; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'ok', label: '有效' },
  { value: 'soon', label: '即将到期' },
  { value: 'overdue', label: '已过期' },
  { value: 'pending', label: '待上传' },
]

function MetricCard({
  icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: ReactNode
  tone: string
  label: string
  value: string
  sub?: string
}) {
  return (
    <Card className="p-[18px]">
      <div className="flex items-start gap-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-[11px] ${tone}`}>{icon}</span>
        <div className="min-w-0">
          <div className="text-[12.5px] text-muted">{label}</div>
          <div className="mt-0.5 text-[20px] font-bold leading-tight text-ink">{value}</div>
          {sub && <div className="mt-0.5 truncate text-[11.5px] text-faint">{sub}</div>}
        </div>
      </div>
    </Card>
  )
}

/** 打开文件（私有 bucket 短期签名链接）。 */
async function openDoc(path: string) {
  try {
    const url = await getDocumentSignedUrl(path)
    window.open(url, '_blank', 'noopener')
  } catch (e) {
    window.alert('打开失败：' + (e instanceof Error ? e.message : '未知错误'))
  }
}

function DocActions({ doc }: { doc: CaseDocument }) {
  const archive = useArchiveDocument()
  return (
    <div className="flex items-center justify-end gap-2.5 whitespace-nowrap">
      {doc.storage_path ? (
        <button type="button" onClick={() => openDoc(doc.storage_path as string)} className="text-xs font-semibold text-brand hover:text-brand-600">
          预览 / 下载
        </button>
      ) : (
        <span className="text-xs text-faint">无文件</span>
      )}
      <button
        type="button"
        title="归档"
        disabled={archive.isPending}
        onClick={() => {
          if (window.confirm('归档该文件？归档后默认不显示。')) archive.mutate(doc.id)
        }}
        className="text-faint hover:text-rose-500"
      >
        <ArchiveIcon className="size-4" />
      </button>
    </div>
  )
}

/**
 * 文件区：客户详情（按客户）或案件详情（按案件）复用。customerId 始终需要（上传归属客户）。
 * variant='full'（默认）：含「文件总数/待补充/最近上传」三张统计卡 + 两栏列表/缺失。
 * variant='compact'：窄栏单列，统计收成一行小字（KPI 横条才是统计唯一来源），功能不变。
 */
export function DocumentsSection({
  customerId,
  caseId,
  variant = 'full',
}: {
  customerId: string
  caseId?: string
  variant?: 'full' | 'compact'
}) {
  const compact = variant === 'compact'
  const byCase = useDocumentsByCase(caseId)
  const byCustomer = useDocumentsByCustomer(caseId ? undefined : customerId)
  const query = caseId ? byCase : byCustomer

  const profiles = useProfiles()
  const { user } = useAuth()
  const checklist = useChecklist()
  const addChecklist = useAddChecklistItem()
  const toggleChecklist = useToggleChecklistItem()
  const source = useBackSource()

  const [adding, setAdding] = useState(false)
  const [dropFile, setDropFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [category, setCategory] = useState<DocType | 'all'>('all')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<DocStatusKind | 'all'>('all')
  const [page, setPage] = useState(1)
  const [missingDraft, setMissingDraft] = useState('')

  const docs = useMemo(() => query.data ?? [], [query.data])
  const profilesById = useMemo(
    () => new Map((profiles.data ?? []).map((p) => [p.id, p.full_name])),
    [profiles.data],
  )
  const categories = useMemo(() => selectDocCategories(docs), [docs])
  const filtered = useMemo(
    () => filterDocs(docs, { category, search, status }),
    [docs, category, search, status],
  )
  const recent = useMemo(() => recentUpload(docs), [docs])

  // 待补充 / 缺失提醒：挂到本案件（或客户）的未完成 checklist 项（真实，可勾选）。
  const missing = useMemo(() => {
    const items = checklist.data ?? []
    return items.filter((it) =>
      caseId ? it.case_id === caseId : it.customer_id === customerId && !it.case_id,
    )
  }, [checklist.data, caseId, customerId])
  const openMissing = missing.filter((m) => !m.is_done)

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageSafe = Math.min(page, totalPages)
  const pageRows = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE)

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      setPage(1)
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) {
      setDropFile(f)
      setAdding(true)
    }
  }

  function addMissing(e: FormEvent) {
    e.preventDefault()
    const content = missingDraft.trim()
    if (!content) return
    addChecklist.mutate(
      { content, customerId, caseId: caseId ?? null },
      { onSuccess: () => setMissingDraft('') },
    )
  }

  const dropZone = (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`rounded-[16px] border-2 border-dashed px-4 py-7 text-center transition-colors ${
        dragOver ? 'border-brand bg-brand-50' : 'border-line-2 bg-surface-2'
      }`}
    >
      <DocIcon className="mx-auto size-7 text-faint" />
      <p className="mt-2 text-sm font-semibold text-body">拖拽文件到此处，或点击下方按钮选择</p>
      <p className="mt-1 text-[12px] text-faint">支持 PDF / JPG / PNG / DOC / XLS / ZIP</p>
      <Button
        variant="primary"
        className="mt-3"
        onClick={() => {
          setDropFile(null)
          setAdding(true)
        }}
      >
        选择文件上传
      </Button>
    </div>
  )
  // 一行小字摘要（compact 用；与 KPI「待补文件」同源，避免统计重复）
  const summaryText = `文件 ${docs.length} · 待补 ${openMissing.length} · 最近上传 ${recent ? recent.date : '—'}`

  return (
    <div className="space-y-5">
      {/* ① 上传卡 + 指标卡（compact 收成小字摘要） */}
      {compact ? (
        <Card>
          <CardHead title="文件与材料" sub={summaryText} />
          {dropZone}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHead title="上传 / 登记文件" />
            {dropZone}
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-2">
            <MetricCard
              icon={<DocIcon className="size-[18px]" />}
              tone="bg-brand-50 text-brand"
              label="文件总数"
              value={String(docs.length)}
              sub="未归档文件"
            />
            <MetricCard
              icon={<AlertTriangleIcon className="size-[18px]" />}
              tone="bg-amber-50 text-amber-600"
              label="待补充"
              value={String(openMissing.length)}
              sub="待补充清单项"
            />
            <MetricCard
              icon={<ClockIcon className="size-[18px]" />}
              tone="bg-emerald-50 text-emerald-600"
              label="最近上传"
              value={recent ? recent.date : '—'}
              sub={
                recent
                  ? `${recent.name}${
                      resolveUploader(recent.uploaderId, profilesById, user?.id) ? ' · ' + resolveUploader(recent.uploaderId, profilesById, user?.id) : ''
                    }`
                  : '暂无上传'
              }
            />
          </div>
        </div>
      )}

      {adding && (
        <DocumentForm
          customerId={customerId}
          caseId={caseId ?? null}
          initialFile={dropFile}
          onDone={() => {
            setAdding(false)
            setDropFile(null)
          }}
        />
      )}

      {/* ② 分类 chips */}
      {categories.length > 0 && (
        <Card className="flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="mr-1 text-[13px] font-semibold text-muted">文件分类</span>
          <CategoryChip label="全部" count={docs.length} active={category === 'all'} onClick={() => resetPage(setCategory)('all')} />
          {categories.map((c) => (
            <CategoryChip
              key={c.type}
              label={c.label}
              count={c.count}
              active={category === c.type}
              onClick={() => resetPage<DocType | 'all'>(setCategory)(c.type)}
            />
          ))}
        </Card>
      )}

      {/* ③ 文件列表 + 缺失提醒（compact 单列） */}
      <div className={`grid grid-cols-1 gap-5 ${compact ? '' : 'lg:grid-cols-3'}`}>
        <Card pad={false} className={compact ? '' : 'lg:col-span-2'}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-[22px] pt-[22px]">
            <h3 className="text-base font-bold tracking-[-0.01em] text-ink">文件列表</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
                <input
                  value={search}
                  onChange={(e) => resetPage(setSearch)(e.target.value)}
                  placeholder="搜索文件名"
                  className="h-9 w-40 rounded-full border border-line-2 bg-white pl-8 pr-3 text-sm text-ink outline-none focus:border-brand"
                />
              </div>
              <select
                value={status}
                onChange={(e) => resetPage(setStatus)(e.target.value as DocStatusKind | 'all')}
                className="h-9 rounded-full border border-line-2 bg-white px-3 text-sm text-ink outline-none focus:border-brand"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {query.isPending ? (
            <p className="px-[22px] py-8 text-sm text-faint">加载文件…</p>
          ) : docs.length === 0 ? (
            <div className="px-[22px] py-10 text-center">
              <DocIcon className="mx-auto size-8 text-faint" />
              <p className="mt-2 text-sm text-muted">暂无文件，点击上方「选择文件上传」开始登记。</p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-[22px] py-10 text-center text-sm text-faint">没有符合条件的文件。</p>
          ) : (
            <>
              <div className="mt-3 overflow-x-auto px-[10px]">
                <table className="w-full min-w-[40rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line-2 text-left text-xs font-medium text-muted">
                      <th className="px-3 py-2">文件名</th>
                      <th className="px-3 py-2">分类</th>
                      <th className="px-3 py-2">上传日期</th>
                      <th className="px-3 py-2">上传人</th>
                      <th className="px-3 py-2">状态</th>
                      <th className="px-3 py-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((d) => {
                      const st = docStatus(d)
                      const uploader = resolveUploader(d.uploaded_by, profilesById, user?.id)
                      return (
                        <tr key={d.id} className="border-b border-line align-middle">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <DocIcon className="size-4 shrink-0 text-faint" />
                              {d.storage_path ? (
                                <button type="button" onClick={() => openDoc(d.storage_path as string)} className="truncate text-left font-medium text-ink hover:text-brand">
                                  {docDisplayName(d)}
                                </button>
                              ) : (
                                <span className="truncate font-medium text-ink">{docDisplayName(d)}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5"><Badge className="bg-brand-50 text-brand">{DOC_TYPE_LABELS[d.doc_type]}</Badge></td>
                          <td className="px-3 py-2.5 tabular-nums text-body">{d.created_at?.slice(0, 10) ?? '—'}</td>
                          <td className="px-3 py-2.5 text-body">{uploader ?? '—'}</td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_PILL[st.kind]}`}>{st.label}</span>
                          </td>
                          <td className="px-3 py-2.5"><DocActions doc={d} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between gap-3 px-[22px] py-3.5 text-sm">
                <span className="text-faint">共 {filtered.length} 条</span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button type="button" disabled={pageSafe <= 1} onClick={() => setPage(pageSafe - 1)} className="rounded-lg px-2 py-1 text-muted disabled:opacity-40">上一页</button>
                    <span className="tabular-nums text-body">{pageSafe} / {totalPages}</span>
                    <button type="button" disabled={pageSafe >= totalPages} onClick={() => setPage(pageSafe + 1)} className="rounded-lg px-2 py-1 text-muted disabled:opacity-40">下一页</button>
                  </div>
                )}
              </div>
            </>
          )}
        </Card>

        {/* 缺失文件提醒（案件/客户挂接的未完成清单项，真实可勾选） */}
        <Card className={compact ? '' : 'lg:col-span-1'}>
          <CardHead
            title="待补充 / 缺失提醒"
            action={<span className="grid size-6 place-items-center rounded-full bg-rose-50 text-xs font-bold text-rose-600">{openMissing.length}</span>}
          />
          <form onSubmit={addMissing} className="flex items-center gap-2">
            <input
              value={missingDraft}
              onChange={(e) => setMissingDraft(e.target.value)}
              placeholder="如：无犯罪证明、体检回执…"
              className="h-9 min-w-0 flex-1 rounded-[12px] border border-line-2 bg-white px-3 text-sm text-ink outline-none focus:border-brand"
            />
            <Button type="submit" variant="secondary" disabled={addChecklist.isPending || missingDraft.trim() === ''}>
              <PlusIcon className="size-4" />
            </Button>
          </form>

          {addChecklist.isError && (() => {
            const msg = errorMessage(addChecklist.error)
            const needsMigration = !!msg && /checklist_items|customer_id|case_id|PGRST204|schema cache/i.test(msg)
            return (
              <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                添加失败：{msg ?? '未知错误'}
                {needsMigration && (
                  <span className="mt-1 block text-rose-500">
                    待办清单的「关联客户 / 案件」列还没建——请在 Supabase 跑迁移 0027_checklist_links.sql 后重试。
                  </span>
                )}
              </p>
            )
          })()}

          {checklist.isPending ? (
            <p className="mt-3 text-sm text-faint">加载…</p>
          ) : openMissing.length === 0 ? (
            <p className="mt-3 text-sm text-faint">暂无待补充项。可在上方添加需要客户补交的材料。</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {openMissing.map((m) => (
                <li key={m.id} className="flex items-start gap-2.5">
                  <button
                    type="button"
                    title="标记已补充"
                    disabled={toggleChecklist.isPending}
                    onClick={() => toggleChecklist.mutate({ id: m.id, is_done: true })}
                    className="mt-0.5 size-4 shrink-0 rounded-[5px] border-2 border-line-2 hover:border-brand"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-body">{m.content}</p>
                  </div>
                  <Badge className="shrink-0 bg-rose-50 text-rose-600">待补充</Badge>
                </li>
              ))}
            </ul>
          )}

          <Link to="/" state={source} className="mt-3 flex items-center gap-0.5 text-[13px] font-semibold text-brand hover:text-brand-600">
            在概览查看全部清单 <ChevronRightIcon className="size-3.5" />
          </Link>
        </Card>
      </div>
    </div>
  )
}

function CategoryChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium transition-colors ${
        active ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:bg-line-2'
      }`}
    >
      {label}
      <span className={`tabular-nums ${active ? 'text-white/80' : 'text-faint'}`}>{count}</span>
    </button>
  )
}
