import { describe, expect, it } from 'vitest'
import { CASE_STAGES, LEGACY_CASE_STAGES } from '../types/domain'
import {
  FLOW_STATUS_CATEGORY,
  FLOW_STATUS_LABELS,
  STAGE_CATEGORY,
  STATUS_CATEGORY_META,
  flowStatusBadgeClass,
  stageBadgeClass,
  stageCategory,
  stageSolidColor,
} from './statusColor'

describe('statusColor · 状态 6 类配色单一来源（全站状态徽章统一查这里）', () => {
  it('定稿映射：紫=待办、蓝=等待外部、灰=进行中/已递交、黄=需要行动、绿=完成/获批、红=终止', () => {
    expect(STAGE_CATEGORY.todo).toBe('todo') // 紫
    expect(STAGE_CATEGORY.awaiting_payment).toBe('waiting') // 蓝
    expect(STAGE_CATEGORY.nomination_lodged).toBe('inProgress') // 灰
    expect(STAGE_CATEGORY.visa_lodged).toBe('inProgress')
    expect(STAGE_CATEGORY.docs_requested).toBe('action') // 黄
    expect(STAGE_CATEGORY.additional_docs).toBe('action') // 旧「补件」
    expect(STAGE_CATEGORY.nomination_approved).toBe('done') // 绿
    expect(STAGE_CATEGORY.granted).toBe('done')
    expect(STAGE_CATEGORY.refused).toBe('terminated') // 红
    expect(STAGE_CATEGORY.withdrawn).toBe('terminated')
  })

  it('表里没列到的状态就近归类：已草拟/补件完毕=进行中；上诉复议=需要行动（存疑项，待用户确认）', () => {
    expect(STAGE_CATEGORY.drafted).toBe('inProgress')
    expect(STAGE_CATEGORY.docs_completed).toBe('inProgress')
    expect(STAGE_CATEGORY.appeal).toBe('action')
  })

  it('同类多状态共用一色；6 类色互不相同', () => {
    expect(stageSolidColor('nomination_lodged')).toBe(stageSolidColor('visa_lodged'))
    expect(stageBadgeClass('granted')).toBe(stageBadgeClass('nomination_approved'))
    expect(stageBadgeClass('refused')).toBe(stageBadgeClass('withdrawn'))
    expect(new Set(Object.values(STATUS_CATEGORY_META).map((m) => m.solid)).size).toBe(6)
    expect(new Set(Object.values(STATUS_CATEGORY_META).map((m) => m.badge)).size).toBe(6)
  })

  it('全部正式 + 遗留阶段都有归类（无漏网）', () => {
    for (const s of [...CASE_STAGES, ...LEGACY_CASE_STAGES]) {
      expect(STAGE_CATEGORY[s], s).toBeTruthy()
      expect(STATUS_CATEGORY_META[STAGE_CATEGORY[s]]).toBeTruthy()
    }
  })

  it('提名/签证状态（审理时长两列 + 里程碑卡）：审理中=灰、获批=绿、已拒=红，文案同源', () => {
    expect(FLOW_STATUS_CATEGORY.pending).toBe('inProgress')
    expect(FLOW_STATUS_CATEGORY.approved).toBe('done')
    expect(FLOW_STATUS_CATEGORY.refused).toBe('terminated')
    expect(FLOW_STATUS_LABELS).toEqual({ pending: '审理中', approved: '获批', refused: '已拒' })
    expect(flowStatusBadgeClass('pending')).toBe(STATUS_CATEGORY_META.inProgress.badge)
    expect(flowStatusBadgeClass('approved')).toBe(STATUS_CATEGORY_META.done.badge)
  })

  it('未知状态兜底 → 灰（进行中）', () => {
    expect(stageCategory('mystery_stage')).toBe('inProgress')
    expect(stageBadgeClass('mystery_stage')).toBe(STATUS_CATEGORY_META.inProgress.badge)
  })

  it('色值取站内令牌：绿=emerald-700(#357a52)、红=rose-700(#b14e47)、灰=mute 令牌(#7e887e)', () => {
    expect(STATUS_CATEGORY_META.done.solid).toBe('#357a52')
    expect(STATUS_CATEGORY_META.done.badge).toContain('emerald')
    expect(STATUS_CATEGORY_META.terminated.solid).toBe('#b14e47')
    expect(STATUS_CATEGORY_META.terminated.badge).toContain('rose')
    expect(STATUS_CATEGORY_META.inProgress.solid).toBe('#7e887e')
    expect(STATUS_CATEGORY_META.inProgress.badge).toContain('mute')
    expect(STATUS_CATEGORY_META.todo.solid).toBe('#7c6fd6')
    expect(STATUS_CATEGORY_META.waiting.solid).toBe('#3f7cb5')
    expect(STATUS_CATEGORY_META.action.solid).toBe('#c08a2e')
  })
})
