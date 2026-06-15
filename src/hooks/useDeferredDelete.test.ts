import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDeferredDelete } from './useDeferredDelete'
import { useUiStore } from '../store/ui'

beforeEach(() => {
  vi.useFakeTimers()
  useUiStore.setState({ toasts: [] })
})
afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

describe('useDeferredDelete（乐观删除 + 5s 后落库 + 可撤销 + 卸载 flush）', () => {
  it('schedule：立即标 pending（UI 据此移除）+ 弹「撤销」toast；5s 内不 commit', () => {
    const commit = vi.fn()
    const { result } = renderHook(() => useDeferredDelete(5000))
    act(() => result.current.schedule('PAY', commit, '已撤销一笔收款'))
    expect(result.current.pendingIds.has('PAY')).toBe(true) // 立即隐藏
    const toasts = useUiStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].type).toBe('undo')
    expect(toasts[0].message).toBe('已撤销一笔收款')
    expect(toasts[0].action?.label).toBe('撤销')
    expect(commit).not.toHaveBeenCalled() // 还没落库
  })

  it('5s 后无操作 → commit 落库一次，且只一次', () => {
    const commit = vi.fn()
    const { result } = renderHook(() => useDeferredDelete(5000))
    act(() => result.current.schedule('IT', commit, '已删除「文案费」'))
    expect(commit).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(5000))
    expect(commit).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(5000))
    expect(commit).toHaveBeenCalledTimes(1) // 不重复
  })

  it('5s 内点「撤销」→ 复位（移出 pending）、不 commit', () => {
    const commit = vi.fn()
    const { result } = renderHook(() => useDeferredDelete(5000))
    act(() => result.current.schedule('PAY', commit, '已撤销一笔收款'))
    // 点 toast 的「撤销」
    act(() => useUiStore.getState().toasts[0].action!.onClick())
    expect(result.current.pendingIds.has('PAY')).toBe(false) // 复位
    expect(useUiStore.getState().toasts).toHaveLength(0) // toast 关闭
    act(() => vi.advanceTimersByTime(5000))
    expect(commit).not.toHaveBeenCalled() // DB 未删
  })

  it('卸载时仍有 pending → flush 落库，不漏删', () => {
    const commit = vi.fn()
    const { result, unmount } = renderHook(() => useDeferredDelete(5000))
    act(() => result.current.schedule('E3', commit, '已删除一笔支出'))
    expect(commit).not.toHaveBeenCalled()
    unmount()
    expect(commit).toHaveBeenCalledTimes(1) // 卸载 flush 落库
    // 卸载后原定时器不应再触发第二次
    act(() => vi.advanceTimersByTime(5000))
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('重复点击同一条：忽略第二次（不重复排程）', () => {
    const commit = vi.fn()
    const { result } = renderHook(() => useDeferredDelete(5000))
    act(() => result.current.schedule('PAY', commit, 'x'))
    act(() => result.current.schedule('PAY', commit, 'x'))
    expect(useUiStore.getState().toasts).toHaveLength(1)
    act(() => vi.advanceTimersByTime(5000))
    expect(commit).toHaveBeenCalledTimes(1)
  })
})
