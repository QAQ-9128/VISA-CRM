import { create } from 'zustand'

/**
 * 纯客户端 UI 状态（不放服务端数据，那些归 TanStack Query）。
 * - 桌面侧栏折叠
 * - 全局 toast 队列（操作成功/失败反馈；由 queryClient 的 MutationCache 全局挂钩 + 手动调用）
 */
export interface Toast {
  id: number
  type: 'success' | 'error'
  message: string
}

interface UiState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
  toasts: Toast[]
  /** 入队一条 toast；duration 毫秒后自动消失（0 = 不自动消失）。同屏最多 3 条，挤掉最旧。 */
  pushToast: (type: Toast['type'], message: string, duration?: number) => void
  dismissToast: (id: number) => void
}

let toastSeq = 0

export const useUiStore = create<UiState>((set, get) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

  toasts: [],
  pushToast: (type, message, duration) => {
    const id = ++toastSeq
    // 成功 3.2s 自动走；错误 6s（要给用户读错误原因的时间）
    const ms = duration ?? (type === 'success' ? 3200 : 6000)
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, type, message }] }))
    if (ms > 0) setTimeout(() => get().dismissToast(id), ms)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** 任意位置（含非 React 代码，如 queryClient 挂钩）可调的便捷入口。 */
export const toastSuccess = (message: string): void => useUiStore.getState().pushToast('success', message)
export const toastError = (message: string): void => useUiStore.getState().pushToast('error', message)
