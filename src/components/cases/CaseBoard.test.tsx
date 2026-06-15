import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { CaseBoard } from './CaseBoard'
import { selectCaseCards } from '../../lib/caseBoard'
import { CASE_STAGE_LABELS } from '../../types/domain'
import type { Case, CaseApplicant, Customer } from '../../types/models'

const mkCust = (o: Partial<Customer>): Customer => ({
  id: 'c1', full_name: '甲', chinese_name: null, english_name: null, birth_date: null, gender: null,
  passport_no: null, nationality: null, phone: null, email: null, wechat: null, address: null,
  sponsor_employer_id: null, sponsor_position: null, referrer_id: null, owner_referrer_id: null,
  primary_applicant_id: null, relationship_to_primary: null, client_source: null, is_starred: false,
  notes: null, assigned_to: null, created_by: null, is_archived: false, created_at: '', updated_at: '', ...o,
})
const mkCase = (o: Partial<Case>): Case => ({
  id: 'ca1', case_number: 'CASE-2026-014', customer_id: 'P', visa_subclass: '482', visa_stream: 'Core Skills',
  case_category: null, case_details: null, destination_country: null, sponsor_position: null, sponsor_employer_id: null,
  immi_account_id: null, current_stage: 'nomination_lodged', currency: 'AUD', sync_tracking: true,
  trt_reminder_enabled: false, trt_reminder_dismissed: false, cohab_reminder_enabled: false, cohab_reminder_last: null,
  parent_case_id: null, parent_sync_progress: false, assigned_to: null, created_by: null, is_archived: false,
  created_at: '', updated_at: '', ...o,
})

const customers = [
  mkCust({ id: 'P', chinese_name: '陈伟', english_name: 'CHEN Wei', owner_referrer_id: 'own1' }),
  mkCust({ id: 'S', chinese_name: '林陆', english_name: 'LIN Lu', relationship_to_primary: '配偶' }),
  mkCust({ id: 'W', chinese_name: '李俊豪', english_name: 'LI Junhao' }),
]
const byId = Object.fromEntries(customers.map((c) => [c.id, c]))
const caseSponsor = mkCase({ id: 'ca1', case_number: 'CASE-2026-014', customer_id: 'P', visa_subclass: '482', sponsor_position: 'Cook（厨师）ANZSCO 351111', sponsor_employer_id: 'e1' })
const caseNoSponsor = mkCase({ id: 'ca2', case_number: 'CASE-2026-021', customer_id: 'W', visa_subclass: '485', visa_stream: 'Post-Study Work' })
const applicants: CaseApplicant[] = [{ id: 'a1', case_id: 'ca1', customer_id: 'S', created_at: '' }]
const vms = selectCaseCards([caseSponsor, caseNoSponsor], byId, applicants, { e1: 'Golden Wok Pty Ltd' })

const cardOf = (caseNumber: string) => screen.getByText(caseNumber).closest('article') as HTMLElement

describe('CaseBoard（网格视图，搜索/筛选由页面共享）', () => {
  it('担保类型案件显示 职位 + 担保雇主 两行', () => {
    render(<CaseBoard vms={vms} onViewProgress={vi.fn()} />)
    const u = within(cardOf('CASE-2026-014'))
    expect(u.getByText('职位')).toBeInTheDocument()
    expect(u.getByText('Cook（厨师）ANZSCO 351111')).toBeInTheDocument()
    expect(u.getByText('担保雇主')).toBeInTheDocument()
    expect(u.getByText('Golden Wok Pty Ltd')).toBeInTheDocument()
  })

  it('无担保字段案件：只显示 签证 + 参与人，不渲染 职位/担保雇主 行、无「—」占位/无空块', () => {
    render(<CaseBoard vms={vms} onViewProgress={vi.fn()} />)
    const u = within(cardOf('CASE-2026-021'))
    expect(u.getByText('485 毕业生工签')).toBeInTheDocument()
    expect(u.queryByText('职位')).not.toBeInTheDocument()
    expect(u.queryByText('担保雇主')).not.toBeInTheDocument()
    expect(u.queryByText('—')).not.toBeInTheDocument()
    // 紧凑卡只剩 3 块：标题行 + 参与人区 + 查看进度（无担保空块）
    const card = cardOf('CASE-2026-021')
    expect(card.querySelectorAll(':scope > div').length).toBe(3)
  })

  it('「担保雇主」k 标签固定宽 + 单行不换行', () => {
    render(<CaseBoard vms={vms} onViewProgress={vi.fn()} />)
    const label = within(cardOf('CASE-2026-014')).getByText('担保雇主')
    expect(label.className).toContain('whitespace-nowrap')
    expect(label.className).toContain('w-[58px]')
  })

  it('参与人 chips 走中文名优先：主申无后缀、副申带「· 配偶」', () => {
    render(<CaseBoard vms={vms} onViewProgress={vi.fn()} />)
    const u = within(cardOf('CASE-2026-014'))
    expect(u.getAllByText('陈伟').length).toBeGreaterThan(0)
    expect(u.getByText('林陆')).toBeInTheDocument()
    expect(u.getByText('· 配偶')).toBeInTheDocument()
    expect(u.queryByText('CHEN Wei')).not.toBeInTheDocument()
  })

  it('卡片不含任何阶段 / 进度 / 金额', () => {
    render(<CaseBoard vms={vms} onViewProgress={vi.fn()} />)
    const card = cardOf('CASE-2026-014')
    expect(within(card).queryByText(CASE_STAGE_LABELS['nomination_lodged'])).not.toBeInTheDocument()
    expect(card.textContent).not.toMatch(/%|AUD|\$|进度条|审理|剩余/)
    expect(card.querySelector('progress')).toBeNull()
  })

  it('「查看进度 →」回调带 caseId（切到进度表定位由页面处理）', () => {
    const onView = vi.fn()
    render(<CaseBoard vms={vms} onViewProgress={onView} />)
    fireEvent.click(within(cardOf('CASE-2026-014')).getByRole('button', { name: '查看进度 →' }))
    expect(onView).toHaveBeenCalledWith('ca1')
  })

  it('空 vms → 空态', () => {
    render(<CaseBoard vms={[]} onViewProgress={vi.fn()} />)
    expect(screen.getByText('没有匹配的案件')).toBeInTheDocument()
  })
})
