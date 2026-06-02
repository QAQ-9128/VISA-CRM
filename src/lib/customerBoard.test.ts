import { describe, expect, it } from 'vitest'
import { selectBoardCards, selectNoCaseCards, noCasePeopleCount } from './customerBoard'
import type { Case, CaseApplicant, Customer } from '../types/models'
import type { CaseStage } from '../types/domain'

const cust = (id: string, over: Partial<Customer> = {}): Customer =>
  ({ id, full_name: id, primary_applicant_id: null, ...over }) as Customer
const kase = (id: string, customer_id: string, stage: CaseStage, sub = '482'): Case =>
  ({ id, customer_id, current_stage: stage, visa_subclass: sub, visa_stream: null, is_archived: false }) as Case
const ca = (case_id: string, customer_id: string): CaseApplicant =>
  ({ id: `${case_id}-${customer_id}`, case_id, customer_id, created_at: '' }) as CaseApplicant

describe('selectBoardCards（按案件所有者聚合，主/副申各自独立成卡）', () => {
  it('同一客户多案、同阶段 → 一张卡、名字一次、列多签证', () => {
    const customerById = { z: cust('z', { full_name: '张伟' }) }
    const cards = selectBoardCards(
      [kase('a', 'z', 'visa_lodged', '482'), kase('b', 'z', 'visa_lodged', '186')],
      customerById,
    )
    const col = cards.get('visa_lodged')!
    expect(col).toHaveLength(1)
    expect(col[0].customerId).toBe('z')
    expect(col[0].headName).toBe('张伟')
    expect(col[0].cases.map((c) => c.visaLabel)).toEqual(['482', '186'])
    expect(col[0].role).toBe('solo')
    expect(col[0].primaryName).toBeNull()
  })

  it('副申案件的卡 → 以副申为主，标注正确主申，落在副申案件的阶段列', () => {
    const customerById = {
      z: cust('z', { full_name: '李旻书' }),
      w: cust('w', { full_name: '邓韬', primary_applicant_id: 'z' }),
    }
    // 主申 z 的案件在 visa_lodged；副申 w 的案件在 todo
    const cards = selectBoardCards(
      [kase('a', 'z', 'visa_lodged'), kase('b', 'w', 'todo')],
      customerById,
    )
    // 待办列：副申卡（以邓韬为主）
    const todo = cards.get('todo')!
    expect(todo).toHaveLength(1)
    expect(todo[0].customerId).toBe('w')
    expect(todo[0].headName).toBe('邓韬')
    expect(todo[0].role).toBe('sub')
    expect(todo[0].primaryId).toBe('z')
    expect(todo[0].primaryName).toBe('李旻书')
    expect(todo[0].cases.map((c) => c.caseId)).toEqual(['b'])
    // 签证递交列：主申卡（以李旻书为主，无主申标注）
    const vl = cards.get('visa_lodged')!
    expect(vl).toHaveLength(1)
    expect(vl[0].customerId).toBe('z')
    expect(vl[0].headName).toBe('李旻书')
    expect(vl[0].role).toBe('primary')
    expect(vl[0].primaryName).toBeNull()
  })

  it('主申 + 副申同阶段 → 不合并，仍是两张独立卡（各自为主）', () => {
    const customerById = {
      z: cust('z', { full_name: '张伟' }),
      w: cust('w', { full_name: '王芳', primary_applicant_id: 'z' }),
    }
    const cards = selectBoardCards(
      [kase('a', 'z', 'visa_lodged'), kase('b', 'w', 'visa_lodged')],
      customerById,
    )
    const col = cards.get('visa_lodged')!
    expect(col).toHaveLength(2)
    const byId = Object.fromEntries(col.map((c) => [c.customerId, c]))
    expect(byId.z.role).toBe('primary')
    expect(byId.z.primaryName).toBeNull()
    expect(byId.w.role).toBe('sub')
    expect(byId.w.primaryName).toBe('张伟')
  })

  it('一个主申多个副申 → 各自独立成卡（各带主申标注）', () => {
    const customerById = {
      z: cust('z', { full_name: '张伟' }),
      w: cust('w', { full_name: '王芳', primary_applicant_id: 'z' }),
      x: cust('x', { full_name: '小明', primary_applicant_id: 'z' }),
    }
    const cards = selectBoardCards(
      [kase('a', 'w', 'todo'), kase('b', 'x', 'todo')],
      customerById,
    )
    const todo = cards.get('todo')!
    expect(todo).toHaveLength(2)
    expect(todo.every((c) => c.role === 'sub' && c.primaryName === '张伟')).toBe(true)
    expect(todo.map((c) => c.customerId).sort()).toEqual(['w', 'x'])
  })

  it('无副申的普通客户不受影响（solo、无主申标注）；空输入 → 空', () => {
    expect(selectBoardCards([], {}).size).toBe(0)
    const customerById = { z: cust('z'), y: cust('y') }
    const cards = selectBoardCards([kase('a', 'z', 'todo'), kase('b', 'y', 'todo')], customerById)
    const todo = cards.get('todo')!
    expect(todo).toHaveLength(2)
    expect(todo.every((c) => c.role === 'solo' && c.primaryName === null)).toBe(true)
  })

  it('共享案件：参与者(PGone)挂到主申(贾乃亮)同一卡的 participants，不另起卡', () => {
    const customerById = {
      jia: cust('jia', { full_name: '贾乃亮' }),
      pgone: cust('pgone', { full_name: 'PGone' }),
    }
    // 贾乃亮拥有 482(case-j)，PGone 通过 case_applicants 参与同一案件
    const cards = selectBoardCards([kase('case-j', 'jia', 'todo')], customerById, [ca('case-j', 'pgone')])
    const todo = cards.get('todo')!
    expect(todo).toHaveLength(1) // 不为 PGone 另起卡
    expect(todo[0].customerId).toBe('jia') // 主申为头
    expect(todo[0].participants).toEqual([{ customerId: 'pgone', name: 'PGone' }])
  })

  it('participants 排除主体本人、去重；解析不到名字的不显示', () => {
    const customerById = { jia: cust('jia'), p: cust('p', { full_name: 'P' }) }
    const cards = selectBoardCards(
      [kase('cj', 'jia', 'todo')],
      customerById,
      [ca('cj', 'jia'), ca('cj', 'p'), ca('cj', 'p'), ca('cj', 'ghost')], // 本人 jia / 重复 p / 不在册 ghost
    )
    expect(cards.get('todo')![0].participants).toEqual([{ customerId: 'p', name: 'P' }])
  })
})

describe('selectNoCaseCards（按人判断无案件）', () => {
  it('① 主申无案 + 副申无案 → 一张合并卡（主申为头、列出无案副申）', () => {
    const cards = selectNoCaseCards(
      [cust('p', { full_name: '主申P' }), cust('s', { full_name: '副申S', primary_applicant_id: 'p' })],
      [],
    )
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ headId: 'p', headName: '主申P', role: 'primary' })
    expect(cards[0].members).toEqual([{ customerId: 's', name: '副申S' }])
    expect(cards[0].relations).toEqual([])
    expect(noCasePeopleCount(cards)).toBe(2)
  })

  it('② 主申无案 + 副申有案 → 主申单独卡，标注「副申·已有案件」；副申不在此列', () => {
    const cards = selectNoCaseCards(
      [cust('p', { full_name: '主申P' }), cust('s', { full_name: '副申S', primary_applicant_id: 'p' })],
      [kase('k', 's', 'visa_lodged')],
    )
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ headId: 'p', role: 'primary' })
    expect(cards[0].members).toEqual([])
    expect(cards[0].relations).toEqual([{ kind: 'subHasCase', customerId: 's', name: '副申S' }])
    expect(noCasePeopleCount(cards)).toBe(1) // 只有主申无案
  })

  it('③ 主申有案 + 副申无案 → 副申独立卡，标注「是 <主申> 的副申」；主申不在此列', () => {
    const cards = selectNoCaseCards(
      [cust('p', { full_name: '主申P' }), cust('s', { full_name: '副申S', primary_applicant_id: 'p' })],
      [kase('k', 'p', 'visa_lodged')],
    )
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ headId: 's', headName: '副申S', role: 'sub' })
    expect(cards[0].relations).toEqual([{ kind: 'subOf', customerId: 'p', name: '主申P' }])
    expect(noCasePeopleCount(cards)).toBe(1)
  })

  it('④ 无副申单人、无案 → 单卡（solo）', () => {
    const cards = selectNoCaseCards([cust('z', { full_name: '张三' })], [])
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ headId: 'z', role: 'solo', members: [], relations: [] })
  })

  it('有案件的人不在此列；某人建案后从此列移除', () => {
    const customers = [cust('z', { full_name: '张三' }), cust('y', { full_name: '李四' })]
    // 都无案 → 两张卡
    expect(selectNoCaseCards(customers, [])).toHaveLength(2)
    // 李四建了案 → 只剩张三
    const after = selectNoCaseCards(customers, [kase('k', 'y', 'todo')])
    expect(after.map((c) => c.headId)).toEqual(['z'])
  })

  it('共享案件参与者(PGone)不算无案件——从「暂时无案件」消失', () => {
    const customers = [cust('jia', { full_name: '贾乃亮' }), cust('pgone', { full_name: 'PGone' })]
    // PGone 不拥有案件，但参与贾乃亮的 482(case-j)
    const cases = [kase('case-j', 'jia', 'todo')]
    // 不传 caseApplicants（旧逻辑）→ PGone 会被误判无案
    expect(selectNoCaseCards(customers, cases).map((c) => c.headId)).toContain('pgone')
    // 传入 case_applicants → PGone 不再出现（贾乃亮有案不在此列、PGone 参与也不在）
    const fixed = selectNoCaseCards(customers, cases, [ca('case-j', 'pgone')])
    expect(fixed.map((c) => c.headId)).not.toContain('pgone')
    expect(fixed).toHaveLength(0)
  })

  it('只有家庭关系、无任何案件参与的副申 → 仍在「暂时无案件」', () => {
    const customers = [cust('p', { full_name: '主申P' }), cust('s', { full_name: '副申S', primary_applicant_id: 'p' })]
    // 都无案、无参与 → 合并卡（主申为头、列出无案副申 S）
    const cards = selectNoCaseCards(customers, [], [])
    expect(cards).toHaveLength(1)
    expect(cards[0].members).toEqual([{ customerId: 's', name: '副申S' }])
  })

  it('有独立案件的副申(邓韬)不受影响——仍按自己案件出独立卡，不进无案件', () => {
    const customers = [cust('p', { full_name: '主申P' }), cust('deng', { full_name: '邓韬', primary_applicant_id: 'p' })]
    // 邓韬拥有自己的 482
    const cases = [kase('c-deng', 'deng', 'todo')]
    const cards = selectNoCaseCards(customers, cases, [])
    // 主申P 无案 → 一张卡，邓韬有案 → 标注 subHasCase、不并入 members
    expect(cards.map((c) => c.headId)).toEqual(['p'])
    expect(cards[0].members).toEqual([])
    expect(cards[0].relations).toEqual([{ kind: 'subHasCase', customerId: 'deng', name: '邓韬' }])
  })

  it('多副申：无案的并入主申卡（主申无案），有案的标注', () => {
    const cards = selectNoCaseCards(
      [
        cust('p', { full_name: 'P' }),
        cust('s1', { full_name: 'S1', primary_applicant_id: 'p' }),
        cust('s2', { full_name: 'S2', primary_applicant_id: 'p' }),
      ],
      [kase('k', 's2', 'todo')], // s2 有案
    )
    expect(cards).toHaveLength(1)
    expect(cards[0].members).toEqual([{ customerId: 's1', name: 'S1' }]) // s1 无案并入
    expect(cards[0].relations).toEqual([{ kind: 'subHasCase', customerId: 's2', name: 'S2' }])
    expect(noCasePeopleCount(cards)).toBe(2) // P + S1
  })

  it('归档客户 / 归档案件不计；全部有案 → 空列（0）', () => {
    expect(selectNoCaseCards([], [])).toEqual([])
    // 归档案件不算「有案」→ 仍无案
    const archivedCase = { ...kase('k', 'z', 'todo'), is_archived: true } as Case
    expect(selectNoCaseCards([cust('z')], [archivedCase])).toHaveLength(1)
    // 归档客户不出现
    expect(selectNoCaseCards([cust('z', { is_archived: true })], [])).toEqual([])
    // 全部有案 → 0
    expect(noCasePeopleCount(selectNoCaseCards([cust('z')], [kase('k', 'z', 'todo')]))).toBe(0)
  })
})
