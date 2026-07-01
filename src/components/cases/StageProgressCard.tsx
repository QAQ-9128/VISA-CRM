import { useState } from 'react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { StageControl } from './StageControl'
import { StageTimeline } from './StageTimeline'
import type { Case } from '../../types/models'

/**
 * 「阶段进展」卡 —— 案件详情页与客户详情页共用（UI 一模一样）：
 *   「推进阶段 →」展开 StageControl（一份进度全员共享，无任何锁定）
 *   + 「阶段流转记录」StageTimeline。
 * 切换案件时请在使用处加 key={caseRow.id}，保证内部状态随案件重置。
 */
export function StageProgressCard({ caseRow }: { caseRow: Case }) {
  const [advancing, setAdvancing] = useState(false)

  return (
    <Card>
      <h2 className="border-l-[3px] border-brand pl-2 font-serif text-[16px] font-bold text-ink">阶段进展</h2>

      {/* 推进阶段：展开切换表单（任意阶段含拒签/撤签 + 实际日期默认今天可补录） */}
      <div className="mt-4">
        {advancing ? (
          <div>
            <StageControl caseId={caseRow.id} currentStage={caseRow.current_stage} caseCategory={caseRow.case_category} />
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
