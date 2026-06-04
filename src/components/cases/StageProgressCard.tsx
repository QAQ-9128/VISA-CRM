import { useMemo, useState } from 'react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { StageControl } from './StageControl'
import { StageTimeline } from './StageTimeline'
import { useCaseStageHistory } from '../../hooks/queries/useCases'
import { selectStagePath } from '../../lib/stagePath'
import { CASE_STAGE_COLOR, CASE_STAGE_LABELS, CASE_STAGE_STYLES } from '../../types/domain'
import type { Case } from '../../types/models'

/**
 * 「阶段进展」卡 —— 案件详情页与客户详情页共用（UI 一模一样）：
 *   真实非线性阶段链（只画 case_stage_history 走过的节点，绝不线性填充）
 *   + 「推进阶段 →」展开 StageControl（一份进度全员共享，无任何锁定）
 *   + 「阶段流转记录」StageTimeline。
 * 切换案件时请在使用处加 key={caseRow.id}，保证内部状态随案件重置。
 */
export function StageProgressCard({ caseRow }: { caseRow: Case }) {
  const history = useCaseStageHistory(caseRow.id)
  const [advancing, setAdvancing] = useState(false)
  const hist = useMemo(() => history.data ?? [], [history.data])
  const stagePath = useMemo(() => selectStagePath(hist, caseRow.current_stage), [hist, caseRow.current_stage])
  const lastIdx = stagePath.length - 1

  return (
    <Card>
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="border-l-[3px] border-brand pl-2 font-serif text-[16px] font-bold text-ink">阶段进展</h2>
        <span className="text-[12px] font-medium text-faint">按实际记录，没走的阶段不显示</span>
      </div>

      {/* 真实流转链（非线性）：节点 = 实际走过的阶段 + 实际日期；每个阶段一色（CASE_STAGE_STYLES），当前节点同色描边高亮 */}
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        {stagePath.map((n, i) => (
          <span key={`${n.stage}-${i}`} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden className="text-line-2">→</span>}
            <span
              className={`rounded-[12px] px-3 py-1.5 text-center ${CASE_STAGE_STYLES[n.stage] ?? 'bg-surface-2 text-body'} ${
                i === lastIdx ? 'border-2 shadow-soft' : ''
              }`}
              style={i === lastIdx ? { borderColor: CASE_STAGE_COLOR[n.stage] } : undefined}
            >
              <span className="block text-[13.5px] font-bold">{CASE_STAGE_LABELS[n.stage]}</span>
              <span className="block text-[11px] font-medium opacity-75 tabular-nums">
                {i === lastIdx ? `当前${n.date ? ` · ${n.date}` : ''}` : n.date ?? ''}
              </span>
            </span>
          </span>
        ))}
      </div>

      {/* 推进阶段：展开切换表单（任意阶段含拒签/撤签 + 实际日期默认今天可补录） */}
      <div className="mt-4">
        {advancing ? (
          <div>
            <StageControl caseId={caseRow.id} currentStage={caseRow.current_stage} />
            <button type="button" onClick={() => setAdvancing(false)} className="mt-2 text-[12.5px] font-semibold text-muted hover:text-ink">
              收起
            </button>
          </div>
        ) : (
          <Button onClick={() => setAdvancing(true)}>推进阶段 →</Button>
        )}
      </div>

      {/* 阶段流转记录（真实历史） */}
      <div className="mt-4 border-t border-line pt-3">
        <h3 className="text-[13.5px] font-bold text-ink">阶段流转记录</h3>
        <div className="mt-2">
          <StageTimeline caseId={caseRow.id} />
        </div>
      </div>
    </Card>
  )
}
