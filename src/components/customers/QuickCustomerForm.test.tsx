import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { createMutate } = vi.hoisted(() => ({ createMutate: vi.fn() }))
vi.mock('../../hooks/queries/useCustomers', () => ({
  useCreateCustomer: () => ({ mutate: createMutate, isPending: false, error: null }),
}))
vi.mock('../../hooks/queries/useReferrers', () => ({
  useReferrers: () => ({ data: [], isPending: false }),
  useCreateReferrer: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateOwner: () => ({ mutate: vi.fn(), isPending: false }),
}))

import { QuickCustomerForm } from './QuickCustomerForm'

beforeEach(() => createMutate.mockReset())

describe('QuickCustomerForm（快速建档卡片：五字段、无案件逻辑）', () => {
  it('只渲染五个字段：姓名/性别/生日/归属人/介绍人；无任何案件入口', () => {
    render(<QuickCustomerForm onCreated={vi.fn()} />)
    expect(screen.getByLabelText(/姓名/)).toBeInTheDocument()
    expect(screen.getByLabelText('性别')).toBeInTheDocument()
    expect(screen.getByLabelText('生日')).toBeInTheDocument()
    expect(screen.getByText('归属人')).toBeInTheDocument()
    expect(screen.getByText('介绍人')).toBeInTheDocument()
    // 快速建档不含任何案件逻辑（图纸拍板：案件后续去客户页里建）
    expect(screen.queryByText(/加入已有案件/)).toBeNull()
    expect(screen.queryByText(/保存并新建案件/)).toBeNull()
    expect(screen.queryByText(/担保雇主/)).toBeNull()
  })

  it('姓名为空保存禁用；填姓名即可保存', () => {
    render(<QuickCustomerForm onCreated={vi.fn()} />)
    const save = screen.getByRole('button', { name: '快速建档' })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/姓名/), { target: { value: '张三' } })
    expect(save).toBeEnabled()
  })

  it('保存：payload 只含五键（空→null），成功回调拿到新客户 id', () => {
    const onCreated = vi.fn()
    createMutate.mockImplementation((input, opts) => opts?.onSuccess?.({ id: 'cu-new', ...input }))
    render(<QuickCustomerForm onCreated={onCreated} />)
    fireEvent.change(screen.getByLabelText(/姓名/), { target: { value: '  张三 ' } })
    fireEvent.change(screen.getByLabelText('生日'), { target: { value: '1990-01-02' } })
    fireEvent.click(screen.getByRole('button', { name: '快速建档' }))
    expect(createMutate).toHaveBeenCalledWith(
      {
        full_name: '张三',
        gender: null,
        birth_date: '1990-01-02',
        owner_referrer_id: null,
        referrer_id: null,
      },
      expect.anything(),
    )
    expect(onCreated).toHaveBeenCalledWith('cu-new')
  })
})
