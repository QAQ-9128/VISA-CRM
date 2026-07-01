import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MilestoneCard, OccupationalDurationCard } from './MilestoneCard'
import type { FlowProcessing } from '../../../lib/casesTable'
import { CASE_STAGE_LABELS } from '../../../types/domain'

const processing = (over: Partial<FlowProcessing> = {}): FlowProcessing => ({
  lodged: '2026-01-01',
  approved: false,
  daysSince: 96,
  elapsed: { months: 3, days: 6 },
  ...over,
})

describe('MilestoneCard（提名/签证递交里程碑卡 · 审理时长+状态，与进度表同一来源口径）', () => {
  it('审理中：显示「审理时长」绿色数值 + 灰色「审理中」徽章 + DHA 剩余/超期行', () => {
    render(<MilestoneCard title="签证递交" dhaDays={120} processing={processing()} status="pending" />)
    const dur = screen.getByText('3 个月 6 天')
    expect(dur.className).toContain('text-emerald-700')
    expect(screen.getByText(/审理时长/)).toBeInTheDocument()
    const badge = screen.getByText('审理中')
    expect(badge.className).toContain('mute') // 灰（statusColor 进行中类）
    // DHA 对照行仍在（按真实今天算剩余/超期；2026-01-01 + 120 天已过 → 超期形态）
    expect(screen.getByText(/剩 \d+ 天|已超期 \d+ 天/)).toBeInTheDocument()
  })

  it('已获批：时长定格仍显示（绿）+ 绿色「获批」徽章；不再有「提名获批」字样与剩余天数', () => {
    render(
      <MilestoneCard
        title="提名递交"
        dhaDays={120}
        processing={processing({ approved: true, daysSince: 45, elapsed: { months: 1, days: 15 } })}
        status="approved"
      />,
    )
    expect(screen.getByText('1 个月 15 天').className).toContain('text-emerald-700')
    const badge = screen.getByText('获批')
    expect(badge.className).toContain('text-emerald-700')
    expect(screen.queryByText('提名获批')).toBeNull()
    expect(screen.queryByText(/已过 /)).toBeNull()
    expect(screen.queryByText(/剩 \d+ 天/)).toBeNull()
    expect(screen.queryByText(/已超期/)).toBeNull()
  })

  it('已拒：玫红「已拒」徽章，时长（冻结值）仍显示', () => {
    render(
      <MilestoneCard
        title="提名递交"
        dhaDays={null}
        processing={processing({ daysSince: 59, elapsed: { months: 1, days: 29 } })}
        status="refused"
      />,
    )
    expect(screen.getByText('已拒').className).toContain('text-rose-700')
    expect(screen.getByText('1 个月 29 天')).toBeInTheDocument()
  })

  it('已拒 + 有 DHA 天数：不再显示按今天实时累计的「剩/已超期」行（时长已冻结，超期天数不应继续上涨）', () => {
    render(
      <MilestoneCard
        title="签证递交"
        dhaDays={120}
        processing={processing({ daysSince: 59, elapsed: { months: 1, days: 29 } })}
        status="refused"
      />,
    )
    expect(screen.queryByText(/剩 \d+ 天/)).toBeNull()
    expect(screen.queryByText(/已超期/)).toBeNull()
  })

  it('无递交日期：日期与时长显示「—」，无状态徽章、无时长行', () => {
    render(
      <MilestoneCard
        title="提名递交"
        dhaDays={null}
        processing={processing({ lodged: null, daysSince: null, elapsed: null })}
        status={null}
      />,
    )
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('审理中')).toBeNull()
    expect(screen.queryByText(/审理时长/)).toBeNull()
  })
})

describe('OccupationalDurationCard（职业评估审理时长两段卡 · §5）', () => {
  it('仍在该阶段(ongoing)：英文标题 + 大数(N 天) + 「自 起 · 处理中」', () => {
    render(
      <OccupationalDurationCard
        title={CASE_STAGE_LABELS.oa_skill_submitted}
        stage="oa_skill_submitted"
        duration={{ start: '2026-06-10', days: 20, ongoing: true }}
      />,
    )
    expect(screen.getByText('Skill Assessment Submitted')).toBeInTheDocument()
    expect(screen.getByText('20 天')).toBeInTheDocument()
    expect(screen.getByText(/自 2026-06-10 起 · 处理中/)).toBeInTheDocument()
  })

  it('已冻结(已用时)：副说明显示「已用时」而非「处理中」', () => {
    render(
      <OccupationalDurationCard
        title={CASE_STAGE_LABELS.oa_chn_verification}
        stage="oa_chn_verification"
        duration={{ start: '2026-05-12', days: 29, ongoing: false }}
      />,
    )
    expect(screen.getByText('29 天')).toBeInTheDocument()
    expect(screen.getByText(/已用时/)).toBeInTheDocument()
    expect(screen.queryByText(/处理中/)).toBeNull()
  })

  it('未发生(null)：大数「—」+ 副「未发生」', () => {
    render(
      <OccupationalDurationCard title={CASE_STAGE_LABELS.oa_chn_verification} stage="oa_chn_verification" duration={null} />,
    )
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('未发生')).toBeInTheDocument()
  })
})
