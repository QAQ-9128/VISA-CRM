import type { InputHTMLAttributes } from 'react'
import { useId } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

/** 带标签的输入框：移动端优先，输入高度 ≥44px。 */
export function TextField({ label, className = '', id, required, ...props }: TextFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-[13.5px] font-semibold text-body">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      <input
        id={inputId}
        required={required}
        className={`block h-12 w-full rounded-[14px] border border-line-2 bg-white px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand-100 ${className}`}
        {...props}
      />
    </div>
  )
}
