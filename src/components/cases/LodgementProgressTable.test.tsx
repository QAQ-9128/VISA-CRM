import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LodgementProgressTable } from './LodgementProgressTable'
import type { CaseRow } from '../../lib/casesTable'

const row = (over: Partial<CaseRow> = {}): CaseRow => ({
  rowKey: 'c1',
  caseId: 'c1',
  caseNumber: '12345678',
  groupCode: 'G-AB12',
  role: 'merged',
  primaryName: '李旻书',
  primaryCustomerId: 'cu1',
  secondaryName: '邓韬',
  secondaryCustomerIds: ['cu2'],
  visaLabel: '482/Core Skills',
  visaSubclass: '482',
  currentStage: 'visa_lodged',
  lodged: true,
  nomLodgedDate: '2026-01-01',
  visaLodgedDate: '2026-03-01',
  daysSince: 89,
  elapsed: { months: 2, days: 29 },
  nomDaysSince: 120,
  nomElapsed: { months: 4, days: 0 },
  visaDaysSince: 89,
  visaElapsed: { months: 2, days: 29 },
  frozen: false,
  nomApproved: false,
  visaGranted: false,
  nomDhaDays: null,
  visaDhaDays: null,
  updatedAt: '2026-05-20T00:00:00Z',
  ...over,
})

function renderTable(...rows: CaseRow[]) {
  return render(
    <MemoryRouter initialEntries={['/cases']}>
      <Routes>
        <Route path="/cases" element={<LodgementProgressTable rows={rows} tasks={[]} />} />
        <Route path="/cases/:id" element={<div>CASE DETAIL</div>} />
        <Route path="/customers/:id" element={<div>CUSTOMER PAGE</div>} />
        <Route path="/customers/:id/group" element={<div>GROUP PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  )
}
const href = (el: HTMLElement) => el.closest('a')?.getAttribute('href')

describe('递交进度表 参与人1/2 两列（无主/副申）+ 距今无进度条', () => {
  it('列头为「参与人1」「参与人2」，不再有 主申请/副申请', () => {
    renderTable(row())
    expect(screen.getByText('参与人1')).toBeInTheDocument()
    expect(screen.getByText('参与人2')).toBeInTheDocument()
    expect(screen.queryByText('主申请')).not.toBeInTheDocument()
    expect(screen.queryByText('副申请')).not.toBeInTheDocument()
  })

  it('两列各写名字，分别链到各自客户主页；案件编号 → 客户详情并选中该案（案件详情页已删）', () => {
    renderTable(row())
    expect(href(screen.getByText('李旻书'))).toBe('/customers/cu1')
    expect(href(screen.getByText('邓韬'))).toBe('/customers/cu2')
    expect(href(screen.getByText('12345678'))).toBe('/customers/cu1?case=c1')
  })

  it('名字超过 5 个字 → 截断显示（title 提示全名）', () => {
    renderTable(row({ primaryName: '欧阳娜娜熊猫', secondaryName: '' , secondaryCustomerIds: [] }))
    const cell = screen.getByText('欧阳娜娜熊…')
    expect(cell.closest('a')?.getAttribute('title')).toBe('欧阳娜娜熊猫')
  })

  it('只有一个参与人 → 参与人2 留空（—）', () => {
    renderTable(row({ secondaryName: '', secondaryCustomerIds: [] }))
    expect(screen.getByText('李旻书')).toBeInTheDocument()
    expect(screen.queryByText('邓韬')).not.toBeInTheDocument()
  })

  it('点参与人名字 → 进客户主页（不进案件）', () => {
    renderTable(row())
    fireEvent.click(screen.getByText('李旻书'))
    expect(screen.getByText('CUSTOMER PAGE')).toBeInTheDocument()
    expect(screen.queryByText('CASE DETAIL')).not.toBeInTheDocument()
  })

  it('参与人2 多于一位 → 不做客户链接（避免歧义），仍显示名字', () => {
    renderTable(row({ secondaryName: '邓韬、王芳', secondaryCustomerIds: ['cu2', 'cu3'] }))
    const sub = screen.getByText('邓韬、王芳')
    expect(sub.closest('a')).toBeNull()
  })

  it('组小节头行：组码 chip + 件数（一案一组，chip 为纯文本不跳转）；无独立「组」列', () => {
    renderTable(row())
    expect(screen.queryByRole('button', { name: /^组/ })).not.toBeInTheDocument() // 表头无「组」列
    const chip = screen.getByText('G-AB12')
    expect(chip.closest('a')).toBeNull() // 组=参与人集合，无单一管理页可跳
    expect(screen.getByText('· 1 件')).toBeInTheDocument()
  })

  it('同组案件相邻：排序后按组聚类（A,B,A → A,A,B），每组上方一条小节头行', () => {
    renderTable(
      // 默认按提名递交时间降序：03(c1,组A) > 02(c2,组B) > 01(c3,组A) → 聚类后 c1,c3 相邻
      row({ rowKey: 'c1', caseId: 'c1', caseNumber: '11111111', groupCode: 'G-AAAA', nomLodgedDate: '2026-01-03' }),
      row({ rowKey: 'c2', caseId: 'c2', caseNumber: '22222222', groupCode: 'G-BBBB', nomLodgedDate: '2026-01-02' }),
      row({ rowKey: 'c3', caseId: 'c3', caseNumber: '33333333', groupCode: 'G-AAAA', nomLodgedDate: '2026-01-01' }),
    )
    const nums = screen.getAllByText(/^(11111111|22222222|33333333)$/).map((el) => el.textContent)
    expect(nums).toEqual(['11111111', '33333333', '22222222'])
    // 组 ID 不重复显示：每组只有一条小节头行（chip + 件数）
    expect(screen.getAllByText('G-AAAA')).toHaveLength(1)
    expect(screen.getByText('· 2 件')).toBeInTheDocument() // G-AAAA 两件
    expect(screen.getAllByText('G-BBBB')).toHaveLength(1)
    expect(screen.getByText('· 1 件')).toBeInTheDocument() // G-BBBB 一件
  })

  it('点其它地方（签证单元格）→ 进客户详情并选中该案（案件详情页已删）', () => {
    renderTable(row())
    fireEvent.click(screen.getByText('482')) // 签证列，非姓名区
    expect(screen.getByText('CUSTOMER PAGE')).toBeInTheDocument()
  })

  it('提名距今/签证距今 只显示时间文字，不再画进度条', () => {
    const { container } = renderTable(row())
    expect(screen.getByText('4 个月 0 天')).toBeInTheDocument()
    expect(screen.getByText('2 个月 29 天')).toBeInTheDocument()
    // 旧进度条轨道是 h-1.5 圆角条 → 现在整表不应再有（Avatar 的内联 width 不算）
    expect(container.querySelectorAll('[class*="h-1.5"]').length).toBe(0)
  })
})

describe('距今列：获批替代时长 + 时间统一绿色', () => {
  it('下签案件：提名/签证距今都显示绿色「获批」标签，不再显示天数', () => {
    renderTable(row({ currentStage: 'granted', frozen: true, nomApproved: true, visaGranted: true }))
    expect(screen.getByText('提名获批').className).toContain('text-emerald-700')
    expect(screen.getByText('签证获批').className).toContain('text-emerald-700')
    expect(screen.queryByText('4 个月 0 天')).toBeNull()
    expect(screen.queryByText('2 个月 29 天')).toBeNull()
  })

  it('仅提名获批：提名列「提名获批」（绿），签证列照常显示距今时间', () => {
    renderTable(row({ currentStage: 'nomination_approved', nomApproved: true }))
    // 「提名获批」出现两处：状态列 StageBadge + 距今列绿色标签；断言距今列那只（emerald-700）
    const labels = screen.getAllByText('提名获批')
    expect(labels.some((el) => el.className.includes('text-emerald-700'))).toBe(true)
    expect(screen.queryByText('签证获批')).toBeNull()
    expect(screen.getByText('2 个月 29 天')).toBeInTheDocument()
  })

  it('未获批：距今时间统一绿色（#357a52），不再有橙/灰分级；冻结(拒签)也为绿', () => {
    const { container } = renderTable(
      row(), // 4 个月 → 旧逻辑为琥珀
      row({ rowKey: 'c2', caseId: 'c2', caseNumber: '22222222', currentStage: 'refused', frozen: true, nomDaysSince: 200, nomElapsed: { months: 6, days: 20 }, visaDaysSince: null, visaElapsed: null, visaLodgedDate: null }), // 6+ 月 → 旧逻辑为红；冻结旧为灰
    )
    expect(screen.getByText('4 个月 0 天').className).toContain('text-emerald-700')
    expect(screen.getByText('6 个月 20 天').className).toContain('text-emerald-700')
    expect(container.querySelectorAll('[class*="text-amber-500"], [class*="text-rose-500"], [class*="text-emerald-500"]').length).toBe(0)
  })

  it('无提名递交（selector 给 nomApproved=false）：距今列「—」保持中性灰（text-faint），不变绿', () => {
    renderTable(row({ nomDaysSince: null, nomElapsed: null, nomLodgedDate: null }))
    const dashes = screen.getAllByText('—')
    expect(dashes.some((el) => el.className.includes('text-faint'))).toBe(true)
    expect(screen.queryByText('提名获批')).toBeNull()
  })
})
