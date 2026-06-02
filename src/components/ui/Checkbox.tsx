import type { ReactNode } from 'react'
import { useId } from 'react'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
  id?: string
  disabled?: boolean
}

/**
 * 自定义勾选框（设计系统）：选中态蓝底白勾，关联文字整体可点。
 * 隐藏原生 input 以保留键盘可达性与表单语义。点按区 ≥44px 高（移动端友好）。
 */
export function Checkbox({ checked, onChange, children, id, disabled }: CheckboxProps) {
  const autoId = useId()
  const boxId = id ?? autoId
  return (
    <label
      htmlFor={boxId}
      className="inline-flex min-h-11 cursor-pointer select-none items-center gap-2.5 text-sm text-body"
    >
      <input
        id={boxId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        className={`grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-100 ${
          checked ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white text-transparent'
        }`}
        aria-hidden
      >
        <svg viewBox="0 0 20 20" fill="none" className="size-3" stroke="currentColor" strokeWidth={3}>
          <path d="m4 10 4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {children}
    </label>
  )
}
