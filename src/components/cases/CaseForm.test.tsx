import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../../providers/auth-context'
import type { AuthContextValue } from '../../providers/auth-context'
import { CaseForm } from './CaseForm'
import { caseGroupCode } from '../../lib/caseGroups'
import { queryKeys } from '../../hooks/queries/keys'
import type { Case, Customer } from '../../types/models'

const P = { id: 'P', full_name: '甲', primary_applicant_id: null, created_at: '2024-01-01', is_archived: false } as unknown as Customer
const S = { id: 'S', full_name: '乙', primary_applicant_id: null, relationship_to_primary: '配偶', created_at: '2024-02-01', is_archived: false } as unknown as Customer

const authValue = {
  user: { id: 'u1' }, loading: false, session: null, profile: null, isAdmin: true,
  signIn: async () => {}, signOut: async () => {},
} as unknown as AuthContextValue

function renderForm(initial?: Case) {
  const onSubmit = vi.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity, refetchOnMount: false } } })
  qc.setQueryData(queryKeys.customers.list({}), [P, S])
  qc.setQueryData(queryKeys.cases.list, [])
  qc.setQueryData(queryKeys.caseApplicants.all, [])
  qc.setQueryData(queryKeys.employers.list, [])
  render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter>
          <CaseForm customerId="P" customerLabel="甲" initial={initial} onSubmit={onSubmit} onCancel={() => {}} />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
  return { onSubmit }
}

// 旧案件（带 parent_case_id 软关联）：表单需正常加载、可保存，提交不再写 parent 字段
const oldLinkedCase = {
  id: 'caOld', case_number: '12345678', customer_id: 'P', visa_subclass: '482', visa_stream: 'Core Skills',
  destination_country: 'Australia', sponsor_position: null, sponsor_employer_id: null, current_stage: 'todo',
  currency: 'AUD', sync_tracking: false, trt_reminder_enabled: false,
  parent_case_id: 'caParent', parent_sync_progress: true, assigned_to: null, created_by: null,
  is_archived: false, created_at: '', updated_at: '',
} as unknown as Case

describe('CaseForm（新增案件 · 一案一组）', () => {
  it('有 Group 区 + 组码由参与人集合实时派生 + 案件级担保字段；无主/副申措辞', async () => {
    renderForm()
    expect(await screen.findByText('Group（本案的组）')).toBeInTheDocument()
    // 初始 = 仅案件客户 → 单人组码（新建未保存以 '' 占位，保存后按案件 id 定）
    expect(screen.getByText(caseGroupCode(['P'], ''))).toBeInTheDocument()
    expect(screen.getByText('担保职位')).toBeInTheDocument()
    expect(screen.getByText('担保雇主')).toBeInTheDocument()
    expect(screen.getByText('案件客户')).toBeInTheDocument()
    // 去主/副申措辞
    expect(screen.queryByText(/主申/)).not.toBeInTheDocument()
    expect(screen.queryByText(/副申/)).not.toBeInTheDocument()
  })

  it('「本案参与人」区：标题改名、无「账单成员/费用按客户拆分」、无平铺 checkbox；owner 固定首位不可移出', async () => {
    renderForm()
    await screen.findByText('Group（本案的组）')
    expect(screen.getByText('本案参与人')).toBeInTheDocument()
    expect(screen.getByText('选择本案参与人')).toBeInTheDocument()
    expect(screen.queryByText(/账单成员/)).not.toBeInTheDocument()
    expect(screen.queryByText(/费用按客户拆分/)).not.toBeInTheDocument()
    // 平铺全客户 checkbox 列表已删（默认无 482 → 表单无任何 checkbox）
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    // owner 固定首位：标「案件客户 · 整案主进度」，无「移出」按钮
    expect(screen.getByText('案件客户 · 整案主进度')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '移出' })).not.toBeInTheDocument()
    // 浅灰账目提示
    expect(screen.getByText('账目自动按参与人分开计算并汇总')).toBeInTheDocument()
  })

  it('下拉添加参与人：列全部客户（排除 owner/已添加）、可筛选；选中进列表、可移出；组码实时更新', async () => {
    renderForm()
    await screen.findByText('Group（本案的组）')
    fireEvent.click(screen.getByRole('button', { name: '+ 添加本案参与人' }))

    // 候选不限"本组"：列出全部在册客户（排除 owner 甲）
    const option = screen.getByRole('option', { name: /乙/ })
    expect(option).toHaveTextContent('配偶') // 关系备注带上
    expect(screen.queryByRole('option', { name: /甲/ })).not.toBeInTheDocument() // owner 不在候选

    // 筛选
    fireEvent.change(screen.getByLabelText('筛选本案参与人'), { target: { value: '不存在' } })
    expect(screen.getByText('没有匹配的客户')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('筛选本案参与人'), { target: { value: '乙' } })

    // 选中 → 进已选列表（chip 行 + 移出），并从候选消失；组码切双人码
    fireEvent.click(screen.getByRole('option', { name: /乙/ }))
    expect(screen.getByRole('button', { name: '移出' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /乙/ })).not.toBeInTheDocument()
    expect(screen.getByText(caseGroupCode(['P', 'S'], ''))).toBeInTheDocument()
    expect(screen.getByText(/共 2 人/)).toBeInTheDocument()

    // 移出 → 回到单人组
    fireEvent.click(screen.getByRole('button', { name: '移出' }))
    expect(screen.queryByRole('button', { name: '移出' })).not.toBeInTheDocument()
    expect(screen.getByText(caseGroupCode(['P'], ''))).toBeInTheDocument()
  })

  it('「与其他案件的关系」整块已删：无任何相关文案（案件自包含，案与案无关系）', async () => {
    renderForm()
    await screen.findByText('Group（本案的组）')
    expect(screen.queryByText('与其他案件的关系')).not.toBeInTheDocument()
    expect(screen.queryByText(/关联案件/)).not.toBeInTheDocument()
    expect(screen.queryByText(/独立案件/)).not.toBeInTheDocument()
    expect(screen.queryByText(/进度同步/)).not.toBeInTheDocument()
    expect(screen.queryByText(/主案件/)).not.toBeInTheDocument()
  })

  it('保存新案件：payload 不含 parent_case_id / parent_sync_progress（落库默认 null）', async () => {
    const { onSubmit } = renderForm()
    await screen.findByText('Group（本案的组）')
    // 选签证类别使保存可用（目录下拉选 482）
    fireEvent.change(screen.getByLabelText('签证类别'), { target: { value: '482' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    const values = onSubmit.mock.calls[0][0]
    expect('parent_case_id' in values).toBe(false)
    expect('parent_sync_progress' in values).toBe(false)
  })

  it('加载 parent_case_id 非空的旧案件：正常渲染、可保存；提交不写 parent 字段（旧值留库不报错）', async () => {
    const { onSubmit } = renderForm(oldLinkedCase)
    await screen.findByText('Group（本案的组）')
    expect(screen.queryByText(/关联案件|与其他案件|进度同步/)).not.toBeInTheDocument()
    const save = screen.getByRole('button', { name: '保存' })
    expect(save).not.toBeDisabled() // visa 已回填 → 可保存
    fireEvent.click(save)
    const values = onSubmit.mock.calls[0][0]
    expect(values).toMatchObject({ customer_id: 'P', visa_subclass: '482' })
    expect('parent_case_id' in values).toBe(false) // 不传 → 编辑 patch 保留旧值，账目/合计不受影响
    expect('parent_sync_progress' in values).toBe(false)
  })
})
