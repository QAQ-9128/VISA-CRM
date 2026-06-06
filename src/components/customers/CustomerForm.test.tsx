import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../../providers/auth-context'
import type { AuthContextValue } from '../../providers/auth-context'
import { caseGroupCode } from '../../lib/caseGroups'
import type { Case, CaseApplicant, Customer } from '../../types/models'

// 真实数据：王芳+李雷 参加案件 ca1（王芳拥有）；ca9 已归档不可选
const { WANG, LI, CA1, CA9, APS } = vi.hoisted(() => {
  const base = {
    relationship_to_primary: null, client_source: null, is_starred: false, birth_date: null,
    gender: null, passport_no: null, nationality: null, phone: null, email: null, wechat: null,
    address: null, sponsor_employer_id: null, sponsor_position: null, referrer_id: null,
    notes: null, assigned_to: null, created_by: null, is_archived: false, updated_at: '',
    primary_applicant_id: null,
  }
  const WANG = { ...base, id: 'p1', full_name: '王芳', created_at: '2024-01-01' }
  const LI = { ...base, id: 'p2', full_name: '李雷', created_at: '2024-02-01' }
  const caseBase = {
    customer_id: 'p1', visa_subclass: '482', visa_stream: 'Core Skills', destination_country: null,
    sponsor_position: null, sponsor_employer_id: null, current_stage: 'todo', currency: 'AUD',
    sync_tracking: false, trt_reminder_enabled: false, parent_case_id: null, parent_sync_progress: false,
    assigned_to: null, created_by: null, is_archived: false, created_at: '2026-01-01', updated_at: '',
  }
  const CA1 = { ...caseBase, id: 'ca1', case_number: '11111111' }
  const CA9 = { ...caseBase, id: 'ca9', case_number: '99999999', is_archived: true }
  const APS = [{ id: 'ap1', case_id: 'ca1', customer_id: 'p2', created_at: '' }]
  return {
    WANG: WANG as unknown as Customer, LI: LI as unknown as Customer,
    CA1: CA1 as unknown as Case, CA9: CA9 as unknown as Case, APS: APS as unknown as CaseApplicant[],
  }
})

vi.mock('../../api/customers', async (orig) => {
  const actual = await orig<typeof import('../../api/customers')>()
  return { ...actual, listCustomers: vi.fn().mockResolvedValue([WANG, LI]) }
})
vi.mock('../../api/cases', async (orig) => {
  const actual = await orig<typeof import('../../api/cases')>()
  return { ...actual, listCases: vi.fn().mockResolvedValue([CA1, CA9]) }
})
vi.mock('../../api/caseApplicants', async (orig) => {
  const actual = await orig<typeof import('../../api/caseApplicants')>()
  return { ...actual, listAllCaseApplicants: vi.fn().mockResolvedValue(APS) }
})

import { CustomerForm } from './CustomerForm'

const authValue = {
  user: { id: 'u1' },
  loading: false,
  session: null,
  profile: null,
  isAdmin: true,
  signIn: async () => {},
  signOut: async () => {},
} as unknown as AuthContextValue

function renderForm(props: Partial<Parameters<typeof CustomerForm>[0]> = {}) {
  const onSubmit = vi.fn()
  const onCancel = vi.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrap = (children: ReactNode) => (
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter>{children}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  )
  render(wrap(<CustomerForm onSubmit={onSubmit} onCancel={onCancel} {...props} />))
  return { onSubmit, onCancel }
}

describe('CustomerForm（改进版 UI 行为）', () => {
  it('姓名为空 → 无「必填已填写」提示、保存禁用；填写后出现提示、保存可用', () => {
    renderForm()
    expect(screen.queryByText('✓ 必填项已填写')).not.toBeInTheDocument()
    const save = screen.getByRole('button', { name: '保存' })
    expect(save).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/姓名/), { target: { value: '王明' } })
    expect(screen.getByText('✓ 必填项已填写')).toBeInTheDocument()
    expect(save).not.toBeDisabled()
  })

  it('填姓名 + 保存 → onSubmit 收到含 full_name 的 values + joinCaseId=null + next=detail', () => {
    const { onSubmit } = renderForm()
    fireEvent.change(screen.getByLabelText(/姓名/), { target: { value: '李雷' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ full_name: '李雷' })
    expect(onSubmit.mock.calls[0][1]).toBeNull()
    expect(onSubmit.mock.calls[0][2]).toBe('detail')
  })

  it('「保存并新建案件」（重录快捷路径）：next=new-case；姓名为空时禁用', () => {
    const { onSubmit } = renderForm()
    const btn = screen.getByRole('button', { name: '保存并新建案件' })
    expect(btn).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/姓名/), { target: { value: '李雷' } })
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][2]).toBe('new-case')
  })

  it('Esc → onCancel；点取消 → onCancel', () => {
    const { onCancel } = renderForm()
    fireEvent.keyDown(screen.getByLabelText(/姓名/), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onCancel).toHaveBeenCalledTimes(2)
  })
})

describe('CustomerForm「组（Group）」区（一案一组：加入已有案件）', () => {
  it('标题为「组（Group）」；全表单无任何 主申/副申 字样', () => {
    renderForm()
    expect(screen.getByText('组（Group）')).toBeInTheDocument()
    expect(screen.queryByText(/主申/)).not.toBeInTheDocument()
    expect(screen.queryByText(/副申/)).not.toBeInTheDocument()
  })

  // 「新建独立客户」选项已删（2026-06 用户拍板）：不勾加入即独立，无需专门一个选择来展现
  it('默认无勾选、不显示「选择案件」；不再有「新建独立客户」选项', () => {
    renderForm()
    expect(screen.queryByText(/新建独立客户/)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/加入已有案件/)).not.toBeChecked()
    expect(screen.queryByText('选择案件')).not.toBeInTheDocument()
  })

  it('选「加入已有案件」→ 下拉列出真实案件（案件号+参与人+组码·N 人，归档案件不列）；选中 → 保存带 joinCaseId', async () => {
    const { onSubmit } = renderForm()
    fireEvent.click(screen.getByLabelText(/加入已有案件/))
    expect(screen.getByText('选择案件')).toBeInTheDocument()

    const option = await screen.findByRole('option', { name: /11111111/ })
    expect(option).toHaveTextContent('王芳、李雷') // 参与人
    expect(option).toHaveTextContent(`${caseGroupCode(['p1', 'p2'], 'ca1')} · 2 人`) // 一案一组组码
    // 归档案件不可选
    expect(screen.queryByRole('option', { name: /99999999/ })).not.toBeInTheDocument()

    fireEvent.click(option)
    expect(screen.getByText(/将加入案件/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/姓名/), { target: { value: '新客户' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ full_name: '新客户' })
    expect(onSubmit.mock.calls[0][1]).toBe('ca1') // 保存后由页面写 case_applicants
  })

  it('筛选可用（按参与人名）；取消勾选「加入已有案件」→ joinCaseId 清空（= 独立客户）', async () => {
    const { onSubmit } = renderForm()
    fireEvent.click(screen.getByLabelText(/加入已有案件/))
    await screen.findByRole('option', { name: /11111111/ })
    // 按参与人名筛选
    fireEvent.change(screen.getByLabelText('筛选选择案件'), { target: { value: '李雷' } })
    expect(within(screen.getByRole('listbox', { name: '选择案件' })).getAllByRole('option')).toHaveLength(1)

    fireEvent.click(screen.getByRole('option', { name: /11111111/ }))
    fireEvent.click(screen.getByLabelText(/加入已有案件/)) // 取消勾选
    expect(screen.queryByText('选择案件')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/姓名/), { target: { value: '独立客户' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSubmit.mock.calls[0][1]).toBeNull()
  })
})
