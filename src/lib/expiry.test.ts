import { describe, expect, it } from 'vitest'
import { computeExpiryStatus } from './expiry'

const TODAY = new Date(2026, 0, 1) // 2026-01-01

describe('computeExpiryStatus', () => {
  it('无 expiry_date 返回 null', () => {
    expect(computeExpiryStatus(null, TODAY)).toBeNull()
  })

  it('已过期 → overdue', () => {
    const r = computeExpiryStatus('2025-12-31', TODAY)!
    expect(r.daysRemaining).toBe(-1)
    expect(r.status).toBe('overdue')
  })

  it('30 天内（含今天与第 30 天边界）→ soon', () => {
    expect(computeExpiryStatus('2026-01-01', TODAY)!.status).toBe('soon') // 0 天
    expect(computeExpiryStatus('2026-01-31', TODAY)!.status).toBe('soon') // 30 天
  })

  it('超过 30 天 → ok', () => {
    const r = computeExpiryStatus('2026-02-01', TODAY)! // 31 天
    expect(r.daysRemaining).toBe(31)
    expect(r.status).toBe('ok')
  })
})
