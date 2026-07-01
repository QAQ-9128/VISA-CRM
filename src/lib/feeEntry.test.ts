import { describe, expect, it } from 'vitest'
import {
  FEE_ENTRY_STATUS,
  FEE_ENTRY_TYPE_LABELS,
  draftToPlanItem,
  draftToReceipt,
  emptyDraft,
  isDraftBlank,
  isDraftValid,
  validateDrafts,
} from './feeEntry'
import type { DraftFeeLine } from './feeEntry'
import { getCaseTotals, getItemPaid } from './planItems'
import { receivableStatus } from './finance'
import type { Payment, PaymentPlanItem } from '../types/models'

const draft = (over: Partial<DraftFeeLine>): DraftFeeLine => ({
  key: 'k', type: '', desc: '', amount: '', ...over,
})

describe('feeEntry — 列式录入纯逻辑', () => {
  it('类型标签 / 状态映射：收款=绿(settled)、待付=黄(owing)', () => {
    expect(FEE_ENTRY_TYPE_LABELS).toEqual({ received: '收款', owing: '待付' })
    expect(FEE_ENTRY_STATUS.received).toBe('settled')
    expect(FEE_ENTRY_STATUS.owing).toBe('owing')
  })

  it('空白行判定：三项皆空才算空白', () => {
    expect(isDraftBlank(draft({}))).toBe(true)
    expect(isDraftBlank(draft({ desc: '律师费' }))).toBe(false)
    expect(isDraftBlank(draft({ amount: '100' }))).toBe(false)
    expect(isDraftBlank(draft({ type: 'owing' }))).toBe(false)
  })

  it('合法行：类型已选 + 描述非空 + 金额>0', () => {
    expect(isDraftValid(draft({ type: 'received', desc: '律师费', amount: '2000' }))).toBe(true)
    expect(isDraftValid(draft({ type: '', desc: '律师费', amount: '2000' }))).toBe(false) // 缺类型
    expect(isDraftValid(draft({ type: 'owing', desc: '  ', amount: '100' }))).toBe(false) // 描述空
    expect(isDraftValid(draft({ type: 'owing', desc: '文案费', amount: '0' }))).toBe(false) // 金额 0
    expect(isDraftValid(draft({ type: 'owing', desc: '文案费', amount: '-5' }))).toBe(false) // 金额负
  })

  it('批量校验：空白行忽略，半填行拦截，全有效放行', () => {
    const blank = draft({ key: 'a' })
    const good1 = draft({ key: 'b', type: 'received', desc: '律师费', amount: '2000' })
    const good2 = draft({ key: 'c', type: 'owing', desc: '文案费', amount: '1500' })
    const half = draft({ key: 'd', type: 'received', desc: '', amount: '300' }) // 半填

    // 全空白 → 不可保存、不报错
    expect(validateDrafts([blank, draft({ key: 'e' })])).toEqual({ ready: [], ok: false, error: null })

    // 空白行被忽略，有效行放行
    const okRes = validateDrafts([good1, blank, good2])
    expect(okRes.ok).toBe(true)
    expect(okRes.error).toBeNull()
    expect(okRes.ready.map((r) => r.key)).toEqual(['b', 'c'])

    // 含半填非法行 → 拦截并提示（仍报出已合法的 ready，供按钮态判断）
    const badRes = validateDrafts([good1, half])
    expect(badRes.ok).toBe(false)
    expect(badRes.error).toMatch(/金额/)
  })

  it('草稿 → 款项 insert：描述 trim 入 fee_category、金额转数', () => {
    expect(draftToPlanItem(draft({ type: 'owing', desc: ' 律师费 ', amount: '2000' }), 'PL')).toEqual({
      plan_id: 'PL', fee_category: '律师费', amount_due: 2000, is_shared: false,
    })
  })

  it('收款类 → 全额 from_client 收款(今天)；待付类 → null（不记收款）', () => {
    const ctx = { caseId: 'ca1', applicantId: 'cu1', planItemId: 'IT', currency: 'AUD', paidAt: '2026-06-23' }
    expect(draftToReceipt(draft({ type: 'owing', desc: '文案费', amount: '1500' }), ctx)).toBeNull()
    expect(draftToReceipt(draft({ type: 'received', desc: '律师费', amount: '2000' }), ctx)).toEqual({
      case_id: 'ca1', applicant_id: 'cu1', direction: 'from_client', plan_item_id: 'IT',
      amount: 2000, currency: 'AUD', method: 'transfer', paid_at: '2026-06-23', fee_category: '律师费', is_shared: false,
    })
  })

  it('共享·全案：draftToPlanItem/draftToReceipt shared=true → is_shared 打标、收款 applicant_id 恒 null', () => {
    const item = draftToPlanItem(draft({ type: 'received', desc: '政府申请费', amount: '500' }), 'PL', true)
    expect(item).toMatchObject({ fee_category: '政府申请费', amount_due: 500, is_shared: true })
    const rec = draftToReceipt(draft({ type: 'received', desc: '政府申请费', amount: '500' }), {
      caseId: 'ca1', applicantId: 'cu1', planItemId: 'IT', currency: 'AUD', paidAt: '2026-07-01', shared: true,
    })
    expect(rec).toMatchObject({ applicant_id: null, is_shared: true, direction: 'from_client', amount: 500 })
  })

  // 不变量：列式录入产物喂回现有账目派生函数，应收/已收/未收与预期一致
  it('账目不变量：收款2000 + 待付1500 → 应收3500/已收2000/未收1500，状态收款=已收·待付=待付', () => {
    const drafts = [
      draft({ key: 'a', type: 'received', desc: '律师费', amount: '2000' }),
      draft({ key: 'b', type: 'owing', desc: '文案费', amount: '1500' }),
    ]
    // 模拟保存：建款项（id=行 key）+ 收款类补一笔 from_client
    const items: PaymentPlanItem[] = []
    const payments: Payment[] = []
    for (const d of drafts) {
      const itemId = `IT-${d.key}`
      items.push({ ...draftToPlanItem(d, 'PL'), id: itemId } as unknown as PaymentPlanItem)
      const rec = draftToReceipt(d, { caseId: 'ca1', applicantId: 'cu1', planItemId: itemId, currency: 'AUD', paidAt: '2026-06-23' })
      if (rec) payments.push({ ...rec, id: `PAY-${d.key}` } as unknown as Payment)
    }

    const totals = getCaseTotals(items, payments)
    expect(totals).toEqual({ totalDue: 3500, totalPaid: 2000, totalUnpaid: 1500 })

    // 律师费（收款）→ 已付满额 → settled；文案费（待付）→ 未付 → owing
    const law = items.find((i) => i.fee_category === '律师费')!
    const draftFee = items.find((i) => i.fee_category === '文案费')!
    expect(getItemPaid(law.id, payments)).toBe(2000)
    expect(receivableStatus({ receivable: 2000, unpaid: 0 }).kind).toBe('settled')
    expect(getItemPaid(draftFee.id, payments)).toBe(0)
    expect(receivableStatus({ receivable: 1500, unpaid: 1500 }).kind).toBe('owing')
  })

  it('emptyDraft：每次 key 唯一、字段全空', () => {
    const a = emptyDraft()
    const b = emptyDraft()
    expect(a.key).not.toBe(b.key)
    expect(isDraftBlank(a)).toBe(true)
  })
})
