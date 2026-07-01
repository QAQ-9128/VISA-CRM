import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { ComboBox } from '../ui/FancySelect'
import { XIcon } from '../ui/icons'
import { FamilyChip } from './FamilyChip'
import { useFamilyMembers, useCreateFamilyMember, useDeleteFamilyMember } from '../../hooks/queries/useFamilyMembers'
import { FAMILY_RELATIONS, selectFamilyByCustomer } from '../../lib/familyMembers'

/**
 * 客户级 family 管理入口（大名字下）：family 标签 + hover 气泡 + 「管理 / + family」。
 * 点击 → 弹窗：填 名字 + 关系（预设可选可手填）+ 现有成员列表可删。family 属于客户、与案件无关。
 * 仅前端关系信息，不建档、不进账目。
 */
export function FamilyManager({ customerId }: { customerId: string }) {
  const all = useFamilyMembers()
  const members = useMemo(() => selectFamilyByCustomer(all.data ?? [], customerId), [all.data, customerId])
  const [open, setOpen] = useState(false)
  return (
    <span className="mt-2 inline-flex items-center gap-2">
      <FamilyChip members={members} />
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11.5px] font-semibold text-[#5b56c9] hover:underline"
      >
        {members.length ? '管理' : '+ family'}
      </button>
      {open && <FamilyModal customerId={customerId} onClose={() => setOpen(false)} />}
    </span>
  )
}

function FamilyModal({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const all = useFamilyMembers()
  const members = useMemo(() => selectFamilyByCustomer(all.data ?? [], customerId), [all.data, customerId])
  const create = useCreateFamilyMember()
  const del = useDeleteFamilyMember()
  const [name, setName] = useState('')
  const [relation, setRelation] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const canSave = name.trim() !== '' && relation.trim() !== ''
  function add(e: FormEvent) {
    e.preventDefault()
    if (!canSave || create.isPending) return
    create.mutate(
      { customer_id: customerId, name: name.trim(), relation: relation.trim() },
      { onSuccess: () => { setName(''); setRelation('') } },
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="客户 family（家庭成员）"
        className="w-full max-w-sm rounded-[20px] bg-white p-6 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-bold text-ink">客户 family（家庭成员）</h2>
        <p className="mt-1 text-[12px] text-faint">属于这个客户 · 全客户页面通用 · 不建档、不进账目</p>

        {/* 现有成员 + 删除 */}
        <div className="mt-4 space-y-1.5">
          {members.length === 0 ? (
            <p className="text-[12px] text-faint">暂无 family</p>
          ) : (
            members.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-[9px] bg-surface-2/70 px-3 py-2">
                <span className="text-[13px] font-semibold text-ink">{m.name}</span>
                {m.relation && (
                  <span className="rounded-[6px] bg-[#eceaf6] px-2 py-0.5 text-[11px] text-muted">{m.relation}</span>
                )}
                {m.linked_customer_id && <span className="text-[10.5px] text-[#5b56c9]">· 有档案</span>}
                <button
                  type="button"
                  aria-label={`删除 ${m.name}`}
                  disabled={del.isPending}
                  onClick={() => del.mutate(m.id)}
                  className="ml-auto grid size-6 place-items-center rounded-full text-faint transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                >
                  <XIcon className="size-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* 新增：名字 + 关系（预设可选可手填） */}
        <form onSubmit={add} className="mt-4 space-y-3">
          <TextField label="名字" value={name} onChange={(e) => setName(e.target.value)} placeholder="家庭成员姓名" />
          <div className="space-y-1.5">
            <span className="block text-sm font-semibold text-body">关系</span>
            <ComboBox
              ariaLabel="关系"
              value={relation}
              onChange={setRelation}
              options={[...FAMILY_RELATIONS]}
              placeholder="选择或手填,如:配偶"
            />
            <p className="text-[11px] text-faint">点预设或直接手填</p>
          </div>
          {create.isError && <p className="text-[12px] text-rose-600">添加失败,请重试。</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose}>关闭</Button>
            <Button type="submit" disabled={!canSave || create.isPending}>{create.isPending ? '添加中…' : '添加'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
