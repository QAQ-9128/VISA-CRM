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

interface CaseFormProps {
  customerId: string
  customerLabel: string
  initial?: Case
  /** 编辑时回填已选的副申请人客户 id */
  initialApplicantIds?: string[]
  submitting?: boolean
  error?: string | null
  onSubmit: (values: CaseFormValues, applicantIds: string[]) => void
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
  const [applicantIds, setApplicantIds] = useState<string[]>(initialApplicantIds ?? [])
  const [addingParticipant, setAddingParticipant] = useState(false)

  const is482 = visaSubclass.trim().startsWith('482')

  // 一案一组：参与候选 = 全部在册客户（任何人都可参加本案）；组码由参与人集合实时派生
  const allCustomers = useCustomers({})

  function addApplicant(id: string) {
    setApplicantIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }
  function removeApplicant(id: string) {
    setApplicantIds((prev) => prev.filter((x) => x !== id))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
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
    )
  }

  const customersData = allCustomers.data ?? []
  const customerById = Object.fromEntries(customersData.map((c) => [c.id, c])) as Record<string, Customer | undefined>
  // 一案一组：下拉候选 = 全部在册客户（不限"本组"——建案就是从全部客户里直接挑人组成本案），排除 owner + 已添加
  const pickerCandidates = customersData.filter(
    (c) => c.id !== customerId && !c.is_archived && !applicantIds.includes(c.id),
  )
  // 组码实时派生 = 案件客户 + 已勾选参与人（保存后与案件页/案件表一致）；新建单人案的码在保存后按案件 id 定
  const groupCodeStr = caseGroupCode([customerId, ...applicantIds], initial?.id ?? '')

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

      {/* Group：一案一组 —— 组 = 本案参与人集合，组码随下方勾选实时派生（只读，零入库） */}
      <fieldset className="rounded-[14px] border border-line-2 p-4">
        <legend className="px-1 text-sm font-semibold text-body">Group（本案的组）</legend>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Group ID</span>
          <span className="rounded-full bg-[var(--color-lime-soft)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--color-lime-ink)]">
            {groupCodeStr}
          </span>
          <span className="text-xs text-faint">
            共 {applicantIds.length + 1} 人 · 组 = 本案参与人（在下方勾选），同参与人的案件同组
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

      {/* 本案参与人：owner 固定首位 + 「+ 添加」下拉（候选=全部客户）；账目是参与的自动结果 */}
      <fieldset className="rounded-[14px] border border-line-2 p-4">
        <legend className="px-1 text-sm font-semibold text-body">本案参与人</legend>
        <div className="space-y-2.5">
          <p className="text-sm text-slate-500">选择本案参与人</p>

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField label="目的国" value={destination} onChange={(e) => setDestination(e.target.value)} />
        <TextField label="货币" value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="AUD" />
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" disabled={submitting || visaSubclass.trim() === ''}>
          {submitting ? '保存中…' : '保存'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          取消
        </Button>
      </div>
    </form>
  )
}

/**
 * 「添加本案参与人」可筛选下拉：候选 = 全部在册客户（排除 owner + 已添加，由调用方传入）。
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
