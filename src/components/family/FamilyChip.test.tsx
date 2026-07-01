import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { FamilyChip } from './FamilyChip'
import type { CustomerFamilyMember } from '../../types/models'

const mk = (o: Partial<CustomerFamilyMember>): CustomerFamilyMember => ({
  id: 'f1', customer_id: 'P', name: '王璜', relation: '配偶', linked_customer_id: null, created_at: '', ...o,
})
const renderChip = (members: CustomerFamilyMember[]) =>
  render(<MemoryRouter><FamilyChip members={members} /></MemoryRouter>)

describe('FamilyChip', () => {
  it('空成员 → 不渲染任何内容', () => {
    const { container } = renderChip([])
    expect(container).toBeEmptyDOMElement()
  })

  it('只显示一颗「family · N」标签（不平铺成员名到标签上）', () => {
    renderChip([mk({ id: 'a', name: '王璜' }), mk({ id: 'b', name: '小明' })])
    expect(screen.getByText(/family · 2/)).toBeInTheDocument()
  })

  it('气泡：有 linked_customer_id 的成员名字可点跳档案；无档案纯文本不可点', () => {
    renderChip([
      mk({ id: 'a', name: '王璜', relation: '配偶', linked_customer_id: 'S' }),
      mk({ id: 'b', name: '小明', relation: '子女', linked_customer_id: null }),
    ])
    // 有档案 → 链接跳 /customers/S
    const link = screen.getByRole('link', { name: '王璜' })
    expect(link).toHaveAttribute('href', '/customers/S')
    // 无档案 → 纯文本，不是链接
    expect(screen.getByText('小明')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '小明' })).toBeNull()
    // 关系 tag
    expect(screen.getByText('配偶')).toBeInTheDocument()
    expect(screen.getByText('子女')).toBeInTheDocument()
  })
})
