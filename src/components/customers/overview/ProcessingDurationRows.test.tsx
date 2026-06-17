import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProcessingDurationRows } from './ProcessingDurationRows'
import type { ProcessingRow } from '../../../lib/processingTime'

const row = (over: Partial<ProcessingRow> = {}): ProcessingRow => ({
  flow: 'nomination',
  flowLabel: '提名',
  days: 226,
  text: '7 个月 16 天',
  status: 'approved',
  tag: '已批',
  ...over,
})

describe('ProcessingDurationRows（审理时长格 · 单行不破版，徽章绝不竖排）', () => {
  it('每段一行：标签/天数/天/徽章同行，整行 nowrap、禁止换行', () => {
    const { container } = render(<ProcessingDurationRows rows={[row()]} />)
    const lineSpan = container.querySelector('[data-testid="proc-row-nomination"]') as HTMLElement
    expect(lineSpan).toBeTruthy()
    // 整行不换行：flex 单行 + nowrap（即便回退到更宽的 CJK 字体也不内折）
    expect(lineSpan.className).toContain('whitespace-nowrap')
    expect(lineSpan.className).toContain('flex-nowrap')
  })

  it('状态徽章：横排（nowrap）且不收缩（shrink-0），永不被压成竖排', () => {
    render(<ProcessingDurationRows rows={[row()]} />)
    const badge = screen.getByText('已批')
    expect(badge.className).toContain('whitespace-nowrap')
    expect(badge.className).toContain('shrink-0')
    expect(badge.className).toContain('inline-flex')
    // 徽章配色仍走状态色源（已批=绿）
    expect(badge.className).toContain('text-emerald-700')
  })

  it('天数与「天」「提名审理」标签都不收缩（shrink-0），保证整行内容不被挤折', () => {
    const { container } = render(<ProcessingDurationRows rows={[row()]} />)
    const lineSpan = container.querySelector('[data-testid="proc-row-nomination"]') as HTMLElement
    // 行内每个原子都 shrink-0
    const atoms = Array.from(lineSpan.children) as HTMLElement[]
    expect(atoms.length).toBeGreaterThanOrEqual(4)
    for (const atom of atoms) {
      expect(atom.className).toContain('shrink-0')
    }
    // 数值仍为绿色等宽
    expect(screen.getByText('226').className).toContain('text-emerald-700')
    expect(screen.getByText('226').className).toContain('tabular-nums')
  })

  it('两段（提名+签证）各自占一行，审理中徽章为中性灰类', () => {
    render(
      <ProcessingDurationRows
        rows={[
          row(),
          row({ flow: 'visa', flowLabel: '签证', days: 102, status: 'pending', tag: '审理中', text: '3 个月 12 天' }),
        ]}
      />,
    )
    expect(screen.getByText('已批')).toBeInTheDocument()
    const pending = screen.getByText('审理中')
    expect(pending.className).toContain('mute') // 灰（statusColor 进行中类）
    expect(pending.className).toContain('whitespace-nowrap')
  })
})
