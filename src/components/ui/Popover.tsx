import { useEffect, useRef, useState, type ReactNode } from 'react'

interface PopoverProps {
  /** 触发按钮的无障碍名（getByRole('button', { name }) 可定位）。 */
  ariaLabel: string
  /** 触发按钮内容（如月份标签 + chevron）。 */
  triggerContent: ReactNode
  triggerClassName?: string
  /** 弹层附加类名（定位/宽度由调用方决定）。 */
  panelClassName?: string
  /** 弹层内容；close 用于选中后关闭。 */
  children: (close: () => void) => ReactNode
}

/**
 * 轻量受控 Popover（无第三方依赖，沿用项目自有 ui 组件风格）：
 * 点触发按钮开合，点外部 / Esc 关闭。弹层仅在 open 时挂载——
 * 内部状态（如月网格的年份视图）随之每次重新初始化，天然与触发值同步。
 */
export function Popover({ ariaLabel, triggerContent, triggerClassName, panelClassName, children }: PopoverProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {triggerContent}
      </button>
      {open && (
        <div
          role="dialog"
          className={`absolute left-1/2 z-30 mt-2 -translate-x-1/2 rounded-[16px] border border-line bg-white p-3 [box-shadow:0_20px_46px_-20px_rgba(40,90,60,.34)] ${panelClassName ?? ''}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}
