import { useCallback, useEffect, useRef, useState } from 'react'
import { toastUndo, useUiStore } from '../store/ui'

/**
 * 延迟提交的「乐观删除 + 可撤销」机制（零迁移、纯前端）。
 *
 * 交互：点删除/撤销 → 立刻把该记录 id 标为 pending（UI 层据此过滤掉，应收/合计立即重算），
 * 底部弹「撤销」toast；delayMs（默认 5s）后才真正落库（commit）。期间：
 *   - 点「撤销」→ 取消定时器 + 把 id 移出 pending（记录复位、总额回原值，不触 DB）；
 *   - 组件卸载/切页 → flush 掉所有未完成的 pending（commit 落库），避免漏删。
 *
 * 不碰账目算法：调用方只把「真正的删除」包成 commit 传进来；总额永远从（过滤后的）记录重算。
 */
export interface DeferredDeleteApi {
  /** 当前被乐观隐藏的记录 id 集合（调用方用它过滤渲染数据）。 */
  pendingIds: Set<string>
  /**
   * 安排一次延迟删除。
   * @param id 记录唯一 id（payment id / plan_item id）
   * @param commit 到点真正落库的动作（如 deletePayment(id)）。撤销则永不调用。
   * @param message toast 文案（如「已删除「文案费」」）；「撤销」链接由本 hook 追加。
   */
  schedule: (id: string, commit: () => void, message: string) => void
  /** 立即 flush 所有未完成的 pending-delete（落库）。卸载时自动调用，亦可手动调。 */
  flushAll: () => void
}

interface PendingEntry {
  commit: () => void
  timeoutId: ReturnType<typeof setTimeout>
  toastId: number
}

export function useDeferredDelete(delayMs = 5000): DeferredDeleteApi {
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set())
  const entries = useRef<Map<string, PendingEntry>>(new Map())

  const restore = useCallback((id: string) => {
    setPendingIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const schedule = useCallback(
    (id: string, commit: () => void, message: string) => {
      // 重复点击同一条：忽略（已在 pending 中）
      if (entries.current.has(id)) return
      setPendingIds((prev) => new Set(prev).add(id))

      const timeoutId = setTimeout(() => {
        entries.current.delete(id)
        commit() // 到点落库；id 仍留在 pending 集合里被过滤，待数据 refetch 后自然消失，避免闪烁
      }, delayMs)

      const toastId = toastUndo(message, () => {
        const e = entries.current.get(id)
        if (e) {
          clearTimeout(e.timeoutId)
          entries.current.delete(id)
        }
        restore(id) // 撤销：复位，不触 DB
      }, delayMs)

      entries.current.set(id, { commit, timeoutId, toastId })
    },
    [delayMs, restore],
  )

  const flushAll = useCallback(() => {
    for (const [, e] of entries.current) {
      clearTimeout(e.timeoutId)
      useUiStore.getState().dismissToast(e.toastId)
      e.commit()
    }
    entries.current.clear()
  }, [])

  // 卸载/切页：flush 掉所有未完成的 pending-delete（落库），不漏删。
  // flushAll 恒等（useCallback []，只读 ref），故该 effect 仅在卸载时触发一次 cleanup。
  useEffect(() => () => flushAll(), [flushAll])

  return { pendingIds, schedule, flushAll }
}
