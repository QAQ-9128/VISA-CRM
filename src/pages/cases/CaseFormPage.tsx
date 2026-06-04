import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CaseForm } from '../../components/cases/CaseForm'
import type { CaseFormValues } from '../../components/cases/CaseForm'
import { useCase, useCreateCase, useUpdateCase } from '../../hooks/queries/useCases'
import { useCustomer } from '../../hooks/queries/useCustomers'
import { useCaseApplicants, useSetCaseApplicants } from '../../hooks/queries/useCaseApplicants'
import type { Case } from '../../types/models'
import { BackLink } from '../../components/ui/BackLink'
import { Card } from '../../components/ui/Card'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'
import { useSmartBack } from '../../hooks/useSmartBack'

export function CaseFormPage() {
  const { id } = useParams()
  const editing = !!id
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const existing = useCase(id)
  const customerId = editing ? existing.data?.customer_id : params.get('customer') ?? undefined
  const customer = useCustomer(customerId)

  const existingApplicants = useCaseApplicants(id)
  const createM = useCreateCase()
  const updateM = useUpdateCase()
  const setApplicantsM = useSetCaseApplicants()
  const submitting = createM.isPending || updateM.isPending || setApplicantsM.isPending
  const err = createM.error ?? updateM.error ?? setApplicantsM.error
  const errorMsg = err instanceof Error ? err.message : err ? '保存失败' : null

  // 取消 = 回到点进来的那个界面（应用内历史后退；刷新/直链则兜底到客户档案——案件详情页已删）
  const goBack = useSmartBack(`/customers/${customerId ?? ''}`)

  if (editing && existing.isPending) return <LoadingBlock />
  if (editing && existing.isError) return <ErrorBlock error={existing.error} />

  if (!editing && !customerId) {
    return (
      <div className="mx-auto max-w-2xl text-center text-slate-500">
        请从客户档案进入新建案件。
        <div className="mt-4">
          <Link to="/customers" className="text-brand hover:underline">
            前往客户列表
          </Link>
        </div>
      </div>
    )
  }

  // 保存完成后写参与人即跳客户详情并选中该案（案件详情页已删）。
  function finishSave(saved: Case, applicantIds: string[]) {
    setApplicantsM.mutate(
      { caseId: saved.id, customerIds: applicantIds },
      {
        // 保存后 replace：表单页不留在历史里 → 客户页再「返回」直接回到进表单前的界面
        onSuccess: () => navigate(`/customers/${saved.customer_id}?case=${saved.id}`, { replace: true }),
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
    <section className="w-full">
      <div className="mb-3">
        <BackLink to={`/customers/${customerId ?? ''}`} label="返回客户档案" />
      </div>
      <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">
        {editing ? '编辑案件' : '新建案件'}
      </h1>
      <Card className="mt-5">
        <CaseForm
          customerId={customerId as string}
          customerLabel={customer.data?.full_name ?? '…'}
          initial={editing ? existing.data ?? undefined : undefined}
          initialApplicantIds={(existingApplicants.data ?? []).map((a) => a.customer_id)}
          submitting={submitting}
          error={errorMsg}
          onSubmit={handleSubmit}
          onCancel={goBack}
        />
      </Card>
    </section>
  )
}
