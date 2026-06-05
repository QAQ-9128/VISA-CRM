import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MilestoneCard } from './MilestoneCard'

describe('MilestoneCard（提名/签证递交里程碑卡）', () => {
  it('未获批：显示「已过 X」距今时间，绿色（#357a52 = emerald-700）', () => {
    render(<MilestoneCard title="提名递交" date="2026-01-01" dhaDays={null} />)
    const el = screen.getByText(/已过 /)
    expect(el).toBeInTheDocument()
    expect(el.className).toContain('text-emerald-700')
  })

  it('已获批：显示绿色「提名获批」，不再显示已过天数与剩余天数', () => {
    render(<MilestoneCard title="提名递交" date="2026-01-01" dhaDays={120} approvedLabel="提名获批" />)
    const el = screen.getByText('提名获批')
    expect(el.className).toContain('text-emerald-700')
    expect(screen.queryByText(/已过 /)).toBeNull()
    expect(screen.queryByText(/剩 \d+ 天/)).toBeNull()
    expect(screen.queryByText(/已超期/)).toBeNull()
  })

  it('签证卡同理：签证获批替代时长', () => {
    render(<MilestoneCard title="签证递交" date="2026-02-01" dhaDays={null} approvedLabel="签证获批" />)
    expect(screen.getByText('签证获批').className).toContain('text-emerald-700')
    expect(screen.queryByText(/已过 /)).toBeNull()
  })

  it('无递交日期：显示「—」占位，即使传了获批标签也不显示（无递交无从获批展示）', () => {
    render(<MilestoneCard title="提名递交" date={null} dhaDays={null} approvedLabel="提名获批" />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('提名获批')).toBeNull()
  })
})
