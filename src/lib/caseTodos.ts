import type { CaseDocument, RecordRow } from '../types/models'
import { selectPendingTasks } from './records'
import { computeExpiryStatus } from './expiry'

/**
 * 「本案待办清单」纯派生：把本案的 ① TRT 提醒 ② 到期/过期文件 ③ 未完成跟进待办
 * 合成一张列表。所有数据须已按本案过滤（records=本案记录、docs=本案文件、trt=本案判断）。
 * 不读取客户级「随手记」（case_id=null 的待办本轮不在此显示）。
 */
export type CaseTodoKind = 'trt' | 'expiry' | 'task'
export type CaseTodoTone = 'amber' | 'rose' | 'default'

export interface CaseTodoItem {
  id: string
  kind: CaseTodoKind
  /** 主文案 */
  text: string
  /** 副说明（小字，如「签证到期」「文件到期」），无则 null */
  sub: string | null
  /** 右侧徽标文案（如「剩 32 天」「已过期 3 天」「截止 2026-06-01」），无则 null */
  badge: string | null
  tone: CaseTodoTone
}

export function selectCaseTodos(input: {
  records: RecordRow[]
  docs: CaseDocument[]
  trt: { show: boolean; months: number }
  today?: Date
}): CaseTodoItem[] {
  const { records, docs, trt, today = new Date() } = input
  const items: CaseTodoItem[] = []

  // ① TRT（本案，最前）
  if (trt.show) {
    items.push({
      id: 'trt',
      kind: 'trt',
      text: '可办 186 TRT 永居',
      sub: `下签 ${trt.months} 个月`,
      badge: null,
      tone: 'amber',
    })
  }

  // ② 到期/过期文件（仅 overdue/soon，未归档）
  for (const d of docs) {
    if (d.is_archived) continue
    const info = computeExpiryStatus(d.expiry_date, today)
    if (!info || info.status === 'ok') continue
    items.push({
      id: `doc-${d.id}`,
      kind: 'expiry',
      text: d.title || d.file_name || '文件',
      sub: '文件到期',
      badge: info.status === 'overdue' ? `已过期 ${Math.abs(info.daysRemaining)} 天` : `${info.daysRemaining} 天后到期`,
      tone: info.status === 'overdue' ? 'rose' : 'amber',
    })
  }

  // ③ 未完成跟进待办（本案）
  for (const t of selectPendingTasks(records)) {
    items.push({
      id: `task-${t.id}`,
      kind: 'task',
      text: t.content,
      sub: '待办',
      badge: t.due_date ? `截止 ${t.due_date}` : null,
      tone: 'default',
    })
  }

  return items
}
