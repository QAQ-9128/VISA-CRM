import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white shadow-brand hover:bg-brand-600 disabled:bg-brand-100 disabled:shadow-none',
  secondary:
    'bg-white text-ink border border-line-2 shadow-[0_1px_2px_rgb(23_32_51/0.05)] hover:bg-surface-2',
  ghost: 'bg-transparent text-muted hover:bg-surface-2 hover:text-ink',
  danger: 'bg-rose-50 text-rose-600 hover:bg-rose-100',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  /** 移动端铺满宽度，便于点按 */
  block?: boolean
  children: ReactNode
}

/** 基础按钮：圆角胶囊，最小 44px 点按高度（移动端友好）。 */
export function Button({
  variant = 'primary',
  block = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
        VARIANTS[variant]
      } ${block ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
