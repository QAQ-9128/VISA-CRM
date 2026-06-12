import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../../providers/auth-context'
import type { AuthContextValue } from '../../providers/auth-context'
import { CaseForm } from './CaseForm'
import { caseGroupCode } from '../../lib/caseGroups'
import { queryKeys } from '../../hooks/queries/keys'
import { addCaseApplicant, removeCaseApplicant, removeSelfFromCase } from '../../api/caseApplicants'
import type { Case, Customer } from '../../types/models'

// 编辑模式的组成员增删/过户走增量写库（useAddCaseApplicant/useRemoveCaseApplicant/useRemoveSelfFromCase → api）；mock 掉避免真连库
vi.mock('../../api/caseApplicants', () => ({
  addCaseApplicant: vi.fn().mockResolvedValue(undefined),
  removeCaseApplicant: vi.fn().mockResolvedValue(undefined),
  removeSelfFromCase: vi.fn().mockResolvedValue(undefined),
}))

// 参与人区就地新建客户（复用 QuickPersonCreate）：mock 建客户 api + 归属人/介绍人查询，避免真连库
const { createCustomerMock } = vi.hoisted(() => ({
  createCustomerMock: vi.fn(async (input: { full_name: string }) => ({ id: 'cu-new', ...input })),
}))
vi.mock('../../api/customers', async (orig) => {
  const actual = await orig<typeof import('../../api/customers')>()
  return { ...actual, listCustomers: vi.fn().mockResolvedValue([]), createCustomer: createCustomerMock }
})
vi.mock('../../api/referrers', async (orig) => {
  const actual = await orig<typeof import('../../api/referrers')>()
  return { ...actual, listReferrers: vi.fn().mockResolvedValue([]) }
})

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

/** 级联快捷：选大类「签证申请」+ 指定签证类型（新建模式保存门禁的最短路径）。 */
function pickVisa(typeKey: string) {
  fireEvent.change(screen.getByLabelText('案件大类'), { target: { value: '签证申请' } })
  fireEvent.change(screen.getByLabelText('签证类型'), { target: { value: typeKey } })
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
  it('渐进披露（照 new_case.html）：选完类型前无 Group/操作区；选完出现组码卡 + 保存；无主/副申措辞', async () => {
    renderForm()
    expect(await screen.findByLabelText('案件大类')).toBeInTheDocument()
    // 选完类型前：组 / 参与人 / 保存按钮 / 担保都不出现（mock 的 Step3/actions 动态出现）
    expect(screen.queryByText('组（Group）')).toBeNull()
    expect(screen.queryByText('本案参与人')).toBeNull()
    expect(screen.queryByRole('button', { name: '保存' })).toBeNull()
    expect(screen.queryByText('担保职位')).toBeNull()
    expect(screen.queryByText('担保雇主')).toBeNull()
    // 选完 → 组码卡（单人组码，新建未保存以 '' 占位）+ 操作区出现
    pickVisa('482')
    expect(screen.getByText('组（Group）')).toBeInTheDocument()
    expect(screen.getByText(caseGroupCode(['P'], ''))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存并记账' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument()
    // 去主/副申措辞（new_case.html 的主申/副申提示不引入）
    expect(screen.queryByText(/主申/)).not.toBeInTheDocument()
    expect(screen.queryByText(/副申/)).not.toBeInTheDocument()
  })

  it('新建模式：「本案参与人」平铺列表 + 下拉添加 + 行尾×移出；组码实时更新；无主/副标识', async () => {
    renderForm()
    await screen.findByLabelText('案件大类')
    pickVisa('482')
    expect(screen.getByText('本案参与人')).toBeInTheDocument()
    // 主/副标识彻底移除；案件客户作为平级首行（仅姓名），新建模式其×禁用（无案件可过户）
    expect(screen.queryByText(/案件客户 · 整案主进度/)).toBeNull()
    expect(screen.queryByText(/整案主进度/)).toBeNull()
    expect(screen.getByText('甲')).toBeInTheDocument()
    expect(screen.getByLabelText('移出 甲')).toBeDisabled()

    // 添加用下拉框：候选含乙(带关系)、排除 owner 甲
    const addSelect = screen.getByLabelText('添加参与人')
    expect(within(addSelect).getByRole('option', { name: /乙（配偶）/ })).toBeInTheDocument()
    expect(within(addSelect).queryByRole('option', { name: '甲' })).toBeNull()

    // 选中乙 → 成员平铺行出现（带行尾×）；组码切双人码、共 2 人
    fireEvent.change(addSelect, { target: { value: 'S' } })
    expect(screen.getByText('乙')).toBeInTheDocument()
    expect(screen.getByLabelText('移出 乙')).toBeEnabled()
    expect(screen.getByText(caseGroupCode(['P', 'S'], ''))).toBeInTheDocument()
    expect(screen.getByText(/共 2 人/)).toBeInTheDocument()

    // 行尾×移出乙 → 回到单人组（乙的参与人行消失；乙会重新回到添加下拉候选，属正常）
    fireEvent.click(screen.getByLabelText('移出 乙'))
    expect(screen.getByText(caseGroupCode(['P'], ''))).toBeInTheDocument()
    expect(screen.queryByLabelText('移出 乙')).toBeNull()
  })

  // ?with= 一条龙：客户表单组区快速建的同组人，进建案表单即已是本案参与人
  it('新建模式带 initialApplicantIds → 参与人预选（平铺行 + 行尾× + 双人组码），保存 applicantIds 含之', async () => {
    const { onSubmit } = renderForm(undefined, ['S'])
    await screen.findByLabelText('案件大类')
    pickVisa('482') // 渐进披露：选完类型出参与人区
    expect(screen.getByText('乙')).toBeInTheDocument() // 预选成员作为平铺行
    expect(screen.getByLabelText('移出 乙')).toBeInTheDocument()
    expect(screen.getByText(caseGroupCode(['P', 'S'], ''))).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSubmit.mock.calls[0][1]).toEqual(['S'])
  })

  // ── 级联（照 图片/new_case.html Step1+Step2）：案件大类 → 签证类型 → 动态子字段 ──
  it('级联逐级展开：初始仅大类；签证申请 → 出签证类型；482 → 子类别+担保职位+担保雇主；600 → 担保消失', async () => {
    renderForm()
    await screen.findByLabelText('案件大类')
    // 初始：只有案件大类，无签证类型/担保（不再常驻）
    expect(screen.getByLabelText('案件大类')).toBeInTheDocument()
    expect(screen.queryByLabelText('签证类型')).toBeNull()
    expect(screen.queryByText('担保职位')).toBeNull()
    expect(screen.queryByText('担保雇主')).toBeNull()
    // 四个大类选项
    for (const o of ['签证申请', '职业评估', 'De Facto 关系认定', '定制文件']) {
      expect(screen.getByRole('option', { name: o })).toBeInTheDocument()
    }
    // 签证申请 → 签证类型（七项）
    fireEvent.change(screen.getByLabelText('案件大类'), { target: { value: '签证申请' } })
    expect(screen.getByLabelText('签证类型')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '482 TSS' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '配偶签证 TR（820 / 801）' })).toBeInTheDocument()
    // 482 → 签证子类别 + 担保职位 + 担保雇主
    fireEvent.change(screen.getByLabelText('签证类型'), { target: { value: '482' } })
    expect(screen.getByText('482 TSS — 签证详情')).toBeInTheDocument()
    expect(screen.getByLabelText('签证子类别')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Core Skill Stream' })).toBeInTheDocument()
    expect(screen.getByLabelText('担保职位')).toBeInTheDocument()
    expect(screen.getByLabelText('担保雇主')).toBeInTheDocument()
    // 切 600 → 担保字段消失，只剩子类别
    fireEvent.change(screen.getByLabelText('签证类型'), { target: { value: '600' } })
    expect(screen.queryByLabelText('担保职位')).toBeNull()
    expect(screen.queryByLabelText('担保雇主')).toBeNull()
    expect(screen.getByRole('option', { name: 'Tourist Stream' })).toBeInTheDocument()
  })

  it('482 保存：visa_subclass/stream/担保职位 全走现有列；case_category=签证申请；TRT 勾选可见', async () => {
    const { onSubmit } = renderForm()
    await screen.findByLabelText('案件大类')
    pickVisa('482')
    expect(screen.getByText(/2 年转 186 TRT 提醒/)).toBeInTheDocument() // is482 驱动逻辑不破坏
    fireEvent.change(screen.getByLabelText('签证子类别'), { target: { value: 'Core Skills' } })
    fireEvent.change(screen.getByLabelText('担保职位'), { target: { value: 'Senior Cook' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    const v = onSubmit.mock.calls[0][0]
    expect(v.case_category).toBe('签证申请')
    expect(v.visa_subclass).toBe('482')
    expect(v.visa_stream).toBe('Core Skills') // 入库值=现有目录 stream（标签才是 mock 文案）
    expect(v.sponsor_position).toBe('Senior Cook')
    expect(v.case_details).toBeNull() // 482 无 JSON 子字段
  })

  // 407 培训签：担保职位 + 担保雇主与 482/186 同款；保存走现有列；无 TRT 提醒
  it('407 培训签：列表有它；选 407 → 担保职位+担保雇主；保存 visa_subclass=407 + 担保走现有列', async () => {
    const { onSubmit } = renderForm()
    await screen.findByLabelText('案件大类')
    fireEvent.change(screen.getByLabelText('案件大类'), { target: { value: '签证申请' } })
    expect(screen.getByRole('option', { name: '407 培训签' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('签证类型'), { target: { value: '407' } })
    expect(screen.getByText('407 培训签 — 签证详情')).toBeInTheDocument()
    expect(screen.getByLabelText('担保职位')).toBeInTheDocument()
    expect(screen.getByLabelText('担保雇主')).toBeInTheDocument()
    // 407 不出 TRT 提醒（只属于 482 TSS）
    expect(screen.queryByText(/2 年转 186 TRT 提醒/)).toBeNull()
    fireEvent.change(screen.getByLabelText('担保职位'), { target: { value: 'Trainee Chef' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    const v = onSubmit.mock.calls[0][0]
    expect(v.case_category).toBe('签证申请')
    expect(v.visa_subclass).toBe('407')
    expect(v.visa_stream).toBeNull() // 407 无子类别
    expect(v.sponsor_position).toBe('Trainee Chef')
    expect(v.trt_reminder_enabled).toBe(false)
    expect(v.case_details).toBeNull()
  })

  it('407 填了担保后切走（600）→ 担保字段消失、不残留入保存值', async () => {
    const { onSubmit } = renderForm()
    await screen.findByLabelText('案件大类')
    pickVisa('407')
    fireEvent.change(screen.getByLabelText('担保职位'), { target: { value: 'Trainee Chef' } })
    fireEvent.change(screen.getByLabelText('签证类型'), { target: { value: '600' } })
    expect(screen.queryByLabelText('担保职位')).toBeNull()
    expect(screen.queryByLabelText('担保雇主')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    const v = onSubmit.mock.calls[0][0]
    expect(v.visa_subclass).toBe('600')
    expect(v.sponsor_position).toBeNull() // 切走清空，无残留
    expect(v.sponsor_employer_id).toBeNull()
  })

  // 「3 个月提醒 · 更新同居材料」：仅 186 ENS + 配偶签（820/801、309/100）渲染；勾选保存写 cohab_reminder_enabled
  it('同居材料勾选框仅 186/配偶签出现：482 / 600 不渲染', async () => {
    renderForm()
    await screen.findByLabelText('案件大类')
    pickVisa('186')
    expect(screen.getByText(/3 个月提醒 · 更新同居材料/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('签证类型'), { target: { value: '820' } })
    expect(screen.getByText(/3 个月提醒 · 更新同居材料/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('签证类型'), { target: { value: '309' } })
    expect(screen.getByText(/3 个月提醒 · 更新同居材料/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('签证类型'), { target: { value: '482' } })
    expect(screen.queryByText(/3 个月提醒 · 更新同居材料/)).toBeNull()
    fireEvent.change(screen.getByLabelText('签证类型'), { target: { value: '600' } })
    expect(screen.queryByText(/3 个月提醒 · 更新同居材料/)).toBeNull()
  })

  it('勾选同居材料提醒并保存 → cohab_reminder_enabled=true；不勾 → false', async () => {
    const { onSubmit } = renderForm()
    await screen.findByLabelText('案件大类')
    pickVisa('820')
    fireEvent.click(screen.getByRole('checkbox', { name: /3 个月提醒 · 更新同居材料/ }))
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSubmit.mock.calls[0][0].cohab_reminder_enabled).toBe(true)
  })

  it('勾了同居材料提醒后切到 600 → 保存 cohab_reminder_enabled=false（不残留）', async () => {
    const { onSubmit } = renderForm()
    await screen.findByLabelText('案件大类')
    pickVisa('186')
    fireEvent.click(screen.getByRole('checkbox', { name: /3 个月提醒 · 更新同居材料/ }))
    fireEvent.change(screen.getByLabelText('签证类型'), { target: { value: '600' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSubmit.mock.calls[0][0].cohab_reminder_enabled).toBe(false)
  })

  // A. 「2 年转 186 TRT 提醒」勾选框仅在 签证类型 = 482 TSS 时渲染（其它类型一律不出现、不写标记）
  it('TRT 勾选框仅 482 TSS 出现：482sbs / 186 / 600 均不渲染', async () => {
    renderForm()
    await screen.findByLabelText('案件大类')
    pickVisa('482')
    expect(screen.getByText(/2 年转 186 TRT 提醒/)).toBeInTheDocument()
    // 切到 482 SBS（入库 subclass=SBS，非 482 TSS）→ 不出现
    fireEvent.change(screen.getByLabelText('签证类型'), { target: { value: '482sbs' } })
    expect(screen.queryByText(/2 年转 186 TRT 提醒/)).toBeNull()
    // 186 / 600 同样不出现
    fireEvent.change(screen.getByLabelText('签证类型'), { target: { value: '186' } })
    expect(screen.queryByText(/2 年转 186 TRT 提醒/)).toBeNull()
    fireEvent.change(screen.getByLabelText('签证类型'), { target: { value: '600' } })
    expect(screen.queryByText(/2 年转 186 TRT 提醒/)).toBeNull()
  })

  it('TRT 勾选框在「签证详情」卡内、位于「组（Group）」之前（与签证配套，不在组区）', async () => {
    renderForm()
    await screen.findByLabelText('案件大类')
    pickVisa('482')
    const trt = screen.getByText(/2 年转 186 TRT 提醒/)
    // 与 482 签证详情卡同属一张卡（向上能找到含「482 TSS — 签证详情」的卡片）
    const card = trt.closest('section.space-y-5') as HTMLElement
    expect(card.textContent).toContain('482 TSS — 签证详情')
    expect(card.textContent).toContain('签证子类别')
    // 文档顺序：签证详情里的 TRT 勾选框排在「组（Group）」之前（不再混在组区）
    const group = screen.getByText('组（Group）')
    expect(trt.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('非 482 TSS 勾不到 → 保存 payload trt_reminder_enabled=false（不写标记）', async () => {
    const { onSubmit } = renderForm()
    await screen.findByLabelText('案件大类')
    pickVisa('186') // 186 ENS：无 TRT 勾选框
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSubmit.mock.calls[0][0].trt_reminder_enabled).toBe(false)
  })

  // 「不再提醒」可逆：dismissed 案件的勾选框显示真实停用状态（不再假勾选），重新勾选保存 = 复活提醒
  it('编辑已「不再提醒」的 482 案件：勾选框未勾（显示实际状态）；重新勾选保存 → dismissed 复位、提醒复活', async () => {
    const dismissed482 = {
      ...oldLinkedCase, trt_reminder_enabled: true, trt_reminder_dismissed: true,
    } as unknown as Case
    const { onSubmit } = renderForm(dismissed482)
    await screen.findByLabelText('案件大类')
    const box = screen.getByRole('checkbox', { name: /2 年转 186 TRT 提醒/ })
    expect(box).not.toBeChecked() // 已停用就不该显示成勾选——否则「表单说开着，却永远不提醒」
    fireEvent.click(box)
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    const v = onSubmit.mock.calls[0][0]
    expect(v.trt_reminder_enabled).toBe(true)
    expect(v.trt_reminder_dismissed).toBe(false)
  })

  // B. prefill（从 TRT 提醒卡「新建 186 TRT 案件」进来）：预填 大类=签证申请 / 类型=186 ENS / Stream=TRT
  it('prefill 预填 186 ENS · TRT：级联回填且保存为 186 + Temporary Residence Transition', async () => {
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
              prefill={{ category: '签证申请', visaType: '186', stream: 'Temporary Residence Transition', sponsorPosition: '', sponsorEmployerId: '', details: {} }}
              onSubmit={onSubmit}
              onCancel={() => {}}
            />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    )
    await screen.findByLabelText('案件大类')
    expect((screen.getByLabelText('案件大类') as HTMLSelectElement).value).toBe('签证申请')
    expect((screen.getByLabelText('签证类型') as HTMLSelectElement).value).toBe('186')
    expect((screen.getByLabelText('Stream') as HTMLSelectElement).value).toBe('Temporary Residence Transition')
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    const v = onSubmit.mock.calls[0][0]
    expect(v.case_category).toBe('签证申请')
    expect(v.visa_subclass).toBe('186')
    expect(v.visa_stream).toBe('Temporary Residence Transition')
  })

  it('职业评估保存：visa_subclass=Skill Assessment（目录已有）；评估机构/职位 → case_details', async () => {
    const { onSubmit } = renderForm()
    await screen.findByLabelText('案件大类')
    fireEvent.change(screen.getByLabelText('案件大类'), { target: { value: '职业评估' } })
    expect(screen.queryByLabelText('签证类型')).toBeNull() // 非签证大类不出签证类型
    fireEvent.change(screen.getByLabelText('评估机构'), { target: { value: 'VETASSESS' } })
    fireEvent.change(screen.getByLabelText('评估职位'), { target: { value: 'Cook' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    const v = onSubmit.mock.calls[0][0]
    expect(v.case_category).toBe('职业评估')
    expect(v.visa_subclass).toBe('Skill Assessment')
    expect(v.case_details).toEqual({ 评估机构: 'VETASSESS', 评估职位: 'Cook' })
    expect(v.sponsor_position).toBeNull() // 担保不相干 → null
  })

  // ── 大类=定制文件（文档服务、只对一个客户）：组(Group)/本案参与人 整块隐藏，案件客户为唯一参与人 ──
  it('大类=定制文件 → 组（Group）/本案参与人区整块隐藏（组码/添加下拉/账目提示全不出现）；其余操作区照常', async () => {
    renderForm()
    await screen.findByLabelText('案件大类')
    fireEvent.change(screen.getByLabelText('案件大类'), { target: { value: '定制文件' } })
    expect(screen.queryByText('组（Group）')).toBeNull()
    expect(screen.queryByText('本案参与人')).toBeNull()
    expect(screen.queryByLabelText('添加参与人')).toBeNull()
    expect(screen.queryByText(/账目自动按参与人分开/)).toBeNull()
    // 目的国/货币/保存等操作区不受影响（只隐组/参与人这块）
    expect(screen.getByLabelText('目的国')).toBeInTheDocument()
    expect(screen.getByLabelText('货币')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: '保存并记账' })).toBeInTheDocument()
  })

  it('大类=定制文件保存：即便带 initialApplicantIds 预选，applicantIds 恒为 []（案件客户为唯一参与人，账目归其名下）', async () => {
    const { onSubmit } = renderForm(undefined, ['S'])
    await screen.findByLabelText('案件大类')
    fireEvent.change(screen.getByLabelText('案件大类'), { target: { value: '定制文件' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    const call = onSubmit.mock.calls[0]
    expect(call[1]).toEqual([]) // 不写任何 case_applicants 行 = 案件客户即唯一参与人（合法态，非「无参与人」）
    expect(call[0].customer_id).toBe('P')
    expect(call[0].visa_subclass).toBe('定制文件')
    expect(call[0].case_category).toBe('定制文件')
  })

  it('切换大类显隐即时：定制文件(隐) → 签证申请 482(显，预选参与人不丢) → 定制文件(隐)', async () => {
    renderForm(undefined, ['S'])
    await screen.findByLabelText('案件大类')
    fireEvent.change(screen.getByLabelText('案件大类'), { target: { value: '定制文件' } })
    expect(screen.queryByText('组（Group）')).toBeNull()
    expect(screen.queryByText('本案参与人')).toBeNull()
    // 切回签证申请 → 区块即时恢复，预选参与人乙仍在（本地状态不因隐藏丢失）
    pickVisa('482')
    expect(screen.getByText('组（Group）')).toBeInTheDocument()
    expect(screen.getByText('本案参与人')).toBeInTheDocument()
    expect(screen.getByText('乙')).toBeInTheDocument()
    expect(screen.getByText(/共 2 人/)).toBeInTheDocument()
    // 再切回定制文件 → 即时隐藏
    fireEvent.change(screen.getByLabelText('案件大类'), { target: { value: '定制文件' } })
    expect(screen.queryByText('组（Group）')).toBeNull()
    expect(screen.queryByText('本案参与人')).toBeNull()
    expect(screen.queryByLabelText('添加参与人')).toBeNull()
  })

  it('编辑定制文件案件：组/参与人区同样隐藏（按大类显隐，新建/编辑同一口径）；保存照常', async () => {
    const customDocCase = {
      ...oldLinkedCase, visa_subclass: '定制文件', visa_stream: null, case_category: '定制文件',
      parent_case_id: null, parent_sync_progress: false,
    } as unknown as Case
    renderForm(customDocCase, [])
    await screen.findByLabelText('案件大类')
    expect((screen.getByLabelText('案件大类') as HTMLSelectElement).value).toBe('定制文件')
    expect(screen.queryByText('组（Group）')).toBeNull()
    expect(screen.queryByText('本案参与人')).toBeNull()
    expect(screen.getByRole('button', { name: '保存' })).not.toBeDisabled()
  })

  it('切换大类清理旧子字段：职业评估填了值 → 切定制文件 → 评估字段消失、payload 无残留', async () => {
    const { onSubmit } = renderForm()
    await screen.findByLabelText('案件大类')
    fireEvent.change(screen.getByLabelText('案件大类'), { target: { value: '职业评估' } })
    fireEvent.change(screen.getByLabelText('评估职位'), { target: { value: 'Cook' } })
    fireEvent.change(screen.getByLabelText('案件大类'), { target: { value: '定制文件' } })
    expect(screen.queryByLabelText('评估机构')).toBeNull()
    expect(screen.queryByLabelText('评估职位')).toBeNull()
    fireEvent.change(screen.getByLabelText('文件类型'), { target: { value: 'Cover Letter' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    const v = onSubmit.mock.calls[0][0]
    expect(v.visa_subclass).toBe('定制文件')
    expect(v.case_details).toEqual({ 文件类型: 'Cover Letter' }) // 无「评估职位」残留
  })

  it('500 学生签：子类别选 Student Guardian → 入库 590；就读院校进 case_details', async () => {
    const { onSubmit } = renderForm()
    await screen.findByLabelText('案件大类')
    pickVisa('500')
    fireEvent.change(screen.getByLabelText('签证子类别'), { target: { value: '590' } })
    fireEvent.change(screen.getByLabelText('就读院校'), { target: { value: 'UNSW' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    const v = onSubmit.mock.calls[0][0]
    expect(v.visa_subclass).toBe('590')
    expect(v.visa_stream).toBeNull() // 子类别已折进 subclass
    expect(v.case_details).toEqual({ 就读院校: 'UNSW' })
  })

  it('配偶签证 TR：当前阶段 → visa_stream；静态申请地点 Onshore 展示', async () => {
    const { onSubmit } = renderForm()
    await screen.findByLabelText('案件大类')
    pickVisa('820')
    expect(screen.getByText(/Onshore（澳洲境内）/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('当前阶段'), { target: { value: '801' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    const v = onSubmit.mock.calls[0][0]
    expect(v.visa_subclass).toBe('820/801')
    expect(v.visa_stream).toBe('801')
  })

  it('保存门禁（渐进披露）：未选大类无操作区；签证申请未选类型仍无；选完类型出现且可保存', async () => {
    renderForm()
    await screen.findByLabelText('案件大类')
    expect(screen.queryByRole('button', { name: '保存' })).toBeNull()
    fireEvent.change(screen.getByLabelText('案件大类'), { target: { value: '签证申请' } })
    expect(screen.queryByRole('button', { name: '保存' })).toBeNull()
    fireEvent.change(screen.getByLabelText('签证类型'), { target: { value: '186' } })
    expect(screen.getByRole('button', { name: '保存' })).not.toBeDisabled()
  })

  it('组（Group）/ 本案参与人区位于级联下方，功能不变', async () => {
    renderForm()
    await screen.findByLabelText('案件大类')
    pickVisa('482')
    const cat = screen.getByLabelText('案件大类')
    const group = screen.getByText('组（Group）')
    expect(cat.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('本案参与人')).toBeInTheDocument()
    expect(screen.getByLabelText('添加参与人')).toBeInTheDocument()
  })

  // 编辑模式现在与新建共用同一套级联（1:1 复刻 new_case.html），用 cascadeFromCase 反向回填现有案件
  it('编辑模式：级联回填现有案件（大类/签证类型/子类别/担保），改类型→担保随之增减，可存写 case_details', async () => {
    const { onSubmit } = renderForm(oldLinkedCase) // 482 / Core Skills（无 case_category → 按签证类型反推大类）
    await screen.findByLabelText('案件大类')
    // 反向回填：482 → 大类=签证申请、类型=482、子类别=Core Skills、担保职位可见
    expect((screen.getByLabelText('案件大类') as HTMLSelectElement).value).toBe('签证申请')
    expect((screen.getByLabelText('签证类型') as HTMLSelectElement).value).toBe('482')
    expect((screen.getByLabelText('签证子类别') as HTMLSelectElement).value).toBe('Core Skills')
    expect(screen.getByLabelText('担保职位')).toBeInTheDocument()
    // 改成 600 → 担保字段消失（与新建同一级联行为，旧子字段不残留）
    fireEvent.change(screen.getByLabelText('签证类型'), { target: { value: '600' } })
    expect(screen.queryByLabelText('担保职位')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    const v = onSubmit.mock.calls[0][0]
    expect(v.case_category).toBe('签证申请')
    expect(v.visa_subclass).toBe('600')
    expect('case_details' in v).toBe(true) // 编辑也走级联 → 写 case_details（不再保留旧扁平字段）
  })

  it('编辑模式：旧签证不在 new_case 这 7 类（如 189）→ 大类/类型回填为空，需重选才可保存', async () => {
    renderForm({ ...oldLinkedCase, visa_subclass: '189', visa_stream: null, case_category: null } as Case)
    await screen.findByLabelText('案件大类')
    expect((screen.getByLabelText('案件大类') as HTMLSelectElement).value).toBe('') // 旧值打开即空
    expect(screen.queryByLabelText('签证类型')).toBeNull()
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled()
  })

  it('编辑模式：「本案参与人」平铺增删——案件客户首行(可过户)+成员行尾×即时移出+可添加；组码随集合展示', async () => {
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
    await screen.findByLabelText('案件大类')
    // 编辑模式平铺增删区：无主/副标识；案件客户甲与成员乙都是平级行，都带行尾×
    expect(screen.getByText('本案参与人')).toBeInTheDocument()
    expect(screen.queryByText(/整案主进度/)).toBeNull()
    expect(screen.getByLabelText('移出 甲')).toBeInTheDocument() // 案件客户平级首行（顶部另有「案件客户」栏，故用 ×label 定位行）
    expect(screen.getByText('乙')).toBeInTheDocument()
    expect(screen.getByLabelText('添加参与人')).toBeInTheDocument()
    expect(screen.getByText(/增减成员立即生效/)).toBeInTheDocument()
    // 组码随现有参与人集合（P+S）展示
    expect(screen.getByText(caseGroupCode(['P', 'S'], 'caOld'))).toBeInTheDocument()
    expect(screen.getByText(/共 2 人/)).toBeInTheDocument()
    // 成员行尾×即时移出（增量写库，不走表单 onSubmit）
    fireEvent.click(screen.getByLabelText('移出 乙'))
    await waitFor(() => expect(removeCaseApplicant).toHaveBeenCalledWith('caOld', 'S'))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('编辑模式：案件客户行×=过户（removeSelfFromCase）；有承接人时可点，唯一参与人时禁用', async () => {
    const onSubmit = vi.fn()
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData(queryKeys.customers.list({}), [P, S])
    qc.setQueryData(queryKeys.employers.list, [])
    const { rerender } = render(
      <QueryClientProvider client={qc}>
        <AuthContext.Provider value={authValue}>
          <MemoryRouter>
            <CaseForm customerId="P" customerLabel="甲" initial={oldLinkedCase} initialApplicantIds={['S']} onSubmit={onSubmit} onCancel={() => {}} />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    )
    await screen.findByLabelText('案件大类')
    // 有承接人（乙）：案件客户甲行的×可点 → 过户（cases.customer_id 改写，复用 removeSelfFromCase）
    fireEvent.click(screen.getByLabelText('移出 甲'))
    await waitFor(() => expect(removeSelfFromCase).toHaveBeenCalledWith('caOld', 'P'))
    expect(onSubmit).not.toHaveBeenCalled()
    // 唯一参与人（无成员）：案件客户行×禁用（无人可承接，不能移出）
    rerender(
      <QueryClientProvider client={qc}>
        <AuthContext.Provider value={authValue}>
          <MemoryRouter>
            <CaseForm customerId="P" customerLabel="甲" initial={oldLinkedCase} initialApplicantIds={[]} onSubmit={onSubmit} onCancel={() => {}} />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    )
    expect(screen.getByLabelText('移出 甲')).toBeDisabled()
  })

  it('编辑模式添加参与人：下拉选中候选 → 调 useAddCaseApplicant（增量即时写库，不走表单保存）', async () => {
    // S 已是成员，候选里应是另一个客户 T；选它即触发增量添加
    const T = { id: 'T', full_name: '丙', primary_applicant_id: null, created_at: '2024-03-01', is_archived: false } as unknown as Customer
    const onSubmit = vi.fn()
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData(queryKeys.customers.list({}), [P, S, T])
    qc.setQueryData(queryKeys.employers.list, [])
    render(
      <QueryClientProvider client={qc}>
        <AuthContext.Provider value={authValue}>
          <MemoryRouter>
            <CaseForm customerId="P" customerLabel="甲" initial={oldLinkedCase} initialApplicantIds={['S']} onSubmit={onSubmit} onCancel={() => {}} />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    )
    await screen.findByLabelText('案件大类')
    const addSelect = screen.getByLabelText('添加参与人')
    expect(within(addSelect).getByRole('option', { name: /丙/ })).toBeInTheDocument()
    expect(within(addSelect).queryByRole('option', { name: /乙/ })).toBeNull() // 已是成员，不在候选
    fireEvent.change(addSelect, { target: { value: 'T' } })
    await waitFor(() => expect(addCaseApplicant).toHaveBeenCalledWith('caOld', 'T')) // 增量写库（非表单 onSubmit）
    expect(onSubmit).not.toHaveBeenCalled()
  })

  // ── 参与人区就地新建客户：复用客户表单的「快速建档」卡（QuickPersonCreate），案件上下文按钮=创建并加入本案 ──
  it('「+ 新建客户」入口与快速建档卡：五字段与新建客户流程一致（姓名/性别/生日/归属人/介绍人含+新建）；无「加入已有案件」勾选框', async () => {
    renderForm()
    await screen.findByLabelText('案件大类')
    pickVisa('482')
    // 入口在「本案参与人」区内
    const section = screen.getByText('本案参与人').closest('div') as HTMLElement
    const entry = within(section).getByRole('button', { name: /新建客户/ })
    fireEvent.click(entry)
    // 五字段与新建客户流程一致（同一组件）
    expect(screen.getByLabelText(/姓名/)).toBeInTheDocument()
    expect(screen.getByLabelText('性别')).toBeInTheDocument()
    expect(screen.getByLabelText('生日')).toBeInTheDocument()
    expect(screen.getByLabelText('归属人')).toBeInTheDocument()
    expect(screen.getByLabelText('介绍人')).toBeInTheDocument()
    // 介绍人的内联新建（限定在卡内查：482 详情卡的担保雇主选择器也有「+ 新建」）
    const card = screen.getByText('⚡ 快速建档新客户').closest('.space-y-3') as HTMLElement
    expect(within(card).getByRole('button', { name: '+ 新建' })).toBeInTheDocument()
    // 案件上下文：已在本案，无「加入已有案件」勾选框；按钮为「创建并加入本案」
    expect(screen.queryByText(/加入已有案件/)).toBeNull()
    expect(screen.getByRole('button', { name: '创建并加入本案' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /创建并加入名单/ })).toBeNull()
  })

  it('新建模式「创建并加入本案」：建档后即成为本案参与人（共 2 人、组码更新），保存 applicantIds 含新客户 id（(case_id, applicant_id) 归账由此保证）', async () => {
    const { onSubmit } = renderForm()
    await screen.findByLabelText('案件大类')
    pickVisa('482')
    fireEvent.click(screen.getByRole('button', { name: /新建客户/ }))
    fireEvent.change(screen.getByLabelText(/姓名/), { target: { value: '丁新' } })
    fireEvent.click(screen.getByRole('button', { name: '创建并加入本案' }))
    await waitFor(() => expect(createCustomerMock).toHaveBeenCalled())
    expect(createCustomerMock.mock.calls[0][0]).toMatchObject({ full_name: '丁新' })
    // 即时出现在参与人列表（姓名就地可见，不等列表刷新）；组码/人数同步
    expect(await screen.findByText('丁新')).toBeInTheDocument()
    expect(screen.getByText(/共 2 人/)).toBeInTheDocument()
    expect(screen.getByText(caseGroupCode(['P', 'cu-new'], ''))).toBeInTheDocument()
    // 保存：applicantIds 带新客户 → 页面层照常写 case_applicants（账目按 (case_id, applicant_id) 归账，算法不动）
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSubmit.mock.calls[0][1]).toEqual(['cu-new'])
  })

  it('编辑模式「创建并加入本案」：建档 + addCaseApplicant 即时写库（沿用现有就地加入逻辑）', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData(queryKeys.customers.list({}), [P, S])
    qc.setQueryData(queryKeys.employers.list, [])
    render(
      <QueryClientProvider client={qc}>
        <AuthContext.Provider value={authValue}>
          <MemoryRouter>
            <CaseForm customerId="P" customerLabel="甲" initial={oldLinkedCase} initialApplicantIds={[]} onSubmit={vi.fn()} onCancel={() => {}} />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    )
    await screen.findByLabelText('案件大类')
    fireEvent.click(screen.getByRole('button', { name: /新建客户/ }))
    fireEvent.change(screen.getByLabelText(/姓名/), { target: { value: '丁新' } })
    fireEvent.click(screen.getByRole('button', { name: '创建并加入本案' }))
    await waitFor(() => expect(addCaseApplicant).toHaveBeenCalledWith('caOld', 'cu-new'))
  })

  it('没有可添加的客户时：占位文案引导用「+ 新建客户」就地建档（不再只指去客户列表）', async () => {
    const onSubmit = vi.fn()
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity, refetchOnMount: false } } })
    qc.setQueryData(queryKeys.customers.list({}), [P]) // 只有案件客户自己 → 无候选
    qc.setQueryData(queryKeys.cases.list, [])
    qc.setQueryData(queryKeys.caseApplicants.all, [])
    qc.setQueryData(queryKeys.employers.list, [])
    render(
      <QueryClientProvider client={qc}>
        <AuthContext.Provider value={authValue}>
          <MemoryRouter>
            <CaseForm customerId="P" customerLabel="甲" onSubmit={onSubmit} onCancel={() => {}} />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    )
    await screen.findByLabelText('案件大类')
    pickVisa('482')
    expect(screen.getByText(/没有可添加的客户了.*新建客户/)).toBeInTheDocument()
    expect(screen.queryByText(/可先在客户列表新建/)).toBeNull()
    expect(screen.getByRole('button', { name: /新建客户/ })).toBeInTheDocument()
  })

  it('「与其他案件的关系」整块已删：无任何相关文案（案件自包含，案与案无关系）', async () => {
    renderForm()
    await screen.findByLabelText('案件大类')
    expect(screen.queryByText('与其他案件的关系')).not.toBeInTheDocument()
    expect(screen.queryByText(/关联案件/)).not.toBeInTheDocument()
    expect(screen.queryByText(/独立案件/)).not.toBeInTheDocument()
    expect(screen.queryByText(/进度同步/)).not.toBeInTheDocument()
    expect(screen.queryByText(/主案件/)).not.toBeInTheDocument()
  })

  it('保存新案件：payload 不含 parent_case_id / parent_sync_progress（落库默认 null）', async () => {
    const { onSubmit } = renderForm()
    await screen.findByLabelText('案件大类')
    pickVisa('482') // 级联最短路径使保存可用
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    const values = onSubmit.mock.calls[0][0]
    expect('parent_case_id' in values).toBe(false)
    expect('parent_sync_progress' in values).toBe(false)
  })

  it('「保存并记账」（重录快捷路径）：next=fees；级联未选完时不出现（渐进披露）', async () => {
    const { onSubmit } = renderForm()
    await screen.findByLabelText('案件大类')
    expect(screen.queryByRole('button', { name: '保存并记账' })).toBeNull()
    pickVisa('482')
    const btn = screen.getByRole('button', { name: '保存并记账' })
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][2]).toBe('fees')
  })

  it('普通「保存」：next=detail，applicantIds 随表单勾选', async () => {
    const { onSubmit } = renderForm()
    await screen.findByLabelText('案件大类')
    pickVisa('482')
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSubmit.mock.calls[0][1]).toEqual([]) // 未勾选参与人
    expect(onSubmit.mock.calls[0][2]).toBe('detail')
  })

  it('加载 parent_case_id 非空的旧案件：正常渲染、可保存；提交不写 parent 字段（旧值留库不报错）', async () => {
    const { onSubmit } = renderForm(oldLinkedCase)
    await screen.findByLabelText('案件大类')
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
