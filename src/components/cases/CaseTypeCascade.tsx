import { Card } from '../ui/Card'
import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import { EmployerSelect } from '../employers/EmployerSelect'
import {
  ASSESS_BODIES,
  DEFACTO_PURPOSES,
  EMPLOYER_TYPES,
  EMPTY_CASCADE,
  SPONSOR_TYPES,
  STATIC_LOCATION,
  STREAM_OPTIONS,
  SUB_TITLES,
  VISA_TYPES,
  showSponsorFields,
} from '../../lib/caseTypeCascade'
import type { CascadeValue, VisaTypeKey } from '../../lib/caseTypeCascade'
import { CASE_CATEGORIES } from '../../types/domain'
import type { CaseCategory } from '../../types/domain'

/**
 * 新建案件「案件大类 → 案件类型 → 动态子字段」级联块（照 图片/new_case.html Step1+Step2 的字段集，
 * 全部换本站清新绿令牌/Noto 字体；不带它的 Group 区/主副申/ID 生成——组模型用现有「案件即组」）。
 * 纯受控组件：状态在 CaseForm（CascadeValue/EMPTY_CASCADE 在 lib/caseTypeCascade）；
 * 切大类清空全部下级，切类型清空子字段（不残留）。
 */

export function CaseTypeCascade({
  value,
  onChange,
  trtReminder = false,
  onTrtReminderChange,
  cohabReminder = false,
  onCohabReminderChange,
}: {
  value: CascadeValue
  onChange: (next: CascadeValue) => void
  /** 「2 年转 186 TRT 提醒」开关：仅 482 TSS 的签证详情卡内渲染（与签证子类别/担保配套）。 */
  trtReminder?: boolean
  onTrtReminderChange?: (next: boolean) => void
  /** 「3 个月提醒 · 更新同居材料」开关：仅 186 ENS + 配偶签（820/309）的签证详情卡内渲染。 */
  cohabReminder?: boolean
  onCohabReminderChange?: (next: boolean) => void
}) {
  const { category, visaType } = value
  const setDetail = (key: string, v: string) => onChange({ ...value, details: { ...value.details, [key]: v } })
  const detail = (key: string) => value.details[key] ?? ''

  const streamCfg = visaType ? STREAM_OPTIONS[visaType] : undefined
  const showSub =
    (category === '签证申请' && visaType !== '') ||
    category === '职业评估' ||
    category === 'De Facto 关系认定' ||
    category === '定制文件'
  const subTitle =
    category === '签证申请'
      ? visaType
        ? SUB_TITLES[visaType]
        : ''
      : category === '职业评估'
        ? '职业评估'
        : category === 'De Facto 关系认定'
          ? 'De Facto 关系认定'
          : '定制文件'

  return (
    <div className="space-y-4">
      {/* Step1 卡：案件类型（照 new_case.html card-title 小标题；切大类 → 下级全部清空） */}
      <Card className="animate-[fadeUp_.3s_ease_both]">
        <div className="mb-5 text-[11px] font-semibold tracking-[0.08em] text-faint">案件类型</div>
        <div className="space-y-5">
          <Select
            label="案件大类"
            placeholder="— 请选择 —"
            options={CASE_CATEGORIES.map((c) => ({ value: c, label: c }))}
            value={category}
            onChange={(e) => {
              // 切大类清空全部下级；TRT/同居提醒是独立状态，一并复位避免残留
              onTrtReminderChange?.(false)
              onCohabReminderChange?.(false)
              onChange({ ...EMPTY_CASCADE, category: e.target.value as '' | CaseCategory })
            }}
          />

          {/* 签证申请 → 签证类型（切换 → 清空子字段） */}
          {category === '签证申请' && (
            <Select
              label="签证类型"
              placeholder="— 请选择 —"
              options={VISA_TYPES.map((t) => ({ value: t.key, label: t.label }))}
              value={visaType}
              onChange={(e) => {
                // 切签证类型即清空子字段；TRT/同居提醒是独立状态，一并复位避免类型来回切后勾选残留
                onTrtReminderChange?.(false)
                onCohabReminderChange?.(false)
                onChange({ ...EMPTY_CASCADE, category, visaType: e.target.value as '' | VisaTypeKey })
              }}
            />
          )}
        </div>
      </Card>

      {/* Step2 卡：按选择动态出子字段（key=标题 → 切类型重放淡入） */}
      {showSub && (
        <Card key={subTitle} className="animate-[fadeUp_.3s_ease_both] space-y-5">
          <div className="mb-5 text-[11px] font-semibold tracking-[0.08em] text-faint">{subTitle || '签证详情'}</div>

          {/* 签证类：子类别/Stream/当前阶段（值=现有目录 stream，标签照参照稿） */}
          {streamCfg && (
            <Select
              label={streamCfg.label}
              placeholder="— 请选择 —"
              options={streamCfg.options}
              value={value.stream}
              onChange={(e) => {
                const stream = e.target.value
                // 切到「副申请」等隐藏担保的子类别 → 即时清空担保职位/雇主，避免残留脏数据
                const next = { ...value, stream }
                if (!showSponsorFields(visaType, stream)) {
                  // 副申请：无自己的担保职位/雇主，也不做自己的 2 年转 186 → 一并清空
                  next.sponsorPosition = ''
                  next.sponsorEmployerId = ''
                  onTrtReminderChange?.(false)
                }
                onChange(next)
              }}
            />
          )}

          {/* 担保职位（仅 482 / 186 / 407；482 选「副申请」时隐藏） */}
          {visaType && SPONSOR_TYPES.has(visaType) && showSponsorFields(visaType, value.stream) && (
            <TextField
              label="担保职位"
              value={value.sponsorPosition}
              onChange={(e) => onChange({ ...value, sponsorPosition: e.target.value })}
              placeholder="职位名称（ANZSCO）"
            />
          )}

          {/* 担保雇主 / 雇主名称（482 / 186 / 482sbs / 407；482 选「副申请」时隐藏） */}
          {visaType && EMPLOYER_TYPES.has(visaType) && showSponsorFields(visaType, value.stream) && (
            <EmployerSelect
              label={visaType === '482sbs' ? '雇主名称' : '担保雇主'}
              value={value.sponsorEmployerId}
              onChange={(id) => onChange({ ...value, sponsorEmployerId: id })}
            />
          )}

          {/* 482 TSS：2 年转 186 TRT 提醒（仅主申；副申请 Subsequent Entrant 不做自己的转 186，隐藏） */}
          {visaType === '482' && showSponsorFields(visaType, value.stream) && onTrtReminderChange && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={trtReminder}
                onChange={(e) => onTrtReminderChange(e.target.checked)}
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

          {/* 186 ENS + 配偶签：3 个月循环提醒「更新同居材料」（持续收集关系/同居证据；每满 3 个月提醒一次） */}
          {(visaType === '186' || visaType === '820' || visaType === '309') && onCohabReminderChange && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={cohabReminder}
                onChange={(e) => onCohabReminderChange(e.target.checked)}
                className="mt-0.5 size-4 rounded border-slate-300 text-brand focus:ring-brand"
              />
              <span>
                3 个月提醒 · 更新同居材料
                <span className="mt-0.5 block text-xs text-slate-500">
                  每满 3 个月在案件/客户/概览处提醒一次，持续收集同居/关系证据；获批或终止后自动停止。
                </span>
              </span>
            </label>
          )}

          {/* 482 SBS：ABN（→ case_details） */}
          {visaType === '482sbs' && (
            <TextField label="ABN" value={detail('ABN')} onChange={(e) => setDetail('ABN', e.target.value)} placeholder="Australian Business Number" />
          )}

          {/* 500：就读院校（→ case_details） */}
          {visaType === '500' && (
            <TextField label="就读院校" value={detail('就读院校')} onChange={(e) => setDetail('就读院校', e.target.value)} placeholder="学校名称" />
          )}

          {/* 配偶签证：静态申请地点（由类型隐含，不入库） */}
          {visaType && STATIC_LOCATION[visaType] && (
            <div className="space-y-1.5">
              <span className="block text-[13.5px] font-semibold text-body">申请地点</span>
              <div className="rounded-[14px] border border-line-2 bg-surface-2 px-3.5 py-3 text-[15px] text-muted">
                {STATIC_LOCATION[visaType]}
              </div>
            </div>
          )}

          {/* 职业评估：评估机构 + 评估职位（→ case_details） */}
          {category === '职业评估' && (
            <>
              <Select
                label="评估机构"
                placeholder="— 请选择 —"
                options={ASSESS_BODIES.map((b) => ({ value: b, label: b }))}
                value={detail('评估机构')}
                onChange={(e) => setDetail('评估机构', e.target.value)}
              />
              <TextField label="评估职位" value={detail('评估职位')} onChange={(e) => setDetail('评估职位', e.target.value)} placeholder="ANZSCO 职位名称" />
            </>
          )}

          {/* De Facto：用途（→ case_details） */}
          {category === 'De Facto 关系认定' && (
            <Select
              label="用途"
              placeholder="— 请选择 —"
              options={DEFACTO_PURPOSES.map((p) => ({ value: p, label: p }))}
              value={detail('用途')}
              onChange={(e) => setDetail('用途', e.target.value)}
            />
          )}

          {/* 定制文件：文件类型（→ case_details） */}
          {category === '定制文件' && (
            <TextField
              label="文件类型"
              value={detail('文件类型')}
              onChange={(e) => setDetail('文件类型', e.target.value)}
              placeholder="如 Employer Statement、Cover Letter、Statutory Declaration…"
            />
          )}
        </Card>
      )}
    </div>
  )
}
