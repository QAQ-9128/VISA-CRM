import type { CaseCardVM } from '../../lib/caseBoard'

/** 担保字段 k-v 行（仅有值时渲染——无值不出空行/「—」占位）。k 标签固定宽 + 不换行（担保雇主不折行）。 */
function SponsorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-[13px]">
      <span className="w-[58px] shrink-0 whitespace-nowrap text-faint">{label}</span>
      <span className="min-w-0 flex-1 break-words font-medium text-body">{value}</span>
    </div>
  )
}

/**
 * 案件卡（紧凑）：案件号(标题) + 签证 tag 同行两端对齐 → (担保职位/担保雇主，仅担保类型且有值) →
 * 细虚线 + 本案参与人 chips → 「查看进度 →」。高度随内容自适应（网格 items-start，不等高拉伸）。
 * **卡上不出现任何阶段/进度/金额**；「查看进度 →」切到本页「进度表」并定位该案件。
 */
export function CaseCard({ vm, onViewProgress }: { vm: CaseCardVM; onViewProgress: (caseId: string) => void }) {
  const hasSponsor = !!vm.position || !!vm.employerName
  return (
    <article className="rounded-[18px] border border-line bg-white p-4 shadow-soft transition-shadow motion-reduce:transition-none hover:shadow-[0_18px_40px_-22px_rgba(40,90,60,.30)]">
      {/* 案件号 + 签证 tag 同一行两端对齐 */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h3 className="font-serif text-[16px] font-bold tracking-[-0.01em] text-ink">{vm.caseNumber}</h3>
          {vm.subtitle && <p className="mt-0.5 truncate text-[12px] text-faint">{vm.subtitle}</p>}
        </div>
        <span className="mt-0.5 shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700">
          {vm.visaLabel}
        </span>
      </div>

      {/* 担保职位 + 担保雇主：仅担保类型且有值时显示，否则整块不渲染 */}
      {hasSponsor && (
        <div className="mt-3 space-y-[5px]">
          {vm.position && <SponsorRow label="职位" value={vm.position} />}
          {vm.employerName && <SponsorRow label="担保雇主" value={vm.employerName} />}
        </div>
      )}

      {/* 本案参与人：细虚线分隔 + chips（中文名优先；副申带「· 关系」后缀） */}
      <div className="mt-3 border-t border-dashed border-line pt-2.5">
        <p className="mb-1.5 text-[11.5px] font-semibold text-faint">本案参与人</p>
        <div className="flex flex-wrap gap-1.5">
          {vm.participants.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center rounded-full bg-[#eef4f0] px-2.5 py-1 text-[12px] font-medium text-[#2e6a48]"
            >
              {p.name}
              {p.relationship && <span className="ml-1 text-[#2e6a48]/70">· {p.relationship}</span>}
            </span>
          ))}
        </div>
      </div>

      {/* 查看进度 → 切到本页「进度表」并定位该案件；卡上无进度展示 */}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => onViewProgress(vm.caseId)}
          className="text-[12.5px] font-semibold text-brand-700 transition-colors motion-reduce:transition-none hover:text-brand-800 hover:underline"
        >
          查看进度 →
        </button>
      </div>
    </article>
  )
}
