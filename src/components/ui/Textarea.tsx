import type { TextareaHTMLAttributes } from 'react'
import { useId } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
}

/** 带标签的多行输入。 */
export function Textarea({ label, className = '', id, rows = 3, ...props }: TextareaProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-[13.5px] font-semibold text-body">
        {label}
      </label>
      <textarea
        id={fieldId}
        rows={rows}
        className={`block w-full rounded-[14px] border border-line-2 bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand-100 ${className}`}
        {...props}
      />
    </div>
  )
}
