import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { TextField } from '../ui/TextField'
import { Select } from '../ui/Select'
import { CaseTypeCascade } from './CaseTypeCascade'
import { useCustomers } from '../../hooks/queries/useCustomers'
import {
  useAddCaseApplicant,
  useRemoveCaseApplicant,
  useRemoveSelfFromCase,
} from '../../hooks/queries/useCaseApplicants'
import { caseGroupCode } from '../../lib/caseGroups'
import {
  cascadeFromCase,
  cascadeStream,
  cascadeSubclass,
  pruneDetails,
  EMPLOYER_TYPES,
  EMPTY_CASCADE,
  SPONSOR_TYPES,
} from '../../lib/caseTypeCascade'
import type { CascadeValue } from '../../lib/caseTypeCascade'
import type { Case, CaseInsert, Customer } from '../../types/models'

// 一案一组：案件是自包含的一组人，案件与案件之间没有任何关系（「与其他案件的关系」已删；
// 提交不写 parent_case_id —— 新建落库默认 null，编辑不传则旧值原样保留、不报错）。
export interface CaseFormValues extends CaseInsert {
  customer_id: string
  visa_subclass: string
  visa_stream: string | null
  sync_tracking: boolean
  trt_reminder_enabled: boolean
  /** 表单保存恒复位为 false：勾选框即提醒开关，「不再提醒」的停用状态只活到下次保存（可逆，对齐同居提醒模型） */
  trt_reminder_dismissed: boolean
}

/** 保存后的去向：detail=客户详情（默认）；fees=直接滚到费用记录卡开始记账（重录数据快捷路径）。 */
export type CaseFormNext = 'detail' | 'fees'

interface CaseFormProps {
  customerId: string
  customerLabel: string
  initial?: Case
  /** 新建模式的级联预填（如从 TRT 提醒卡进来：大类=签证申请 / 类型=186 ENS / Stream=TRT）。编辑模式忽略。 */
  prefill?: CascadeValue
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
  prefill,
  initialApplicantIds,
  submitting,
  error,
  onSubmit,
  onCancel,
}: CaseFormProps) {
  // 案件大类 → 案件类型 → 动态子字段 级联（照 图片/new_case.html Step1+Step2）：新建/编辑共用同一套。
  // 编辑模式用 cascadeFromCase 反向回填现有案件；旧库里这 8 类外的签证反推不出 → 大类/类型留空（需重选才能存）。
  // 新建模式可由 prefill 预填（如 TRT 提醒卡：186 ENS · TRT）。
  const [cascade, setCascade] = useState<CascadeValue>(initial ? cascadeFromCase(initial) : prefill ?? EMPTY_CASCADE)
  const [destination, setDestination] = useState(initial?.destination_country ?? 'Australia')
  const [currency, setCurrency] = useState(initial?.currency ?? 'AUD')
  // 财务口径已统一按人(applicant_id)归属：新案固定 sync_tracking=false；编辑保留原值（旧合并案件兼容，不动数据）
  const financeCombined = initial?.sync_tracking ?? false
  // 勾选框显示「实际生效状态」（enabled 且未被「不再提醒」停掉）：dismissed 案件不显示假勾选
  const [trtReminder, setTrtReminder] = useState(
    initial ? initial.trt_reminder_enabled && !initial.trt_reminder_dismissed : false,
  )
  const [cohabReminder, setCohabReminder] = useState(initial?.cohab_reminder_enabled ?? false)
  // 参与人：新建模式存本地状态、保存时一次写入；编辑模式直接对已有案件增量增删、即时写库
  const editing = !!initial
  const [applicantIds, setApplicantIds] = useState<string[]>(initialApplicantIds ?? [])

  // 入库 visa_subclass = 级联派生（''=选择不完整 → 保存禁用）。新建/编辑同一口径。
  const derivedSubclass = cascadeSubclass(cascade.category, cascade.visaType, cascade.stream)
  // 「2 年转 186 TRT 提醒」勾选框仅在 签证类型 = 482 TSS 时渲染并写入（482 SBS / 186 / 600… 一律不出现、不写标记）。
  const is482tss = cascade.visaType === '482'
  // 「3 个月提醒 · 更新同居材料」仅 186 ENS + 配偶签（820/309）渲染并写入。
  const isCohabType = cascade.visaType === '186' || cascade.visaType === '820' || cascade.visaType === '309'
  const canSave = derivedSubclass !== ''

  // 参与候选 = 全部在册客户
  const allCustomers = useCustomers({})
  // 编辑模式：组成员增量即时写库（案件已存在、有 caseId）；新建模式：本地状态、保存时一次写入
  const addMemberM = useAddCaseApplicant()
  const removeMemberM = useRemoveCaseApplicant()
  // 案件客户行移出 = 过户给其余参与人（复用现有 removeSelfFromCase：唯一参与人会被它拦下并 toast）
  const removeSelfM = useRemoveSelfFromCase()
  const removingAny = removeMemberM.isPending || removeSelfM.isPending

  function onAddMember(id: string) {
    if (editing && initial) addMemberM.mutate({ caseId: initial.id, customerId: id })
    else setApplicantIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }
  function onRemoveMember(id: string) {
    if (editing && initial) removeMemberM.mutate({ caseId: initial.id, customerId: id })
    else setApplicantIds((prev) => prev.filter((x) => x !== id))
  }
  // 移出案件客户（owner）：仅编辑模式可行——过户给其余参与人（cases.customer_id 改写）。
  // 新建模式案件尚不存在、无法过户 → owner 行的 × 在 UI 上禁用。
  function onRemoveOwner() {
    if (editing && initial) removeSelfM.mutate({ caseId: initial.id, customerId })
  }

  function submit(next: CaseFormNext) {
    if (submitting || !canSave) return
    // 从级联派生入库值（新建/编辑同一口径）；担保字段只在相关类型下写入（切走自动清空，不残留）
    onSubmit(
      {
        customer_id: customerId,
        destination_country: trimOrNull(destination),
        currency: currency.trim() || 'AUD',
        sync_tracking: financeCombined,
        // 仅 482 TSS 才可能开启；切到其它签证类型自动清掉，避免残留 true
        trt_reminder_enabled: is482tss ? trtReminder : false,
        // 保存恒复位：勾选 = 复活提醒；未勾 = enabled 已是 false，dismissed 无需保留
        trt_reminder_dismissed: false,
        // 仅 186/配偶签才可能开启（同上：切走清空，不残留）
        cohab_reminder_enabled: isCohabType ? cohabReminder : false,
        case_category: cascade.category || null,
        visa_subclass: derivedSubclass,
        visa_stream: cascadeStream(cascade.visaType, cascade.stream),
        sponsor_position:
          cascade.visaType && SPONSOR_TYPES.has(cascade.visaType) ? trimOrNull(cascade.sponsorPosition) : null,
        sponsor_employer_id:
          cascade.visaType && EMPLOYER_TYPES.has(cascade.visaType) ? cascade.sponsorEmployerId || null : null,
        case_details: pruneDetails(cascade.details),
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
  // 组成员集合（不含案件客户）：编辑=随 prop（增删 mutation 失效缓存 → 父查询重取 → 此处自动更新；
  // existingApplicants 异步到达后照常更新，避免定格空值把多人案件显示成「1 人」）；新建=本地勾选实时变
  const displayApplicantIds = editing ? initialApplicantIds ?? [] : applicantIds
  const pickerCandidates = customersData.filter(
    (c) => c.id !== customerId && !c.is_archived && !displayApplicantIds.includes(c.id),
  )
  const groupCodeStr = caseGroupCode([customerId, ...displayApplicantIds], initial?.id ?? '')

  // 参与人统一平铺列表（案件客户在首位，但无任何主/副标识）：[owner, ...成员]。
  // owner 行的移出仅编辑模式可用（= 过户）；新建模式或唯一参与人时禁用。
  const participants = [
    { id: customerId, name: customerLabel, isOwner: true },
    ...displayApplicantIds.map((id) => ({
      id,
      name: customerById[id]?.full_name ?? '（未知客户）',
      isOwner: false,
    })),
  ]
  const ownerRemovable = editing && displayApplicantIds.length >= 1 // 过户需有承接人

  // 新建模式渐进披露（照 new_case.html：选完类型才出 Group/操作区）；编辑模式恒显
  const showRest = editing || canSave

  // 组（Group）/参与人/目的国/货币/按钮：编辑=平铺（外层页卡）；新建=选完类型后套卡淡入。
  // 「2 年转 186 TRT 提醒」勾选框已并入上方 CaseTypeCascade 的 482 TSS 签证详情卡（与签证子类别/担保配套）。
  const restBlocks = (
    <>
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
            {editing ? '组 = 本案参与人（在下方增删，即时保存）' : '组 = 本案参与人（在下方选择），同参与人的案件同组'}
          </span>
        </div>
      </fieldset>

      {/* 本案参与人（参与人完全平级，无主/副之分）：紧凑单行列表 + 行尾 × 移出 + ＋ 添加面板。
          新建=建案一次选好（本地）；编辑=即时增删/过户（增量写库，不必去客户页）。 */}
      <div className="rounded-[14px] border border-line-2 p-4">
        {/* 标题（Noto Serif）+ 标题下小灰字：增减立即生效说明 */}
        <h3 className="font-serif text-[17px] font-bold tracking-[-0.01em] text-ink">本案参与人</h3>
        <p className="mt-1 text-[12.5px] text-faint">
          {editing ? '增减成员立即生效，无需保存' : '选择本案参与人，保存案件时一并写入'}
        </p>
        {/* ?with= 一条龙带过来的预选人：说明来源，免得用户以为系统乱填（仅新建） */}
        {!editing && (initialApplicantIds?.length ?? 0) > 0 && (
          <p className="mt-1 text-xs text-faint">已自动带入上一步「快速建档同组的人」，不需要的可移出</p>
        )}

        {/* 紧凑单行列表：序号圆标 + 姓名 + 行尾 ×（全部同款；都可移出，owner 行移出=过户） */}
        <ul className="mt-3 space-y-2">
          {participants.map((p, i) => {
            const removable = p.isOwner ? ownerRemovable : true
            const disabledTitle = p.isOwner
              ? editing
                ? '本案唯一参与人不可移出（可改用归档/删除本案）'
                : '案件客户（案件归属）。建案后可在此过户给其他参与人'
              : ''
            return (
              <li
                key={p.id}
                className="flex min-h-11 items-center gap-3 rounded-[12px] bg-surface-2/70 px-3 py-1.5"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-[12px] font-semibold tabular-nums text-brand-700">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{p.name}</span>
                <button
                  type="button"
                  aria-label={`移出 ${p.name}`}
                  title={removable ? `移出 ${p.name}` : disabledTitle}
                  disabled={!removable || removingAny}
                  onClick={() => (p.isOwner ? onRemoveOwner() : onRemoveMember(p.id))}
                  className="grid size-7 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-faint"
                >
                  <span aria-hidden className="text-[15px] leading-none">×</span>
                </button>
              </li>
            )
          })}
        </ul>

        {/* 添加参与人：下拉框选择即加入（与「移出」对称的下拉交互；选中即增量加入，value 复位回占位）。
            无可加客户 → 占位为空态文案。 */}
        <div className="mt-2.5">
          <Select
            label="添加参与人"
            placeholder={pickerCandidates.length === 0 ? '没有可添加的客户了（可先在客户列表新建）' : '选择客户加入本案…'}
            value=""
            disabled={pickerCandidates.length === 0 || addMemberM.isPending}
            options={pickerCandidates.map((c) => ({
              value: c.id,
              label: c.relationship_to_primary ? `${c.full_name}（${c.relationship_to_primary}）` : c.full_name,
            }))}
            onChange={(e) => {
              if (e.target.value) onAddMember(e.target.value)
            }}
          />
        </div>

        {/* 底部细分隔线 + 小灰字：账目说明 */}
        <p className="mt-3 flex items-center gap-1.5 border-t border-line pt-2.5 text-xs text-faint">
          <span aria-hidden className="size-1.5 rounded-full bg-faint/60" />
          账目自动按参与人分开计算并汇总
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField label="目的国" value={destination} onChange={(e) => setDestination(e.target.value)} />
        <TextField label="货币" value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="AUD" />
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="flex flex-wrap justify-end gap-3 pt-2">
        <Button type="submit" disabled={submitting || !canSave}>
          {submitting ? '保存中…' : '保存'}
        </Button>
        {/* 重录数据快捷路径：保存后直接滚到费用记录卡开始记账 */}
        <Button
          type="button"
          variant="secondary"
          disabled={submitting || !canSave}
          onClick={() => submit('fees')}
        >
          保存并记账
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          取消
        </Button>
      </div>
    </>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 案件客户（编辑模式；新建模式由页头客户 pill 展示） */}
      {editing && (
        <div className="space-y-1.5">
          <span className="block text-sm font-semibold text-body">案件客户</span>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
            {customerLabel}
          </div>
        </div>
      )}

      {/* 案件大类 → 案件类型 → 动态子字段 级联（双卡，照 new_case.html Step1+Step2）：新建/编辑共用，
          唯一案件类型录入口；担保并入 482/186 等类型，编辑模式由 cascadeFromCase 回填 */}
      <CaseTypeCascade
        value={cascade}
        onChange={setCascade}
        trtReminder={trtReminder}
        onTrtReminderChange={setTrtReminder}
        cohabReminder={cohabReminder}
        onCohabReminderChange={setCohabReminder}
      />

      {/* 渐进披露（照 new_case.html）：选完类型才出 Group/参与人/操作区，套卡淡入（编辑模式恒显） */}
      {showRest && (
        <Card className="animate-[fadeUp_.3s_ease_both]">
          <div className="space-y-5">{restBlocks}</div>
        </Card>
      )}
    </form>
  )
}
