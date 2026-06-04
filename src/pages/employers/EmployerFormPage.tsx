import { useNavigate, useParams } from 'react-router-dom'
import { EmployerForm } from '../../components/employers/EmployerForm'
import type { EmployerFormValues } from '../../components/employers/EmployerForm'
import {
  useCreateEmployer,
  useEmployer,
  useUpdateEmployer,
} from '../../hooks/queries/useEmployers'
import { BackLink } from '../../components/ui/BackLink'
import { Card } from '../../components/ui/Card'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'
import { useSmartBack } from '../../hooks/useSmartBack'

export function EmployerFormPage() {
  const { id } = useParams()
  const editing = !!id
  const navigate = useNavigate()
  // 取消 = 回到点进来的那个界面；刷新/直链兜底回雇主列表
  const goBack = useSmartBack('/employers')

  const existing = useEmployer(id)
  const createM = useCreateEmployer()
  const updateM = useUpdateEmployer()
  const submitting = createM.isPending || updateM.isPending
  const err = createM.error ?? updateM.error
  const errorMsg = err instanceof Error ? err.message : err ? '保存失败' : null

  if (editing && existing.isPending) return <LoadingBlock />
  if (editing && existing.isError) return <ErrorBlock error={existing.error} />

  function handleSubmit(values: EmployerFormValues) {
    // 保存后 replace：表单页不留在历史里
    if (editing && id) {
      updateM.mutate({ id, patch: values }, { onSuccess: () => navigate('/employers', { replace: true }) })
    } else {
      createM.mutate(values, { onSuccess: () => navigate('/employers', { replace: true }) })
    }
  }

  return (
    <section className="w-full">
      <div className="mb-3">
        <BackLink to="/employers" label="雇主列表" />
      </div>
      <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">
        {editing ? '编辑雇主' : '新建雇主'}
      </h1>
      <Card className="mt-5">
        <EmployerForm
          initial={editing ? existing.data ?? undefined : undefined}
          submitting={submitting}
          error={errorMsg}
          onSubmit={handleSubmit}
          onCancel={goBack}
        />
      </Card>
    </section>
  )
}
