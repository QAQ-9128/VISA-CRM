import { useMemo, useState } from 'react'
import type { FormEvent, KeyboardEvent, ReactNode } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Textarea } from '../ui/Textarea'
import { Select } from '../ui/Select'
import { Checkbox } from '../ui/Checkbox'
import { useConfirm } from '../ui/useConfirm'
import { ReferrerSelect } from '../referrers/ReferrerSelect'
import { NameFields } from './NameFields'
import { OwnerSelect } from './OwnerSelect'
import { CaseJoinPicker } from './CaseJoinPicker'
import { QuickPersonCreate } from './QuickPersonCreate'
import { useJoinableCases } from '../../hooks/queries/useJoinableCases'
import { CLIENT_SOURCES, CLIENT_SOURCE_OPTION_LABELS, GENDERS, GENDER_LABELS } from '../../types/domain'
import { initialFormState, toPayload } from '../../lib/customerForm'
import type { CustomerFormState, CustomerFormValues } from '../../lib/customerForm'
import type { Customer } from '../../types/models'

export type { CustomerFormValues }

/** 保存后的去向：detail=客户详情（默认）；new-case=直接进新建案件（重录数据快捷路径）。 */
export type CustomerFormNext = 'detail' | 'new-case'

interface CustomerFormProps {
  /** 编辑时传入现有客户 */
  initial?: Customer
  submitting?: boolean
  error?: string | null
  /** joinCaseId：选了「加入已有案件」时为该案件 id（保存后写 case_applicants），否则 null；
   *  companionIds：组区就地快速建档的「同组的人」——保存并新建案件时自动预选为本案参与人，
   *  选了加入已有案件时随主客户一并加入该案 */
  onSubmit: (
    values: CustomerFormValues,
    joinCaseId: string | null,
    next: CustomerFormNext,
    companionIds: string[],
  ) => void
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

export function CustomerForm({ initial, submitting, error, onSubmit, onCancel }: CustomerFormProps) {
  const initialSnapshot = useMemo(() => initialFormState(initial), [initial])
  const [state, setState] = useState<CustomerFormState>(initialSnapshot)
  const { confirm, confirmNode } = useConfirm()
  // 一案一组：加入已有案件（成为本案参与人）/ 新建独立客户（自成一组）
  const [joinMode, setJoinMode] = useState(false)
  const [joinCaseId, setJoinCaseId] = useState<string | null>(null)
  // 组区就地建档的「同组的人」（TA 们还没档案 → 当场建）：保存时随成组路径落地
  const [companions, setCompanions] = useState<{ id: string; full_name: string }[]>([])
  const [creatingCompanion, setCreatingCompanion] = useState(false)
  // 可加入案件口径与快速建档卡共用（CaseJoinPicker.tsx 的 useJoinableCases）
  const { joinableCases, applicants, customerById } = useJoinableCases()

  const set =
    <K extends keyof CustomerFormState>(key: K) =>
    (value: CustomerFormState[K]) =>
      setState((prev) => ({ ...prev, [key]: value }))

  const selectedCase = joinCaseId ? joinableCases.find((c) => c.id === joinCaseId) ?? null : null

  const sourceOptions = CLIENT_SOURCES.map((s) => ({ value: s, label: CLIENT_SOURCE_OPTION_LABELS[s] }))
  // 至少填一个名；编辑老数据（只有旧 full_name）不强迫补录两栏
  const nameFilled =
    state.chinese_name.trim() !== '' || state.english_name.trim() !== '' || state.full_name.trim() !== ''
  // 选了「加入已有案件」却没选案件 → 禁存（之前会默默存成独立客户，用户以为加入失败）
  const joinIncomplete = joinMode && !joinCaseId

  function pickJoin() {
    setJoinMode(true)
  }
  function pickNewGroup() {
    setJoinMode(false)
    setJoinCaseId(null)
  }

  function submit(next: CustomerFormNext) {
    if (!nameFilled || submitting || joinIncomplete) return
    onSubmit(toPayload(state), joinMode ? joinCaseId : null, next, companions.map((c) => c.id))
  }
  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    submit('detail')
  }
  // 有未保存改动时，取消前确认，避免误丢
  const dirty =
    JSON.stringify(state) !== JSON.stringify(initialSnapshot) || companions.length > 0 || joinMode
  async function requestCancel() {
    if (
      dirty &&
      !(await confirm({ title: '放弃编辑', description: '有未保存的修改，确定放弃？', confirmLabel: '放弃', tone: 'danger' }))
    )
      return
    onCancel()
  }
  // Esc 取消（与底部提示一致）；Enter 由表单原生提交，textarea 内换行不受影响
  function handleKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key === 'Escape') requestCancel()
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-[22px]">
      {/* 基本信息 */}
      <Section title="基本信息" first>
        <div>
          {/* 姓名拆两栏（中文优先显示，英文按录入原样）；至少填一个名（编辑老数据可两空靠旧 full_name 兜底） */}
          <NameFields
            chineseName={state.chinese_name}
            englishName={state.english_name}
            onChineseChange={set('chinese_name')}
            onEnglishChange={set('english_name')}
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

        {/* 生日/性别归基本信息（与组区建人块同序：姓名→性别→生日，两处心智一致） */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label="性别"
            placeholder="未填"
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
      </Section>

      {/* 担保信息（担保雇主/担保职位已移到案件级，由案件表单录入）：客户表单不再录入 */}

      {/* 关系 */}
      <Section title="关系">
        {/* 归属人（与介绍人同表 kind=owner；选择或输入新名字即创建）与介绍人并列、互不混 */}
        <OwnerSelect
          value={state.owner_referrer_id || null}
          onChange={(id) => set('owner_referrer_id')(id ?? '')}
        />
        <ReferrerSelect value={state.referrer_id} onChange={(id) => set('referrer_id')(id)} />

        {/* 组（Group）：一案一组。不勾任何东西本身就是独立客户——「新建独立客户」选项已删
            （2026-06 用户拍板：无需专门一个选择来展现默认态），只留可选的「加入已有案件」 */}
        <div className="rounded-[18px] border border-brand-100 bg-brand-50/50 p-[18px]">
          <h3 className="mb-3 flex items-center gap-1.5 text-[13.5px] font-bold text-ink">
            <span aria-hidden>🧩</span> 组（Group）
          </h3>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={joinMode}
                onChange={(e) => (e.target.checked ? pickJoin() : pickNewGroup())}
                className="mt-0.5 size-4 accent-brand"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">加入已有案件（成为本案参与人）</span>
                <span className="block text-xs text-faint">选择一个案件，保存后 TA 加入该案的组；不勾 = 独立客户（自成一组）</span>
              </span>
            </label>

            {joinMode && (
              <div className="space-y-3 border-t border-brand-100 pt-3">
                <CaseJoinPicker
                  cases={joinableCases}
                  applicants={applicants}
                  customerById={customerById}
                  value={joinCaseId}
                  onChange={setJoinCaseId}
                />
                {selectedCase && (
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    将加入案件
                    <span className="font-semibold text-ink tabular-nums">{selectedCase.case_number}</span>
                    —— 保存后成为本案参与人，组随参与人集合自动更新
                  </p>
                )}
              </div>
            )}

            {/* 同组的人还没建档 → 当场快速建（2026-06 拍板：建案时 TA 们自动预选为参与人）。
                说明常驻：用户加人之前就要知道「加了会怎样」 */}
            <div className="border-t border-brand-100 pt-3">
              <p className="mb-2 text-xs text-faint">
                同组的人还没有档案？在这里先建好——TA 们会随本客户一并加入所选案件，或在「保存并新建案件」时自动成为本案参与人
              </p>
              {companions.length > 0 && (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-[12.5px] font-semibold text-muted">同组的人</span>
                  {companions.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pr-1 pl-2.5 text-[12px] font-semibold text-ink"
                    >
                      {p.full_name}
                      <button
                        type="button"
                        aria-label={`将 ${p.full_name} 移出同组名单`}
                        title="移出同组名单（TA 的档案保留）"
                        onClick={() => setCompanions((list) => list.filter((x) => x.id !== p.id))}
                        className="grid size-5 place-items-center rounded-full text-[11px] text-faint hover:bg-rose-50 hover:text-rose-600"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {creatingCompanion ? (
                <QuickPersonCreate
                  onCreated={(p) =>
                    // 按 id 去重：防 onSuccess 偶发重入把同一个人塞两次（真重名是不同 id，允许）
                    setCompanions((list) => (list.some((x) => x.id === p.id) ? list : [...list, p]))
                  }
                  onCancel={() => setCreatingCompanion(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setCreatingCompanion(true)}
                  className="text-[12.5px] font-semibold text-brand hover:text-brand-600"
                >
                  + 快速建档同组的人（TA 还没有档案）
                </button>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* 其他 */}
      <Section title="其他">
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
          填写「中文名或英文名」后即可保存 · Enter 保存 / Esc 取消
        </p>
        <div className="flex flex-wrap justify-end gap-3">
          {joinIncomplete && <span className="self-center text-xs text-amber-700">先在上方选择要加入的案件</span>}
          <Button type="submit" disabled={submitting || !nameFilled || joinIncomplete}>
            {submitting ? '保存中…' : '保存'}
          </Button>
          {/* 重录数据快捷路径：建完人直接进「新建案件」（仅新建独立客户时；加入已有案件无此场景） */}
          {!initial && !joinMode && (
            <Button type="button" variant="secondary" disabled={submitting || !nameFilled} onClick={() => submit('new-case')}>
              保存并新建案件
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={requestCancel}>
            取消
          </Button>
        </div>
      </div>
      {confirmNode}
    </form>
  )
}
