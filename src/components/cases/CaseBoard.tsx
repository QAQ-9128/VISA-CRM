import { CaseCard } from './CaseCard'
import { EmptyState } from '../ui/states'
import type { CaseCardVM } from '../../lib/caseBoard'

/**
 * 案件 card 看板（网格视图）：一案一卡，响应式网格（桌面 3 列 / 中屏 2 列 / 手机 1 列）。
 * 纯展示——搜索 / 筛选复用「递交进度」页顶部的共享控件，本组件只渲染已筛选好的 vms。
 * 卡上不分类、不分列，无任何阶段/进度/金额。
 */
export function CaseBoard({
  vms,
  onViewProgress,
}: {
  vms: CaseCardVM[]
  /** 卡片「查看进度 →」：切到本页进度表并定位该案件 */
  onViewProgress: (caseId: string) => void
}) {
  if (vms.length === 0) {
    return <EmptyState title="没有匹配的案件" icon="📁" />
  }
  return (
    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {vms.map((vm) => (
        <CaseCard key={vm.caseId} vm={vm} onViewProgress={onViewProgress} />
      ))}
    </div>
  )
}
