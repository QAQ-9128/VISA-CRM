import { useNavigate, useParams } from 'react-router-dom'
import { ReferrerForm } from '../../components/referrers/ReferrerForm'
import type { ReferrerFormValues } from '../../components/referrers/ReferrerForm'
import {
  useCreateReferrer,
  useReferrer,
  useUpdateReferrer,
} from '../../hooks/queries/useReferrers'
import { BackLink } from '../../components/ui/BackLink'
import { Card } from '../../components/ui/Card'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'

export function ReferrerFormPage() {
  const { id } = useParams()
  const editing = !!id
  const navigate = useNavigate()

  const existing = useReferrer(id)
  const createM = useCreateReferrer()
  const updateM = useUpdateReferrer()
  const submitting = createM.isPending || updateM.isPending
  const err = createM.error ?? updateM.error
  const errorMsg = err instanceof Error ? err.message : err ? '保存失败' : null

  if (editing && existing.isPending) return <LoadingBlock />
  if (editing && existing.isError) return <ErrorBlock error={existing.error} />

  function handleSubmit(values: ReferrerFormValues) {
    if (editing && id) {
      updateM.mutate({ id, patch: values }, { onSuccess: () => navigate('/referrers') })
    } else {
      createM.mutate(values, { onSuccess: () => navigate('/referrers') })
    }
  }

  return (
    <section className="mx-auto max-w-2xl">
      <div className="mb-3">
        <BackLink to="/referrers" label="介绍人列表" />
      </div>
      <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">
        {editing ? '编辑介绍人' : '新建介绍人'}
      </h1>
      <Card className="mt-5">
        <ReferrerForm
          initial={editing ? existing.data ?? undefined : undefined}
          submitting={submitting}
          error={errorMsg}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/referrers')}
        />
      </Card>
    </section>
  )
}
