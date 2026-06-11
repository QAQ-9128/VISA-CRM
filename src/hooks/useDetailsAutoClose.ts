import { useEffect, useRef } from 'react'

/**
 * 原生 <details> 弹层（⋯ 操作菜单等）的人性化收起：点击弹层外任意空白 / 按 Esc → 自动关闭，
 * 免去必须再点一次「⋯」。点菜单内部不误关（菜单项执行后自行 removeAttribute('open')）。
 * 用法：const ref = useDetailsAutoClose() → <details ref={ref}>…</details>
 */
export function useDetailsAutoClose() {
  const ref = useRef<HTMLDetailsElement | null>(null)
  useEffect(() => {
    const close = () => ref.current?.removeAttribute('open')
    const onDown = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && ref.current?.open) close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])
  return ref
}
