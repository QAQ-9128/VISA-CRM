import { CASE_STAGE_LABELS, LODGEMENT_OUTCOME_LABELS, LODGEMENT_TYPE_LABELS } from '../types/domain'
import type { CaseStage } from '../types/domain'
import type { LodgementDerivedStatus } from './lodgementStatus'
import type { StatusCategory } from './statusColor'
import type { CaseStageHistory, Lodgement } from '../types/models'

export interface LodgementCardStatus {
  /** 是否已递交（递交日期是否存在） */
  lodged: boolean
  label: string
  /** 状态类别（颜色查 lib/statusColor 的 STATUS_CATEGORY_META，6 类全站统一） */
  category: StatusCategory
  /** 最后更新日期（lodgement.updated_at）；无 lodgement 记录则 null */
  lastUpdated: string | null
}

/**
 * 提名/签证状态卡：先看是否已递交（lodged_date 派生），再叠加派生 outcome。
 * 全部基于真实数据：未递交→待递交(紫·未开始)；已递交且待决→已递交(灰·进行中)；
 * 已批→已获批(绿)；已拒→已拒签(红)。
 */
export function lodgementCardStatus(
  lodgedDate: string | null,
  derived: LodgementDerivedStatus,
  lodgement?: Pick<Lodgement, 'updated_at'>,
): LodgementCardStatus {
  const lastUpdated = lodgement?.updated_at ? lodgement.updated_at.slice(0, 10) : null
  if (!lodgedDate) return { lodged: false, label: '待递交', category: 'todo', lastUpdated }
  if (derived === 'approved') return { lodged: true, label: '已获批', category: 'done', lastUpdated }
  if (derived === 'refused') return { lodged: true, label: '已拒签', category: 'terminated', lastUpdated }
  return { lodged: true, label: '已递交', category: 'inProgress', lastUpdated }
}

/** 递交时间线一条（由 case_stage_history + lodgement outcome 派生，全真实）。 */
export interface LodgementTimelineItem {
  id: string
  /** YYYY-MM-DD */
  date: string
  /** 阶段事件用 to_stage（渲染阶段 pill）；outcome 事件无 stage */
  stage: CaseStage | null
  title: string
  note: string | null
}

/**
 * 递交时间线：案件阶段历史（每次 stage 变更）+ lodgement 的 outcome 决定（已批/已拒/撤回 + 结果日期）。
 * 不编造额外内容；按日期倒序。
 */
export function selectLodgementTimeline(
  stageHistory: CaseStageHistory[],
  lodgements: Lodgement[],
): LodgementTimelineItem[] {
  const items: LodgementTimelineItem[] = []
  for (const h of stageHistory) {
    const date = (h.effective_at ?? h.changed_at).slice(0, 10)
    items.push({ id: `s:${h.id}`, date, stage: h.to_stage, title: CASE_STAGE_LABELS[h.to_stage], note: h.note })
  }
  for (const lg of lodgements) {
    if (lg.outcome !== 'pending' && lg.outcome_date) {
      items.push({
        id: `o:${lg.id}`,
        date: lg.outcome_date,
        stage: null,
        title: `${LODGEMENT_TYPE_LABELS[lg.type]}${LODGEMENT_OUTCOME_LABELS[lg.outcome]}`,
        note: lg.note,
      })
    }
  }
  return items.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
}
