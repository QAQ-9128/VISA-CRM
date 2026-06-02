import { describe, expect, it } from 'vitest'
import {
  docStatus,
  selectDocCategories,
  filterDocs,
  recentUpload,
  resolveUploader,
  docDisplayName,
} from './documentsView'
import type { CaseDocument } from '../types/models'
import type { DocType } from '../types/domain'

const TODAY = new Date('2026-06-01T00:00:00Z')

const doc = (over: Partial<CaseDocument> = {}): CaseDocument =>
  ({
    id: 'd',
    customer_id: 'cu',
    case_id: 'ca',
    doc_type: 'passport' as DocType,
    title: null,
    storage_path: 'p/x.pdf',
    file_name: 'x.pdf',
    issue_date: null,
    expiry_date: null,
    note: null,
    uploaded_by: null,
    is_archived: false,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    ...over,
  }) as CaseDocument

describe('docStatus（真实字段派生）', () => {
  it('无文件 → 待上传', () => {
    expect(docStatus(doc({ storage_path: null }), TODAY)).toEqual({ kind: 'pending', label: '待上传' })
  })
  it('已过到期日 → 已过期', () => {
    expect(docStatus(doc({ expiry_date: '2026-05-01' }), TODAY).kind).toBe('overdue')
  })
  it('≤30 天到期 → 即将到期', () => {
    expect(docStatus(doc({ expiry_date: '2026-06-20' }), TODAY).kind).toBe('soon')
  })
  it('有文件、无/远到期日 → 有效', () => {
    expect(docStatus(doc({ expiry_date: null }), TODAY).kind).toBe('ok')
    expect(docStatus(doc({ expiry_date: '2027-01-01' }), TODAY).kind).toBe('ok')
  })
})

describe('selectDocCategories', () => {
  it('只列出现有类别，按 DOC_TYPES 顺序，计数正确', () => {
    const cats = selectDocCategories([
      doc({ doc_type: 'financial' }),
      doc({ doc_type: 'passport' }),
      doc({ doc_type: 'passport' }),
    ])
    expect(cats.map((c) => [c.type, c.count])).toEqual([
      ['passport', 2],
      ['financial', 1],
    ]) // passport 在 financial 之前（枚举顺序）
    expect(cats[0].label).toBe('护照')
  })
  it('空 → 空', () => {
    expect(selectDocCategories([])).toEqual([])
  })
})

describe('filterDocs', () => {
  const docs = [
    doc({ id: 'a', doc_type: 'passport', file_name: '护照扫描.pdf' }),
    doc({ id: 'b', doc_type: 'financial', title: '银行流水', storage_path: null }),
    doc({ id: 'c', doc_type: 'passport', file_name: '旧护照.pdf', expiry_date: '2026-05-01' }),
  ]
  it('按分类过滤', () => {
    expect(filterDocs(docs, { category: 'passport', search: '', status: 'all' }, TODAY).map((d) => d.id)).toEqual(['a', 'c'])
  })
  it('按文件名/标签搜索（含 title）', () => {
    expect(filterDocs(docs, { category: 'all', search: '流水', status: 'all' }, TODAY).map((d) => d.id)).toEqual(['b'])
    expect(filterDocs(docs, { category: 'all', search: '护照', status: 'all' }, TODAY).map((d) => d.id)).toEqual(['a', 'c'])
  })
  it('按派生状态过滤', () => {
    expect(filterDocs(docs, { category: 'all', search: '', status: 'pending' }, TODAY).map((d) => d.id)).toEqual(['b'])
    expect(filterDocs(docs, { category: 'all', search: '', status: 'overdue' }, TODAY).map((d) => d.id)).toEqual(['c'])
  })
})

describe('recentUpload', () => {
  it('取 created_at 最新；含展示名与 uploaderId', () => {
    const r = recentUpload([
      doc({ id: 'a', created_at: '2026-05-01T00:00:00Z' }),
      doc({ id: 'b', created_at: '2026-05-20T00:00:00Z', title: '补件通知', uploaded_by: 'u1' }),
    ])
    expect(r).toEqual({ date: '2026-05-20', name: '补件通知', uploaderId: 'u1' })
  })
  it('空 → null', () => {
    expect(recentUpload([])).toBeNull()
  })
})

describe('resolveUploader', () => {
  const byId = new Map([['u1', '李律师'], ['u2', null]])
  it('当前用户 → 我；命中 profiles → 名；未命中/空 → null', () => {
    expect(resolveUploader('me', byId, 'me')).toBe('我')
    expect(resolveUploader('u1', byId, 'me')).toBe('李律师')
    expect(resolveUploader('u2', byId)).toBeNull()
    expect(resolveUploader('ghost', byId)).toBeNull()
    expect(resolveUploader(null, byId)).toBeNull()
  })
})

describe('docDisplayName', () => {
  it('title 优先，其次 file_name，再次（未命名）', () => {
    expect(docDisplayName(doc({ title: 'T', file_name: 'f' }))).toBe('T')
    expect(docDisplayName(doc({ title: null, file_name: 'f' }))).toBe('f')
    expect(docDisplayName(doc({ title: null, file_name: null }))).toBe('（未命名）')
  })
})
