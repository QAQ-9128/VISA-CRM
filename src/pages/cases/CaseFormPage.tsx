import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CaseForm } from '../../components/cases/CaseForm'
import type { CaseFormValues } from '../../components/cases/CaseForm'
import { useCase, useCreateCase, useUpdateCase } from '../../hooks/queries/useCases'
import { useCustomer } from '../../hooks/queries/useCustomers'
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

  const createM = useCreateCase()
  const updateM = useUpdateCase()
  const submitting = createM.isPending || updateM.isPending
  const err = createM.error ?? updateM.error
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

  function handleSubmit(values: CaseFormValues) {
    if (editing && id) {
      updateM.mutate({ id, patch: values }, { onSuccess: () => navigate(`/cases/${id}`) })
    } else {
      createM.mutate(values, { onSuccess: (created) => navigate(`/cases/${created.id}`) })
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
