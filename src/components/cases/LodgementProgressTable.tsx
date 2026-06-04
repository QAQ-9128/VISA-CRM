import { Fragment, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useBackSource } from '../../hooks/useBackSource'
import { clusterRowsByGroup, groupPositions, sortCaseRows } from '../../lib/casesTable'
import type { CaseRow, CaseSortKey } from '../../lib/casesTable'
import { computeWaitBar } from '../../lib/waitBar'
import { selectCaseTodoPreviews } from '../../lib/tasks'
import { StageBadge } from './StageBadge'
import { Avatar } from '../ui/Avatar'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/states'
import type { RecordRow } from '../../types/models'

const fmtElapsed = (e: { months: number; days: number }) =>
  e.months <= 0 ? `${e.days} 天` : `${e.months} 个月 ${e.days} 天`

/** 距今文字色调（绿<3月 / 琥珀3–6月 / 红≥6月）；不再画进度条，只显示时间。 */
const WAIT_TEXT: Record<ReturnType<typeof computeWaitBar>['tone'], string> = {
  ok: 'text-emerald-500',
  soon: 'text-amber-500',
  over: 'text-rose-500',
}

const truncate = (s: string, n = 30) => (s.length > n ? s.slice(0, n) + '…' : s)
/** 参与人显示最长 5 个字，超出截断（title 提示全名）。 */
const clipName = (s: string) => (s.length > 5 ? s.slice(0, 5) + '…' : s)

interface Column {
  key: CaseSortKey
  label: string
  /** 表头额外类（分组底色 / 左分隔线） */
  head?: string
}
// 提名两列浅蓝(表头 #e7eefc)、签证两列浅紫(表头 #efeafe)；组首列加 2px 左分隔线
const COLUMNS: Column[] = [
  { key: 'caseNumber', label: '案件编号' },
  { key: 'primary', label: '参与人1' },
  { key: 'secondary', label: '参与人2' },
  { key: 'visa', label: '签证类型' },
  { key: 'stage', label: '状态' },
  { key: 'nomDate', label: '提名递交时间', head: 'bg-[#e7eefc] border-l-2 border-line-2' },
  { key: 'nomElapsed', label: '提名距今', head: 'bg-[#e7eefc]' },
  { key: 'visaDate', label: '签证递交时间', head: 'bg-[#efeafe] border-l-2 border-line-2' },
  { key: 'visaElapsed', label: '签证距今', head: 'bg-[#efeafe]' },
]

/** 递交进度宽表：参与人1/2 两列（名字截 5 字、无主副角色）、提名蓝/签证紫分组、距今只显时间、待办行标「待递交」。 */
export function LodgementProgressTable({ rows, tasks }: { rows: CaseRow[]; tasks: RecordRow[] }) {
  const [sortKey, setSortKey] = useState<CaseSortKey>('nomDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  // 排序后再按组聚类：同组案件永远相邻；组顺序跟随各组首行在当前排序中的位置
  const sorted = useMemo(
    () => clusterRowsByGroup(sortCaseRows(rows, sortKey, sortDir)),
    [rows, sortKey, sortDir],
  )
  // 每行在组段中的位置：组首行上方插一条「组小节头行」（Group chip + 件数），代替旧的组框描边
  const positions = useMemo(() => groupPositions(sorted), [sorted])

  function toggleSort(key: CaseSortKey) {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(['nomDate', 'visaDate', 'nomElapsed', 'visaElapsed'].includes(key) ? 'desc' : 'asc')
    }
  }

  if (sorted.length === 0) {
    return <EmptyState title="没有匹配的案件" icon="🔍" />
  }

  return (
    <Card pad={false}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-[11px] font-bold tracking-[0.04em] text-muted uppercase">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`border-b border-line-2 bg-surface-2 px-3.5 py-[11px] whitespace-nowrap ${col.head ?? ''}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className="inline-flex items-center gap-1 hover:text-body"
                  >
                    {col.label}
                    <span className="text-faint">
                      {sortKey === col.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </span>
                  </button>
                </th>
              ))}
              <th className="border-b border-l-2 border-line-2 bg-surface-2 px-3.5 py-[11px] whitespace-nowrap">
                待办
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <Fragment key={r.rowKey}>
                {positions[i].start && <GroupHeaderRow row={r} count={positions[i].span ?? 1} colSpan={COLUMNS.length + 1} />}
                <CaseRowView row={r} tasks={tasks} />
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/** 「距今」单元格：只显示时长文字（不画进度条）；终态(下签/拒签)灰字；未递交占位 —。 */
function WaitCell({
  daysSince,
  elapsed,
  frozen,
}: {
  daysSince: number | null
  elapsed: { months: number; days: number } | null
  frozen: boolean
}) {
  if (daysSince == null || !elapsed) return <span className="text-slate-300">—</span>
  const label = fmtElapsed(elapsed)
  if (frozen) return <span className="font-semibold text-faint">{label}</span>
  const { tone } = computeWaitBar(daysSince)
  return <span className={`text-[13px] font-bold tabular-nums ${WAIT_TEXT[tone]}`}>{label}</span>
}

/** 组小节头行：浅底细行 = 组码 chip + 件数；一案一组（同参与人集合的案件共用一个组头）。 */
function GroupHeaderRow({ row, count, colSpan }: { row: CaseRow; count: number; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="border-b border-line bg-surface-2 px-3.5 py-1.5">
        <span className="flex items-center gap-2">
          <span
            title="同参与人的案件为一组"
            className="rounded-full bg-[var(--color-lime-soft)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--color-lime-ink)]"
          >
            {row.groupCode}
          </span>
          <span className="text-[12px] text-faint">· {count} 件</span>
        </span>
      </td>
    </tr>
  )
}

function CaseRowView({ row, tasks }: { row: CaseRow; tasks: RecordRow[] }) {
  const todos = selectCaseTodoPreviews(tasks, row.caseId)
  // 未递交（提名/签证均无日期）→ 待办行：整行浅黄、提名时间列显「待递交」胶囊
  const todo = !row.lodged
  // 单元格底色：待办行整行浅黄；否则提名两列浅蓝、签证两列浅紫；hover 统一回 surface-2
  const td = 'border-b border-line px-3.5 py-3.5 align-middle whitespace-nowrap'
  const plainBg = todo ? 'bg-[#fffdf6] group-hover:bg-[#fff8e9]' : 'group-hover:bg-surface-2'
  const nomBg = todo ? 'bg-[#fffdf6] group-hover:bg-[#fff8e9]' : 'bg-[#f1f5ff] group-hover:bg-surface-2'
  const visaBg = todo ? 'bg-[#fffdf6] group-hover:bg-[#fff8e9]' : 'bg-[#f6f3fe] group-hover:bg-surface-2'
  const split = 'border-l-2 border-line-2'

  // 签证类型：粗体子类 + 灰色 stream 副行（如 482 / Core Skills）
  const [vSub, ...vRest] = row.visaLabel.split('/')
  const vStream = vRest.join('/')
  const navigate = useNavigate()
  const source = useBackSource()
  // 整行 → 案件详情；头像/名字单元格 → 该客户主页（stopPropagation 不触发行的案件跳转）
  const openCase = () => navigate(`/cases/${row.caseId}`, { state: { from: 'cases', view: 'lodge' } })
  const stop = (e: MouseEvent) => e.stopPropagation()
  // 参与人1 = 案件客户；参与人2 = 同案参与客户(case_applicants)，无主副角色；只有一人时第二列留空
  const subName = row.secondaryName
  // 参与人2 恰好一位时，其头像/名字可链到该客户；多位则保持纯文本（避免歧义）
  const singleSubId = row.secondaryCustomerIds.length === 1 ? row.secondaryCustomerIds[0] : null

  return (
    <tr onClick={openCase} className="group cursor-pointer align-middle">
      <td className={`${td} ${plainBg}`}>
        <Link
          to={`/cases/${row.caseId}`}
          state={{ from: 'cases', view: 'lodge' }}
          onClick={stop}
          className="font-semibold tabular-nums text-brand hover:underline"
        >
          {row.caseNumber}
        </Link>
      </td>
      <td className={`${td} ${plainBg}`}>
        {row.primaryName ? (
          <Link
            to={`/customers/${row.primaryCustomerId}`}
            state={source}
            onClick={stop}
            title={row.primaryName}
            className="group/cust -m-1 flex items-center gap-2.5 rounded-lg p-1 transition hover:bg-surface-2"
          >
            <Avatar name={row.primaryName} seed={row.caseId} size={34} />
            <span className="font-medium text-ink group-hover/cust:text-brand">{clipName(row.primaryName)}</span>
          </Link>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className={`${td} ${plainBg}`}>
        {subName ? (
          singleSubId ? (
            <Link
              to={`/customers/${singleSubId}`}
              state={source}
              onClick={stop}
              title={subName}
              className="group/cust -m-1 flex items-center gap-2 rounded-lg p-1 transition hover:bg-surface-2"
            >
              <Avatar name={subName} seed={subName} size={28} />
              <span className="text-body group-hover/cust:text-brand">{clipName(subName)}</span>
            </Link>
          ) : (
            <span className="flex items-center gap-2" title={subName}>
              <Avatar name={subName} seed={subName} size={28} />
              <span className="text-body">{clipName(subName)}</span>
            </span>
          )
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className={`${td} ${plainBg}`}>
        <div className="font-bold text-ink">{vSub}</div>
        <div className="mt-0.5 text-[11.5px] text-faint">{vStream || '—'}</div>
      </td>
      <td className={`${td} ${plainBg}`}>
        <StageBadge stage={row.currentStage} />
      </td>

      {/* 提名组（浅蓝） */}
      <td className={`${td} ${nomBg} ${split} tabular-nums text-body`}>
        {todo ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            <span className="size-1.5 rounded-full bg-amber-500" />
            待递交
          </span>
        ) : (
          row.nomLodgedDate || <span className="text-slate-300">—</span>
        )}
      </td>
      <td className={`${td} ${nomBg}`}>
        {todo ? null : <WaitCell daysSince={row.nomDaysSince} elapsed={row.nomElapsed} frozen={row.frozen} />}
      </td>

      {/* 签证组（浅紫） */}
      <td className={`${td} ${visaBg} ${split} tabular-nums text-body`}>
        {row.visaLodgedDate || <span className="text-slate-300">—</span>}
      </td>
      <td className={`${td} ${visaBg}`}>
        <WaitCell daysSince={row.visaDaysSince} elapsed={row.visaElapsed} frozen={row.frozen} />
      </td>

      {/* 待办 */}
      <td className={`${td} ${plainBg} ${split} min-w-[14rem] whitespace-normal`}>
        {todos.length === 0 ? (
          <span className="text-slate-300">—</span>
        ) : (
          <ul className="space-y-0.5">
            {todos.map((t) => (
              <li key={t.id} className="text-[12.5px] leading-snug font-medium text-body" title={t.content}>
                <span className="mr-1">{t.emoji_marker || '📝'}</span>
                {truncate(t.content)}
              </li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  )
}
