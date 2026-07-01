import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
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
  nomStatus: 'pending',
  visaStatus: 'pending',
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

  it('签证子类别为空 → 类型 chip 下方不渲染「—」占位；非空照常显示副行', () => {
    renderTable(row({ visaLabel: '186', visaSubclass: '186' }))
    const cell = screen.getByText('186').closest('td')!
    expect(within(cell).queryByText('—')).toBeNull()
  })

  it('签证子类别非空 → chip 下方显示该副值', () => {
    renderTable(row()) // visaLabel '482/Core Skills'
    const cell = screen.getByText('482').closest('td')!
    expect(within(cell).getByText('Core Skills')).toBeInTheDocument()
  })

  it('审理时长列只显示时间文字，不再画进度条', () => {
    const { container } = renderTable(row())
    expect(screen.getByText('4 个月 0 天')).toBeInTheDocument()
    expect(screen.getByText('2 个月 29 天')).toBeInTheDocument()
    // 旧进度条轨道是 h-1.5 圆角条 → 现在整表不应再有（Avatar 的内联 width 不算）
    expect(container.querySelectorAll('[class*="h-1.5"]').length).toBe(0)
  })
})

describe('审理时长列（常显 + 获批定格）+ 提名/签证状态列', () => {
  it('两层表头：提名/签证分组标签 + 子列（递交时间/审理时长/状态 各两枚），不再有「距今」', () => {
    renderTable(row())
    // 上层分组标签
    expect(screen.getByText('提名 · Nomination')).toBeInTheDocument()
    expect(screen.getByText('签证 · Visa')).toBeInTheDocument()
    // 下层子列：提名 + 签证 各一套 → 每个出现两次；当前状态独立
    expect(screen.getAllByText('递交时间')).toHaveLength(2)
    expect(screen.getAllByText('审理时长')).toHaveLength(2)
    expect(screen.getAllByText('状态')).toHaveLength(2)
    expect(screen.getByText('当前状态')).toBeInTheDocument()
    expect(screen.queryByText('提名距今')).toBeNull()
    expect(screen.queryByText('签证距今')).toBeNull()
  })

  it('下签案件：时长仍显示（绿、定格值），不再被「获批」字样替换；状态列两枚绿色「获批」徽章', () => {
    renderTable(
      row({ currentStage: 'granted', frozen: true, nomApproved: true, visaGranted: true, nomStatus: 'approved', visaStatus: 'approved' }),
    )
    expect(screen.getByText('4 个月 0 天').className).toContain('text-emerald-700')
    expect(screen.getByText('2 个月 29 天').className).toContain('text-emerald-700')
    expect(screen.queryByText('提名获批')).toBeNull()
    expect(screen.queryByText('签证获批')).toBeNull()
    const badges = screen.getAllByText('获批')
    expect(badges).toHaveLength(2)
    expect(badges.every((el) => el.className.includes('text-emerald-700'))).toBe(true)
  })

  it('审理中：灰（进行中类别，statusColor 单一来源），时长数值照常绿色（两者不混）', () => {
    renderTable(row({ visaStatus: 'pending', nomStatus: 'approved' }))
    const pending = screen.getByText('审理中')
    expect(pending.className).toContain('mute') // 灰类徽章（--color-mute-bg/tx 令牌）
    expect(pending.className).not.toContain('blue')
    expect(screen.getByText('获批').className).toContain('text-emerald-700')
    expect(screen.getByText('2 个月 29 天').className).toContain('text-emerald-700')
  })

  it('未获批：时长统一绿色，不按时长分级橙/红；冻结(拒签)值也为绿', () => {
    const { container } = renderTable(
      row(),
      row({ rowKey: 'c2', caseId: 'c2', caseNumber: '22222222', currentStage: 'refused', frozen: true, nomDaysSince: 200, nomElapsed: { months: 6, days: 20 }, nomStatus: 'refused', visaDaysSince: null, visaElapsed: null, visaLodgedDate: null, visaStatus: null }),
    )
    expect(screen.getByText('4 个月 0 天').className).toContain('text-emerald-700')
    expect(screen.getByText('6 个月 20 天').className).toContain('text-emerald-700')
    expect(container.querySelectorAll('[class*="text-amber-500"], [class*="text-rose-500"], [class*="text-emerald-500"]').length).toBe(0)
    // 被拒流程：玫红「已拒」徽章
    expect(screen.getByText('已拒').className).toContain('text-rose-700')
  })

  it('无提名递交：时长与状态都显示「—」（中性灰）', () => {
    renderTable(row({ nomDaysSince: null, nomElapsed: null, nomLodgedDate: null, nomStatus: null }))
    const dashes = screen.getAllByText('—')
    expect(dashes.some((el) => el.className.includes('text-faint'))).toBe(true)
    expect(screen.queryByText('提名获批')).toBeNull()
  })
})
