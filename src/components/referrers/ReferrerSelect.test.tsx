import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const { state } = vi.hoisted(() => ({ state: { referrers: [] as unknown[] } }))
vi.mock('../../hooks/queries/useReferrers', () => ({
  useReferrers: () => ({ data: state.referrers, isPending: false }),
  useCreateReferrer: () => ({ mutate: vi.fn(), isPending: false }),
}))

import { ReferrerSelect } from './ReferrerSelect'

const ref = (id: string, name: string, kind?: string) => ({
  id, name, kind, contact_phone: null, contact_email: null, notes: null,
  is_archived: false, created_by: null, created_at: '', updated_at: '',
})

describe('ReferrerSelect · 一表两用后只列介绍人', () => {
  it('归属人(kind=owner)不出现在介绍人下拉；kind 缺失（迁移前旧数据）按介绍人处理', () => {
    state.referrers = [
      ref('r1', 'CICI', 'referrer'),
      ref('o1', '刘祎', 'owner'),
      ref('r2', '旧数据王', undefined), // 0030 迁移未跑/旧缓存：无 kind → 视为介绍人
    ]
    render(<ReferrerSelect value="" onChange={vi.fn()} />)
    const select = screen.getByLabelText('介绍人') as HTMLSelectElement
    const labels = Array.from(select.options).map((o) => o.text)
    expect(labels).toContain('CICI')
    expect(labels).toContain('旧数据王')
    expect(labels).not.toContain('刘祎')
  })
})
