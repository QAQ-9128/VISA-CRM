import { Badge } from '../ui/Badge'
import { computeExpiryStatus } from '../../lib/expiry'
import type { ExpiryStatus } from '../../lib/expiry'

const STYLE: Record<ExpiryStatus, string> = {
  overdue: 'bg-rose-100 text-rose-800',
  soon: 'bg-amber-100 text-amber-800',
  ok: 'bg-emerald-100 text-emerald-700',
}

/** 文件到期状态徽章：已过期(红) / ≤30 天(黄) / 正常(绿)。无到期日则不渲染。 */
export function ExpiryBadge({ expiryDate }: { expiryDate: string | null }) {
  const info = computeExpiryStatus(expiryDate)
  if (!info) return null
  const label =
    info.status === 'overdue'
      ? `已过期 ${Math.abs(info.daysRemaining)} 天`
      : info.daysRemaining === 0
        ? '今天到期'
        : `${info.daysRemaining} 天后到期`
  return <Badge className={STYLE[info.status]}>{label}</Badge>
}
