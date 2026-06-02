import type { ReactNode } from 'react'
import { Card } from '../ui/Card'

/**
 * 预警卡：标题 + 计数胶囊 + 列表。
 * 空状态压成一行小灰字（不渲染 children），卡片高度随之自适应内容——
 * 配合外层栅格的 items-start，空卡不再被同行高卡撑满。
 */
export function AlertCard({
  title,
  count,
  children,
  empty,
  sub,
  action,
}: {
  title: string
  count: number
  children: ReactNode
  empty: string
  /** 标题下的小灰副标（如「处于待办阶段的案件」） */
  sub?: string
  /** 右上操作（如「全部 ›」链接） */
  action?: ReactNode
}) {
  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-ink">{title}</h2>
            {count > 0 && (
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold tabular-nums text-brand">
                {count}
              </span>
            )}
          </div>
          {sub && <p className="mt-0.5 text-[12px] text-faint">{sub}</p>}
        </div>
        {action && <span className="shrink-0">{action}</span>}
      </div>
      {count === 0 ? <p className="text-sm text-faint">{empty}</p> : <div>{children}</div>}
    </Card>
  )
}
