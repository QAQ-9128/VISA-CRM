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

function renderForm(initial?: Case, initialApplicantIds?: string[]) {
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
          <CaseForm
            customerId="P"
            customerLabel="甲"
            initial={initial}
            initialApplicantIds={initialApplicantIds}
            onSubmit={onSubmit}
            onCancel={() => {}}
          />
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
  it('有 Group 区（组码只读）+ 案件级担保字段；无主/副申措辞', async () => {
    renderForm()
    expect(await screen.findByText('组（Group）')).toBeInTheDocument()
    // 初始 = 仅案件客户 → 单人组码（新建未保存以 '' 占位，保存后按案件 id 定）
    expect(screen.getByText(caseGroupCode(['P'], ''))).toBeInTheDocument()
    expect(screen.getByText('担保职位')).toBeInTheDocument()
    expect(screen.getByText('担保雇主')).toBeInTheDocument()
    expect(screen.getByText('案件客户')).toBeInTheDocument()
    // 去主/副申措辞
    expect(screen.queryByText(/主申/)).not.toBeInTheDocument()
    expect(screen.queryByText(/副申/)).not.toBeInTheDocument()
  })

  it('新建模式：「本案参与人」区可编辑——下拉添加、可移出、组码实时更新', async () => {
    renderForm()
    await screen.findByText('组（Group）')
    expect(screen.getByText('本案参与人')).toBeInTheDocument()
    expect(screen.getByText('案件客户 · 整案主进度')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '+ 添加本案参与人' }))

    // 候选列出全部在册客户（排除 owner 甲），带关系备注
    const option = screen.getByRole('option', { name: /乙/ })
    expect(option).toHaveTextContent('配偶')
    expect(screen.queryByRole('option', { name: /甲/ })).not.toBeInTheDocument()

    // 选中 → chip 行 + 移出；组码切双人码
    fireEvent.click(option)
    expect(screen.getByRole('button', { name: '移出' })).toBeInTheDocument()
    expect(screen.getByText(caseGroupCode(['P', 'S'], ''))).toBeInTheDocument()
    expect(screen.getByText(/共 2 人/)).toBeInTheDocument()

    // 移出 → 回到单人组
    fireEvent.click(screen.getByRole('button', { name: '移出' }))
    expect(screen.getByText(caseGroupCode(['P'], ''))).toBeInTheDocument()
  })

  // ?with= 一条龙：客户表单组区快速建的同组人，进建案表单即已是本案参与人
  it('新建模式带 initialApplicantIds → 参与人预选（chip + 双人组码），保存 applicantIds 含之', async () => {
    const { onSubmit } = renderForm(undefined, ['S'])
    await screen.findByText('组（Group）')
    expect(screen.getByText('乙')).toBeInTheDocument() // 预选 chip
    expect(screen.getByText(caseGroupCode(['P', 'S'], ''))).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/案件类型/), { target: { value: '482' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSubmit.mock.calls[0][1]).toEqual(['S'])
  })

  // 两级分类：「案件大类」（粗，四值枚举）在「案件类型」（细）上方，相互独立不级联
  it('「案件大类」下拉位于「案件类型」上方：四个选项可选，保存写入 case_category 且不影响案件类型', async () => {
    const { onSubmit } = renderForm()
    await screen.findByText('组（Group）')
    const cat = screen.getByLabelText('案件大类')
    const type = screen.getByLabelText('案件类型')
    // 大类在类型上方（DOM 先后序）
    expect(cat.compareDocumentPosition(type) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    for (const o of ['签证申请', '职业评估', 'De Facto 关系认定', '定制文件']) {
      expect(screen.getByRole('option', { name: o })).toBeInTheDocument()
    }
    fireEvent.change(cat, { target: { value: '职业评估' } })
    fireEvent.change(type, { target: { value: '482' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    const values = onSubmit.mock.calls[0][0]
    expect(values.case_category).toBe('职业评估')
    expect(values.visa_subclass).toBe('482') // 类型照常保存，互不影响
  })

  it('编辑模式：已有 case_category 回填选中；清回「— 请选择 —」保存写 null', async () => {
    const { onSubmit } = renderForm({ ...oldLinkedCase, case_category: '定制文件' } as Case)
    await screen.findByText('组（Group）')
    const cat = screen.getByLabelText('案件大类') as HTMLSelectElement
    expect(cat.value).toBe('定制文件') // 回填
    fireEvent.change(cat, { target: { value: '' } }) // 清回占位
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSubmit.mock.calls[0][0].case_category).toBeNull()
  })

  it('不选「案件大类」：可空，按现有逻辑正常保存（case_category=null）', async () => {
    const { onSubmit } = renderForm()
    await screen.findByText('组（Group）')
    fireEvent.change(screen.getByLabelText('案件类型'), { target: { value: '482' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    const values = onSubmit.mock.calls[0][0]
    expect(values.case_category).toBeNull()
    expect(values.visa_subclass).toBe('482')
    expect(onSubmit.mock.calls[0][1]).toEqual([]) // 参与人等其它数据改前=改后
  })

  // 命名简化：单一标签「案件类型」，无「签证类别 / 案件大类」双层残留；下拉选项与取值不变
  it('案件类型字段：单一标签、无旧标签残留；下拉大类分组与选项不变，选 482 保存写 visa_subclass', async () => {
    const { onSubmit } = renderForm()
    await screen.findByText('组（Group）')
    // 单一标签「案件类型」（可见 <label> 恰好一个 + 下拉可达名）
    const labels = screen.getAllByText(/案件类型/).filter((el) => el.tagName === 'LABEL')
    expect(labels).toHaveLength(1)
    expect(screen.getByLabelText('案件类型')).toBeInTheDocument()
    // 无旧标签残留（「案件大类」现为独立的两级分类字段，见上方用例）
    expect(screen.queryByText(/签证类别/)).toBeNull()
    // 下拉结构不变：大类 optgroup 分组 + 现有选项 + 其他（手填）
    expect(screen.getByRole('group', { name: '工作 / 雇主担保' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '482 Skills in Demand' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '其他（手填）' })).toBeInTheDocument()
    // 取值读写不变：选 482 → 保存 payload visa_subclass='482'
    fireEvent.change(screen.getByLabelText('案件类型'), { target: { value: '482' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSubmit.mock.calls[0][0].visa_subclass).toBe('482')
  })

  it('编辑模式：「本案参与人」编辑区隐藏（增删在客户页相关案件卡）；组码按现有集合只读展示', async () => {
    const onSubmit = vi.fn()
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData(queryKeys.customers.list({}), [P, S])
    qc.setQueryData(queryKeys.employers.list, [])
    render(
      <QueryClientProvider client={qc}>
        <AuthContext.Provider value={authValue}>
          <MemoryRouter>
            <CaseForm
              customerId="P"
              customerLabel="甲"
              initial={oldLinkedCase}
              initialApplicantIds={['S']}
              onSubmit={onSubmit}
              onCancel={() => {}}
            />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    )
    await screen.findByText('组（Group）')
    expect(screen.queryByText('本案参与人')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ 添加本案参与人' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '移出' })).not.toBeInTheDocument()
    expect(screen.getByText(/参与人在客户页「相关案件」卡里增删/)).toBeInTheDocument()
    // 组码按现有参与人集合（P+S）只读展示
    expect(screen.getByText(caseGroupCode(['P', 'S'], 'caOld'))).toBeInTheDocument()
    expect(screen.getByText(/共 2 人/)).toBeInTheDocument()
  })

  it('「与其他案件的关系」整块已删：无任何相关文案（案件自包含，案与案无关系）', async () => {
    renderForm()
    await screen.findByText('组（Group）')
    expect(screen.queryByText('与其他案件的关系')).not.toBeInTheDocument()
    expect(screen.queryByText(/关联案件/)).not.toBeInTheDocument()
    expect(screen.queryByText(/独立案件/)).not.toBeInTheDocument()
    expect(screen.queryByText(/进度同步/)).not.toBeInTheDocument()
    expect(screen.queryByText(/主案件/)).not.toBeInTheDocument()
  })

  it('保存新案件：payload 不含 parent_case_id / parent_sync_progress（落库默认 null）', async () => {
    const { onSubmit } = renderForm()
    await screen.findByText('组（Group）')
    // 选案件类型使保存可用（目录下拉选 482）
    fireEvent.change(screen.getByLabelText('案件类型'), { target: { value: '482' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    const values = onSubmit.mock.calls[0][0]
    expect('parent_case_id' in values).toBe(false)
    expect('parent_sync_progress' in values).toBe(false)
  })

  it('「保存并记账」（重录快捷路径）：next=fees；未选案件类型时禁用', async () => {
    const { onSubmit } = renderForm()
    await screen.findByText('组（Group）')
    const btn = screen.getByRole('button', { name: '保存并记账' })
    expect(btn).toBeDisabled()
    fireEvent.change(screen.getByLabelText('案件类型'), { target: { value: '482' } })
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][2]).toBe('fees')
  })

  it('普通「保存」：next=detail，applicantIds 随表单勾选', async () => {
    const { onSubmit } = renderForm()
    await screen.findByText('组（Group）')
    fireEvent.change(screen.getByLabelText('案件类型'), { target: { value: '482' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSubmit.mock.calls[0][1]).toEqual([]) // 未勾选参与人
    expect(onSubmit.mock.calls[0][2]).toBe('detail')
  })

  it('加载 parent_case_id 非空的旧案件：正常渲染、可保存；提交不写 parent 字段（旧值留库不报错）', async () => {
    const { onSubmit } = renderForm(oldLinkedCase)
    await screen.findByText('组（Group）')
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
