import type { MouseEventHandler } from 'react'

/** 星标切换按钮（标注优先客户）。受控：starred + onToggle。 */
export function StarToggle({
  starred,
  onToggle,
  disabled,
  size = 20,
}: {
  starred: boolean
  onToggle: MouseEventHandler<HTMLButtonElement>
  disabled?: boolean
  size?: number
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={starred}
      aria-label={starred ? '取消标注优先' : '标注为优先'}
      className={`inline-flex size-9 items-center justify-center rounded-[10px] transition-colors disabled:opacity-50 ${
        starred ? 'bg-amber-50 text-amber-500' : 'text-slate-300 hover:bg-surface-2'
      }`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={starred ? '#f59e0b' : 'none'}
        stroke={starred ? '#f59e0b' : 'currentColor'}
        strokeWidth="1.8"
        strokeLinejoin="round"
      >
        <path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9L12 3Z" />
      </svg>
    </button>
  )
}
