import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { VisaSubclassField } from './VisaSubclassField'
import { ParentCaseField } from './ParentCaseField'
import { useCustomers } from '../../hooks/queries/useCustomers'
import { useCases } from '../../hooks/queries/useCases'
import { selectFamilyGroupMembers } from '../../lib/family'
import { parentCaseDropdown } from '../../lib/parentCase'
import { relationshipOf, relationshipPatch } from '../../lib/caseRelationship'
import type { CaseRelationship } from '../../lib/caseRelationship'
import type { Case, CaseInsert } from '../../types/models'

export interface CaseFormValues extends CaseInsert {
  customer_id: string
  visa_subclass: string
  visa_stream: string | null
  sync_tracking: boolean
  trt_reminder_enabled: boolean
  parent_case_id: string | null
  parent_sync_progress: boolean
}

const RELATIONSHIP_OPTIONS: { value: CaseRelationship; label: string }[] = [
  { value: 'independent', label: '独立案件（默认）' },
  { value: 'linked', label: '关联主案件，进度独立' },
  { value: 'synced', label: '关联主案件，进度同步' },
]

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
  const [destination, setDestination] = useState(initial?.destination_country ?? 'Australia')
  const [currency, setCurrency] = useState(initial?.currency ?? 'AUD')
  // 仅决定财务核算口径（true=合并账单；false=按申请人分开）。案件进度永远同步追踪，无开关。
  const [financeCombined, setFinanceCombined] = useState(initial?.sync_tracking ?? true)
  const [trtReminder, setTrtReminder] = useState(initial?.trt_reminder_enabled ?? false)
  const [relationship, setRelationship] = useState<CaseRelationship>(
    initial ? relationshipOf(initial) : 'independent',
  )
  const [parentCaseId, setParentCaseId] = useState<string | null>(initial?.parent_case_id ?? null)
  const [applicantIds, setApplicantIds] = useState<string[]>(initialApplicantIds ?? [])

  const is482 = visaSubclass.trim().startsWith('482')

  // 候选副申请人 = 与主申同家庭组的其他成员（双向：主申↔副申、同主申的副申之间）
  const allCustomers = useCustomers({})
  const allCases = useCases()

  function toggleApplicant(id: string) {
    setApplicantIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit(
      {
        customer_id: customerId,
        visa_subclass: visaSubclass.trim(),
        visa_stream: visaStream && visaStream.trim() !== '' ? visaStream.trim() : null,
        destination_country: trimOrNull(destination),
        currency: currency.trim() || 'AUD',
        sync_tracking: financeCombined,
        // 仅 482 才可能开启；切到非 482 自动清掉，避免残留 true
        trt_reminder_enabled: is482 ? trtReminder : false,
        // 三态关系 → parent_case_id + parent_sync_progress（独立态自动清空两者）
        ...relationshipPatch(relationship, parentCaseId),
      },
      applicantIds,
    )
  }

  const candidates = selectFamilyGroupMembers(customerId, allCustomers.data ?? [])
  const customersData = allCustomers.data ?? []
  const casesData = allCases.data ?? []
  // 主案件下拉：严格只列家庭主申名下案件（排除归档/本案、created_at 倒序）+ 空态判定
  const { state: parentState, candidates: parentCandidates } = parentCaseDropdown(
    casesData,
    customerId,
    customersData,
    initial?.id,
  )
  // 无家庭主申 / 主申无案件 → 不能关联，radio 2/3 置灰
  const canLink = parentState === 'has-cases'
  const emptyHint =
    parentState === 'no-family-primary'
      ? '（此客户无家庭主申请，无可关联案件）'
      : '（主申请尚无案件）'

  const isLinked = relationship !== 'independent'
  // 关联态必须选主案件才能保存
  const relationshipIncomplete = isLinked && !parentCaseId

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-slate-700">主申请客户</span>
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

      {is482 && (
        <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={trtReminder}
            onChange={(e) => setTrtReminder(e.target.checked)}
            className="mt-0.5 size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span>
            2 年转 186 TRT 提醒
            <span className="mt-0.5 block text-xs text-slate-500">
              下签满 22 个月后，在案件/客户/概览处提醒及时启动 186 TRT 永居（开了 186 TRT 案后自动消失）。
            </span>
          </span>
        </label>
      )}

      <fieldset className="rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-medium text-slate-600">副申请人 / 财务核算</legend>
        <div className="space-y-3">
          {candidates.length === 0 ? (
            <p className="text-sm text-slate-400">同家庭组暂无其他成员可作副申请人。可先到客户档案添加家庭成员。</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-500">选择本案件包含的副申请人：</p>
              {candidates.map((c) => (
                <label key={c.id} className="flex min-h-11 items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={applicantIds.includes(c.id)}
                    onChange={() => toggleApplicant(c.id)}
                    className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {c.full_name}
                  {c.relationship_to_primary ? <span className="text-slate-400">（{c.relationship_to_primary}）</span> : null}
                </label>
              ))}
            </div>
          )}

          <div className="border-t border-slate-100 pt-3">
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={financeCombined}
                onChange={(e) => setFinanceCombined(e.target.checked)}
                className="mt-0.5 size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                财务合并核算（勾选 = 主申 + 副申账单合并、一起算；不勾 = 按申请人 / 组别分开算）
              </span>
            </label>
            <p className="mt-1.5 pl-6 text-xs text-slate-400">
              案件进度始终同步追踪（主申 + 副申一起），此选项只影响财务核算口径。
            </p>
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-medium text-slate-600">与其他案件的关系</legend>
        <div className="space-y-3">
          <div className="space-y-2">
            {RELATIONSHIP_OPTIONS.map((opt) => {
              // 选项 2/3（关联）在无可关联案件时置灰禁用
              const disabled = opt.value !== 'independent' && !canLink
              return (
                <label
                  key={opt.value}
                  className={`flex min-h-11 items-center gap-2 text-sm ${disabled ? 'text-slate-300' : 'text-slate-700'}`}
                >
                  <input
                    type="radio"
                    name="case-relationship"
                    disabled={disabled}
                    checked={relationship === opt.value}
                    onChange={() => setRelationship(opt.value)}
                    className="size-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {opt.label}
                </label>
              )
            })}
          </div>

          {!canLink && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">{emptyHint}</p>
          )}

          {canLink && isLinked && (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <ParentCaseField value={parentCaseId} onChange={setParentCaseId} candidates={parentCandidates} />
              {relationship === 'synced' && (
                <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                  🔗 主案件 stage 变化将自动同步到本案件。
                </p>
              )}
            </div>
          )}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField label="目的国" value={destination} onChange={(e) => setDestination(e.target.value)} />
        <TextField label="货币" value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="AUD" />
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={submitting || visaSubclass.trim() === '' || relationshipIncomplete}>
          {submitting ? '保存中…' : '保存'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          取消
        </Button>
      </div>
    </form>
  )
}
