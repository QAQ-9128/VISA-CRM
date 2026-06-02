import type { Case } from '../../types/models'
import { parentCaseOptionLabel } from '../../lib/parentCase'

const inputCls =
  'block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand-100'

/**
 * 「主案件」严格下拉：**只列出该客户家庭主申请名下的案件**（candidates 由 parentCaseDropdown 推导，
 * 已排除归档、按 created_at 倒序），不再支持自由搜索任意案件。
 * 显示格式：主申请客户名 · 签证类型 · 案件编号 · 当前阶段。
 */
export function ParentCaseField({
  value,
  onChange,
  candidates,
  customerNameById,
}: {
  value: string | null
  onChange: (id: string | null) => void
  candidates: Case[]
  customerNameById: Record<string, string>
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700">主案件</label>
      <select
        aria-label="主案件"
        className={inputCls}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">（请选择主案件）</option>
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {parentCaseOptionLabel(c, customerNameById[c.customer_id] ?? '—')}
          </option>
        ))}
      </select>
    </div>
  )
}
