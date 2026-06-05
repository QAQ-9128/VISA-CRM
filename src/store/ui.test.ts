import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest'
import { useUiStore, toastSuccess, toastError } from './ui'

beforeEach(() => {
  useUiStore.setState({ toasts: [] })
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('UI store · toast 队列', () => {
  it('toastSuccess / toastError 入队，带类型与文案', () => {
    toastSuccess('已保存')
    toastError('保存失败')
    const ts = useUiStore.getState().toasts
    expect(ts).toHaveLength(2)
    expect(ts[0]).toMatchObject({ type: 'success', message: '已保存' })
    expect(ts[1]).toMatchObject({ type: 'error', message: '保存失败' })
    expect(ts[0].id).not.toBe(ts[1].id)
  })

  it('成功 toast 自动消失（约 3 秒）；错误停留更久（约 6 秒）', () => {
    toastSuccess('已保存')
    toastError('失败')
    vi.advanceTimersByTime(3500)
    expect(useUiStore.getState().toasts.map((t) => t.type)).toEqual(['error'])
    vi.advanceTimersByTime(3000)
    expect(useUiStore.getState().toasts).toHaveLength(0)
  })

  it('dismissToast 手动移除', () => {
    toastSuccess('A')
    const id = useUiStore.getState().toasts[0].id
    useUiStore.getState().dismissToast(id)
    expect(useUiStore.getState().toasts).toHaveLength(0)
  })

  it('同屏最多 3 条：超出时挤掉最旧的', () => {
    toastSuccess('1'); toastSuccess('2'); toastSuccess('3'); toastSuccess('4')
    const msgs = useUiStore.getState().toasts.map((t) => t.message)
    expect(msgs).toEqual(['2', '3', '4'])
  })
})
