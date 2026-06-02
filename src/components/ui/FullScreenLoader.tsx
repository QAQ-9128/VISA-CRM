/** 会话恢复 / 鉴权加载期间的全屏占位，避免守卫闪烁误判。 */
export function FullScreenLoader({ label = '加载中…' }: { label?: string }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 text-slate-400">
      <span className="size-8 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
