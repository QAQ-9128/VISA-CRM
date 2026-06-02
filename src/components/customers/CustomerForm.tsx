import { useState } from 'react'
import type { FormEvent, KeyboardEvent, ReactNode } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Textarea } from '../ui/Textarea'
import { Select } from '../ui/Select'
import { Checkbox } from '../ui/Checkbox'
import { EmployerSelect } from '../employers/EmployerSelect'
import { ReferrerSelect } from '../referrers/ReferrerSelect'
import { usePrimaryApplicants } from '../../hooks/queries/useCustomers'
import { CLIENT_SOURCES, CLIENT_SOURCE_OPTION_LABELS, GENDERS, GENDER_LABELS } from '../../types/domain'
import { initialFormState, toPayload } from '../../lib/customerForm'
import type { CustomerFormState, CustomerFormValues } from '../../lib/customerForm'
import type { Customer } from '../../types/models'

export type { CustomerFormValues }

interface CustomerFormProps {
  /** 编辑时传入现有客户 */
  initial?: Customer
  /** 新建时预选「挂靠到的主申请人」id（从主申档案「+ 添加副申请人」带 ?primary= 进来）。 */
  initialPrimaryId?: string
  submitting?: boolean
  error?: string | null
  onSubmit: (values: CustomerFormValues) => void
  onCancel: () => void
}

/** 表单分区：品牌色小标题 + 内容；非首段顶部带分隔线。 */
function Section({ title, first, children }: { title: string; first?: boolean; children: ReactNode }) {
  return (
    <section className={first ? '' : 'border-t border-line pt-[22px]'}>
      <h2 className="mb-[18px] text-[13px] font-bold tracking-wide text-brand">{title}</h2>
      <div className="space-y-[18px]">{children}</div>
    </section>
  )
}

export function CustomerForm({ initial, initialPrimaryId, submitting, error, onSubmit, onCancel }: CustomerFormProps) {
  const [state, setState] = useState<CustomerFormState>(() => initialFormState(initial, initialPrimaryId))
  // 家庭组模式：副申（挂靠主申）/ 主申（独立）。初值跟随是否已选主申。
  const [subMode, setSubMode] = useState(() => initialFormState(initial, initialPrimaryId).primary_applicant_id !== '')
  const primaries = usePrimaryApplicants()

  const set =
    <K extends keyof CustomerFormState>(key: K) =>
    (value: CustomerFormState[K]) =>
      setState((prev) => ({ ...prev, [key]: value }))

  // 主申请人下拉：排除自己（编辑时），未归档的主申请人
  const primaryOptions = (primaries.data ?? [])
    .filter((c) => c.id !== initial?.id)
    .map((c) => ({ value: c.id, label: c.full_name }))

  const sourceOptions = CLIENT_SOURCES.map((s) => ({ value: s, label: CLIENT_SOURCE_OPTION_LABELS[s] }))
  const nameFilled = state.full_name.trim() !== ''

  function pickPrimary() {
    setSubMode(true)
  }
  function pickSelf() {
    setSubMode(false)
    setState((prev) => ({ ...prev, primary_applicant_id: '', relationship_to_primary: '' }))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit(toPayload(state))
  }
  // Esc 取消（与底部提示一致）；Enter 由表单原生提交，textarea 内换行不受影响
  function handleKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key === 'Escape') onCancel()
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-[22px]">
      {/* 基本信息 */}
      <Section title="基本信息" first>
        <div>
          <TextField
            label="姓名"
            required
            value={state.full_name}
            onChange={(e) => set('full_name')(e.target.value)}
            placeholder="客户姓名"
          />
          {nameFilled && <p className="mt-1.5 text-xs font-medium text-emerald-600">✓ 必填项已填写</p>}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Select
              label="客户来源"
              placeholder="未分类"
              options={sourceOptions}
              value={state.client_source}
              onChange={(e) => set('client_source')(e.target.value)}
            />
          </div>
          <div className="sm:pb-2.5">
            <Checkbox checked={state.is_starred} onChange={set('is_starred')}>
              标注为优先客户（星标）
            </Checkbox>
          </div>
        </div>
      </Section>

      {/* 担保信息 */}
      <Section title="担保信息">
        <EmployerSelect value={state.sponsor_employer_id} onChange={(id) => set('sponsor_employer_id')(id)} />
        <TextField
          label="担保职位"
          value={state.sponsor_position}
          onChange={(e) => set('sponsor_position')(e.target.value)}
          placeholder="如：Senior Cook、Marketing Manager"
        />
      </Section>

      {/* 关系 */}
      <Section title="关系">
        <ReferrerSelect value={state.referrer_id} onChange={(id) => set('referrer_id')(id)} />

        {/* 家庭组 / 主副申请人 */}
        <div className="rounded-[18px] border border-brand-100 bg-brand-50/50 p-[18px]">
          <h3 className="mb-3 flex items-center gap-1.5 text-[13.5px] font-bold text-ink">
            <span aria-hidden>👥</span> 家庭组 / 主副申请人
          </h3>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="radio"
                name="familyMode"
                checked={!subMode}
                onChange={pickSelf}
                className="mt-0.5 size-4 accent-brand"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">本人是主申请人</span>
                <span className="block text-xs text-faint">默认 —— 新建一个独立客户</span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="radio"
                name="familyMode"
                checked={subMode}
                onChange={pickPrimary}
                className="mt-0.5 size-4 accent-brand"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">作为副申请人，挂靠到某位主申</span>
                <span className="block text-xs text-faint">选中后，下面出现「选择主申」下拉</span>
              </span>
            </label>

            {subMode && (
              <div className="space-y-3 border-t border-brand-100 pt-3">
                <Select
                  label="选择要挂靠的主申请人"
                  placeholder="选择要挂靠的主申请人…"
                  options={primaryOptions}
                  value={state.primary_applicant_id}
                  onChange={(e) => set('primary_applicant_id')(e.target.value)}
                />
                <TextField
                  label="与主申请人关系"
                  value={state.relationship_to_primary}
                  onChange={(e) => set('relationship_to_primary')(e.target.value)}
                  placeholder="如 配偶 / 子女 / 父母"
                />
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* 其他 */}
      <Section title="其他">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="生日"
            type="date"
            value={state.birth_date}
            onChange={(e) => set('birth_date')(e.target.value)}
          />
          <Select
            label="性别"
            placeholder="未填"
            options={GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }))}
            value={state.gender}
            onChange={(e) => set('gender')(e.target.value)}
          />
        </div>
        <Textarea
          label="备注"
          value={state.notes}
          onChange={(e) => set('notes')(e.target.value)}
          rows={4}
          placeholder="补充信息、沟通要点、特殊情况…"
          className="min-h-[104px] resize-y"
        />
      </Section>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {/* 底部：提示 + 操作 */}
      <div className="flex flex-col gap-3 border-t border-line pt-[22px] sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-faint">
          填写「姓名」后即可保存 · Enter 保存 / Esc 取消
        </p>
        <div className="flex justify-end gap-3">
          <Button type="submit" disabled={submitting || !nameFilled}>
            {submitting ? '保存中…' : '保存'}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            取消
          </Button>
        </div>
      </div>
    </form>
  )
}
