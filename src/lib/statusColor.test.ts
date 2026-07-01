import { describe, expect, it } from 'vitest'
import { CASE_STAGES, LEGACY_CASE_STAGES, OCCUPATIONAL_STAGES } from '../types/domain'
import {
  EXPENSE_STATUS_LABELS,
  FLOW_STATUS_CATEGORY,
  FLOW_STATUS_LABELS,
  RECEIVABLE_STATUS_CATEGORY,
  RECEIVABLE_STATUS_LABELS,
  STAGE_CATEGORY,
  STATUS_CATEGORY_META,
  expenseStatusBadgeClass,
  flowStatusBadgeClass,
  receivableStatusBadgeClass,
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

  it('费用卡应收行状态：已收款=绿(done)、待付款=黄(action，列式录入改版)、未设=灰；徽章类同源', () => {
    expect(RECEIVABLE_STATUS_CATEGORY.settled).toBe('done')
    expect(RECEIVABLE_STATUS_CATEGORY.owing).toBe('action')
    expect(RECEIVABLE_STATUS_CATEGORY.unset).toBe('inProgress')
    expect(RECEIVABLE_STATUS_LABELS).toEqual({ unset: '未设应收', settled: '已收款', owing: '待付款' })
    // 单一来源：徽章类 = STATUS_CATEGORY_META 对应类别（已收款绿、待付款黄 #c08a2e）
    expect(receivableStatusBadgeClass('settled')).toBe(STATUS_CATEGORY_META.done.badge)
    expect(receivableStatusBadgeClass('owing')).toBe(STATUS_CATEGORY_META.action.badge)
    expect(receivableStatusBadgeClass('owing')).toContain('#c08a2e') // 黄，不是蓝/灰
  })

  it('费用卡支出行状态（收支对称两态）：待支出=琥珀(与待付款同源·action)、已支出=支出珊瑚；徽章类同源', () => {
    expect(EXPENSE_STATUS_LABELS).toEqual({ pending: '待支出', paid: '已支出' })
    // 待支出 = 需要行动（琥珀 #c08a2e），与收款侧「待付款」同一色源，对称
    expect(expenseStatusBadgeClass('pending')).toBe(STATUS_CATEGORY_META.action.badge)
    expect(expenseStatusBadgeClass('pending')).toBe(receivableStatusBadgeClass('owing'))
    expect(expenseStatusBadgeClass('pending')).toContain('#c08a2e')
    // 已支出 = 支出语义珊瑚（§9 珊瑚只在支出出现），用站内 coral 令牌底 + 珊瑚深字
    expect(expenseStatusBadgeClass('paid')).toContain('coral')
    expect(expenseStatusBadgeClass('paid')).not.toBe(expenseStatusBadgeClass('pending'))
  })

  it('职业评估 7 阶段 → 6 类色（蓝/蓝/黄/灰/绿/绿/红）单一来源，不新增颜色类', () => {
    expect(STAGE_CATEGORY.oa_chn_verification).toBe('waiting') // 蓝
    expect(STAGE_CATEGORY.oa_skill_submitted).toBe('waiting') // 蓝
    expect(STAGE_CATEGORY.oa_rfe).toBe('action') // 黄
    expect(STAGE_CATEGORY.oa_responded).toBe('inProgress') // 灰
    expect(STAGE_CATEGORY.oa_approved).toBe('done') // 绿
    expect(STAGE_CATEGORY.oa_positive).toBe('done') // 绿
    expect(STAGE_CATEGORY.oa_negative).toBe('terminated') // 红
    // 徽章/圆点经单一来源正确解析（英文名 + 状态色），不硬编码
    expect(stageBadgeClass('oa_skill_submitted')).toBe(STATUS_CATEGORY_META.waiting.badge)
    expect(stageSolidColor('oa_negative')).toBe('#b14e47') // terminated 红（statusColor 令牌）
    // 全部 7 个 OA 阶段都有归类（无漏网），且仍是 6 类色（未新增颜色）
    for (const s of OCCUPATIONAL_STAGES) expect(STATUS_CATEGORY_META[STAGE_CATEGORY[s]]).toBeTruthy()
    expect(new Set(Object.values(STATUS_CATEGORY_META).map((m) => m.badge)).size).toBe(6)
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
