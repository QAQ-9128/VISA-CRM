import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { ConfirmDialog } from './ConfirmDialog'

interface ConfirmOpts {
  title: string
  description: ReactNode
  confirmLabel?: string
  tone?: 'brand' | 'danger'
}

interface PendingConfirm extends ConfirmOpts {
  resolve: (ok: boolean) => void
}

/**
 * Promise 版确认弹窗，复用统一的 ConfirmDialog（替代散落的 window.confirm）。
 * 用法：const { confirm, confirmNode } = useConfirm()
 *   onClick={async () => { if (await confirm({ title, description, tone:'danger' })) doDelete() }}
 *   并在 JSX 末尾渲染 {confirmNode}。
 */
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = useCallback(
    (opts: ConfirmOpts) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve })),
    [],
  )

  const settle = (ok: boolean) => {
    setPending((p) => {
      p?.resolve(ok)
      return null
    })
  }

  const confirmNode = pending ? (
    <ConfirmDialog
      open
      title={pending.title}
      description={pending.description}
      confirmLabel={pending.confirmLabel}
      tone={pending.tone}
      onConfirm={() => settle(true)}
      onClose={() => settle(false)}
    />
  ) : null

  return { confirm, confirmNode }
}
