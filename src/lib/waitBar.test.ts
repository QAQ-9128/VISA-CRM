import { describe, expect, it } from 'vitest'
import { computeWaitBar } from './waitBar'

describe('computeWaitBar', () => {
  it('不足 3 个月 → 绿色(ok)，宽度按 月/8', () => {
    expect(computeWaitBar(0)).toEqual({ tone: 'ok', pct: 0 })
    expect(computeWaitBar(30)).toEqual({ tone: 'ok', pct: 13 }) // 1 月 → 12.5→13
    expect(computeWaitBar(89)).toMatchObject({ tone: 'ok' }) // 2.97 月
  })

  it('3–6 个月 → 琥珀(soon)，含 3 月整边界', () => {
    expect(computeWaitBar(90)).toMatchObject({ tone: 'soon' }) // 恰好 3 月
    expect(computeWaitBar(150)).toEqual({ tone: 'soon', pct: 63 }) // 5 月 → 62.5→63
    expect(computeWaitBar(179)).toMatchObject({ tone: 'soon' }) // 5.97 月
  })

  it('≥6 个月 → 红色(over)，含 6 月整边界', () => {
    expect(computeWaitBar(180)).toMatchObject({ tone: 'over' }) // 恰好 6 月
    expect(computeWaitBar(210)).toMatchObject({ tone: 'over' }) // 7 月
  })

  it('宽度按 月数/8 封顶 100%', () => {
    expect(computeWaitBar(240).pct).toBe(100) // 8 月 = 满
    expect(computeWaitBar(600).pct).toBe(100) // 20 月仍封顶
  })

  it('负数(未递交哨兵)与 0 都给 0% 宽度，不报错', () => {
    expect(computeWaitBar(-1).pct).toBe(0)
    expect(computeWaitBar(-1).tone).toBe('ok')
  })
})
