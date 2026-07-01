import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { FancySelect, ComboBox } from './FancySelect'
import type { FancyOption } from './FancySelect'

const OPTS: FancyOption[] = [
  { value: 'received', label: '收款' },
  { value: 'owing', label: '待付' },
]

function SelectHarness({ onChange }: { onChange: (v: string) => void }) {
  const [v, setV] = useState('')
  return (
    <FancySelect
      ariaLabel="录入类型"
      value={v}
      onChange={(x) => { setV(x); onChange(x) }}
      options={OPTS}
      placeholder="选择类型"
    />
  )
}

describe('FancySelect（纯选择 · portal + 勾选 + 键盘）', () => {
  it('初始显示 placeholder；点击打开浮层列出选项', () => {
    render(<SelectHarness onChange={() => {}} />)
    expect(screen.getByLabelText('录入类型')).toHaveTextContent('选择类型')
    expect(screen.queryByRole('listbox')).toBeNull()
    fireEvent.click(screen.getByLabelText('录入类型'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '收款' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '待付' })).toBeInTheDocument()
  })

  it('选中某项 → onChange(值) + 触发器显示该 label + 勾选态', async () => {
    const onChange = vi.fn()
    render(<SelectHarness onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('录入类型'))
    fireEvent.click(screen.getByRole('option', { name: '待付' }))
    expect(onChange).toHaveBeenCalledWith('owing')
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull()) // 选后关闭
    expect(screen.getByLabelText('录入类型')).toHaveTextContent('待付')
    // 再开 → 该项 aria-selected（带勾）
    fireEvent.click(screen.getByLabelText('录入类型'))
    expect(screen.getByRole('option', { name: '待付' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: '收款' })).toHaveAttribute('aria-selected', 'false')
  })

  it('键盘可达：↓ 打开并高亮、Enter 选中、Esc 关闭', async () => {
    const onChange = vi.fn()
    render(<SelectHarness onChange={onChange} />)
    const trigger = screen.getByLabelText('录入类型')
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }) // 打开 + 高亮第 0 项
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.keyDown(trigger, { key: 'Enter' }) // 选中收款
    expect(onChange).toHaveBeenCalledWith('received')
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    // Esc 关闭
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.keyDown(trigger, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
  })
})

function ComboHarness({ onChange }: { onChange: (v: string) => void }) {
  const [v, setV] = useState('')
  return (
    <ComboBox
      ariaLabel="录入描述"
      value={v}
      onChange={(x) => { setV(x); onChange(x) }}
      options={['律师费', '文案费']}
      placeholder="选择 / 手填"
    />
  )
}

describe('ComboBox（可选可手填 · 描述）', () => {
  it('★手填任意文字 → onChange 收到该文字（输入框回显）', () => {
    const onChange = vi.fn()
    render(<ComboHarness onChange={onChange} />)
    const input = screen.getByLabelText('录入描述') as HTMLInputElement
    fireEvent.change(input, { target: { value: '公证费' } }) // 不在建议项里的自定义文字
    expect(onChange).toHaveBeenLastCalledWith('公证费')
    expect(input.value).toBe('公证费')
  })

  it('下拉选建议项 → onChange 收到该项文字', async () => {
    const onChange = vi.fn()
    render(<ComboHarness onChange={onChange} />)
    const input = screen.getByLabelText('录入描述') as HTMLInputElement
    fireEvent.click(screen.getByRole('button', { name: '录入描述下拉' }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('option', { name: '律师费' }))
    expect(onChange).toHaveBeenLastCalledWith('律师费')
    expect(input.value).toBe('律师费')
  })

  it('手填后仍可继续改成别的自定义文字（手填能力不被建议项吞掉）', () => {
    const onChange = vi.fn()
    render(<ComboHarness onChange={onChange} />)
    const input = screen.getByLabelText('录入描述') as HTMLInputElement
    fireEvent.change(input, { target: { value: '律师费' } })
    fireEvent.change(input, { target: { value: '律师费（含加急）' } })
    expect(onChange).toHaveBeenLastCalledWith('律师费（含加急）')
    expect(input.value).toBe('律师费（含加急）')
  })
})
