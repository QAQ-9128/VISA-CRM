import type { ProcessingRow } from '../../../lib/processingTime'
import { flowStatusBadgeClass } from '../../../lib/statusColor'

/**
 * 概要带「审理时长」格的行内容（提名/签证已递交各占一行）。
 *
 * 纯展示、与计算解耦：rows 由 selectProcessingRows 单一来源算好传入（审理中=实时 / 已批=定格仍显示，
 * 本地澳洲日期），本组件**只负责不破版的排布**——
 *  - 每段整行 `flex flex-nowrap whitespace-nowrap`：标签 / 天数 / 「天」/ 状态徽章永远同一行；
 *  - 行内每个原子 `shrink-0`，徽章额外 `whitespace-nowrap`，确保即便回退到更宽的 CJK 字体
 *    （PingFang 等，Noto 未加载时）「审理中 / 已批」也绝不被压成竖排「审/理/中」；
 *  - 宽度按内容自适应（不写死“假设某字体宽度”的窄列宽），溢出由外层 flex-wrap 整块换行消化。
 */
export function ProcessingDurationRows({ rows }: { rows: ProcessingRow[] }) {
  return (
    <span className="flex flex-col items-start gap-1">
      {rows.map((row) => (
        <span
          key={row.flow}
          data-testid={`proc-row-${row.flow}`}
          className="flex flex-nowrap items-baseline gap-1.5 whitespace-nowrap"
          title={row.text}
        >
          <span className="shrink-0 whitespace-nowrap text-[13px] font-semibold">
            <span className="text-emerald-700">{row.flowLabel}</span>审理
          </span>
          <span className="shrink-0 text-[20px] leading-tight font-extrabold tabular-nums text-emerald-700">
            {row.days}
          </span>
          <span className="shrink-0 text-[12px] font-semibold text-muted">天</span>
          <span
            className={`inline-flex shrink-0 items-center self-center whitespace-nowrap rounded-full px-2 py-px text-[11px] font-bold ${flowStatusBadgeClass(row.status)}`}
          >
            {row.tag}
          </span>
        </span>
      ))}
    </span>
  )
}
