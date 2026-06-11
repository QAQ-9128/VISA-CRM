import { describe, expect, it } from 'vitest'
import { selectArchiveFiles, filterArchiveFiles, sortArchiveFiles } from './archive'
import type { Case, CaseDocument, Customer, Payment, Profile } from '../types/models'

const mkDoc = (o: Partial<CaseDocument>): CaseDocument => ({
  id: 'd1', customer_id: 'cu1', case_id: null, doc_type: 'passport', title: null, storage_path: 'cu1/general/x.pdf',
  file_name: 'passport.pdf', issue_date: null, expiry_date: null, note: null, uploaded_by: null,
  is_archived: false, created_at: '2026-05-10T00:00:00Z', updated_at: '', ...o,
})
const mkPayment = (o: Partial<Payment>): Payment => ({
  id: 'pay1', case_id: 'c1', applicant_id: null, direction: 'from_client', installment_id: null, plan_item_id: null, amount: 0,
  currency: 'AUD', method: 'transfer', paid_at: null, note: null, fee_category: null, invoice_path: null, invoice_name: null,
  from_client_customer_id: null, recorded_by: null, created_at: '2026-05-01T00:00:00Z', ...o,
})
const mkCase = (o: Partial<Case>): Case => ({
  id: 'c1', case_number: '00000001', customer_id: 'cu1', visa_subclass: '482', visa_stream: null, case_category: null, case_details: null, current_stage: 'visa_lodged',
  currency: 'AUD', sync_tracking: true, trt_reminder_enabled: false, trt_reminder_dismissed: false, cohab_reminder_enabled: false, cohab_reminder_last: null, parent_case_id: null, parent_sync_progress: false, destination_country: 'Australia', sponsor_position: null, sponsor_employer_id: null, assigned_to: null, created_by: null,
  is_archived: false, created_at: '', updated_at: '', ...o,
})
const mkCustomer = (o: Partial<Customer>): Customer => ({
  id: 'cu1', full_name: '张三', is_starred: false, client_source: null, primary_applicant_id: null,
  relationship_to_primary: null, birth_date: null, gender: null, passport_no: null, nationality: null, phone: null,
  email: null, wechat: null, address: null, sponsor_employer_id: null, sponsor_position: null, referrer_id: null, owner_referrer_id: null, notes: null,
  assigned_to: null, created_by: null, is_archived: false, created_at: '', updated_at: '', ...o,
})
const mkProfile = (o: Partial<Profile>): Profile => ({
  id: 'u1', role: 'staff', full_name: '李顾问', active: true, created_at: '', updated_at: '', ...o,
})

const maps = (cases: Case[], customers: Customer[], profiles: Profile[]) => ({
  caseById: Object.fromEntries(cases.map((c) => [c.id, c])),
  customerById: Object.fromEntries(customers.map((c) => [c.id, c])),
  profileById: Object.fromEntries(profiles.map((p) => [p.id, p])),
})

describe('selectArchiveFiles', () => {
  it('合并 documents 文件 + payments 发票为统一列表，解析客户/案件/签证/上传人', () => {
    const documents = [
      mkDoc({ id: 'd1', customer_id: 'cu1', case_id: 'c1', doc_type: 'passport', file_name: 'pp.pdf', storage_path: 'cu1/c1/pp.pdf', uploaded_by: 'u1', created_at: '2026-05-10T00:00:00Z' }),
      mkDoc({ id: 'd2', customer_id: 'cu1', doc_type: 'medical', file_name: null, title: '体检报告', storage_path: null }), // 无文件 → 跳过
    ]
    const payments = [
      mkPayment({ id: 'pay1', case_id: 'c1', invoice_path: 'cu1/c1/inv.pdf', invoice_name: 'inv.pdf', recorded_by: 'u1', created_at: '2026-05-12T00:00:00Z' }),
      mkPayment({ id: 'pay2', case_id: 'c1', invoice_path: null }), // 无发票 → 跳过
    ]
    const m = maps([mkCase({ id: 'c1', customer_id: 'cu1', visa_subclass: '482' })], [mkCustomer({ id: 'cu1', full_name: '张三' })], [mkProfile({ id: 'u1', full_name: '李顾问' })])

    const files = selectArchiveFiles(documents, payments, m)

    expect(files).toHaveLength(2) // d2 与 pay2 被跳过
    // 默认按上传日期倒序：发票(05-12) 在护照(05-10) 前
    expect(files.map((f) => f.key)).toEqual(['invoice:pay1', 'document:d1'])

    const invoice = files.find((f) => f.source === 'invoice')!
    expect(invoice).toMatchObject({
      typeKey: 'invoice', typeLabel: '发票', fileName: 'inv.pdf', sourceId: 'pay1',
      storagePath: 'cu1/c1/inv.pdf', customerId: 'cu1', customerName: '张三', caseId: 'c1',
      visaSubclass: '482', uploadedByName: '李顾问',
    })
    const doc = files.find((f) => f.source === 'document')!
    expect(doc).toMatchObject({
      typeKey: 'passport', typeLabel: '护照', fileName: 'pp.pdf', sourceId: 'd1',
      customerName: '张三', visaSubclass: '482', uploadedByName: '李顾问',
    })
  })

  // 归档物只在回收站可见（2026-06-05 用户拍板）：归档客户/案件名下的文件与发票从档案库隐藏
  describe('归档隐藏', () => {
    it('客户已归档 → 其文件不显示（恢复后 is_archived=false 自动回来）', () => {
      const m = maps([], [mkCustomer({ id: 'cu1', is_archived: true }), mkCustomer({ id: 'cu2', full_name: '李四' })], [])
      const files = selectArchiveFiles(
        [mkDoc({ id: 'd1', customer_id: 'cu1' }), mkDoc({ id: 'd2', customer_id: 'cu2', storage_path: 'cu2/general/y.pdf' })],
        [],
        m,
      )
      expect(files.map((f) => f.sourceId)).toEqual(['d2'])
    })

    it('文件所挂案件已归档 → 隐藏（即便客户仍在册）', () => {
      const m = maps([mkCase({ id: 'c1', customer_id: 'cu1', is_archived: true })], [mkCustomer({ id: 'cu1' })], [])
      const files = selectArchiveFiles([mkDoc({ id: 'd1', customer_id: 'cu1', case_id: 'c1' })], [], m)
      expect(files).toHaveLength(0)
    })

    it('发票：案件已归档 → 隐藏', () => {
      const m = maps([mkCase({ id: 'c1', customer_id: 'cu1', is_archived: true })], [mkCustomer({ id: 'cu1' })], [])
      const files = selectArchiveFiles([], [mkPayment({ id: 'pay1', case_id: 'c1', invoice_path: 'p.pdf' })], m)
      expect(files).toHaveLength(0)
    })

    it('发票：案件在册但案件客户已归档 → 隐藏', () => {
      const m = maps([mkCase({ id: 'c1', customer_id: 'cu1' })], [mkCustomer({ id: 'cu1', is_archived: true })], [])
      const files = selectArchiveFiles([], [mkPayment({ id: 'pay1', case_id: 'c1', invoice_path: 'p.pdf' })], m)
      expect(files).toHaveLength(0)
    })
  })

  it('上传人缺失（id 为 null 或查不到）显示 —', () => {
    const files = selectArchiveFiles(
      [mkDoc({ id: 'd1', uploaded_by: null })],
      [],
      maps([], [mkCustomer({ id: 'cu1' })], []),
    )
    expect(files[0].uploadedByName).toBe('—')
  })
})

describe('filterArchiveFiles', () => {
  const base = selectArchiveFiles(
    [
      mkDoc({ id: 'd1', customer_id: 'cu1', doc_type: 'passport', file_name: '护照扫描.pdf', created_at: '2026-05-10T00:00:00Z' }),
      mkDoc({ id: 'd2', customer_id: 'cu2', doc_type: 'medical', file_name: 'med.pdf', created_at: '2026-04-01T00:00:00Z' }),
    ],
    [mkPayment({ id: 'pay1', case_id: 'c1', invoice_path: 'p.pdf', invoice_name: 'invoice.pdf', created_at: '2026-05-20T00:00:00Z' })],
    maps([mkCase({ id: 'c1', customer_id: 'cu1' })], [mkCustomer({ id: 'cu1', full_name: '张三' }), mkCustomer({ id: 'cu2', full_name: '王五' })], []),
  )

  it('按类型过滤', () => {
    expect(filterArchiveFiles(base, { typeKey: 'invoice' }).map((f) => f.sourceId)).toEqual(['pay1'])
    expect(filterArchiveFiles(base, { typeKey: 'all' })).toHaveLength(3)
  })

  it('按客户过滤', () => {
    expect(filterArchiveFiles(base, { customerId: 'cu2' }).map((f) => f.sourceId)).toEqual(['d2'])
  })

  it('按日期范围过滤（含端点）', () => {
    const r = filterArchiveFiles(base, { dateFrom: '2026-05-01', dateTo: '2026-05-15' })
    expect(r.map((f) => f.sourceId)).toEqual(['d1'])
  })

  it('按文件名 / 客户名模糊搜索', () => {
    expect(filterArchiveFiles(base, { search: '护照' }).map((f) => f.sourceId)).toEqual(['d1'])
    expect(filterArchiveFiles(base, { search: '王五' }).map((f) => f.sourceId)).toEqual(['d2'])
  })
})

describe('sortArchiveFiles', () => {
  const files = selectArchiveFiles(
    [
      mkDoc({ id: 'd1', customer_id: 'cu2', doc_type: 'medical', created_at: '2026-05-10T00:00:00Z' }),
      mkDoc({ id: 'd2', customer_id: 'cu1', doc_type: 'passport', created_at: '2026-05-20T00:00:00Z' }),
    ],
    [],
    maps([], [mkCustomer({ id: 'cu1', full_name: 'Alice' }), mkCustomer({ id: 'cu2', full_name: 'Bob' })], []),
  )

  it('按日期升序', () => {
    expect(sortArchiveFiles(files, 'date', 'asc').map((f) => f.sourceId)).toEqual(['d1', 'd2'])
  })
  it('按日期降序（默认）', () => {
    expect(sortArchiveFiles(files, 'date').map((f) => f.sourceId)).toEqual(['d2', 'd1'])
  })
  it('按客户名升序（字典序）', () => {
    expect(sortArchiveFiles(files, 'customer', 'asc').map((f) => f.customerName)).toEqual(['Alice', 'Bob'])
  })
  it('不改原数组', () => {
    const before = files.map((f) => f.sourceId)
    sortArchiveFiles(files, 'date', 'asc')
    expect(files.map((f) => f.sourceId)).toEqual(before)
  })
})
