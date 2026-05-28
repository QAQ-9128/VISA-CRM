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
      <label htmlFor={fieldId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea
        id={fieldId}
        rows={rows}
        className={`block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 ${className}`}
        {...props}
      />
    </div>
  )
}
