import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// 受控 hooks mock：列表数据 + 创建 mutation
const { state, createMutate } = vi.hoisted(() => ({
  state: { referrers: [] as unknown[] },
  createMutate: vi.fn(),
}))
vi.mock('../../hooks/queries/useReferrers', () => ({
  useReferrers: () => ({ data: state.referrers, isPending: false }),
  useCreateOwner: () => ({ mutate: createMutate, isPending: false }),
}))

import { OwnerSelect } from './OwnerSelect'

const ref = (id: string, name: string, kind: string) => ({
  id, name, kind, contact_phone: null, contact_email: null, notes: null,
  is_archived: false, created_by: null, created_at: '', updated_at: '',
})

beforeEach(() => {
  createMutate.mockReset()
  state.referrers = [
    ref('o1', '刘祎', 'owner'),
    ref('o2', 'Company', 'owner'),
    ref('r1', 'CICI', 'referrer'), // 介绍人不应出现在归属人下拉
  ]
})

describe('OwnerSelect（归属人 · Notion 式选择或创建）', () => {
  it('聚焦展开下拉：只列 kind=owner 的选项，不混入介绍人', () => {
    render(<OwnerSelect value={null} onChange={vi.fn()} />)
    fireEvent.focus(screen.getByRole('combobox'))
    expect(screen.getByRole('option', { name: /刘祎/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Company/ })).toBeInTheDocument()
    expect(screen.queryByText('CICI')).toBeNull()
  })

  it('输入过滤选项；点击选项 → onChange(id)，下拉关闭', () => {
    const onChange = vi.fn()
    render(<OwnerSelect value={null} onChange={onChange} />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '刘' } })
    expect(screen.queryByRole('option', { name: /Company/ })).toBeNull()
    fireEvent.click(screen.getByRole('option', { name: /刘祎/ }))
    expect(onChange).toHaveBeenCalledWith('o1')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('输入新名字 → 出现「创建」行，点击调用创建（kind=owner），成功后选中新 id', () => {
    const onChange = vi.fn()
    createMutate.mockImplementation((input, opts) => opts?.onSuccess?.({ id: 'new1', ...input }))
    render(<OwnerSelect value={null} onChange={onChange} />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '张老板' } })
    fireEvent.click(screen.getByRole('option', { name: /创建 "张老板"/ }))
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: '张老板', kind: 'owner' }),
      expect.anything(),
    )
    expect(onChange).toHaveBeenCalledWith('new1')
  })

  it('已有同名（忽略大小写/空白）→ 不出现「创建」行，只剩匹配项', () => {
    state.referrers = [ref('o9', 'VIP', 'owner')]
    render(<OwnerSelect value={null} onChange={vi.fn()} />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: ' vip ' } })
    expect(screen.queryByRole('option', { name: /创建/ })).toBeNull()
    expect(screen.getByRole('option', { name: /VIP/ })).toBeInTheDocument()
  })

  it('Enter 选中高亮项且不会提交外层表单', () => {
    const onChange = vi.fn()
    const onSubmit = vi.fn((e) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <OwnerSelect value={null} onChange={onChange} />
      </form>,
    )
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('o1') // 第一项 刘祎
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('已选值显示名字；「清空归属人」→ onChange(null)', () => {
    const onChange = vi.fn()
    render(<OwnerSelect value="o1" onChange={onChange} />)
    const input = screen.getByRole('combobox') as HTMLInputElement
    expect(input.value).toBe('刘祎')
    fireEvent.focus(input)
    fireEvent.click(screen.getByRole('option', { name: /清空归属人/ }))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
