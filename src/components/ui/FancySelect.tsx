import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * 仿 21st「圆角 + 动画勾选」选择器，但**纯清新绿令牌 / Noto**、零默认主题色。
 * 浮层 portal 到 body（fixed 定位，不被卡片 overflow 裁切、z-index 置顶），framer-motion 过渡，
 * lucide 勾号选中态，键盘可达（↑↓/Enter/Esc）。导出两种：
 *   - FancySelect：纯选择（用于「类型」收款/待付，可带彩色 tag）。
 *   - ComboBox：可选可手填（用于「描述」律师费/文案费 + 任意自定义文字）——**保留手填能力**。
 * 两者与同区输入框共用同一套外观令牌（见 FIELD），保证一行三控件高度/圆角/边框/底色/focus 完全一致。
 */

/** 同区控件统一外观：38px 高、10 圆角、#eef2ef 边、#fbfdfc 底、绿 focus 描边+柔光。 */
export const FIELD_CLASS =
  'h-[38px] rounded-[10px] border border-[#eef2ef] bg-[#fbfdfc] text-[13px] text-ink outline-none transition-colors focus:border-brand/60 focus:ring-2 focus:ring-brand-50'

export interface FancyOption {
  value: string
  label: string
  /** 选项/触发器里显示的彩色 tag（如 收款绿/待付黄）；不传则纯文字 */
  tag?: ReactNode
}

/** 浮层定位：跟随触发器矩形（fixed），开/滚动/缩放时重算。 */
function useAnchorRect(open: boolean, anchorRef: React.RefObject<HTMLElement | null>) {
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const measure = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setRect({ top: r.bottom + 6, left: r.left, width: r.width })
  }, [anchorRef])
  useLayoutEffect(() => {
    if (!open) return
    measure()
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [open, measure])
  return rect
}

/** 共用浮层面板（portal + 动画 + 选项列表 + 勾选态 + 键盘高亮）。 */
function Panel({
  open,
  rect,
  options,
  activeIndex,
  selectedValue,
  onPick,
  onHover,
  labelledBy,
}: {
  open: boolean
  rect: { top: number; left: number; width: number } | null
  options: FancyOption[]
  activeIndex: number
  selectedValue: string
  onPick: (o: FancyOption) => void
  onHover: (i: number) => void
  labelledBy?: string
}) {
  return createPortal(
    <AnimatePresence>
      {open && rect && (
        <motion.ul
          role="listbox"
          aria-label={labelledBy}
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.14, ease: 'easeOut' }}
          style={{ position: 'fixed', top: rect.top, left: rect.left, minWidth: rect.width, zIndex: 100 }}
          className="max-h-64 overflow-auto rounded-[12px] border border-line-2 bg-white p-1 shadow-soft"
          // 阻止 mousedown 冒泡触发外部关闭（关闭逻辑用 click-outside）
          onMouseDown={(e) => e.preventDefault()}
        >
          {options.map((o, i) => {
            const selected = o.value === selectedValue
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => onHover(i)}
                  onClick={() => onPick(o)}
                  className={cn(
                    'flex h-9 w-full items-center gap-2 rounded-[8px] px-2.5 text-left text-[13px] transition-colors',
                    i === activeIndex ? 'bg-brand-50' : 'hover:bg-brand-50/60',
                    selected ? 'font-semibold text-brand-700' : 'text-ink',
                  )}
                >
                  {o.tag ? o.tag : <span className="truncate">{o.label}</span>}
                  {selected && (
                    <motion.span
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                      className="ml-auto text-brand-700"
                    >
                      <Check className="size-4" strokeWidth={2.5} />
                    </motion.span>
                  )}
                </button>
              </li>
            )
          })}
        </motion.ul>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** 点击外部关闭（触发器 + 浮层都不算外部）。浮层在 portal，故用全局 click 判断目标是否在 anchor 内或带 data-fancy-panel。 */
function useClickOutside(open: boolean, anchorRef: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (anchorRef.current?.contains(t)) return
      // 浮层项点击走各自 onClick；这里只处理真正的外部点击
      if (t instanceof Element && t.closest('[role="listbox"]')) return
      close()
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [open, anchorRef, close])
}

// ── 纯选择（类型）──────────────────────────────────────────────
export function FancySelect({
  value,
  onChange,
  options,
  placeholder = '请选择',
  ariaLabel,
  className,
  defaultOpen = false,
}: {
  value: string
  onChange: (value: string) => void
  options: FancyOption[]
  placeholder?: string
  ariaLabel?: string
  className?: string
  /** 仅用于静态预览/截图：初始即展开浮层。默认 false，不影响真实使用。 */
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [active, setActive] = useState(-1)
  const btnRef = useRef<HTMLButtonElement>(null)
  const rect = useAnchorRect(open, btnRef)
  const close = useCallback(() => setOpen(false), [])
  useClickOutside(open, btnRef, close)

  const selected = options.find((o) => o.value === value) ?? null
  const openMenu = () => {
    setActive(options.findIndex((o) => o.value === value))
    setOpen(true)
  }
  const pick = (o: FancyOption) => {
    onChange(o.value)
    setOpen(false)
    btnRef.current?.focus()
  }

  // 方向键打开时高亮首项（或已选项），保证随后 Enter 能选中
  const openWithHighlight = () => {
    setOpen(true)
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) return openWithHighlight()
      setActive((i) => Math.min(options.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) return openWithHighlight()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!open) return openMenu()
      if (active >= 0) pick(options[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={cn(FIELD_CLASS, 'flex w-full items-center gap-1.5 px-2.5 text-left', className)}
      >
        <span className={cn('flex min-w-0 flex-1 items-center gap-1.5', !selected && 'text-faint')}>
          {selected ? selected.tag ?? <span className="truncate">{selected.label}</span> : placeholder}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-faint transition-transform', open && 'rotate-180')} />
      </button>
      <Panel
        open={open}
        rect={rect}
        options={options}
        activeIndex={active}
        selectedValue={value}
        onPick={pick}
        onHover={setActive}
        labelledBy={ariaLabel}
      />
    </>
  )
}

// ── 可选可手填（描述）────────────────────────────────────────────
export function ComboBox({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  className,
}: {
  value: string
  onChange: (value: string) => void
  /** 建议项（可选可不选；用户始终能手填任意文字） */
  options: string[]
  placeholder?: string
  ariaLabel?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const rect = useAnchorRect(open, wrapRef)
  const close = useCallback(() => setOpen(false), [])
  useClickOutside(open, wrapRef, close)

  const opts: FancyOption[] = options.map((s) => ({ value: s, label: s }))
  const pick = (o: FancyOption) => {
    onChange(o.value) // 选中建议项 = 写入该文字
    setOpen(false)
    inputRef.current?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      setActive((i) => Math.min(opts.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      if (open && active >= 0) {
        e.preventDefault()
        pick(opts[active]) // 高亮项即选中；否则保留已手填文字
      } else {
        setOpen(false)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapRef} className={cn('relative flex items-center', className)}>
      <input
        ref={inputRef}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value) // ★手填：任意文字直接写入并保存
          if (!open) setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={cn(FIELD_CLASS, 'w-full px-3 pr-8 placeholder:text-faint')}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={ariaLabel ? `${ariaLabel}下拉` : '展开建议'}
        onClick={() => {
          setOpen((o) => !o)
          inputRef.current?.focus()
        }}
        className="absolute right-2 grid size-5 place-items-center text-faint"
      >
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
      </button>
      <Panel
        open={open}
        rect={rect}
        options={opts}
        activeIndex={active}
        selectedValue={value}
        onPick={pick}
        onHover={setActive}
        labelledBy={ariaLabel}
      />
    </div>
  )
}
