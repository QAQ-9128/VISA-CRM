import { useState } from 'react'
import { caseGroupCode, caseParticipantIds } from '../../lib/caseGroups'
import { customerDisplayName } from '../../lib/customerName'
import { formatVisaType } from '../../lib/visa'
import type { Case, CaseApplicant, Customer } from '../../types/models'

/**
 * 「选择案件」选择器（可筛选下拉）：每项 = 案件号 + 签证 + 参与人名，右侧组标签（组码 · N 人）。
 * 一案一组：选中即「加入该案的组」（保存后写 case_applicants）。
 */
export function CaseJoinPicker({
  cases,
  applicants,
  customerById,
  value,
  onChange,
}: {
  cases: Case[]
  applicants: CaseApplicant[]
  customerById: Record<string, Customer | undefined>
  value: string | null
  onChange: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const options = cases.map((c) => {
    const ids = caseParticipantIds(c, applicants)
    const names = ids.map((id) => customerDisplayName(customerById[id])).filter(Boolean)
    return { caseRow: c, ids, names, code: caseGroupCode(ids, c.id) }
  })
  const list = q
    ? options.filter(
        (o) =>
          o.caseRow.case_number.toLowerCase().includes(q) ||
          o.names.some((n) => n.toLowerCase().includes(q)),
      )
    : options

  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-semibold text-body">选择案件</span>
      <div className="overflow-hidden rounded-xl border border-brand-100 bg-white focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-100">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入案件编号 / 参与人姓名筛选…"
          aria-label="筛选选择案件"
          className="w-full border-b border-line px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-faint"
        />
        <ul className="max-h-64 divide-y divide-line overflow-auto" role="listbox" aria-label="选择案件">
          {list.length === 0 ? (
            <li className="px-3.5 py-3 text-sm text-faint">
              {cases.length === 0 ? '还没有案件可加入' : '没有匹配的案件'}
            </li>
          ) : (
            list.map((o) => {
              const selected = value === o.caseRow.id
              return (
                <li key={o.caseRow.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => onChange(o.caseRow.id)}
                    className={`flex min-h-12 w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors ${
                      selected ? 'bg-brand-50' : 'hover:bg-surface-2'
                    }`}
                  >
                    <span className="min-w-0">
                      <span
                        className={`block truncate text-sm ${
                          selected ? 'font-semibold text-brand-700' : 'font-medium text-ink'
                        }`}
                      >
                        {o.caseRow.case_number} · {formatVisaType(o.caseRow.visa_subclass, o.caseRow.visa_stream)}
                      </span>
                      <span className="block truncate text-[11px] text-faint">参与人：{o.names.join('、') || '—'}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-[var(--color-lime-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-lime-ink)]">
                      {o.code} · {o.ids.length} 人
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </div>
  )
}
