import { describe, expect, it } from 'vitest'
import { computeLodgementProgress } from './lodgementProgress'

const TODAY = new Date(2026, 0, 1) // 固定 today = 2026-01-01，便于推算天数

describe('computeLodgementProgress', () => {
  it('缺 lodged_date 或 dha_processing_days 返回 null', () => {
    expect(computeLodgementProgress(null, 100, TODAY)).toBeNull()
    expect(computeLodgementProgress('2026-01-01', null, TODAY)).toBeNull()
    expect(computeLodgementProgress('2026-01-01', 0, TODAY)).toBeNull()
  })

  it('剩余 >50% → 绿', () => {
    // 总 100 天，已过 10 天 → 剩 90，ratio 0.9
    const p = computeLodgementProgress('2025-12-22', 100, TODAY)!
    expect(p.daysElapsed).toBe(10)
    expect(p.daysRemaining).toBe(90)
    expect(p.totalDays).toBe(100)
    expect(p.color).toBe('green')
    expect(p.isOverdue).toBe(false)
  })

  it('剩余 20–50% → 黄', () => {
    // 已过 60 天 → 剩 40，ratio 0.4
    const p = computeLodgementProgress('2025-11-02', 100, TODAY)!
    expect(p.daysRemaining).toBe(40)
    expect(p.color).toBe('yellow')
  })

  it('剩余 <20% → 红', () => {
    // 已过 85 天 → 剩 15，ratio 0.15
    const p = computeLodgementProgress('2025-10-08', 100, TODAY)!
    expect(p.daysRemaining).toBe(15)
    expect(p.color).toBe('red')
  })

  it('已超期 → 红 + isOverdue', () => {
    // 已过 110 天 → 剩 -10
    const p = computeLodgementProgress('2025-09-13', 100, TODAY)!
    expect(p.daysRemaining).toBe(-10)
    expect(p.color).toBe('red')
    expect(p.isOverdue).toBe(true)
  })

  it('percentElapsed 限制在 0–100', () => {
    const over = computeLodgementProgress('2025-09-13', 100, TODAY)! // 110/100
    expect(over.percentElapsed).toBe(100)
    const fresh = computeLodgementProgress('2026-01-01', 100, TODAY)! // 0 天
    expect(fresh.percentElapsed).toBe(0)
  })
})
