import { useMarkCohabUpdated } from '../../hooks/queries/useCases'

/**
 * 186/配偶签「3 个月更新同居材料」提醒卡（清新绿）。是否显示由调用方用 lib/cohab 的
 * shouldShowCohabReminder / selectCohabReminders 判定（已含：186/配偶签 + 已勾选 +
 * 距上次更新/递交满 3 个月 + 未到终态），本组件只负责展示与一个动作：
 *  - 「本次已更新」→ 置 cohab_reminder_last=今天，顺延到下一个 3 个月周期再提醒（循环）。
 * 手动停止 = 在编辑案件里取消勾选「3 个月提醒 · 更新同居材料」。
 */
export function CohabReminderCard({ caseId, months }: { caseId: string; months: number }) {
  const mark = useMarkCohabUpdated()

  return (
    <div className="rounded-[14px] border border-emerald-200 bg-emerald-50/70 p-4">
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="text-lg leading-none">🌿</span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-emerald-900">该更新同居材料了</p>
          <p className="mt-0.5 text-[12.5px] text-emerald-700">
            距上次更新/递交已 <span className="font-semibold tabular-nums">{months}</span> 个月，请持续收集同居/关系证据（共同账单、合照、租约等），每 3 个月更新一次。
          </p>
          <div className="mt-3">
            <button
              type="button"
              disabled={mark.isPending}
              onClick={() => mark.mutate(caseId)}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-700 px-4 text-[13px] font-semibold text-white shadow-brand transition-colors hover:bg-brand-800 disabled:opacity-50"
            >
              {mark.isPending ? '处理中…' : '本次已更新（3 个月后再提醒）'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
