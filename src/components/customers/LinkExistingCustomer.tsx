import { useMemo, useState } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { useCustomers } from '../../hooks/queries/useCustomers'
import { useFamilyLinks, useCreateFamilyLink } from '../../hooks/queries/useFamilyLinks'
import { selectLinkCandidates } from '../../lib/familyLinks'

const inputCls =
  'block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'

/**
 * 「关联现有客户」为某主申的副申：搜索全部客户(排除本人/原生副申/已关联) → 选一个 + 关系 → 建 family_member_links。
 * 只建关联，不改对方 primary_applicant_id（对方仍是独立客户、顶层显示、case 照常）。
 */
export function LinkExistingCustomer({ primaryId }: { primaryId: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [memberId, setMemberId] = useState('')
  const [relationship, setRelationship] = useState('')
  const customersQ = useCustomers({})
  const linksQ = useFamilyLinks()
  const create = useCreateFamilyLink(primaryId)

  const candidates = useMemo(
    () => selectLinkCandidates(primaryId, customersQ.data ?? [], linksQ.data ?? []),
    [primaryId, customersQ.data, linksQ.data],
  )
  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q === '' ? candidates : candidates.filter((c) => c.full_name.toLowerCase().includes(q))
    if (memberId && !base.some((c) => c.id === memberId)) {
      const sel = candidates.find((c) => c.id === memberId)
      return sel ? [sel, ...base] : base
    }
    return base
  }, [query, candidates, memberId])

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        + 关联现有客户
      </Button>
    )
  }

  function submit() {
    if (!memberId) return
    create.mutate(
      { member_customer_id: memberId, relationship: relationship.trim() || null },
      { onSuccess: () => { setOpen(false); setMemberId(''); setRelationship(''); setQuery('') } },
    )
  }

  const saveErr = create.error instanceof Error ? create.error.message : create.error ? '保存失败' : null

  return (
    <div className="w-full space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
      <p className="text-sm font-medium text-slate-700">
        关联现有客户为副申
        <span className="mt-0.5 block text-xs text-slate-400">
          不改对方身份：对方仍是独立客户、顶层显示、自己的 case 照常；只是同时出现在本家庭组里。
        </span>
      </p>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">选择客户</label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索客户姓名…"
          className={inputCls}
        />
        <select aria-label="选择客户" className={inputCls} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          <option value="">（选择客户…）</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </select>
      </div>

      <TextField
        label="与主申请关系（可选）"
        value={relationship}
        onChange={(e) => setRelationship(e.target.value)}
        placeholder="如 配偶 / 子女 / 父母"
      />

      {saveErr && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{saveErr}</p>}

      <div className="flex gap-2">
        <Button type="button" disabled={!memberId || create.isPending} onClick={submit}>
          {create.isPending ? '保存中…' : '保存关联'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => { setOpen(false); setMemberId(''); setRelationship('') }}>
          取消
        </Button>
      </div>
    </div>
  )
}
