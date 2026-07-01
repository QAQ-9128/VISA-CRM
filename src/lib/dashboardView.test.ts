import { describe, expect, it } from 'vitest'
import { countOwingCustomers, displayCustomerName, pickGreetingName, dueUrgency, buildDueSoonList } from './dashboardView'
import type { ExpiringDocItem } from './dashboard'
import type { TrtReminderItem } from './trt'
import type { CohabReminderItem } from './cohab'

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

describe('dueUrgency（临近到期分色单一来源：≤7 红 / 8–14 黄 / 15–30 绿，逾期归红）', () => {
  it('边界 7：≤7 天 → red（含 7、0、逾期负数）', () => {
    expect(dueUrgency(-3)).toBe('red')
    expect(dueUrgency(0)).toBe('red')
    expect(dueUrgency(7)).toBe('red')
  })
  it('边界 8/14：8–14 天 → amber', () => {
    expect(dueUrgency(8)).toBe('amber')
    expect(dueUrgency(14)).toBe('amber')
  })
  it('边界 15/30：15–30 天 → green', () => {
    expect(dueUrgency(15)).toBe('green')
    expect(dueUrgency(30)).toBe('green')
  })
})

describe('buildDueSoonList（合并文档/TRT/同居 → 统一行项，按剩余天数升序）', () => {
  const doc = (o: Partial<ExpiringDocItem>): ExpiringDocItem => ({
    id: 'd1', customerId: 'cu1', customerName: '王璞', label: '护照', daysRemaining: 10, status: 'soon', tone: 'amber', ic: 'passport', ...o,
  })
  const trt = (o: Partial<TrtReminderItem>): TrtReminderItem => ({
    customerId: 'cu2', customerName: '孙佳琪', caseId: 'k1', caseNumber: 'C1', monthsSinceGrant: 25, ...o,
  })
  const cohab = (o: Partial<CohabReminderItem>): CohabReminderItem => ({
    customerId: 'cu3', customerName: '张献元', caseId: 'k2', caseNumber: 'C2', monthsSince: 4, ...o,
  })

  it('空入参 → 空列表（空状态）', () => {
    expect(buildDueSoonList([], [], [])).toEqual([])
  })

  it('文档：逾期与临近文案 + 紧急度分色', () => {
    const r = buildDueSoonList(
      [doc({ id: 'a', daysRemaining: -5, status: 'overdue' }), doc({ id: 'b', daysRemaining: 20, status: 'soon' })],
      [], [],
    )
    const a = r.find((x) => x.key === 'doc-a')!
    expect(a.detail).toBe('已逾期 5 天')
    expect(a.urgency).toBe('red')
    const b = r.find((x) => x.key === 'doc-b')!
    expect(b.detail).toBe('20 天后到期')
    expect(b.urgency).toBe('green')
  })

  it('TRT / 同居：循环提醒视为已到点（0 天·红），同居链到该客户并选中该案', () => {
    const r = buildDueSoonList([], [trt({})], [cohab({})])
    const t = r.find((x) => x.key === 'trt-k1')!
    expect(t.matter).toContain('186 TRT 可办')
    expect(t.urgency).toBe('red')
    const c = r.find((x) => x.key === 'cohab-k2')!
    expect(c.matter).toBe('更新同居材料')
    expect(c.detail).toBe('距上次 4 个月')
    expect(c.to).toBe('/customers/cu3?case=k2')
  })

  it('合并三源并按剩余天数升序（逾期/已到点最前）', () => {
    const r = buildDueSoonList(
      [doc({ id: 'far', daysRemaining: 25, status: 'soon' }), doc({ id: 'over', daysRemaining: -2, status: 'overdue' })],
      [trt({})], [cohab({})],
    )
    expect(r).toHaveLength(4)
    expect(r[0].key).toBe('doc-over') // -2 最前
    expect(r[r.length - 1].key).toBe('doc-far') // 25 最后
  })
})
