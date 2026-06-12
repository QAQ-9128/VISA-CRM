import { useState } from 'react'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import { OwnerSelect } from './OwnerSelect'
import { ReferrerSelect } from '../referrers/ReferrerSelect'
import { useCreateCustomer } from '../../hooks/queries/useCustomers'
import { initialQuickState, toQuickPayload } from '../../lib/quickCustomer'
import { errorMessage } from '../../lib/errorMessage'
import { GENDERS, GENDER_LABELS } from '../../types/domain'

/**
 * 组区内联建人块（完整建档 · 组（Group）里「快速建档同组的人」）：
 * 五字段同快速建档（姓名/性别/生日/归属人/介绍人），建完即回调、自重置可连建。
 * ⚠ 嵌在 CustomerForm 的 <form> 里 → 本组件必须是 div（嵌套 form 非法），
 *   创建按钮 type=button，姓名框 Enter 拦截后触发创建（不冒泡提交外层表单）。
 */
export function QuickPersonCreate({
  onCreated,
  onCancel,
  title = '⚡ 快速建档同组的人',
  description = '给还没有档案的 TA 建档并进同组名单（可连建多个）；真正成组发生在保存并新建案件 / 加入案件时',
  submitLabel = '创建并加入名单',
}: {
  /** 建档成功（调用方把 TA 收进「同组的人」名单 / 加为本案参与人） */
  onCreated: (person: { id: string; full_name: string }) => void
  onCancel: () => void
  /** 案件参与人区复用时可覆写文案（标题/说明/提交按钮）；五字段与建档行为不变 */
  title?: string
  description?: string
  submitLabel?: string
}) {
  const createM = useCreateCustomer()
  const [state, setState] = useState(initialQuickState())
  const set = <K extends keyof typeof state>(key: K) => (value: (typeof state)[K]) =>
    setState((s) => ({ ...s, [key]: value }))
  const errMsg = errorMessage(createM.error)
  const canCreate = state.full_name.trim() !== '' && !createM.isPending

  function requestCancel() {
    // 填了内容才二次确认，空表直接关（防误触丢掉已填的四五个字段）
    const dirty = Object.values(state).some((v) => v !== '')
    if (!dirty || window.confirm('丢弃已填写的内容？')) onCancel()
  }

  function create() {
    if (!canCreate) return
    const payload = toQuickPayload(state)
    createM.mutate(payload, {
      onSuccess: (created) => {
        onCreated({ id: created.id, full_name: payload.full_name })
        setState(initialQuickState()) // 自重置：直接建下一个
      },
    })
  }

  return (
    <div
      className="space-y-3 rounded-[14px] border border-brand-100 bg-white p-3"
      onKeyDown={(e) => {
        // Esc = 只收起建人块；拦下冒泡，否则外层 CustomerForm 的 Esc 会取消整张表单丢光已填内容
        if (e.key === 'Escape') {
          e.stopPropagation()
          requestCancel()
        }
      }}
    >
      {/* 块标题：和外层客户表单的「姓名」区分开，明确这块是在建另一个人。
          文案不许诺「已成组」——一案一组：真正成组发生在「保存并新建案件/加入案件」那一步 */}
      <div>
        <h4 className="text-[13px] font-bold text-ink">{title}</h4>
        <p className="mt-0.5 text-xs text-faint">{description}</p>
      </div>
      <TextField
        label="姓名"
        required
        value={state.full_name}
        onChange={(e) => set('full_name')(e.target.value)}
        onKeyDown={(e) => {
          // 拦下 Enter：在这里回车=创建这个人，绝不提交外层客户表单
          if (e.key === 'Enter') {
            e.preventDefault()
            create()
          }
        }}
        placeholder="TA 的姓名"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="性别"
          placeholder="未填写"
          options={GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }))}
          value={state.gender}
          onChange={(e) => set('gender')(e.target.value)}
        />
        <TextField
          label="生日"
          type="date"
          value={state.birth_date}
          onChange={(e) => set('birth_date')(e.target.value)}
        />
      </div>
      <OwnerSelect
        value={state.owner_referrer_id || null}
        onChange={(id) => set('owner_referrer_id')(id ?? '')}
      />
      <ReferrerSelect value={state.referrer_id} onChange={(id) => set('referrer_id')(id)} />

      {errMsg && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">创建失败：{errMsg}</p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={requestCancel}>
          取消
        </Button>
        <Button type="button" disabled={!canCreate} onClick={create}>
          {createM.isPending ? '创建中…' : submitLabel}
        </Button>
      </div>
    </div>
  )
}
