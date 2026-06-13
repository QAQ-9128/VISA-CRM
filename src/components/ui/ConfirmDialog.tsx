import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Button } from './Button'

/**
 * 统一风格的确认弹窗（替代浏览器原生 window.confirm 的丑弹框）：
 * 居中卡片 + 标题 + 说明 + 确认/取消。用于归档等可逆操作；
 * 不可逆的高危删除请用 ConfirmDangerDialog（需输入文本解锁）。
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '确认',
  pendingLabel = '处理中…',
  pending = false,
  tone = 'brand',
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel?: string
  pendingLabel?: string
  pending?: boolean
  /** brand=常规绿主按钮；danger=珊瑚警示按钮 */
  tone?: 'brand' | 'danger'
  onConfirm: () => void
  onClose: () => void
}) {
  // Esc 关闭：挂在 document 上，避免遮罩 div 不可聚焦时收不到键事件
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-[20px] bg-white p-6 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-bold text-ink">{title}</h2>
        <div className="mt-2.5 text-[13.5px] leading-relaxed text-body">{description}</div>
        <div className="mt-5 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button
            type="button"
            autoFocus
            disabled={pending}
            onClick={onConfirm}
            className={tone === 'danger' ? '!bg-[#c25a52] hover:!bg-[#b14e47]' : ''}
          >
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
