import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CustomerForm } from '../../components/customers/CustomerForm'
import type { CustomerFormValues } from '../../components/customers/CustomerForm'
import {
  useCreateCustomer,
  useCustomer,
  useUpdateCustomer,
} from '../../hooks/queries/useCustomers'
import { BackLink } from '../../components/ui/BackLink'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'

export function CustomerFormPage() {
  const { id } = useParams()
  const editing = !!id
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // 新建副申请人：从主申档案「+ 添加副申请人」带 ?primary=<主申id> 进来，预选挂靠主申
  const initialPrimaryId = !editing ? params.get('primary') ?? undefined : undefined

  const existing = useCustomer(id)
  const createM = useCreateCustomer()
  const updateM = useUpdateCustomer()

  const submitting = createM.isPending || updateM.isPending
  const error = createM.error ?? updateM.error
  const errorMsg = error instanceof Error ? error.message : error ? '保存失败' : null

  function handleSubmit(values: CustomerFormValues) {
    if (editing && id) {
      updateM.mutate(
        { id, patch: values },
        { onSuccess: () => navigate(`/customers/${id}`) },
      )
    } else {
      createM.mutate(values, {
        onSuccess: (created) => navigate(`/customers/${created.id}`),
      })
    }
  }

  if (editing && existing.isPending) return <LoadingBlock />
  if (editing && existing.isError) return <ErrorBlock error={existing.error} />

  return (
    <section className="mx-auto max-w-2xl">
      <div className="mb-3">
        <BackLink
          to={editing && id ? `/customers/${id}` : '/customers'}
          label={editing ? '返回客户档案' : '客户列表'}
        />
      </div>
      <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">
        {editing ? '编辑客户' : '新建客户'}
      </h1>
      <div className="mt-6">
        <CustomerForm
          initial={editing ? existing.data ?? undefined : undefined}
          initialPrimaryId={initialPrimaryId}
          submitting={submitting}
          error={errorMsg}
          onSubmit={handleSubmit}
          onCancel={() => navigate(editing && id ? `/customers/${id}` : '/customers')}
        />
      </div>
    </section>
  )
}
