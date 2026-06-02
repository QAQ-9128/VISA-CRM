import { Avatar } from './Avatar'
import { displayCustomerName } from '../../lib/dashboardView'

/** 头像 + 姓名/副文 的人名单元（表格、列表通用）。姓名走无名兜底。 */
export function NameCell({
  name,
  sub,
  seed,
  size = 40,
}: {
  name: string
  sub?: string
  seed?: string
  size?: number
}) {
  const display = displayCustomerName(name)
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={display} seed={seed} size={size} />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-ink">{display}</div>
        {sub && <div className="truncate text-xs text-faint">{sub}</div>}
      </div>
    </div>
  )
}
