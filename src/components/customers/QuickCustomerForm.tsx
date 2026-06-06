import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import { OwnerSelect } from './OwnerSelect'
import { ReferrerSelect } from '../referrers/ReferrerSelect'
import { CaseJoinPicker } from './CaseJoinPicker'
import { useJoinableCases } from '../../hooks/queries/useJoinableCases'
import { useCreateCustomer } from '../../hooks/queries/useCustomers'
import { useAddCaseApplicant } from '../../hooks/queries/useCaseApplicants'
import { initialQuickState, toQuickPayload } from '../../lib/quickCustomer'
import { errorMessage } from '../../lib/errorMessage'
import { GENDERS, GENDER_LABELS } from '../../types/domain'

/**
 * 快速建档卡片（与完整表单同页并存，2026-06 图纸拍板）：
 * 姓名/性别/生日/归属人/介绍人 五个字段，建完即进客户档案。
 * 可选「组」：勾选加入已有案件 → 保存后顺手写 case_applicants（成为本案参与人）；
 * 不选则与原来一致，纯建档零案件逻辑。
 */
export function QuickCustomerForm({
  onCreated,
}: {
  /** 创建成功（调用方负责跳转，通常 navigate 到客户详情） */
  onCreated: (customerId: string) => void
}) {
  const createM = useCreateCustomer()
  const addApplicantM = useAddCaseApplicant()
  const { joinableCases, applicants, customerById } = useJoinableCases()
  const [state, setState] = useState(initialQuickState())
  // 组（可选）：展开选择要加入的案件
  const [joining, setJoining] = useState(false)
  const [joinCaseId, setJoinCaseId] = useState<string | null>(null)
  // 建档成功但加入案件失败时记住已建客户：重试只补「加入」，绝不重复建人
  const [createdId, setCreatedId] = useState<string | null>(null)

  const set = <K extends keyof typeof state>(key: K) => (value: (typeof state)[K]) =>
    setState((s) => ({ ...s, [key]: value }))

  const pending = createM.isPending || addApplicantM.isPending
  // 展开了「加入案件」却没选 → 禁存（与完整表单同规则，避免默默存成独立客户）
  const joinIncomplete = joining && !joinCaseId
  const selectedCase = joinCaseId ? joinableCases.find((c) => c.id === joinCaseId) ?? null : null
  const errMsg = addApplicantM.error
    ? `客户已建好，但加入案件失败：${errorMessage(addApplicantM.error) ?? '请重试'}`
    : errorMessage(createM.error)

  function finish(customerId: string) {
    if (joining && joinCaseId) {
      addApplicantM.mutate(
        { caseId: joinCaseId, customerId },
        { onSuccess: () => onCreated(customerId) },
      )
    } else {
      onCreated(customerId)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!state.full_name.trim() || pending || joinIncomplete) return
    // 上一轮已建好客户（仅加入失败）→ 直接重试加入
    if (createdId) {
      finish(createdId)
      return
    }
    createM.mutate(toQuickPayload(state), {
      onSuccess: (created) => {
        setCreatedId(created.id)
        finish(created.id)
      },
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="快速建档">
      <TextField
        label="姓名"
        required
        value={state.full_name}
        onChange={(e) => set('full_name')(e.target.value)}
        placeholder="客户姓名"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      {/* 组（Group）· 可选：快速建档也能顺手把人挂进已有案件（建副申最常用） */}
      <div className="rounded-[14px] border border-brand-100 bg-brand-50/40 p-3">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={joining}
            onChange={(e) => {
              setJoining(e.target.checked)
              if (!e.target.checked) setJoinCaseId(null)
            }}
            className="mt-0.5 size-4 accent-brand"
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">🧩 加入已有案件（组）</span>
            <span className="block text-xs text-faint">保存后 TA 成为所选案件的参与人；不勾 = 独立建档</span>
          </span>
        </label>
        {joining && (
          <div className="mt-3 space-y-2 border-t border-brand-100 pt-3">
            <CaseJoinPicker
              cases={joinableCases}
              applicants={applicants}
              customerById={customerById}
              value={joinCaseId}
              onChange={setJoinCaseId}
            />
            {selectedCase && (
              <p className="text-xs text-muted">
                将加入案件 <span className="font-semibold text-ink tabular-nums">{selectedCase.case_number}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {errMsg && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {createdId ? errMsg : `创建失败：${errMsg}`}
        </p>
      )}

      <div className="space-y-1.5">
        {joinIncomplete && <p className="text-xs text-amber-700">先在上方选择要加入的案件</p>}
        <Button type="submit" block disabled={!state.full_name.trim() || pending || joinIncomplete}>
          {pending ? '保存中…' : createdId ? '重试加入案件' : '快速建档'}
        </Button>
      </div>
    </form>
  )
}
