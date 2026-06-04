import { describe, expect, it } from 'vitest'
import { CASE_STAGES, CASE_STAGE_COLOR, CASE_STAGE_STYLES } from './domain'

describe('阶段配色：每个阶段一色（阶段进展链 / 流转记录 / 徽章共用，不允许撞色）', () => {
  it('CASE_STAGE_STYLES：11 个正式阶段的类名互不重复', () => {
    const styles = CASE_STAGES.map((s) => CASE_STAGE_STYLES[s])
    expect(new Set(styles).size).toBe(CASE_STAGES.length)
  })

  it('CASE_STAGE_COLOR：11 个正式阶段的实色互不重复', () => {
    const colors = CASE_STAGES.map((s) => CASE_STAGE_COLOR[s])
    expect(new Set(colors).size).toBe(CASE_STAGES.length)
  })
})
