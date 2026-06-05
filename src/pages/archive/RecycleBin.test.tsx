import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { state, restore, del } = vi.hoisted(() => ({
  state: { data: null as unknown },
  restore: { customer: vi.fn(), kase: vi.fn(), doc: vi.fn() },
  del: { customer: vi.fn(), kase: vi.fn(), doc: vi.fn(), employer: vi.fn(), referrer: vi.fn() },
}))
const idle = (mutate: ReturnType<typeof vi.fn>) => ({ mutate, isPending: false, variables: undefined })
vi.mock('../../hooks/queries/useRecycleBin', () => ({
  useRecycleBin: () => state.data,
  useUnarchiveCustomer: () => idle(restore.customer),
  useUnarchiveCase: () => idle(restore.kase),
  useUnarchiveDocument: () => idle(restore.doc),
  useUnarchiveEmployer: () => idle(vi.fn()),
  useUnarchiveReferrer: () => idle(vi.fn()),
}))
vi.mock('../../hooks/queries/useCases', () => ({ useDeleteCase: () => idle(del.kase) }))
vi.mock('../../hooks/queries/useCustomers', () => ({ useDeleteCustomer: () => idle(del.customer) }))
vi.mock('../../hooks/queries/useDocuments', () => ({ useDeleteDocument: () => idle(del.doc) }))
vi.mock('../../hooks/queries/useEmployers', () => ({ useDeleteEmployer: () => idle(del.employer) }))
vi.mock('../../hooks/queries/useReferrers', () => ({ useDeleteReferrer: () => idle(del.referrer) }))

import { RecycleBin } from './RecycleBin'
import { AuthContext } from '../../providers/auth-context'
import type { AuthContextValue } from '../../providers/auth-context'

// 彻底删除是 admin 专属（RLS 同样限制）；staff 只能看与恢复
const authState = { isAdmin: true }
const authValue = () =>
  ({
    user: { id: 'u1' }, loading: false, session: null, profile: null, isAdmin: authState.isAdmin,
    signIn: async () => {}, signOut: async () => {},
  }) as unknown as AuthContextValue

function renderBin() {
  return render(
    <AuthContext.Provider value={authValue()}>
      <RecycleBin />
    </AuthContext.Provider>,
  )
}

function setData(over: Record<string, unknown> = {}) {
  state.data = {
    isPending: false,
    isError: false,
    archivedCustomers: [{ id: 'cu1', full_name: '张三', is_archived: true }],
    archivedCases: [
      { id: 'k1', case_number: '12345678', visa_subclass: '482', visa_stream: null, customer_id: 'cu1', is_archived: true },
    ],
    archivedDocuments: [
      { id: 'd1', file_name: '护照.pdf', title: null, customer_id: 'cu1', storage_path: 'cu1/general/x.pdf', is_archived: true },
    ],
    archivedEmployers: [{ id: 'e1', name: 'ABC Pty Ltd', is_archived: true }],
    archivedReferrers: [{ id: 'r1', name: 'CICI', is_archived: true }],
    customerById: { cu1: { id: 'cu1', full_name: '张三' } },
    ...over,
  }
}

beforeEach(() => {
  setData()
  authState.isAdmin = true
  Object.values(restore).forEach((f) => f.mockClear())
  Object.values(del).forEach((f) => f.mockClear())
})

describe('回收站（恢复 + 彻底删除全类型）', () => {
  it('五类分组都列出，每行都有 恢复 + 彻底删除', () => {
    renderBin()
    for (const t of ['已归档客户', '已归档案件', '已归档文件', '已归档雇主', '已归档介绍人']) {
      expect(screen.getByText(t)).toBeInTheDocument()
    }
    expect(screen.getAllByRole('button', { name: '恢复' })).toHaveLength(5)
    expect(screen.getAllByRole('button', { name: '彻底删除' })).toHaveLength(5)
  })

  it('恢复：调用对应 unarchive', () => {
    renderBin()
    fireEvent.click(screen.getAllByRole('button', { name: '恢复' })[0])
    expect(restore.customer).toHaveBeenCalledWith('cu1')
  })

  it.each([
    [0, '不可恢复', () => expect(del.customer).toHaveBeenCalledWith('cu1')],
    [1, '所有参与人的档案里都不再有此案件', () => expect(del.kase).toHaveBeenCalledWith('k1')],
    [2, '文件实体', () => expect(del.doc).toHaveBeenCalledWith({ id: 'd1', storagePath: 'cu1/general/x.pdf' })],
    [3, '担保雇主', () => expect(del.employer).toHaveBeenCalledWith('e1')],
    [4, '介绍人', () => expect(del.referrer).toHaveBeenCalledWith('r1')],
  ] as const)('彻底删除第 %s 行：弹窗含「%s」，确认后调用对应 delete', (idx, copy, assert) => {
    renderBin()
    fireEvent.click(screen.getAllByRole('button', { name: '彻底删除' })[idx])
    expect(screen.getByRole('dialog')).toHaveTextContent(copy)
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    assert()
  })

  it('删除确认可取消：不调用任何 delete', () => {
    renderBin()
    fireEvent.click(screen.getAllByRole('button', { name: '彻底删除' })[1])
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    Object.values(del).forEach((f) => expect(f).not.toHaveBeenCalled())
  })

  it('staff（非 admin）：看不到任何「彻底删除」按钮，恢复仍可用', () => {
    authState.isAdmin = false
    renderBin()
    expect(screen.queryAllByRole('button', { name: '彻底删除' })).toHaveLength(0)
    expect(screen.getAllByRole('button', { name: '恢复' })).toHaveLength(5)
  })

  it('全空 → 优雅空态', () => {
    setData({
      archivedCustomers: [], archivedCases: [], archivedDocuments: [],
      archivedEmployers: [], archivedReferrers: [],
    })
    renderBin()
    expect(screen.getByText(/回收站是空的/)).toBeInTheDocument()
  })
})
