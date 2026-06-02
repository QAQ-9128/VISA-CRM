/**
 * 渐变首字母头像（Layout A 规格）。圆形、内容=姓名首字（白、600、字号≈尺寸×0.4），
 * 底为按 seed/name hash 选定的渐变（8 套固定色板），含投影。无名兜底为「·」。
 */
import { avatarInitial } from '../../lib/avatar'

const GRADS = [
  'linear-gradient(135deg,#5b7cfa,#8b6cf0)',
  'linear-gradient(135deg,#2f8fff,#38c6ff)',
  'linear-gradient(135deg,#ff7a59,#ff5e84)',
  'linear-gradient(135deg,#12b886,#5fd0a0)',
  'linear-gradient(135deg,#f5a623,#ffce4f)',
  'linear-gradient(135deg,#a55eea,#ec5bb0)',
  'linear-gradient(135deg,#0ea5e9,#22d3ee)',
  'linear-gradient(135deg,#f43f5e,#fb7185)',
] as const

const KEYWORD_PX = { sm: 32, md: 36, lg: 44 } as const

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

export function Avatar({
  name,
  seed,
  size = 40,
}: {
  name: string
  /** 用于稳定取色（一般传客户 id）；缺省回落到 name */
  seed?: string
  /** 像素值，或 sm/md/lg 关键字 */
  size?: number | keyof typeof KEYWORD_PX
}) {
  const px = typeof size === 'number' ? size : KEYWORD_PX[size]
  const key = (seed || name || '').trim()
  const grad = GRADS[key ? hash(key) % GRADS.length : GRADS.length - 1]
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{
        width: px,
        height: px,
        fontSize: Math.round(px * 0.4),
        background: grad,
        boxShadow: '0 4px 10px -4px rgba(23,32,51,.4)',
      }}
      aria-hidden
    >
      {avatarInitial(name)}
    </span>
  )
}
