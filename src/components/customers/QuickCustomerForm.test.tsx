import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { createMutate, addMutate } = vi.hoisted(() => ({
  createMutate: vi.fn(),
  addMutate: vi.fn(),
}))
vi.mock('../../hooks/queries/useCustomers', () => ({
  useCreateCustomer: () => ({ mutate: createMutate, isPending: false, error: null }),
  useCustomers: () => ({ data: [{ id: 'cuX', full_name: '王主申' }], isPending: false }),
}))
vi.mock('../../hooks/queries/useCases', () => ({
  useCases: () => ({
    data: [{
      id: 'c1', case_number: '10042X', customer_id: 'cuX', visa_subclass: '482', visa_stream: null,
      is_archived: false,
    }],
    isPending: false,
  }),
}))
vi.mock('../../hooks/queries/useCaseApplicants', () => ({
  useAllCaseApplicants: () => ({ data: [], isPending: false }),
  useAddCaseApplicant: () => ({ mutate: addMutate, isPending: false, error: null }),
}))
vi.mock('../../hooks/queries/useReferrers', () => ({
  useReferrers: () => ({ data: [], isPending: false }),
  useCreateReferrer: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateOwner: () => ({ mutate: vi.fn(), isPending: false }),
}))

import { QuickCustomerForm } from './QuickCustomerForm'

beforeEach(() => {
  createMutate.mockReset()
  addMutate.mockReset()
})

describe('QuickCustomerForm（快速建档卡片：五字段 + 可选加入组）', () => {
  it('渲染五字段 + 「加入已有案件（组）」复选项（默认收起）；无担保/保存并新建案件', () => {
    render(<QuickCustomerForm onCreated={vi.fn()} />)
    expect(screen.getByLabelText(/姓名/)).toBeInTheDocument()
    expect(screen.getByLabelText('性别')).toBeInTheDocument()
    expect(screen.getByLabelText('生日')).toBeInTheDocument()
    expect(screen.getByText('归属人')).toBeInTheDocument()
    expect(screen.getByText('介绍人')).toBeInTheDocument()
    expect(screen.getByText(/加入已有案件（组）/)).toBeInTheDocument()
    expect(screen.queryByText('选择案件')).toBeNull() // 默认收起
    expect(screen.queryByText(/担保雇主/)).toBeNull()
    expect(screen.queryByText(/保存并新建案件/)).toBeNull()
  })

  it('不勾组：保存只建档（五键 payload），不调加入案件', () => {
    const onCreated = vi.fn()
    createMutate.mockImplementation((input, opts) => opts?.onSuccess?.({ id: 'cu-new', ...input }))
    render(<QuickCustomerForm onCreated={onCreated} />)
    fireEvent.change(screen.getByLabelText(/姓名/), { target: { value: '  张三 ' } })
    fireEvent.click(screen.getByRole('button', { name: '快速建档' }))
    expect(createMutate).toHaveBeenCalledWith(
      { full_name: '张三', gender: null, birth_date: null, owner_referrer_id: null, referrer_id: null },
      expect.anything(),
    )
    expect(addMutate).not.toHaveBeenCalled()
    expect(onCreated).toHaveBeenCalledWith('cu-new')
  })

  it('勾了组但没选案件 → 保存禁用 + 提示', () => {
    render(<QuickCustomerForm onCreated={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/姓名/), { target: { value: '张三' } })
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('button', { name: '快速建档' })).toBeDisabled()
    expect(screen.getByText(/先在上方选择要加入的案件/)).toBeInTheDocument()
  })

  it('勾组并选案件：建档成功后写入参与人，再回调 onCreated', () => {
    const onCreated = vi.fn()
    createMutate.mockImplementation((input, opts) => opts?.onSuccess?.({ id: 'cu-new', ...input }))
    addMutate.mockImplementation((_input, opts) => opts?.onSuccess?.())
    render(<QuickCustomerForm onCreated={onCreated} />)
    fireEvent.change(screen.getByLabelText(/姓名/), { target: { value: '张三' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('option', { name: /10042X/ }))
    fireEvent.click(screen.getByRole('button', { name: '快速建档' }))
    expect(addMutate).toHaveBeenCalledWith(
      { caseId: 'c1', customerId: 'cu-new' },
      expect.anything(),
    )
    expect(onCreated).toHaveBeenCalledWith('cu-new')
  })

  it('建档成功但加入失败：重试只补加入，绝不重复建人', () => {
    const onCreated = vi.fn()
    createMutate.mockImplementation((input, opts) => opts?.onSuccess?.({ id: 'cu-new', ...input }))
    addMutate.mockImplementationOnce(() => {}) // 第一次加入：无回调（视为失败/挂起后用户重试）
    render(<QuickCustomerForm onCreated={onCreated} />)
    fireEvent.change(screen.getByLabelText(/姓名/), { target: { value: '张三' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('option', { name: /10042X/ }))
    fireEvent.click(screen.getByRole('button', { name: '快速建档' }))
    expect(createMutate).toHaveBeenCalledTimes(1)
    // 第二次点击（按钮已变「重试加入案件」）→ 只重试加入
    addMutate.mockImplementation((_input, opts) => opts?.onSuccess?.())
    fireEvent.click(screen.getByRole('button', { name: '重试加入案件' }))
    expect(createMutate).toHaveBeenCalledTimes(1) // 没有第二次建人
    expect(addMutate).toHaveBeenCalledTimes(2)
    expect(onCreated).toHaveBeenCalledWith('cu-new')
  })
})
