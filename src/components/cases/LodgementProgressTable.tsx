import { Fragment, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useBackSource } from '../../hooks/useBackSource'
import { clusterRowsByGroup, groupPositions, sortCaseRows } from '../../lib/casesTable'
import type { CaseRow, CaseSortKey } from '../../lib/casesTable'
import { selectCaseTodoPreviews } from '../../lib/tasks'
import type { LodgementDerivedStatus } from '../../lib/lodgementStatus'
import { FLOW_STATUS_LABELS, flowStatusBadgeClass, stageSolidColor } from '../../lib/statusColor'
import { StageBadge } from './StageBadge'
import { Avatar } from '../ui/Avatar'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/states'
import type { RecordRow } from '../../types/models'

const fmtElapsed = (e: { months: number; days: number }) =>
  e.months <= 0 ? `${e.days} 天` : `${e.months} 个月 ${e.days} 天`

const truncate = (s: string, n = 30) => (s.length > n ? s.slice(0, n) + '…' : s)
/** 参与人显示最长 5 个字，超出截断（title 提示全名）。 */
const clipName = (s: string) => (s.length > 5 ? s.slice(0, 5) + '…' : s)

interface Column {
  key: CaseSortKey
  label: string
  /** 所属流程分组（两层表头上层标签用） */
  grp?: 'nom' | 'visa'
}
// 12 列：前 5 列为案件主体；提名 3 列 + 签证 3 列由两层表头的分组标签统领（不再逐列底色）；末列待办。
const COLUMNS: Column[] = [
  { key: 'caseNumber', label: '案件编号' },
  { key: 'primary', label: '参与人1' },
  { key: 'secondary', label: '参与人2' },
  { key: 'visa', label: '案件类型' },
  { key: 'stage', label: '当前状态' },
  { key: 'nomDate', label: '递交时间', grp: 'nom' },
  { key: 'nomElapsed', label: '审理时长', grp: 'nom' },
  { key: 'nomStatus', label: '状态', grp: 'nom' },
  { key: 'visaDate', label: '递交时间', grp: 'visa' },
  { key: 'visaElapsed', label: '审理时长', grp: 'visa' },
  { key: 'visaStatus', label: '状态', grp: 'visa' },
]
/** 组分隔（提名/签证/待办 段首）的细竖线。 */
const SPLIT = 'border-l-2 border-line-2'

/**
 * 递交进度宽表（视觉刷新版）：编辑感两层表头（提名/签证分组）+ 左侧状态轨 + 审理时长英雄数字 +
 * 案件编号降级为 mono 标签、参与人主角放大。去掉旧的蓝/紫/黄整列底色（噪音源），层级靠
 * 字号/字重/颜色与留白建立；列语义与排序不变（仍对齐客户 Excel）。
 */
export function LodgementProgressTable({ rows, tasks }: { rows: CaseRow[]; tasks: RecordRow[] }) {
  const [sortKey, setSortKey] = useState<CaseSortKey>('nomDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  // 排序后再按组聚类：同组案件永远相邻；组顺序跟随各组首行在当前排序中的位置
  const sorted = useMemo(
    () => clusterRowsByGroup(sortCaseRows(rows, sortKey, sortDir)),
    [rows, sortKey, sortDir],
  )
  // 每行在组段中的位置：组首行上方插一条「组小节头行」（Group chip + 件数）
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
        <table className="w-full min-w-[1320px] border-separate border-spacing-0 text-sm">
          <thead>
            {/* 上层：流程分组彩色标签（提名蓝 / 签证紫），替代旧的整列底色 */}
            <tr>
              <th className="border-b border-line bg-surface-2 border-l-4 border-l-transparent" colSpan={5} />
              <th className={`border-b border-line bg-surface-2 px-3.5 pt-2.5 pb-1 text-left text-[10.5px] font-extrabold tracking-[0.16em] text-[#3f7cb5] uppercase ${SPLIT}`} colSpan={3}>
                提名 · Nomination
              </th>
              <th className={`border-b border-line bg-surface-2 px-3.5 pt-2.5 pb-1 text-left text-[10.5px] font-extrabold tracking-[0.16em] text-[#7c6fd6] uppercase ${SPLIT}`} colSpan={3}>
                签证 · Visa
              </th>
              <th className={`border-b border-line bg-surface-2 ${SPLIT}`} />
            </tr>
            {/* 下层：列名（可排序） */}
            <tr className="text-left text-[11px] font-bold tracking-[0.04em] text-muted">
              {COLUMNS.map((col, i) => (
                <th
                  key={col.key}
                  className={`border-b border-line-2 bg-surface-2 px-3.5 pb-2.5 whitespace-nowrap ${col.grp && (col.key === 'nomDate' || col.key === 'visaDate') ? SPLIT : ''} ${
                    i === 0 ? 'sticky left-0 z-[2] border-l-4 border-l-transparent border-r border-line-2 md:static md:border-r-0' : ''
                  }`}
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
              <th className={`border-b border-line-2 bg-surface-2 px-3.5 pb-2.5 whitespace-nowrap ${SPLIT}`}>
                待办 / 下一步
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

/**
 * 「审理时长」英雄数字：常显时长文字（统一绿 #357a52，放大加粗作组内主角）——获批后定格仍显示；
 * 未递交 → 中性灰「—」。不按时长分级橙/红，终态(拒签)冻结值也为绿。
 */
function WaitCell({ elapsed }: { elapsed: { months: number; days: number } | null }) {
  if (!elapsed) return <span className="text-faint">—</span>
  return <span className="text-[15.5px] leading-none font-extrabold tabular-nums text-emerald-700">{fmtElapsed(elapsed)}</span>
}

// 「提名状态/签证状态」徽章：文案与颜色都走 statusColor 单一来源（审理中=灰、获批=绿、已拒=红）；无此流程 → 「—」
function FlowStatusCell({ status }: { status: LodgementDerivedStatus | null }) {
  if (!status) return <span className="text-faint">—</span>
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-bold ${flowStatusBadgeClass(status)}`}>
      {FLOW_STATUS_LABELS[status]}
    </span>
  )
}

/** 待递交胶囊（提名/签证未递交时，对应「递交时间」列显示）。 */
function WaitToLodge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-bold text-amber-700">
      <span className="size-1.5 rounded-full bg-amber-500" />
      待递交
    </span>
  )
}

/** 组小节头行：浅底细行 = 组码 chip + 件数；一案一组（同参与人集合的案件共用一个组头）。 */
function GroupHeaderRow({ row, count, colSpan }: { row: CaseRow; count: number; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="border-b border-line border-l-4 border-l-transparent bg-gradient-to-r from-surface-2 to-white px-3.5 py-1.5">
        <span className="flex items-center gap-2">
          <span
            title="同参与人的案件为一组"
            className="rounded-full bg-[var(--color-lime-soft)] px-2.5 py-0.5 text-[12.5px] font-bold tracking-[0.02em] text-[var(--color-lime-ink)]"
          >
            {row.groupCode}
          </span>
          <span className="text-[12px] font-medium text-faint">· {count} 件</span>
        </span>
      </td>
    </tr>
  )
}

function CaseRowView({ row, tasks }: { row: CaseRow; tasks: RecordRow[] }) {
  const todos = selectCaseTodoPreviews(tasks, row.caseId)
  // 未递交（提名/签证均无日期）→ 对应「递交时间」列显「待递交」胶囊
  const todo = !row.lodged
  // 去掉整列/整行底色，统一白底 + hover 浅绿；层级靠字号/字重/颜色建立
  const td = 'border-b border-line px-3.5 py-3.5 align-middle whitespace-nowrap group-hover:bg-[#f7fbf7]'

  // 签证类型：粗体子类 + 灰色 stream 副行（如 482 / Core Skills）
  const [vSub, ...vRest] = row.visaLabel.split('/')
  const vStream = vRest.join('/')
  const navigate = useNavigate()
  const source = useBackSource()
  // 整行 → 客户详情并选中该案；头像/名字单元格 → 该客户主页（stopPropagation）
  const openCase = () => navigate(`/customers/${row.primaryCustomerId}?case=${row.caseId}`, { state: source })
  const stop = (e: MouseEvent) => e.stopPropagation()
  const subName = row.secondaryName
  const singleSubId = row.secondaryCustomerIds.length === 1 ? row.secondaryCustomerIds[0] : null

  return (
    <tr onClick={openCase} className="group cursor-pointer align-middle">
      {/* 案件编号列：左侧状态轨（按当前阶段着色，秒扫）+ 降级为 mono 标签；移动端横滚时固定 */}
      <td
        className={`${td} sticky left-0 z-[1] border-r border-line-2 bg-white md:static md:border-r-0`}
        style={{ borderLeft: `4px solid ${stageSolidColor(row.currentStage)}` }}
      >
        <Link
          to={`/customers/${row.primaryCustomerId}?case=${row.caseId}`}
          state={source}
          onClick={stop}
          title={`案件 ${row.caseNumber}`}
          className="inline-flex rounded-md bg-surface-2 px-2 py-1 font-mono text-[11.5px] font-bold tracking-[0.02em] tabular-nums text-muted transition hover:bg-brand-50 hover:text-brand"
        >
          {row.caseNumber}
        </Link>
      </td>

      {/* 参与人1：主角放大（34 头像 + 15px 墨色名） */}
      <td className={td}>
        {row.primaryName ? (
          <Link
            to={`/customers/${row.primaryCustomerId}`}
            state={source}
            onClick={stop}
            title={row.primaryName}
            className="group/cust -m-1 flex items-center gap-2.5 rounded-lg p-1 transition hover:bg-surface-2"
          >
            <Avatar name={row.primaryName} seed={row.caseId} size={34} />
            <span className="text-[15px] font-bold text-ink group-hover/cust:text-brand">{clipName(row.primaryName)}</span>
          </Link>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>

      {/* 参与人2：副角弱化 */}
      <td className={td}>
        {subName ? (
          singleSubId ? (
            <Link
              to={`/customers/${singleSubId}`}
              state={source}
              onClick={stop}
              title={subName}
              className="group/cust -m-1 flex items-center gap-2 rounded-lg p-1 transition hover:bg-surface-2"
            >
              <Avatar name={subName} seed={subName} size={26} />
              <span className="text-[13px] font-medium text-muted group-hover/cust:text-brand">{clipName(subName)}</span>
            </Link>
          ) : (
            <span className="flex items-center gap-2" title={subName}>
              <Avatar name={subName} seed={subName} size={26} />
              <span className="text-[13px] font-medium text-muted">{clipName(subName)}</span>
            </span>
          )
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>

      {/* 案件类型：lime 子类 chip + stream 副行 */}
      <td className={td}>
        <span className="inline-flex items-center rounded-full bg-[var(--color-lime-soft)] px-2.5 py-1 text-[13px] font-bold tracking-[0.01em] text-[var(--color-lime-ink)]">
          {vSub}
        </span>
        {vStream && <div className="mt-1 text-[12px] font-medium text-faint">{vStream}</div>}
      </td>

      {/* 当前状态 */}
      <td className={td}>
        <StageBadge stage={row.currentStage} />
      </td>

      {/* 提名组：递交时间(小灰) / 审理时长(英雄数字) / 状态(徽章) */}
      <td className={`${td} ${SPLIT}`}>
        {todo ? (
          <WaitToLodge />
        ) : row.nomLodgedDate ? (
          <span className="text-[12.5px] font-medium tabular-nums text-faint">{row.nomLodgedDate}</span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className={td}>{todo ? null : <WaitCell elapsed={row.nomElapsed} />}</td>
      <td className={td}>{todo ? null : <FlowStatusCell status={row.nomStatus} />}</td>

      {/* 签证组（待办行与提名列对称标「待递交」） */}
      <td className={`${td} ${SPLIT}`}>
        {todo ? (
          <WaitToLodge />
        ) : row.visaLodgedDate ? (
          <span className="text-[12.5px] font-medium tabular-nums text-faint">{row.visaLodgedDate}</span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className={td}>
        <WaitCell elapsed={row.visaElapsed} />
      </td>
      <td className={td}>{todo ? null : <FlowStatusCell status={row.visaStatus} />}</td>

      {/* 待办 / 下一步 */}
      <td className={`${td} ${SPLIT} min-w-[13rem] whitespace-normal`}>
        {todos.length === 0 ? (
          <span className="text-slate-300">—</span>
        ) : (
          <ul className="space-y-0.5">
            {todos.map((t) => (
              <li key={t.id} className="text-[12.5px] leading-snug font-semibold text-body" title={t.content}>
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
