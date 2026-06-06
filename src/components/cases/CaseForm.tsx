import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { VisaSubclassField } from './VisaSubclassField'
import { EmployerSelect } from '../employers/EmployerSelect'
import { useCustomers } from '../../hooks/queries/useCustomers'
import { caseGroupCode } from '../../lib/caseGroups'
import type { Case, CaseInsert, Customer } from '../../types/models'

// 一案一组：案件是自包含的一组人，案件与案件之间没有任何关系（「与其他案件的关系」已删；
// 提交不写 parent_case_id —— 新建落库默认 null，编辑不传则旧值原样保留、不报错）。
export interface CaseFormValues extends CaseInsert {
  customer_id: string
  visa_subclass: string
  visa_stream: string | null
  sync_tracking: boolean
  trt_reminder_enabled: boolean
}

/** 保存后的去向：detail=客户详情（默认）；fees=直接滚到费用记录卡开始记账（重录数据快捷路径）。 */
export type CaseFormNext = 'detail' | 'fees'

interface CaseFormProps {
  customerId: string
  customerLabel: string
  initial?: Case
  /** 编辑时的现有参与人（只读，用于组码展示——编辑模式参与人增删在客户页「相关案件」卡里做） */
  initialApplicantIds?: string[]
  submitting?: boolean
  error?: string | null
  /** applicantIds 仅新建模式有效（建案时一次选好参与人）；编辑模式恒为现有集合、不会被写库 */
  onSubmit: (values: CaseFormValues, applicantIds: string[], next: CaseFormNext) => void
  onCancel: () => void
}

const trimOrNull = (s: string) => (s.trim() === '' ? null : s.trim())

export function CaseForm({
  customerId,
  customerLabel,
  initial,
  initialApplicantIds,
  submitting,
  error,
  onSubmit,
  onCancel,
}: CaseFormProps) {
  const [visaSubclass, setVisaSubclass] = useState(initial?.visa_subclass ?? '')
  const [visaStream, setVisaStream] = useState<string | null>(initial?.visa_stream ?? null)
  const [sponsorPosition, setSponsorPosition] = useState(initial?.sponsor_position ?? '')
  const [sponsorEmployerId, setSponsorEmployerId] = useState(initial?.sponsor_employer_id ?? '')
  const [destination, setDestination] = useState(initial?.destination_country ?? 'Australia')
  const [currency, setCurrency] = useState(initial?.currency ?? 'AUD')
  // 财务口径已统一按人(applicant_id)归属：新案固定 sync_tracking=false；编辑保留原值（旧合并案件兼容，不动数据）
  const financeCombined = initial?.sync_tracking ?? false
  const [trtReminder, setTrtReminder] = useState(initial?.trt_reminder_enabled ?? false)
  // 参与人：仅新建模式可编辑（建案时一次选好）；编辑模式只读（增删在客户页「相关案件」卡）
  const editing = !!initial
  const [applicantIds, setApplicantIds] = useState<string[]>(initialApplicantIds ?? [])
  const [addingParticipant, setAddingParticipant] = useState(false)

  const is482 = visaSubclass.trim().startsWith('482')

  // 新建模式的参与候选 = 全部在册客户
  const allCustomers = useCustomers({})

  function addApplicant(id: string) {
    setApplicantIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }
  function removeApplicant(id: string) {
    setApplicantIds((prev) => prev.filter((x) => x !== id))
  }

  function submit(next: CaseFormNext) {
    if (submitting || visaSubclass.trim() === '') return
    onSubmit(
      {
        customer_id: customerId,
        visa_subclass: visaSubclass.trim(),
        visa_stream: visaStream && visaStream.trim() !== '' ? visaStream.trim() : null,
        sponsor_position: trimOrNull(sponsorPosition),
        sponsor_employer_id: sponsorEmployerId || null,
        destination_country: trimOrNull(destination),
        currency: currency.trim() || 'AUD',
        sync_tracking: financeCombined,
        // 仅 482 才可能开启；切到非 482 自动清掉，避免残留 true
        trt_reminder_enabled: is482 ? trtReminder : false,
      },
      applicantIds,
      next,
    )
  }
  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    submit('detail')
  }

  const customersData = allCustomers.data ?? []
  const customerById = Object.fromEntries(customersData.map((c) => [c.id, c])) as Record<string, Customer | undefined>
  const pickerCandidates = customersData.filter(
    (c) => c.id !== customerId && !c.is_archived && !applicantIds.includes(c.id),
  )
  // 组码/人数的展示集合：编辑模式直接随 prop 派生（existingApplicants 异步到达后照常更新——
  // 之前进 useState 定格首渲空值，多人案件会显示成「1 人 + 单人组码」）；新建模式随勾选实时变
  const displayApplicantIds = editing ? initialApplicantIds ?? [] : applicantIds
  const groupCodeStr = caseGroupCode([customerId, ...displayApplicantIds], initial?.id ?? '')

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <span className="block text-sm font-semibold text-body">案件客户</span>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
          {customerLabel}
        </div>
      </div>

      <VisaSubclassField
        subclass={visaSubclass}
        stream={visaStream}
        onChange={(sc, st) => {
          setVisaSubclass(sc)
          setVisaStream(st)
        }}
      />

      {/* 担保职位 / 担保雇主（案件级，需 additive SQL：cases.sponsor_position / sponsor_employer_id） */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField
          label="担保职位"
          value={sponsorPosition}
          onChange={(e) => setSponsorPosition(e.target.value)}
          placeholder="如：Senior Cook / Marketing Manager"
        />
        <EmployerSelect value={sponsorEmployerId} onChange={setSponsorEmployerId} />
      </div>

      {/* 组（Group）：一案一组 —— 组 = 本案参与人集合（与客户表单组区同一用语，中文为主） */}
      <fieldset className="rounded-[14px] border border-line-2 p-4">
        <legend className="px-1 text-sm font-semibold text-body">组（Group）</legend>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">组码</span>
          <span className="rounded-full bg-[var(--color-lime-soft)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--color-lime-ink)]">
            {groupCodeStr}
          </span>
          <span className="text-xs text-faint">
            共 {displayApplicantIds.length + 1} 人 ·{' '}
            {editing ? '参与人在客户页「相关案件」卡里增删' : '组 = 本案参与人（在下方选择），同参与人的案件同组'}
          </span>
        </div>
      </fieldset>

      {is482 && (
        <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={trtReminder}
            onChange={(e) => setTrtReminder(e.target.checked)}
            className="mt-0.5 size-4 rounded border-slate-300 text-brand focus:ring-brand"
          />
          <span>
            2 年转 186 TRT 提醒
            <span className="mt-0.5 block text-xs text-slate-500">
              下签满 22 个月后，在案件/客户/概览处提醒及时启动 186 TRT 永居（开了 186 TRT 案后自动消失）。
            </span>
          </span>
        </label>
      )}

      {/* 本案参与人：仅新建模式可编辑（建案一次选好）；编辑模式此区隐藏，增删在客户页「相关案件」卡 */}
      {!editing && (
        <fieldset className="rounded-[14px] border border-line-2 p-4">
          <legend className="px-1 text-sm font-semibold text-body">本案参与人</legend>
          <div className="space-y-2.5">
            <p className="text-sm text-slate-500">选择本案参与人</p>
            {/* ?with= 一条龙带过来的预选人：说明来源，免得用户以为系统乱填 */}
            {(initialApplicantIds?.length ?? 0) > 0 && (
              <p className="text-xs text-faint">已自动带入上一步「快速建档同组的人」，不需要的可移出</p>
            )}

            {/* 案件客户固定首位，不可移出 */}
            <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-[10px] border border-line bg-surface-2/60 px-3 py-1.5 text-sm">
              <span className="font-semibold text-ink">{customerLabel}</span>
              <span className="rounded-full bg-[var(--color-lime-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-lime-ink)]">
                案件客户 · 整案主进度
              </span>
            </div>

            {/* 已选参与人（姓名 + 关系备注 + 移出） */}
            {applicantIds.map((id) => {
              const cu = customerById[id]
              return (
                <div key={id} className="flex min-h-11 items-center gap-2 rounded-[10px] border border-line px-3 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {cu?.full_name ?? '（未知客户）'}
                    {cu?.relationship_to_primary && <span className="text-faint">（{cu.relationship_to_primary}）</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeApplicant(id)}
                    className="shrink-0 text-[12.5px] font-semibold text-faint hover:text-rose-600"
                  >
                    移出
                  </button>
                </div>
              )
            })}

            {/* + 添加本案参与人：可筛选下拉（排除 owner + 已添加；选中即加入，可连选） */}
            {addingParticipant ? (
              <div className="space-y-2">
                <ParticipantPicker candidates={pickerCandidates} onPick={addApplicant} />
                <button
                  type="button"
                  onClick={() => setAddingParticipant(false)}
                  className="text-[12.5px] font-semibold text-muted hover:text-ink"
                >
                  收起
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingParticipant(true)}
                className="text-[13px] font-semibold text-brand hover:text-brand-600"
              >
                + 添加本案参与人
              </button>
            )}

            <p className="text-xs text-faint">账目自动按参与人分开计算并汇总</p>
          </div>
        </fieldset>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField label="目的国" value={destination} onChange={(e) => setDestination(e.target.value)} />
        <TextField label="货币" value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="AUD" />
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="flex flex-wrap justify-end gap-3 pt-2">
        <Button type="submit" disabled={submitting || visaSubclass.trim() === ''}>
          {submitting ? '保存中…' : '保存'}
        </Button>
        {/* 重录数据快捷路径：保存后直接滚到费用记录卡开始记账 */}
        <Button
          type="button"
          variant="secondary"
          disabled={submitting || visaSubclass.trim() === ''}
          onClick={() => submit('fees')}
        >
          保存并记账
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          取消
        </Button>
      </div>
    </form>
  )
}

/**
 * 「添加本案参与人」可筛选下拉（仅新建模式）：候选 = 全部在册客户（排除 owner + 已添加，由调用方传入）。
 * 选中即加入（可连选，列表实时收缩）；带关系备注辅助辨认。
 */
function ParticipantPicker({
  candidates,
  onPick,
}: {
  candidates: Customer[]
  onPick: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const list = q ? candidates.filter((c) => c.full_name.toLowerCase().includes(q)) : candidates

  return (
    <div className="overflow-hidden rounded-xl border border-brand-100 bg-white focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-100">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="输入姓名筛选…"
        aria-label="筛选本案参与人"
        className="w-full border-b border-line px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-faint"
      />
      <ul className="max-h-56 divide-y divide-line overflow-auto" role="listbox" aria-label="添加本案参与人">
        {list.length === 0 ? (
          <li className="px-3.5 py-3 text-sm text-faint">
            {candidates.length === 0 ? '没有可添加的客户了（可先在「客户列表」新建）' : '没有匹配的客户'}
          </li>
        ) : (
          list.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => onPick(c.id)}
                className="flex min-h-11 w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-2"
              >
                <span className="truncate font-medium">{c.full_name}</span>
                {c.relationship_to_primary && (
                  <span className="shrink-0 text-xs text-faint">{c.relationship_to_primary}</span>
                )}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
