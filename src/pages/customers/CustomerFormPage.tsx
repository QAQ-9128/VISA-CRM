import { useNavigate, useParams } from 'react-router-dom'
import { CustomerForm } from '../../components/customers/CustomerForm'
import type { CustomerFormNext, CustomerFormValues } from '../../components/customers/CustomerForm'
import {
  useCreateCustomer,
  useCustomer,
  useUpdateCustomer,
} from '../../hooks/queries/useCustomers'
import { useAddCaseApplicant } from '../../hooks/queries/useCaseApplicants'
import { BackLink } from '../../components/ui/BackLink'
import { Card } from '../../components/ui/Card'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'
import { useSmartBack } from '../../hooks/useSmartBack'

export function CustomerFormPage() {
  const { id } = useParams()
  const editing = !!id
  const navigate = useNavigate()

  const existing = useCustomer(id)
  const createM = useCreateCustomer()
  const updateM = useUpdateCustomer()
  const addApplicantM = useAddCaseApplicant()

  const submitting = createM.isPending || updateM.isPending || addApplicantM.isPending
  // 加入案件失败单独成句：客户其实已建好/已保存，提示用户可重试或直接取消（不会丢人）
  const errorMsg = addApplicantM.error
    ? `客户已保存，但加入案件失败：${addApplicantM.error instanceof Error ? addApplicantM.error.message : '请重试'}`
    : (() => {
        const error = createM.error ?? updateM.error
        return error instanceof Error ? error.message : error ? '保存失败' : null
      })()

  // 取消 = 回到点进来的那个界面（应用内历史后退；刷新/直链则兜底到详情或列表）
  const goBack = useSmartBack(editing && id ? `/customers/${id}` : '/customers')

  function handleSubmit(
    values: CustomerFormValues,
    joinCaseId: string | null,
    next: CustomerFormNext,
    companionIds: string[],
  ) {
    // 保存后 replace：表单页不留在历史里 → 详情页再「返回」直接回到进表单前的界面
    const finish = (customerId: string) => {
      // 「保存并新建案件」：建完人直进案件表单；组区快速建的同组人经 ?with= 自动预选为本案参与人
      const withQ = companionIds.length ? `&with=${companionIds.join(',')}` : ''
      const dest =
        next === 'new-case' ? `/cases/new?customer=${customerId}${withQ}` : `/customers/${customerId}`
      // 选了「加入已有案件」→ 建完人把 本客户 + 同组的人 依次写 case_applicants（一案一组）。
      // onSuccess 才跳转：加入失败时留在表单显示错误（客户已建好，可重试或取消）。
      if (joinCaseId) {
        const queue = [customerId, ...companionIds]
        const addNext = (i: number) => {
          if (i >= queue.length) {
            navigate(dest, { replace: true })
            return
          }
          addApplicantM.mutate(
            { caseId: joinCaseId, customerId: queue[i] },
            { onSuccess: () => addNext(i + 1) },
          )
        }
        addNext(0)
      } else {
        navigate(dest, { replace: true })
      }
    }
    if (editing && id) {
      updateM.mutate({ id, patch: values }, { onSuccess: () => finish(id) })
    } else {
      createM.mutate(values, { onSuccess: (created) => finish(created.id) })
    }
  }

  if (editing && existing.isPending) return <LoadingBlock />
  if (editing && existing.isError) return <ErrorBlock error={existing.error} />

  return (
    <section className="w-full">
      <div className="mb-3">
        <BackLink
          to={editing && id ? `/customers/${id}` : '/customers'}
          label={editing ? '返回客户档案' : '客户列表'}
        />
      </div>
      <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">
        {editing ? '编辑客户' : '新建客户'}
      </h1>
      {/* 单张完整表单（独立快速卡已删，2026-06 拍板）：快速建同组人的能力在 组（Group）区内 */}
      <Card className="mt-5">
        <CustomerForm
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
