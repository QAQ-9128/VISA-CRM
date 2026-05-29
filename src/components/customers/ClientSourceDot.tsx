import { CLIENT_SOURCE_DOT, CLIENT_SOURCE_LABELS } from '../../types/domain'
import type { ClientSource } from '../../types/domain'

/**
 * 客户来源彩色圆点徽章：红/绿/黄。未分类(null/未知值)不渲染任何东西。
 * 替代原 VIP/A/B/C 文字徽章，统一用于客户列表、详情头部、概览等处。
 */
export function ClientSourceDot({
  source,
  size = 'sm',
}: {
  source: string | null
  size?: 'sm' | 'md'
}) {
  if (!source) return null
  const color = CLIENT_SOURCE_DOT[source as ClientSource]
  if (!color) return null // 未知/历史值不显示
  const label = CLIENT_SOURCE_LABELS[source as ClientSource]
  const dim = size === 'md' ? 'size-3' : 'size-2.5'
  return (
    <span
      className={`inline-block shrink-0 rounded-full ${dim} ${color}`}
      title={label}
      aria-label={`客户来源：${label}`}
      role="img"
    />
  )
}
