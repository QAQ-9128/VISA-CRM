import { useUiStore } from '../../store/ui'

/**
 * 全局 toast 出口（挂在 AppLayout）：底部居中浮层，移动端避开 BottomTabBar。
 * 成功绿 / 错误珊瑚；点按即关；成功 role=status、错误 role=alert（读屏正确播报）。
 */
export function Toaster() {
  const toasts = useUiStore((s) => s.toasts)
  const dismiss = useUiStore((s) => s.dismissToast)
  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          role={t.type === 'error' ? 'alert' : 'status'}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto flex max-w-full min-w-0 items-center gap-2.5 rounded-[14px] px-4 py-3 text-left text-sm font-semibold text-white shadow-soft ${
            t.type === 'success' ? 'bg-[linear-gradient(135deg,#2e6a48,#357a52)]' : 'bg-[#c25a52]'
          }`}
        >
          <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-white/20 text-[11px]">
            {t.type === 'success' ? '✓' : '!'}
          </span>
          <span className="min-w-0 break-words">{t.message}</span>
        </button>
      ))}
    </div>
  )
}
