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

  it('archiveCustomer 是软删除：调用 update({is_archived:true})，绝不 delete', async () => {
    const b = mockReturn({ data: null, error: null })
    await customersApi.archiveCustomer('c1')
    expect(b.update).toHaveBeenCalledWith({ is_archived: true })
    expect(b.eq).toHaveBeenCalledWith('id', 'c1')
    expect(b.delete).not.toHaveBeenCalled()
  })
})
