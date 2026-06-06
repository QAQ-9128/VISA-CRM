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

import { QuickPersonCreate } from './QuickPersonCreate'

beforeEach(() => createMutate.mockReset())

describe('QuickPersonCreate（组区内联建人：div 实现，可嵌入外层 form）', () => {
  it('五字段渲染；姓名空时创建禁用', () => {
    render(<QuickPersonCreate onCreated={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByLabelText(/姓名/)).toBeInTheDocument()
    expect(screen.getByLabelText('性别')).toBeInTheDocument()
    expect(screen.getByLabelText('生日')).toBeInTheDocument()
    expect(screen.getByText('归属人')).toBeInTheDocument()
    expect(screen.getByText('介绍人')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /创建并加入名单/ })).toBeDisabled()
  })

  it('创建：五键 payload（空→null、姓名 trim），成功回调带 id/姓名并自重置（可连建）', () => {
    const onCreated = vi.fn()
    createMutate.mockImplementation((input, opts) => opts?.onSuccess?.({ id: 'cu-b', ...input }))
    render(<QuickPersonCreate onCreated={onCreated} onCancel={vi.fn()} />)
    const name = screen.getByLabelText(/姓名/) as HTMLInputElement
    fireEvent.change(name, { target: { value: '  李四 ' } })
    fireEvent.click(screen.getByRole('button', { name: /创建并加入名单/ }))
    expect(createMutate).toHaveBeenCalledWith(
      { full_name: '李四', gender: null, birth_date: null, owner_referrer_id: null, referrer_id: null },
      expect.anything(),
    )
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'cu-b', full_name: '李四' }))
    expect(name.value).toBe('') // 自重置，直接建下一个
  })

  it('姓名框按 Enter：触发创建且不冒泡提交外层 form（嵌套场景）', () => {
    const onSubmit = vi.fn((e) => e.preventDefault())
    createMutate.mockImplementation((input, opts) => opts?.onSuccess?.({ id: 'cu-b', ...input }))
    render(
      <form onSubmit={onSubmit}>
        <QuickPersonCreate onCreated={vi.fn()} onCancel={vi.fn()} />
      </form>,
    )
    const name = screen.getByLabelText(/姓名/)
    fireEvent.change(name, { target: { value: '李四' } })
    fireEvent.keyDown(name, { key: 'Enter' })
    expect(createMutate).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('取消 → onCancel（空表直接关；填了内容先 confirm）', () => {
    const onCancel = vi.fn()
    render(<QuickPersonCreate onCreated={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onCancel).toHaveBeenCalledTimes(1) // 空表无确认

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.change(screen.getByLabelText(/姓名/), { target: { value: '李四' } })
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(confirmSpy).toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalledTimes(1) // 用户选了不丢弃 → 不关
    confirmSpy.mockRestore()
  })

  it('块内按 Esc：只收起建人块（onCancel），不冒泡触发外层表单的 Esc 取消', () => {
    const onCancel = vi.fn()
    const outerKeyDown = vi.fn()
    render(
      <form onKeyDown={outerKeyDown}>
        <QuickPersonCreate onCreated={vi.fn()} onCancel={onCancel} />
      </form>,
    )
    fireEvent.keyDown(screen.getByLabelText(/姓名/), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(outerKeyDown).not.toHaveBeenCalled() // 外层 CustomerForm 的 Esc=取消整页，绝不能被触发
  })
})
