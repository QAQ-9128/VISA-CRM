import { useMemo, useState } from 'react'
import { useLodgements } from '../../hooks/queries/useLodgements'
import { useCaseStageHistory } from '../../hooks/queries/useCases'
import { Card, CardHead } from '../ui/Card'
import { StageBadge } from './StageBadge'
import { LodgementForm } from './LodgementForm'
import { LoadingBlock } from '../ui/states'
import { BellIcon, ClockIcon, DocIcon, PassportIcon } from '../ui/icons'
import { getLodgementLodgedDate, getLodgementStatus } from '../../lib/lodgementStatus'
import { lodgementCardStatus, selectLodgementTimeline } from '../../lib/lodgementView'
import type { LodgementCardStatus } from '../../lib/lodgementView'
import { STATUS_CATEGORY_META } from '../../lib/statusColor'
import { LODGEMENT_TYPE_LABELS } from '../../types/domain'
import type { CaseStage, LodgementType } from '../../types/domain'
import type { CaseStageHistory, Lodgement } from '../../types/models'
import type { ReactNode } from 'react'

/** DHA 官方签证处理时间页 */
const DHA_PROCESSING_TIMES_URL = 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-processing-times'

const TIMELINE_LIMIT = 6

/** ① 提名 / 签证 状态卡。 */
function StatusCard({ icon, title, status }: { icon: ReactNode; title: string; status: LodgementCardStatus }) {
  return (
    <Card>
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-brand-50 text-brand">{icon}</span>
        <h3 className="text-[14px] font-bold text-ink">{title}</h3>
      </div>
      <div className="mt-3 text-[12px] text-muted">当前状态</div>
      <div className="mt-1 flex items-center gap-2">
        {/* 圆点按状态类别着色（statusColor 6 类单一来源） */}
        <span className="size-2.5 rounded-full" style={{ backgroundColor: STATUS_CATEGORY_META[status.category].solid }} />
        <span className="text-[18px] font-bold text-ink">{status.label}</span>
      </div>
      <div className="mt-2.5 text-[12px] text-faint">最后更新：{status.lastUpdated ?? '—'}</div>
    </Card>
  )
}

/** ② 提名 / 签证 递交记录表（schema 真实列：递交日期 / 编号 / 状态 / 备注 / 操作）。 */
function RecordTable({
  caseId,
  type,
  records,
  lodgedDate,
  status,
}: {
  caseId: string
  type: LodgementType
  records: Lodgement[]
  lodgedDate: string | null
  status: LodgementCardStatus
}) {
  const [editId, setEditId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const typeLabel = LODGEMENT_TYPE_LABELS[type]

  return (
    <Card>
      <CardHead
        title={`${typeLabel}递交记录`}
        action={
          records.length > 0 && (
            <button type="button" onClick={() => { setAdding(true); setEditId(null) }} className="text-[13px] font-semibold text-brand hover:text-brand-600">
              + 添加{typeLabel}递交
            </button>
          )
        }
      />

      {records.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-line-2 bg-surface-2 px-4 py-8 text-center">
          <div className="text-3xl">📄</div>
          <p className="mt-2 text-sm text-muted">
            {type === 'visa' ? '签证尚未递交，请先完成材料准备' : '尚未添加提名递交记录'}
          </p>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 inline-flex min-h-11 items-center rounded-full bg-brand px-4 text-xs font-semibold text-white shadow-brand hover:bg-brand-600"
          >
            添加{typeLabel}递交
          </button>
        </div>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[24rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line-2 text-left text-xs font-medium text-muted">
                <th className="px-2 py-2">递交日期</th>
                <th className="px-2 py-2">编号</th>
                <th className="px-2 py-2">状态</th>
                <th className="px-2 py-2">备注</th>
                <th className="px-2 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-line align-top">
                  <td className="px-2 py-2.5 whitespace-nowrap tabular-nums text-body">{lodgedDate || '—'}</td>
                  <td className="px-2 py-2.5 whitespace-nowrap text-body">{r.reference_number || '—'}</td>
                  <td className="px-2 py-2.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CATEGORY_META[status.category].badge}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-muted">{r.note || '—'}</td>
                  <td className="px-2 py-2.5 text-right whitespace-nowrap">
                    <button type="button" onClick={() => { setEditId(r.id); setAdding(false) }} className="text-xs font-semibold text-brand hover:underline">
                      查看 / 编辑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-2 pt-2 text-[12px] text-faint">共 {records.length} 条{typeLabel}递交记录</p>
        </div>
      )}

      {(adding || editId) && (
        <div className="mt-3">
          <LodgementForm
            caseId={caseId}
            type={type}
            initial={editId ? records.find((r) => r.id === editId) : undefined}
            onDone={() => { setAdding(false); setEditId(null) }}
          />
        </div>
      )}
    </Card>
  )
}

/** 案件「递交」标签：状态卡 + 递交记录表 + 审理跟进(规划中) + 递交时间线 + 提醒。 */
export function LodgementTab({ caseId, currentStage }: { caseId: string; currentStage: CaseStage }) {
  const lodgements = useLodgements(caseId)
  const stageHistoryQ = useCaseStageHistory(caseId)
  const [timelineAll, setTimelineAll] = useState(false)

  const list = useMemo(() => lodgements.data ?? [], [lodgements.data])
  const history: CaseStageHistory[] = useMemo(() => stageHistoryQ.data ?? [], [stageHistoryQ.data])

  const nomRecords = useMemo(() => list.filter((l) => l.type === 'nomination'), [list])
  const visaRecords = useMemo(() => list.filter((l) => l.type === 'visa'), [list])

  const nomLodged = getLodgementLodgedDate(history, 'nomination')
  const visaLodged = getLodgementLodgedDate(history, 'visa')
  const nomStatus = lodgementCardStatus(nomLodged, getLodgementStatus(currentStage, 'nomination', history), nomRecords[0])
  const visaStatus = lodgementCardStatus(visaLodged, getLodgementStatus(currentStage, 'visa', history), visaRecords[0])

  const timeline = useMemo(() => selectLodgementTimeline(history, list), [history, list])
  const shownTimeline = timelineAll ? timeline : timeline.slice(0, TIMELINE_LIMIT)

  // 真实 DHA 处理天数（任一 lodgement 填了才显示，否则只留外链；绝不编估计）
  const dhaRows = list
    .filter((l) => l.dha_processing_days != null)
    .map((l) => ({ type: l.type, days: l.dha_processing_days as number, updated: l.dha_processing_updated_at }))

  if (lodgements.isPending || stageHistoryQ.isPending) return <LoadingBlock />

  return (
    <div className="space-y-5">
      {/* ① 三状态卡 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatusCard icon={<DocIcon className="size-5" />} title="提名状态" status={nomStatus} />
        <StatusCard icon={<PassportIcon className="size-5" />} title="签证状态" status={visaStatus} />
        <Card>
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-brand-50 text-brand"><ClockIcon className="size-5" /></span>
            <h3 className="text-[14px] font-bold text-ink">DHA 处理时间</h3>
          </div>
          <div className="mt-3 text-[12px] text-muted">预计处理时间</div>
          {dhaRows.length > 0 ? (
            <div className="mt-1 space-y-0.5">
              {dhaRows.map((d) => (
                <div key={d.type} className="text-[13px] text-ink">
                  {LODGEMENT_TYPE_LABELS[d.type]}：<span className="font-bold tabular-nums">{d.days} 天</span>
                  {d.updated && <span className="text-[11px] text-faint">（更新于 {d.updated}）</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-[13px] text-faint">未记录处理时长</p>
          )}
          <a href={DHA_PROCESSING_TIMES_URL} target="_blank" rel="noreferrer" className="mt-2.5 inline-block text-[13px] font-semibold text-brand hover:underline">
            查看 DHA 官网处理时间 ↗
          </a>
        </Card>
      </div>

      {/* ②③ 左主区 + 右侧栏 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* 两记录表 */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <RecordTable caseId={caseId} type="nomination" records={nomRecords} lodgedDate={nomLodged} status={nomStatus} />
            <RecordTable caseId={caseId} type="visa" records={visaRecords} lodgedDate={visaLodged} status={visaStatus} />
          </div>

          {/* 递交时间线 */}
          <Card>
            <CardHead title="递交时间线" sub="由阶段历史 + 递交结果派生" />
            {timeline.length === 0 ? (
              <p className="py-2 text-sm text-faint">暂无递交事件</p>
            ) : (
              <>
                <ol className="space-y-3.5">
                  {shownTimeline.map((t) => (
                    <li key={t.id} className="flex gap-3">
                      <div className="mt-1.5 size-2.5 shrink-0 rounded-full bg-brand" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs tabular-nums text-faint">{t.date}</span>
                          {t.stage && <StageBadge stage={t.stage} />}
                          <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-faint">系统记录</span>
                        </div>
                        <div className="mt-0.5 text-sm font-semibold text-ink">{t.title}</div>
                        {t.note && <div className="text-xs text-faint">{t.note}</div>}
                      </div>
                    </li>
                  ))}
                </ol>
                {timeline.length > TIMELINE_LIMIT && (
                  <button type="button" onClick={() => setTimelineAll((v) => !v)} className="mt-3 text-[13px] font-semibold text-brand hover:underline">
                    {timelineAll ? '收起 ‹' : `查看完整时间线（共 ${timeline.length} 条）›`}
                  </button>
                )}
              </>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          {/* 审理跟进（规划中，无数据模型，不造假） */}
          <Card>
            <CardHead title="审理跟进" />
            <p className="text-sm text-faint">
              暂无「审理步骤」数据模型，未展示带状态的清单（不造假）。当前可在「记录」标签用待办 / 跟进记录管理审理事项。
            </p>
          </Card>

          {/* 提醒（通用静态提示） */}
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <BellIcon className="size-[18px] text-amber-500" />
              <h2 className="text-base font-bold text-ink">提醒</h2>
            </div>
            <ul className="space-y-2 text-sm text-body">
              <li className="flex gap-2"><span className="text-faint">•</span>递交后 7–10 个工作日内确认 DHA 是否已受理。</li>
              <li className="flex gap-2"><span className="text-faint">•</span>收到 DHA 补件（s56）通知，请在指定期限内（通常 28 天）回复。</li>
              <li className="flex gap-2"><span className="text-faint">•</span>定期核对 DHA 官网处理时间预估，留意是否超期。</li>
            </ul>
            <p className="mt-2.5 text-[11px] text-faint">以上为通用提示，非本案件实时计算。</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
