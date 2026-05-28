import { create } from 'zustand'

/**
 * 纯客户端 UI 状态（不放服务端数据，那些归 TanStack Query）。
 * 目前只有桌面侧栏折叠；后续筛选条件等可加在这里。
 */
interface UiState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
}))
