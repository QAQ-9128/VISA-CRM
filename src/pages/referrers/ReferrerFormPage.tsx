import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
import { useSmartBack } from '../../hooks/useSmartBack'

export function ReferrerFormPage() {
  const { id } = useParams()
  const editing = !!id
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // 列表页开关带过来的默认类型：?kind=owner → 新建归属人（编辑时以实体自身 kind 为准）
  const defaultKind = searchParams.get('kind') === 'owner' ? ('owner' as const) : ('referrer' as const)
  // 取消 = 回到点进来的那个界面；刷新/直链兜底回介绍人列表
  const goBack = useSmartBack('/referrers')

  const existing = useReferrer(id)
  const createM = useCreateReferrer()
  const updateM = useUpdateReferrer()
  const submitting = createM.isPending || updateM.isPending
  const err = createM.error ?? updateM.error
  const errorMsg = err instanceof Error ? err.message : err ? '保存失败' : null

  if (editing && existing.isPending) return <LoadingBlock />
  if (editing && existing.isError) return <ErrorBlock error={existing.error} />

  function handleSubmit(values: ReferrerFormValues) {
    // 保存后 replace：表单页不留在历史里
    if (editing && id) {
      updateM.mutate({ id, patch: values }, { onSuccess: () => navigate('/referrers', { replace: true }) })
    } else {
      createM.mutate(values, { onSuccess: () => navigate('/referrers', { replace: true }) })
    }
  }

  return (
    <section className="w-full">
      <div className="mb-3">
        <BackLink to="/referrers" label="介绍人 / 归属人列表" />
      </div>
      <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">
        {editing
          ? `编辑${existing.data?.kind === 'owner' ? '归属人' : '介绍人'}`
          : `新建${defaultKind === 'owner' ? '归属人' : '介绍人'}`}
      </h1>
      <Card className="mt-5">
        <ReferrerForm
          initial={editing ? existing.data ?? undefined : undefined}
          defaultKind={defaultKind}
          submitting={submitting}
          error={errorMsg}
          onSubmit={handleSubmit}
          onCancel={goBack}
        />
      </Card>
    </section>
  )
}
