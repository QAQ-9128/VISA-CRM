import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as customersApi from './customers'

// 受控的 supabase mock：from() 返回一个可链式调用、且 await 时解析为 result 的 builder。
const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))
vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
  setRememberMe: vi.fn(),
}))

interface Result {
  data: unknown
  error: { message: string } | null
}

function makeBuilder(result: Result) {
  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    then: (resolve: (r: Result) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>
  } = {} as never
  const chain = ['select', 'insert', 'update', 'delete', 'eq', 'is', 'or', 'ilike', 'order', 'limit']
  for (const m of chain) builder[m] = vi.fn(() => builder)
  builder.single = vi.fn(() => builder)
  builder.maybeSingle = vi.fn(() => builder)
  // 让 builder 可被 await
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  return builder
}

function mockReturn(result: Result) {
  const b = makeBuilder(result)
  fromMock.mockReturnValue(b)
  return b
}

beforeEach(() => {
  fromMock.mockReset()
})

describe('listCustomers', () => {
  it('默认排除已归档，并按星标→姓名排序', async () => {
    const rows = [{ id: '1', full_name: 'A' }]
    const b = mockReturn({ data: rows, error: null })

    const result = await customersApi.listCustomers()

    expect(fromMock).toHaveBeenCalledWith('customers')
    expect(b.select).toHaveBeenCalledWith('*')
    expect(b.eq).toHaveBeenCalledWith('is_archived', false)
    expect(b.order).toHaveBeenCalledWith('is_starred', { ascending: false })
    expect(b.order).toHaveBeenCalledWith('full_name', { ascending: true })
    expect(result).toEqual(rows)
  })

  it('includeArchived 时不加 is_archived 过滤', async () => {
    const b = mockReturn({ data: [], error: null })
    await customersApi.listCustomers({ includeArchived: true })
    expect(b.eq).not.toHaveBeenCalledWith('is_archived', false)
  })

  it('带 search 时做 full_name/phone/email 的 ilike or 查询', async () => {
    const b = mockReturn({ data: [], error: null })
    await customersApi.listCustomers({ search: '张三' })
    const orArg = b.or.mock.calls[0]?.[0] as string
    expect(orArg).toContain('full_name.ilike')
    expect(orArg).toContain('张三')
  })

  // PostgREST 的 .or() 里逗号/括号是语法保留字符：模式值必须双引号包裹，否则
  // 搜「Smith, John」「a(b」会破坏过滤串（逗号被当条件分隔符）→ 结果错误或 400。
  it('搜索词含逗号/括号/引号/顿号：模式值双引号包裹并转义内部引号，语法不被破坏', async () => {
    const cases: Array<{ input: string; quoted: string }> = [
      { input: '张, 三', quoted: '"%张, 三%"' },
      { input: 'a(b)', quoted: '"%a(b)%"' },
      { input: '王"五', quoted: '"%王\\"五%"' },
      { input: '张、三', quoted: '"%张、三%"' },
      { input: 'back\\slash', quoted: '"%back\\\\slash%"' },
    ]
    for (const { input, quoted } of cases) {
      const b = mockReturn({ data: [], error: null })
      await customersApi.listCustomers({ search: input })
      const orArg = b.or.mock.calls[0]?.[0] as string
      expect(orArg).toBe(`full_name.ilike.${quoted},phone.ilike.${quoted},email.ilike.${quoted}`)
    }
  })

  it('error 时抛出', async () => {
    mockReturn({ data: null, error: { message: 'boom' } })
    await expect(customersApi.listCustomers()).rejects.toThrow('boom')
  })
})

describe('getCustomer', () => {
  it('按 id maybeSingle 查询', async () => {
    const row = { id: 'c1', full_name: 'A' }
    const b = mockReturn({ data: row, error: null })
    const result = await customersApi.getCustomer('c1')
    expect(b.eq).toHaveBeenCalledWith('id', 'c1')
    expect(b.maybeSingle).toHaveBeenCalled()
    expect(result).toEqual(row)
  })
})

describe('家庭组', () => {
  it('getSubApplicants 按 primary_applicant_id 过滤', async () => {
    const b = mockReturn({ data: [], error: null })
    await customersApi.getSubApplicants('p1')
    expect(b.eq).toHaveBeenCalledWith('primary_applicant_id', 'p1')
  })

  it('listPrimaryApplicants 只取 primary_applicant_id 为空的', async () => {
    const b = mockReturn({ data: [], error: null })
    await customersApi.listPrimaryApplicants()
    expect(b.is).toHaveBeenCalledWith('primary_applicant_id', null)
  })
})

describe('写操作', () => {
  it('createCustomer 插入并返回新行', async () => {
    const row = { id: 'new', full_name: '李四' }
    const b = mockReturn({ data: row, error: null })
    const result = await customersApi.createCustomer({ full_name: '李四' })
    expect(b.insert).toHaveBeenCalledWith({ full_name: '李四' })
    expect(b.single).toHaveBeenCalled()
    expect(result).toEqual(row)
  })

  it('updateCustomer 按 id 更新并返回', async () => {
    const row = { id: 'c1', full_name: '改名' }
    const b = mockReturn({ data: row, error: null })
    const result = await customersApi.updateCustomer('c1', { full_name: '改名' })
    expect(b.update).toHaveBeenCalledWith({ full_name: '改名' })
    expect(b.eq).toHaveBeenCalledWith('id', 'c1')
    expect(result).toEqual(row)
  })

  it('addFamilyMember 只建一个挂靠主申请的客户行（四字段 + primary_applicant_id，不建 case）', async () => {
    const b = mockReturn({ data: { id: 'm1', full_name: '小明' }, error: null })
    await customersApi.addFamilyMember('primary1', {
      full_name: '小明',
      gender: 'male',
      birth_date: '2010-01-01',
      relationship_to_primary: '子女',
    })
    expect(fromMock).toHaveBeenCalledWith('customers')
    expect(fromMock).not.toHaveBeenCalledWith('cases')
    expect(b.insert).toHaveBeenCalledWith({
      full_name: '小明',
      gender: 'male',
      birth_date: '2010-01-01',
      relationship_to_primary: '子女',
      primary_applicant_id: 'primary1',
    })
  })

  it('createCustomer 透传 client_source（客户来源）', async () => {
    const b = mockReturn({ data: { id: 'new', full_name: '赵六', client_source: 'red' }, error: null })
    await customersApi.createCustomer({ full_name: '赵六', client_source: 'red' })
    expect(b.insert).toHaveBeenCalledWith({ full_name: '赵六', client_source: 'red' })
  })

  it('updateCustomer 可改 client_source（含清空为 null）', async () => {
    const b = mockReturn({ data: { id: 'c1' }, error: null })
    await customersApi.updateCustomer('c1', { client_source: null })
    expect(b.update).toHaveBeenCalledWith({ client_source: null })
  })

  it('createCustomer 透传 sponsor_position（担保职位）', async () => {
    const row = { id: 'new', full_name: '王五', sponsor_position: 'Senior Cook' }
    const b = mockReturn({ data: row, error: null })
    await customersApi.createCustomer({ full_name: '王五', sponsor_position: 'Senior Cook' })
    expect(b.insert).toHaveBeenCalledWith({ full_name: '王五', sponsor_position: 'Senior Cook' })
  })

  it('updateCustomer 可单独更新 sponsor_position（与雇主互不依赖）', async () => {
    const b = mockReturn({ data: { id: 'c1' }, error: null })
    await customersApi.updateCustomer('c1', { sponsor_position: 'Marketing Manager' })
    expect(b.update).toHaveBeenCalledWith({ sponsor_position: 'Marketing Manager' })
  })

  /** 按表分调用队列的 mock：同一表多次 from() 依次吐出不同结果，记录每次的 builder。 */
  function mockTables(queues: Record<string, Result[]>) {
    const made: Record<string, ReturnType<typeof makeBuilder>[]> = {}
    fromMock.mockImplementation((table: string) => {
      const r = queues[table]?.shift() ?? { data: null, error: null }
      const b = makeBuilder(r)
      b.neq = vi.fn(() => b)
      b.in = vi.fn(() => b)
      b.limit = vi.fn(() => b)
      ;(made[table] ??= []).push(b)
      return b
    })
    return made
  }

  it('archiveCustomer：TA 参与的所有案件（拥有 ∪ 参与）一并归档，客户软删，绝不 delete', async () => {
    const made = mockTables({
      cases: [
        { data: [{ id: 'k1' }], error: null }, // ① 名下未归档案件
        { data: null, error: null }, // ② 批量归档 update.in()
      ],
      case_applicants: [
        { data: [{ case_id: 'k2' }], error: null }, // ① TA 作为参与人的案件
      ],
      customers: [{ data: null, error: null }], // ③ 客户软删
    })
    await customersApi.archiveCustomer('c1')
    expect(made.cases[1].update).toHaveBeenCalledWith({ is_archived: true })
    expect(made.cases[1].in).toHaveBeenCalledWith('id', ['k1', 'k2']) // 拥有 + 参与 全归档
    expect(made.customers[0].update).toHaveBeenCalledWith({ is_archived: true })
    expect(made.customers[0].delete).not.toHaveBeenCalled()
    expect(made.cases[1].delete).not.toHaveBeenCalled()
  })

  it('archiveCustomer：无任何案件 → 只软删客户，不发案件 update', async () => {
    const made = mockTables({
      cases: [{ data: [], error: null }],
      case_applicants: [{ data: [], error: null }],
      customers: [{ data: null, error: null }],
    })
    await customersApi.archiveCustomer('c1')
    expect(made.cases).toHaveLength(1) // 只有查询
    expect(made.customers[0].update).toHaveBeenCalledWith({ is_archived: true })
  })

  it('unarchiveCustomer 只恢复客户本体（连带归档的案件在回收站分别恢复）', async () => {
    const made = mockTables({ customers: [{ data: null, error: null }] })
    await customersApi.unarchiveCustomer('c1')
    expect(made.customers[0].update).toHaveBeenCalledWith({ is_archived: false })
    expect(made.cases).toBeUndefined()
  })

  it('deleteCustomer：名下多人案件先过户给另一参与人（案件保留），再真删客户', async () => {
    // 每张表一个调用队列：同一表的多次 from() 依次返回不同结果
    const queues: Record<string, Result[]> = {
      cases: [
        { data: [{ id: 'k1' }], error: null }, // ① 查名下案件 → k1
        { data: null, error: null }, // ③ 过户 update customer_id
      ],
      case_applicants: [
        { data: [{ customer_id: 'heir1' }], error: null }, // ② 查 k1 其他参与人 → heir1
        { data: null, error: null }, // ④ 把 heir1 从参与表移除（已成为案件客户）
      ],
      customers: [{ data: [{ id: 'c1' }], error: null }], // ⑤ 真删客户（select 校验：确实删了 1 行）
    }
    const made: Record<string, ReturnType<typeof makeBuilder>[]> = {}
    fromMock.mockImplementation((table: string) => {
      const r = queues[table]?.shift() ?? { data: null, error: null }
      const b = makeBuilder(r)
      b.neq = vi.fn(() => b)
      ;(made[table] ??= []).push(b)
      return b
    })

    await customersApi.deleteCustomer('c1')

    // ③ 案件过户给 heir1（不删除案件）
    expect(made.cases[1].update).toHaveBeenCalledWith({ customer_id: 'heir1' })
    expect(made.cases[1].eq).toHaveBeenCalledWith('id', 'k1')
    // ④ heir1 移出参与表（案件客户不在 case_applicants）
    expect(made.case_applicants[1].delete).toHaveBeenCalled()
    // ⑤ 客户真删（其参与的他人案件由 case_applicants 级联自动移出）
    expect(made.customers[0].delete).toHaveBeenCalled()
    expect(made.customers[0].eq).toHaveBeenCalledWith('id', 'c1')
  })

  it('deleteCustomer：名下单人案件（无其他参与人）不过户，随客户级联删除', async () => {
    const queues: Record<string, Result[]> = {
      cases: [{ data: [{ id: 'k1' }], error: null }],
      case_applicants: [{ data: [], error: null }], // 无其他参与人
      customers: [{ data: [{ id: 'c1' }], error: null }],
    }
    const made: Record<string, ReturnType<typeof makeBuilder>[]> = {}
    fromMock.mockImplementation((table: string) => {
      const r = queues[table]?.shift() ?? { data: null, error: null }
      const b = makeBuilder(r)
      b.neq = vi.fn(() => b)
      ;(made[table] ??= []).push(b)
      return b
    })

    await customersApi.deleteCustomer('c1')

    expect(made.cases).toHaveLength(1) // 只查询，未过户
    expect(made.customers[0].delete).toHaveBeenCalled()
  })

  // RLS 把 admin-only DELETE 静默挡掉时（命中 0 行、不报错），必须显式抛错——
  // 否则前面的过户/移出参与人已写入，会留下"客户没删成但案件归属被改"的脏数据且无任何提示。
  it('deleteCustomer：末步删除命中 0 行（如被 RLS 拒）→ 抛错，不静默', async () => {
    const queues: Record<string, Result[]> = {
      cases: [{ data: [], error: null }], // 名下无案件
      customers: [{ data: [], error: null }], // delete 被 RLS 挡 → 0 行
    }
    const made: Record<string, ReturnType<typeof makeBuilder>[]> = {}
    fromMock.mockImplementation((table: string) => {
      const r = queues[table]?.shift() ?? { data: null, error: null }
      const b = makeBuilder(r)
      b.neq = vi.fn(() => b)
      ;(made[table] ??= []).push(b)
      return b
    })

    await expect(customersApi.deleteCustomer('c1')).rejects.toThrow(/未删除|管理员/)
    expect(made.customers[0].select).toHaveBeenCalled() // 删除后跟 select 校验行数
  })
})
