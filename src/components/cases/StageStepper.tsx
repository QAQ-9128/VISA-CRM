import { stageSteps } from '../../lib/stageSteps'
import type { StageStep } from '../../lib/stageSteps'
import type { CaseStage } from '../../types/domain'

/** 圆点样式：已过实心 / 当前高亮(描边光圈) / 未到空心；拒签·撤签用红。 */
function dotClass(s: StageStep): string {
  const base = 'relative z-[1] size-3 shrink-0 rounded-full'
  if (s.abnormal) {
    if (s.state === 'current') return `${base} bg-rose-500 ring-4 ring-rose-100`
    if (s.state === 'past') return `${base} bg-rose-500`
    return `${base} border-2 border-rose-200 bg-white`
  }
  if (s.state === 'current') return `${base} bg-brand ring-4 ring-brand-50`
  if (s.state === 'past') return `${base} bg-brand`
  return `${base} border-2 border-line-2 bg-white`
}

function labelClass(s: StageStep): string {
  if (s.abnormal) {
    if (s.state === 'current') return 'text-rose-600 font-bold'
    if (s.state === 'past') return 'text-rose-600 font-medium'
    return 'text-rose-400'
  }
  if (s.state === 'current') return 'text-brand font-bold'
  if (s.state === 'past') return 'text-body font-medium'
  return 'text-faint'
}

/**
 * 阶段步进条：按 case_stage enum 真实顺序排出**全部**阶段（数量随 enum，不写死）。
 * 4 列网格自动换行（11 个排成 3 行左右），行内相邻节点用连线连起来；
 * 连线 = 每个节点左侧伪元素，每行首列(:nth-child(4n+1))隐藏 → 不跨行、不悬空。
 * 已过填充、当前高亮、未到空心；拒签·撤签标红。纯展示。
 */
export function StageStepper({ current }: { current: CaseStage }) {
  const steps = stageSteps(current)
  return (
    <div className="grid grid-cols-4 gap-y-4">
      {steps.map((s) => {
        // 连线（节点左侧）：已到达该节点(已过/当前)则填充，否则浅灰；首列隐藏
        const reached = s.state !== 'future'
        return (
          <div
            key={s.stage}
            className={`relative flex flex-col items-center gap-1.5 px-1 before:absolute before:top-[5px] before:left-[-50%] before:h-0.5 before:w-full before:rounded-full before:content-[''] [&:nth-child(4n+1)]:before:hidden ${
              reached ? 'before:bg-brand' : 'before:bg-line-2'
            }`}
          >
            <span className={dotClass(s)} aria-hidden />
            <span className={`text-center text-[11px] leading-tight ${labelClass(s)}`}>{s.label}</span>
          </div>
        )
      })}
    </div>
  )
}
