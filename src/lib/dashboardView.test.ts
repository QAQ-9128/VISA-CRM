import { describe, expect, it } from 'vitest'
import { countOwingCustomers, displayCustomerName, pickGreetingName } from './dashboardView'

describe('pickGreetingName（问候语绝不外显邮箱）', () => {
  it('有真实姓名 → 返回姓名', () => {
    expect(pickGreetingName('张三')).toBe('张三')
  })
  it('姓名两端空白 → trim 后返回', () => {
    expect(pickGreetingName('  李四  ')).toBe('李四')
  })
  it('无姓名（null/空/纯空白）→ 返回 null，不回落邮箱', () => {
    expect(pickGreetingName(null)).toBeNull()
    expect(pickGreetingName(undefined)).toBeNull()
    expect(pickGreetingName('')).toBeNull()
    expect(pickGreetingName('   ')).toBeNull()
  })
  it('full_name 实为邮箱（含 @）→ 视为无名，返回 null', () => {
    expect(pickGreetingName('1535759562@qq.com')).toBeNull()
    expect(pickGreetingName('  amy@example.com ')).toBeNull()
  })
})

describe('countOwingCustomers（KPI 角标「N 户欠款」= 欠你钱的客户数）', () => {
  it('只数 clientOwes > 0 的客户（仅欠主代理不算）', () => {
    expect(
      countOwingCustomers([
        { clientOwes: 190000.09 },
        { clientOwes: 6600 },
        { clientOwes: 1 },
        { clientOwes: 0 }, // 仅欠主代理的行
      ]),
    ).toBe(3)
  })
  it('空列表 → 0', () => {
    expect(countOwingCustomers([])).toBe(0)
  })
})

describe('displayCustomerName（无名兜底）', () => {
  it('有名字 → 原样（trim）', () => {
    expect(displayCustomerName('王五')).toBe('王五')
    expect(displayCustomerName('  赵六 ')).toBe('赵六')
  })
  it('空白名 → 未命名', () => {
    expect(displayCustomerName(null)).toBe('未命名')
    expect(displayCustomerName(undefined)).toBe('未命名')
    expect(displayCustomerName('')).toBe('未命名')
    expect(displayCustomerName('   ')).toBe('未命名')
  })
  it('空名可传更有意义的兜底（签证 / 案件号）', () => {
    expect(displayCustomerName('', '482 · 案件')).toBe('482 · 案件')
    expect(displayCustomerName(null, 'C0001')).toBe('C0001')
    expect(displayCustomerName('王五', 'C0001')).toBe('王五')
  })
})
