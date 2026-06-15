import { useUiStore } from '../../store/ui'

/**
 * 全局 toast 出口（挂在 AppLayout）：底部居中浮层，移动端避开 BottomTabBar。
 * 成功绿 / 错误珊瑚 / 可撤销=深墨底(--ink)白字 + 「撤销」链接；成功 role=status、错误 role=alert。
 */
export function Toaster() {
  const toasts = useUiStore((s) => s.toasts)
  const dismiss = useUiStore((s) => s.dismissToast)
  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) =>
        t.type === 'undo' ? (
          // 可撤销 toast：深墨底白字 + 「撤销」加粗链接（非原生 alert 外观）
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex max-w-full min-w-0 items-center gap-3 rounded-[12px] bg-[#1f2620] px-4 py-3 text-sm font-semibold text-white shadow-soft"
          >
            <span className="min-w-0 break-words">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={t.action.onClick}
                className="shrink-0 font-bold text-white underline underline-offset-2 hover:opacity-80"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ) : (
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
        ),
      )}
    </div>
  )
}
