import { describe, expect, it } from 'vitest'
import { initialQuickState, toQuickPayload } from './quickCustomer'

describe('quickCustomer（快速建档：五字段，无任何案件/家庭组键）', () => {
  it('initialQuickState：全空', () => {
    expect(initialQuickState()).toEqual({
      full_name: '',
      gender: '',
      birth_date: '',
      owner_referrer_id: '',
      referrer_id: '',
    })
  })

  it('toQuickPayload：只产出五个键，空串→null，姓名 trim', () => {
    const p = toQuickPayload({
      full_name: '  张三 ',
      gender: '',
      birth_date: '',
      owner_referrer_id: '',
      referrer_id: '',
    })
    expect(p).toEqual({
      full_name: '张三',
      gender: null,
      birth_date: null,
      owner_referrer_id: null,
      referrer_id: null,
    })
    // 绝不夹带案件/家庭组字段（快速建档不含任何 case 逻辑）
    expect(Object.keys(p).sort()).toEqual(
      ['birth_date', 'full_name', 'gender', 'owner_referrer_id', 'referrer_id'].sort(),
    )
  })

  it('toQuickPayload：有值原样透传', () => {
    expect(
      toQuickPayload({
        full_name: 'Alice',
        gender: 'female',
        birth_date: '1990-01-02',
        owner_referrer_id: 'o1',
        referrer_id: 'r1',
      }),
    ).toEqual({
      full_name: 'Alice',
      gender: 'female',
      birth_date: '1990-01-02',
      owner_referrer_id: 'o1',
      referrer_id: 'r1',
    })
  })
})
