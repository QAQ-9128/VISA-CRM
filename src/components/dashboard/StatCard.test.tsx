import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCard } from './StatCard'

describe('StatCard（趋势 chip 仅在传入 trend 时渲染）', () => {
  it('不传 trend（如本月收款为 0 时）→ 不渲染任何趋势 chip', () => {
    render(<StatCard icon={<span />} label="本月收款 (AUD)" value="AUD 0.00" />)
    expect(screen.getByText('AUD 0.00')).toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
    expect(screen.queryByText(/↓|↑|→/)).not.toBeInTheDocument()
  })

  it('传 trend → 渲染涨跌 chip', () => {
    render(<StatCard icon={<span />} label="本月收款 (AUD)" value="AUD 4,800.00" trend={{ pct: 8.2, dir: 'up' }} />)
    expect(screen.getByText(/8\.2%/)).toBeInTheDocument()
  })
})
