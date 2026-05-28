import { useNavigate, useParams } from 'react-router-dom'
import { EmployerForm } from '../../components/employers/EmployerForm'
import type { EmployerFormValues } from '../../components/employers/EmployerForm'
import {
  useCreateEmployer,
  useEmployer,
  useUpdateEmployer,
} from '../../hooks/queries/useEmployers'
import { BackLink } from '../../components/ui/BackLink'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'

export function EmployerFormPage() {
  const { id } = useParams()
  const editing = !!id
  const navigate = useNavigate()

  const existing = useEmployer(id)
  const createM = useCreateEmployer()
  const updateM = useUpdateEmployer()
  const submitting = createM.isPending || updateM.isPending
  const err = createM.error ?? updateM.error
  const errorMsg = err instanceof Error ? err.message : err ? '保存失败' : null

  if (editing && existing.isPending) return <LoadingBlock />
  if (editing && existing.isError) return <ErrorBlock error={existing.error} />

  function handleSubmit(values: EmployerFormValues) {
    if (editing && id) {
      updateM.mutate({ id, patch: values }, { onSuccess: () => navigate('/employers') })
    } else {
      createM.mutate(values, { onSuccess: () => navigate('/employers') })
    }
  }

  return (
    <section className="mx-auto max-w-2xl">
      <div className="mb-3">
        <BackLink to="/employers" label="雇主列表" />
      </div>
      <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">
        {editing ? '编辑雇主' : '新建雇主'}
      </h1>
      <div className="mt-6">
        <EmployerForm
          initial={editing ? existing.data ?? undefined : undefined}
          submitting={submitting}
          error={errorMsg}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/employers')}
        />
      </div>
    </section>
  )
}
