import { Link } from 'react-router-dom'
import { UsersIcon } from '../ui/icons'
import type { CustomerFamilyMember } from '../../types/models'

/**
 * 「family」标签 + hover 悬浮气泡（紫）。members 为当前客户已过滤好的家庭成员。
 *  - 只显示一颗「family · N」标签（不平铺成员名）；空 → 不渲染。
 *  - hover 气泡列每个成员 名字 + 关系；有 linked_customer_id → 名字可点跳档案，无 → 纯文本。
 *  - family 属于客户、与案件无关（两处复用：大名字下 / 参与客户行）。
 */
export function FamilyChip({ members }: { members: CustomerFamilyMember[] }) {
  if (members.length === 0) return null
  const hasPlain = members.some((m) => !m.linked_customer_id)
  return (
    <span className="group relative inline-flex">
      <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-transparent bg-[#eef1ff] px-2.5 py-0.5 text-[12px] font-semibold text-[#5b56c9] transition-colors group-hover:border-[#c8c5f2]">
        <UsersIcon className="size-[13px]" />
        family · {members.length}
      </span>
      {/* 气泡：group-hover 显现；pt-2 作桥接避免鼠标移入时断触发 */}
      <span className="pointer-events-none absolute left-0 top-full z-40 hidden pt-2 group-hover:block group-hover:pointer-events-auto">
        <span className="block min-w-[200px] rounded-[10px] bg-[#20302a] p-3 text-white shadow-soft">
          <span className="mb-2 block text-[11px] text-[#9fb4a8]">家庭成员</span>
          {members.map((m) => (
            <span key={m.id} className="flex items-center justify-between gap-4 py-1">
              {m.linked_customer_id ? (
                <Link
                  to={`/customers/${m.linked_customer_id}`}
                  className="border-b border-dashed border-transparent text-[13px] font-semibold text-[#a9d8bd] hover:border-[#7fbf9a] hover:text-[#cdeed9]"
                >
                  {m.name}
                </Link>
              ) : (
                <span className="text-[13px] font-semibold">{m.name}</span>
              )}
              {m.relation && (
                <span className="rounded-[6px] bg-white/10 px-2 py-0.5 text-[11.5px] text-[#bcd0c4]">{m.relation}</span>
              )}
            </span>
          ))}
          {hasPlain && (
            <span className="mt-2 block border-t border-white/10 pt-1.5 text-[10.5px] text-[#8fa89a]">
              有下划线的可点开档案;无档案为纯记录
            </span>
          )}
        </span>
      </span>
    </span>
  )
}
