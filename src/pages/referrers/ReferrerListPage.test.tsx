import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { state, idle } = vi.hoisted(() => ({
  state: { referrers: [] as unknown[], isAdmin: true },
  idle: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('../../hooks/queries/useReferrers', () => ({
  useReferrers: () => ({ data: state.referrers, isPending: false, isError: false }),
  useArchiveReferrer: idle,
  useDeleteReferrer: idle,
}))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAdmin: state.isAdmin }) }))

import { ReferrerListPage } from './ReferrerListPage'

const ref = (id: string, name: string, kind: string, notes: string | null = null) => ({
  id, name, kind, contact_phone: null, contact_email: null, notes,
  is_archived: false, created_by: null, created_at: '', updated_at: '',
})

function renderPage() {
  return render(
    <MemoryRouter>
      <ReferrerListPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  state.referrers = [ref('r1', 'CICI', 'referrer'), ref('o1', '刘祎', 'owner')]
  state.isAdmin = true
})

describe('ReferrerListPage · 介绍人/归属人开关（一表两用）', () => {
  it('默认介绍人视图：只列介绍人，不混入归属人', () => {
    renderPage()
    expect(screen.getByText('CICI')).toBeInTheDocument()
    expect(screen.queryByText('刘祎')).toBeNull()
  })

  it('切到「归属人」：只列归属人；新建链接带 kind=owner', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '归属人' }))
    expect(screen.getByText('刘祎')).toBeInTheDocument()
    expect(screen.queryByText('CICI')).toBeNull()
    expect(screen.getByRole('link', { name: /新建归属人/ })).toHaveAttribute(
      'href',
      '/referrers/new?kind=owner',
    )
  })

  it('介绍人视图：新建链接不带 kind（默认介绍人）', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /新建介绍人/ })).toHaveAttribute('href', '/referrers/new')
  })

  it('归属人视图空列表 → 对应空态文案', () => {
    state.referrers = [ref('r1', 'CICI', 'referrer')]
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '归属人' }))
    expect(screen.getByText(/还没有归属人/)).toBeInTheDocument()
  })

  it('有备注的介绍人 → 列表展示备注内容', () => {
    state.referrers = [ref('r1', 'CICI', 'referrer', '123124124')]
    renderPage()
    expect(screen.getByTestId('referrer-notes')).toHaveTextContent('123124124')
  })

  it('空备注 → 不渲染备注行，不报错', () => {
    state.referrers = [ref('r1', 'CICI', 'referrer', null)]
    expect(() => renderPage()).not.toThrow()
    // 备注为空时不应出现备注位（用占位 em dash 之外的内容判定）
    expect(screen.queryByTestId('referrer-notes')).toBeNull()
  })
})
