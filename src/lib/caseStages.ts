import { CASE_STAGES, OCCUPATIONAL_STAGES, DE_FACTO_STAGES } from '../types/domain'
import type { CaseStage } from '../types/domain'

/**
 * 案件大类 → 「切换到」阶段集合（单一来源）。
 *   - 职业评估（'职业评估'）→ OCCUPATIONAL_STAGES（专属 7 阶段，英文显示）；
 *   - De Facto 关系认定 → DE_FACTO_STAGES（专属 6 阶段，中英混排显示）；
 *   - 其它（签证申请 / 定制文件 / 旧案件空大类）→ 通用 CASE_STAGES（签证流程，零改动）。
 * 只读返回，调用方不可变更。
 */
export function stagesForCategory(category: string | null | undefined): readonly CaseStage[] {
  if (category === '职业评估') return OCCUPATIONAL_STAGES
  if (category === 'De Facto 关系认定') return DE_FACTO_STAGES
  return CASE_STAGES
}

/** 是否职业评估大类（表单条件隐藏账号/组、阶段集合切换等共用判定）。 */
export const isOccupationalCategory = (category: string | null | undefined): boolean =>
  category === '职业评估'

/** 是否 De Facto 关系认定大类（表单隐藏账号·留组、阶段集合切换等共用判定）。 */
export const isDeFactoCategory = (category: string | null | undefined): boolean =>
  category === 'De Facto 关系认定'

/**
 * 该大类是否用「专属阶段集合 + FancySelect 圆点下拉」（职业评估 / De Facto）。
 * 控制 StageControl 的下拉样式与「不前置集合外当前值」逻辑；签证类（通用 CASE_STAGES）恒 false。
 */
export const usesFancyStageSelect = (category: string | null | undefined): boolean =>
  isOccupationalCategory(category) || isDeFactoCategory(category)

/**
 * 新建案件的初始当前阶段：De Facto → 'df_prep'（同居关系材料准备＝自然起始态，写入 current_stage）；
 * 其它大类 → null（不预设，用 DB 默认 'todo'；职业评估据此显示「无」直到推进）。
 */
export function initialStageForCategory(category: string | null | undefined): CaseStage | null {
  return isDeFactoCategory(category) ? 'df_prep' : null
}

/**
 * 职业评估案件「当前阶段未推进」判定：**职业评估没有「待办」阶段**，新建用 DB 默认（todo 等非 OA 值），
 * 当 current 不在 7 个 OA 阶段内时，当前阶段一律显示「无」（推进到某个 OA 阶段后才显示具体阶段）。
 * 仅对职业评估生效；签证类恒返回 false（其阶段照常显示）。
 */
export function isUnsetOccupationalStage(
  category: string | null | undefined,
  stage: string | null | undefined,
): boolean {
  return isOccupationalCategory(category) && !(OCCUPATIONAL_STAGES as readonly string[]).includes(stage ?? '')
}
