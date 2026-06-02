import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CaseOverviewSummary } from './CaseOverviewSummary'
import type { CaseStage } from '../../types/domain'
import type { CaseDocument, RecordRow } from '../../types/models'

const rec = (o: Partial<RecordRow>): RecordRow =>
  ({ id: 'r', case_id: 'c1', customer_id: 'cu1', type: 'follow_up', content: '记录内容', due_date: null, is_done: false, emoji_marker: null, created_at: '', updated_at: '', ...o }) as RecordRow
const doc = (o: Partial<CaseDocument>): CaseDocument =>
  ({ id: 'd', case_id: 'c1', customer_id: 'cu1', doc_type: 'passport', file_name: null, expiry_date: null, storage_path: null, is_archived: false, created_at: '', updated_at: '', ...o }) as CaseDocument

const base = {
  syncTracking: true,
  payTotals: { totalDue: 80000, totalPaid: 30000, totalUnpaid: 50000 },
  instTotal: 0,
  instPaid: 0,
  instPct: 0,
  records: [] as RecordRow[],
  openTasks: [] as RecordRow[],
  docs: [] as CaseDocument[],
  docCount: 0,
  currentStage: 'visa_lodged' as CaseStage,
  showTrt: false,
  trtMonths: 0,
  onTab: () => {},
}

describe('CaseOverviewSummary', () => {
  it('付款摘要：应收/已付/未付金额完整显示（不截断）', () => {
    render(<CaseOverviewSummary {...base} />)
    expect(screen.getByText('AUD 80,000.00')).toBeInTheDocument()
    expect(screen.getByText('AUD 30,000.00')).toBeInTheDocument()
    expect(screen.getByText('AUD 50,000.00')).toBeInTheDocument()
  })

  it('分期进度：有分期显示 X/Y 期', () => {
    render(<CaseOverviewSummary {...base} instTotal={3} instPaid={1} instPct={33} />)
    expect(screen.getByText('1/3 期')).toBeInTheDocument()
  })

  it('分开核算：不显示金额，给提示', () => {
    render(<CaseOverviewSummary {...base} syncTracking={false} />)
    expect(screen.queryByText('AUD 80,000.00')).toBeNull()
    expect(screen.getByText(/按申请人分开核算/)).toBeInTheDocument()
  })

  it('最近记录：有数据列出内容；空显示「暂无记录」', () => {
    const { rerender } = render(<CaseOverviewSummary {...base} records={[rec({ id: 'r1', content: '催客户补料' })]} />)
    expect(screen.getByText('催客户补料')).toBeInTheDocument()
    rerender(<CaseOverviewSummary {...base} records={[]} />)
    expect(screen.getByText('暂无记录')).toBeInTheDocument()
  })

  it('文件：显示数量与名称；空显示「暂无文件」', () => {
    render(<CaseOverviewSummary {...base} docs={[doc({ id: 'd1', file_name: '护照.pdf' })]} docCount={5} />)
    expect(screen.getByText('共 5 个')).toBeInTheDocument()
    expect(screen.getByText('护照.pdf')).toBeInTheDocument()
  })

  it('下一步：TRT / 要求补件 / 待办；都没有时「暂无待办提醒」', () => {
    const { rerender } = render(<CaseOverviewSummary {...base} showTrt trtMonths={7} />)
    expect(screen.getByText(/可办 186 TRT/)).toBeInTheDocument()
    rerender(<CaseOverviewSummary {...base} currentStage={'docs_requested' as CaseStage} />)
    expect(screen.getByText(/要求补件/)).toBeInTheDocument()
    rerender(<CaseOverviewSummary {...base} openTasks={[rec({ id: 't1', type: 'task', content: '约体检' })]} />)
    expect(screen.getByText('约体检')).toBeInTheDocument()
    rerender(<CaseOverviewSummary {...base} />)
    expect(screen.getByText('暂无待办提醒')).toBeInTheDocument()
  })

  it('空数据不崩，渲染各空态', () => {
    expect(() => render(<CaseOverviewSummary {...base} />)).not.toThrow()
    expect(screen.getByText('暂无记录')).toBeInTheDocument()
    expect(screen.getByText('暂无文件')).toBeInTheDocument()
  })

  it('「查看付款详情 / 添加记录 / 查看·上传」触发对应 tab 切换', () => {
    const onTab = vi.fn()
    render(<CaseOverviewSummary {...base} onTab={onTab} />)
    fireEvent.click(screen.getByText(/查看付款详情/))
    fireEvent.click(screen.getByText(/添加记录/))
    fireEvent.click(screen.getByText(/查看 \/ 上传/))
    expect(onTab.mock.calls.map((c) => c[0])).toEqual(['付款', '记录', '文件'])
  })
})
