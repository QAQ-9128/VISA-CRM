import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { state, archiveMutate, deleteMutate } = vi.hoisted(() => ({
  state: { isAdmin: true },
  archiveMutate: vi.fn(),
  deleteMutate: vi.fn(),
}))
vi.mock('../../hooks/queries/useCustomers', () => ({
  useArchiveCustomer: () => ({ mutate: archiveMutate, isPending: false }),
  useDeleteCustomer: () => ({ mutate: deleteMutate, isPending: false }),
}))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAdmin: state.isAdmin }) }))

import { CustomerActionsMenu } from './CustomerActionsMenu'
import type { Customer } from '../../types/models'

const cust = { id: 'cu1', full_name: '张三', is_archived: false } as unknown as Customer

beforeEach(() => {
  state.isAdmin = true
  archiveMutate.mockReset()
  deleteMutate.mockReset()
})

describe('CustomerActionsMenu（客户列表/看板的 ⋯ 操作菜单）', () => {
  it('菜单含 归档客户 + 彻底删除客户（admin）', () => {
    render(<CustomerActionsMenu customer={cust} />)
    fireEvent.click(screen.getByLabelText('客户操作'))
    expect(screen.getByText('归档客户')).toBeInTheDocument()
    expect(screen.getByText('彻底删除客户')).toBeInTheDocument()
  })

  it('staff 也能彻底删除（0031 全员开放，防误删靠确认弹窗）', () => {
    state.isAdmin = false
    render(<CustomerActionsMenu customer={cust} />)
    fireEvent.click(screen.getByLabelText('客户操作'))
    expect(screen.getByText('归档客户')).toBeInTheDocument()
    expect(screen.getByText('彻底删除客户')).toBeInTheDocument()
  })

  it('归档：弹窗确认（文案与客户详情页一致）→ 调 archive(id)', () => {
    render(<CustomerActionsMenu customer={cust} />)
    fireEvent.click(screen.getByLabelText('客户操作'))
    fireEvent.click(screen.getByText('归档客户'))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('确定归档「张三」吗')
    expect(dialog).toHaveTextContent('TA 参与的所有案件也一并归档')
    fireEvent.click(screen.getByRole('button', { name: '归档' }))
    expect(archiveMutate).toHaveBeenCalledWith('cu1')
  })

  it('彻底删除：危险弹窗确认 → 调 delete(id)', () => {
    render(<CustomerActionsMenu customer={cust} />)
    fireEvent.click(screen.getByLabelText('客户操作'))
    fireEvent.click(screen.getByText('彻底删除客户'))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('彻底删除「张三」')
    expect(dialog).toHaveTextContent('不可恢复')
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(deleteMutate).toHaveBeenCalledWith('cu1')
  })

  it('取消弹窗：不调用任何 mutation', () => {
    render(<CustomerActionsMenu customer={cust} />)
    fireEvent.click(screen.getByLabelText('客户操作'))
    fireEvent.click(screen.getByText('归档客户'))
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(archiveMutate).not.toHaveBeenCalled()
    expect(deleteMutate).not.toHaveBeenCalled()
  })
})
