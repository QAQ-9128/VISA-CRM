import type { SelectHTMLAttributes } from 'react'
import { useId } from 'react'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label: string
  options: SelectOption[]
  /** 顶部「未选择」项的文案；不传则不显示空选项 */
  placeholder?: string
}

/** 带标签的下拉选择，移动端优先，高度 ≥44px。 */
export function Select({ label, options, placeholder, className = '', id, required, ...props }: SelectProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <div className="space-y-1.5">
      <label htmlFor={selectId} className="block text-[13.5px] font-semibold text-body">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      <select
        id={selectId}
        required={required}
        className={`block h-12 w-full appearance-none rounded-[14px] border border-line-2 bg-white bg-[length:20px] bg-[right_0.75rem_center] bg-no-repeat px-3.5 pr-10 text-[15px] text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand-100 ${className}`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='none' stroke='%239aa4b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m5 8 5 5 5-5'/%3E%3C/svg%3E\")",
        }}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
