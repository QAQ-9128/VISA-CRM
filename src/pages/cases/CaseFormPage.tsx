import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CaseForm } from '../../components/cases/CaseForm'
import type { CaseFormValues } from '../../components/cases/CaseForm'
import { useCase, useCases, useCreateCase, useUpdateCase, useUpdateCaseStage } from '../../hooks/queries/useCases'
import { useCustomer } from '../../hooks/queries/useCustomers'
import { useCaseApplicants, useSetCaseApplicants } from '../../hooks/queries/useCaseApplicants'
import { relationshipOf, syncStageAction } from '../../lib/caseRelationship'
import type { Case } from '../../types/models'
import { BackLink } from '../../components/ui/BackLink'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'

export function CaseFormPage() {
  const { id } = useParams()
  const editing = !!id
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const existing = useCase(id)
  const customerId = editing ? existing.data?.customer_id : params.get('customer') ?? undefined
  const customer = useCustomer(customerId)

  const existingApplicants = useCaseApplicants(id)
  const allCases = useCases()
  const createM = useCreateCase()
  const updateM = useUpdateCase()
  const setApplicantsM = useSetCaseApplicants()
  const stageM = useUpdateCaseStage()
  const submitting = createM.isPending || updateM.isPending || setApplicantsM.isPending || stageM.isPending
  const err = createM.error ?? updateM.error ?? setApplicantsM.error ?? stageM.error
  const errorMsg = err instanceof Error ? err.message : err ? '保存失败' : null

  if (editing && existing.isPending) return <LoadingBlock />
  if (editing && existing.isError) return <ErrorBlock error={existing.error} />

  if (!editing && !customerId) {
    return (
      <div className="mx-auto max-w-2xl text-center text-slate-500">
        请从客户档案进入新建案件。
        <div className="mt-4">
          <Link to="/customers" className="text-indigo-600 hover:underline">
            前往客户列表
          </Link>
        </div>
      </div>
    )
  }

  // 保存完成后：若本案开启了「进度同步」，立即把本案 stage 对齐主案件当前 stage（写 history「进度同步开启」）。
  // 后续主案件 stage 变化的持续同步由 DB 触发器负责。
  function finishSave(saved: Case, applicantIds: string[]) {
    setApplicantsM.mutate(
      { caseId: saved.id, customerIds: applicantIds },
      {
        onSuccess: () => {
          const parent = (allCases.data ?? []).find((c) => c.id === saved.parent_case_id)
          const action = parent
            ? syncStageAction(relationshipOf(saved), saved.current_stage, parent.current_stage)
            : null
          if (action) {
            stageM.mutate(
              { caseId: saved.id, fromStage: saved.current_stage, toStage: action.toStage, note: action.note },
              { onSuccess: () => navigate(`/cases/${saved.id}`) },
            )
          } else {
            navigate(`/cases/${saved.id}`)
          }
        },
      },
    )
  }

  function handleSubmit(values: CaseFormValues, applicantIds: string[]) {
    if (editing && id) {
      updateM.mutate({ id, patch: values }, { onSuccess: (updated) => finishSave(updated, applicantIds) })
    } else {
      createM.mutate(values, { onSuccess: (created) => finishSave(created, applicantIds) })
    }
  }

  return (
    <section className="mx-auto max-w-2xl">
      <div className="mb-3">
        <BackLink
          to={editing && id ? `/cases/${id}` : `/customers/${customerId}`}
          label={editing ? '返回案件' : '返回客户档案'}
        />
      </div>
      <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">
        {editing ? '编辑案件' : '新建案件'}
      </h1>
      <div className="mt-6">
        <CaseForm
          customerId={customerId as string}
          customerLabel={customer.data?.full_name ?? '…'}
          initial={editing ? existing.data ?? undefined : undefined}
          initialApplicantIds={(existingApplicants.data ?? []).map((a) => a.customer_id)}
          submitting={submitting}
          error={errorMsg}
          onSubmit={handleSubmit}
          onCancel={() =>
            navigate(editing && id ? `/cases/${id}` : `/customers/${customerId}`)
          }
        />
      </div>
    </section>
  )
}
