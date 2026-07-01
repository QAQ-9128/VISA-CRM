import { useState } from 'react'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import { FancySelect } from '../ui/FancySelect'
import type { FancyOption } from '../ui/FancySelect'
import { StageBadge } from './StageBadge'
import { useUpdateCaseStage } from '../../hooks/queries/useCases'
import { replaceDateKeepTime } from '../../lib/stageHistory'
import { todayYmd, isFutureYmd } from '../../lib/dateRules'
import { stagesForCategory, isOccupationalCategory, usesFancyStageSelect } from '../../lib/caseStages'
import { stageSolidColor } from '../../lib/statusColor'
import { toastError } from '../../store/ui'
import { CASE_STAGE_LABELS } from '../../types/domain'
import type { CaseStage } from '../../types/domain'

/** 阶段流转：选择新阶段 + 可填备注 → 写入 case_stage_history。
 *  一案一组：一份进度全员共享，无任何锁定/同步态——随时可编辑。
 *  阶段集合按案件大类切换（职业评估专属 7 阶段 + FancySelect 圆点/打勾；签证类沿用 CASE_STAGES + 原生 Select）。 */
export function StageControl({
  caseId,
  currentStage,
  caseCategory,
}: {
  caseId: string
  currentStage: CaseStage
  /** 案件大类（cases.case_category）：决定「切换到」阶段集合与下拉样式。 */
  caseCategory?: string | null
}) {
  const [stage, setStage] = useState<CaseStage>(currentStage)
  const [note, setNote] = useState('')
  const [effDate, setEffDate] = useState(todayYmd)
  const mutation = useUpdateCaseStage()

  const changed = stage !== currentStage
  const isOccupational = isOccupationalCategory(caseCategory)
  // 专属阶段大类（职业评估 / De Facto）用 FancySelect 圆点下拉，且绝不前置集合外当前值。
  const useFancy = usesFancyStageSelect(caseCategory)
  // 下拉列出该大类的阶段集合。
  // 签证类：若当前停在集合外的旧值（如旧「补件」additional_docs），把它补到最前以便显示/可切走。
  // 职业评估 / De Facto：下拉恒为各自专属阶段集合，绝不前置集合外值（旧库里若有此类案停在 'todo' 也不混进来）；
  //          当前若不在集合则触发器显占位、由用户直接选目标阶段（De Facto 新建已默认 df_prep，恒在集合内）。
  const stageSet = stagesForCategory(caseCategory)
  const isListed = (stageSet as readonly string[]).includes(currentStage)
  const options = [
    ...(!useFancy && !isListed ? [{ value: currentStage, label: CASE_STAGE_LABELS[currentStage] }] : []),
    ...stageSet.map((s) => ({ value: s, label: CASE_STAGE_LABELS[s] })),
  ]
  // 专属阶段：FancySelect 选项 = label + 状态色圆点（选中打勾由 FancySelect 自带）。
  const fancyOptions: FancyOption[] = options.map((o) => ({
    value: o.value,
    label: o.label,
    tag: (
      <span className="flex items-center gap-2.5">
        <span className="size-2.5 shrink-0 rounded-full" style={{ background: stageSolidColor(o.value as CaseStage) }} />
        <span>{o.label}</span>
      </span>
    ),
  }))

  function apply() {
    if (!changed) return
    // 阶段记录的是已发生的事 → 禁未来日期（max 属性 + 此处兜底拦手输）
    if (isFutureYmd(effDate)) {
      toastError('实际发生日期不能是未来——阶段记录的是已发生的事')
      return
    }
    // 实际发生时间：用所填日期 + 当前时分秒（默认今天=现在）
    const effectiveAt = effDate ? replaceDateKeepTime(new Date().toISOString(), effDate) : null
    // 职业评估没有「待办」：从未推进态（current 不在 7 个 OA 阶段内，如默认 'todo'）首次选阶段时，
    // from_stage 写 null → 流转记录直接显示目标阶段，而非「待办 → 某阶段」。签证类照旧传当前阶段。
    const fromStage = isOccupational && !isListed ? null : currentStage
    mutation.mutate(
      { caseId, fromStage, toStage: stage, note: note.trim() || null, effectiveAt },
      { onSuccess: () => setNote('') },
    )
  }

  return (
    <div className="space-y-3 rounded-card bg-white p-[22px] shadow-soft">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted">当前阶段</span>
        {/* 职业评估没有「待办」：未推进（current 不在 7 个 OA 阶段内）→ 显示「无」，推进后才显具体阶段 */}
        {isOccupational && !isListed ? (
          <span className="text-sm font-medium text-faint">无</span>
        ) : (
          <StageBadge stage={currentStage} />
        )}
      </div>

      <fieldset className="space-y-3">
        {useFancy ? (
          <div className="space-y-1.5">
            <span className="block text-sm font-semibold text-body">切换到</span>
            <FancySelect
              ariaLabel="切换到"
              value={stage}
              onChange={(v) => setStage(v as CaseStage)}
              options={fancyOptions}
              placeholder="选择阶段"
            />
          </div>
        ) : (
          <Select
            label="切换到"
            options={options}
            value={stage}
            onChange={(e) => setStage(e.target.value as CaseStage)}
          />
        )}
        {/* 备注常驻：推进到任意阶段都可填备注（可选，记入时间线）。不放示例占位文案，留空即可。 */}
        <TextField
          label="备注（可选，记入时间线）"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <TextField
          label="实际发生日期（默认今天，可补录过去，不能选未来）"
          type="date"
          max={todayYmd()}
          value={effDate}
          onChange={(e) => setEffDate(e.target.value)}
        />
        <Button onClick={apply} disabled={!changed || mutation.isPending}>
          {mutation.isPending ? '更新中…' : '更新阶段'}
        </Button>
      </fieldset>

      {mutation.isError && (
        <p className="text-sm text-rose-700">
          {mutation.error instanceof Error ? mutation.error.message : '更新失败'}
        </p>
      )}
    </div>
  )
}
