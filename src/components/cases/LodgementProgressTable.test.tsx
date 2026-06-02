import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LodgementProgressTable } from './LodgementProgressTable'
import type { CaseRow } from '../../lib/casesTable'

const row = (over: Partial<CaseRow> = {}): CaseRow => ({
  rowKey: 'c1',
  caseId: 'c1',
  caseNumber: '12345678',
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
  nomDhaDays: null,
  visaDhaDays: null,
  updatedAt: '2026-05-20T00:00:00Z',
  ...over,
})

function renderTable(r: CaseRow) {
  return render(
    <MemoryRouter initialEntries={['/cases']}>
      <Routes>
        <Route path="/cases" element={<LodgementProgressTable rows={[r]} tasks={[]} />} />
        <Route path="/cases/:id" element={<div>CASE DETAIL</div>} />
        <Route path="/customers/:id" element={<div>CUSTOMER PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  )
}
const href = (el: HTMLElement) => el.closest('a')?.getAttribute('href')

describe('递交进度表 行内导航分区', () => {
  it('主申/副申头像名字 → 各自客户主页；案件编号 → 案件详情（不同入口）', () => {
    renderTable(row())
    expect(href(screen.getByText('李旻书'))).toBe('/customers/cu1')
    expect(href(screen.getByText('邓韬'))).toBe('/customers/cu2')
    expect(href(screen.getByText('12345678'))).toBe('/cases/c1')
  })

  it('点主申名字 → 进客户主页（不进案件）', () => {
    renderTable(row())
    fireEvent.click(screen.getByText('李旻书'))
    expect(screen.getByText('CUSTOMER PAGE')).toBeInTheDocument()
    expect(screen.queryByText('CASE DETAIL')).not.toBeInTheDocument()
  })

  it('点其它地方（签证单元格）→ 进案件详情', () => {
    renderTable(row())
    fireEvent.click(screen.getByText('482')) // 签证列，非姓名区
    expect(screen.getByText('CASE DETAIL')).toBeInTheDocument()
    expect(screen.queryByText('CUSTOMER PAGE')).not.toBeInTheDocument()
  })

  it('副申多于一位 → 不做客户链接（避免歧义），仍显示名字', () => {
    renderTable(row({ secondaryName: '邓韬、王芳', secondaryCustomerIds: ['cu2', 'cu3'] }))
    const sub = screen.getByText('邓韬、王芳')
    expect(sub.closest('a')).toBeNull()
  })
})
