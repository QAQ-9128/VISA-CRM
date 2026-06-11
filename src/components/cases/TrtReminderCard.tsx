import { Link } from 'react-router-dom'
import { useDismissTrtReminder } from '../../hooks/queries/useCases'

/**
 * 482→186 TRT 永居提醒卡（清新绿）。是否显示由调用方用 lib/trt 的 shouldShowTrtReminder /
 * selectTrtReminders 判定（已含：482 TSS + 已勾选 + 下签满 22 个月 + 客户名下无 186 TRT 案 +
 * 未手动停止），本组件只负责展示与两个动作：
 *  - 「新建 186 TRT 案件」→ 走现有新建案件流程，?prefill=186trt 预填 大类=签证申请 / 类型=186 ENS /
 *    Stream=TRT / 案件客户=该客户（建出后客户名下即有 186 TRT 案，提醒经 lib/trt 自动消失）；
 *  - 「不再提醒」→ 置 trt_reminder_dismissed=true，该案提醒永久停止（持久化）。
 */
export function TrtReminderCard({
  customerId,
  caseId,
  months,
}: {
  customerId: string
  caseId: string
  months: number
}) {
  const dismiss = useDismissTrtReminder()

  return (
    <div className="rounded-[14px] border border-emerald-200 bg-emerald-50/70 p-4">
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="text-lg leading-none">🌿</span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-emerald-900">下签满 22 个月，及时启动 186 TRT 永居</p>
          <p className="mt-0.5 text-[12.5px] text-emerald-700">
            该 482 TSS 已下签 <span className="font-semibold tabular-nums">{months}</span> 个月，可办 186 TRT（临时居留转永居）。
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <Link
              to={`/cases/new?customer=${customerId}&prefill=186trt`}
              className="inline-flex min-h-9 items-center justify-center rounded-full bg-brand-700 px-4 text-[13px] font-semibold text-white shadow-brand transition-colors hover:bg-brand-800"
            >
              新建 186 TRT 案件
            </Link>
            <button
              type="button"
              disabled={dismiss.isPending}
              onClick={() => dismiss.mutate(caseId)}
              className="inline-flex min-h-9 items-center rounded-full px-3 text-[12.5px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
            >
              {dismiss.isPending ? '处理中…' : '已处理 / 不再提醒'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
