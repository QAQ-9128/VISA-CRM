import { useEffect, useRef, useState } from 'react'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { useArchiveCustomer, useDeleteCustomer } from '../../hooks/queries/useCustomers'
import type { Customer } from '../../types/models'

/**
 * 客户「⋯」操作菜单（客户列表行 + 来源看板卡共用）：归档客户 / 彻底删除客户（0031 起全员开放，防误删靠红色确认弹窗）。
 * 确认弹窗文案与客户详情页逐字一致（同一套级联行为：归档连带 TA 参与的所有案件；
 * 彻底删除删人不删多人案件）。挂在 <Link> 旁边/之上时注意外层已做 stopPropagation。
 */
export function CustomerActionsMenu({ customer }: { customer: Customer }) {
  const archive = useArchiveCustomer()
  const del = useDeleteCustomer()
  // 0031 起彻底删除全员开放（两位用户均 staff，2026-06 拍板）；防误删靠红色确认弹窗
  const [confirming, setConfirming] = useState<'archive' | 'delete' | null>(null)
  const detailsRef = useRef<HTMLDetailsElement | null>(null)

  // 原生 <details> 不会因点外部/Esc 收起 → 自己补上（否则多行菜单同时挂开互相叠压）
  useEffect(() => {
    const close = () => detailsRef.current?.removeAttribute('open')
    const onDown = (e: MouseEvent) => {
      if (detailsRef.current?.open && !detailsRef.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && detailsRef.current?.open) close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <>
      <details
        ref={detailsRef}
        className="relative"
        onClick={(e) => {
          // 行/卡片整体是 Link：菜单交互不允许冒泡成跳转
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <summary
          aria-label="客户操作"
          title="客户操作（归档 / 删除）"
          onClick={(e) => {
            e.stopPropagation()
            // <summary> 默认行为即开合 details；阻止外层 Link 的导航
            const details = e.currentTarget.closest('details')
            if (details) {
              e.preventDefault()
              details.toggleAttribute('open')
            }
          }}
          className="grid size-11 cursor-pointer list-none place-items-center rounded-full text-[17px] text-muted transition-colors hover:bg-surface-2 hover:text-ink [&::-webkit-details-marker]:hidden"
        >
          ⋯
        </summary>
        <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-[12px] border border-line bg-white py-1 shadow-soft">
          <button
            type="button"
            disabled={archive.isPending || customer.is_archived}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              e.currentTarget.closest('details')?.removeAttribute('open')
              setConfirming('archive')
            }}
            className="block w-full px-3.5 py-2 text-left text-[13px] text-body hover:bg-surface-2 disabled:opacity-50"
          >
            归档客户
            <span className="block text-[11px] text-faint">隐藏不删数据，可恢复</span>
          </button>
            <button
              type="button"
              disabled={del.isPending}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                e.currentTarget.closest('details')?.removeAttribute('open')
                setConfirming('delete')
              }}
              className="block w-full px-3.5 py-2 text-left text-[13px] text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              彻底删除客户
              <span className="block text-[11px] text-rose-300">连同资料/文件，不可恢复</span>
            </button>
        </div>
      </details>

      {/* 归档（可逆）：与客户详情页同款文案 */}
      <ConfirmDialog
        open={confirming === 'archive'}
        title={`确定归档「${customer.full_name}」吗？`}
        description={
          <>
            归档后 TA 从客户列表隐藏，<b>TA 参与的所有案件也一并归档</b>；
            客户与案件都可在 <b>档案库 → 回收站</b> 分别恢复。
            想保住某个案件？先在「相关案件」卡把 TA 移出参与人再归档。
          </>
        }
        confirmLabel="归档"
        pendingLabel="归档中…"
        pending={archive.isPending}
        onConfirm={() => {
          setConfirming(null)
          archive.mutate(customer.id)
        }}
        onClose={() => setConfirming(null)}
      />

      {/* 彻底删除（不可恢复）：与客户详情页同款文案 */}
      <ConfirmDialog
        open={confirming === 'delete'}
        title={`彻底删除「${customer.full_name}」？`}
        tone="danger"
        description={
          <>
            TA 的<b>客户资料、文件、跟进/待办</b>将永久删除，<b>不可恢复</b>。
            案件处理：<b>多人案件保留</b>（移出 TA、案件过户给其余参与人，账目不动）；
            <b>仅 TA 一人的案件</b>连同递交记录与账目<b>整案删除</b>。
            如只想暂时隐藏，请改用「归档」。
          </>
        }
        confirmLabel="删除"
        pendingLabel="删除中…"
        pending={del.isPending}
        onConfirm={() => {
          setConfirming(null)
          del.mutate(customer.id)
        }}
        onClose={() => setConfirming(null)}
      />
    </>
  )
}
