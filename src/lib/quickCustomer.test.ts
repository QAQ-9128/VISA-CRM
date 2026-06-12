import { describe, expect, it } from 'vitest'
import { initialQuickState, toQuickPayload } from './quickCustomer'

describe('quickCustomer（快速建档：中文名/英文名 + 四字段，无任何案件/家庭组键）', () => {
  it('initialQuickState：全空', () => {
    expect(initialQuickState()).toEqual({
      chinese_name: '',
      english_name: '',
      gender: '',
      birth_date: '',
      owner_referrer_id: '',
      referrer_id: '',
    })
  })

  it('toQuickPayload：产出七键（含派生 full_name=显示名），空串→null，名字 trim', () => {
    const p = toQuickPayload({
      chinese_name: '  张三 ',
      english_name: '',
      gender: '',
      birth_date: '',
      owner_referrer_id: '',
      referrer_id: '',
    })
    expect(p).toEqual({
      full_name: '张三', // 中文优先派生（老消费方/排序/搜索兼容）
      chinese_name: '张三',
      english_name: null,
      gender: null,
      birth_date: null,
      owner_referrer_id: null,
      referrer_id: null,
    })
    // 绝不夹带案件/家庭组字段（快速建档不含任何 case 逻辑）
    expect(Object.keys(p).sort()).toEqual(
      ['birth_date', 'chinese_name', 'english_name', 'full_name', 'gender', 'owner_referrer_id', 'referrer_id'].sort(),
    )
  })

  it('只填英文名 → full_name=英文（按录入原样，不改大小写）', () => {
    const p = toQuickPayload({
      chinese_name: '',
      english_name: 'DENG Tao',
      gender: '',
      birth_date: '',
      owner_referrer_id: '',
      referrer_id: '',
    })
    expect(p.full_name).toBe('DENG Tao')
    expect(p.chinese_name).toBeNull()
    expect(p.english_name).toBe('DENG Tao')
  })

  it('中英都填 → full_name=中文优先；其余字段原样透传', () => {
    expect(
      toQuickPayload({
        chinese_name: '李旻书',
        english_name: 'LI Minshu',
        gender: 'female',
        birth_date: '1990-01-02',
        owner_referrer_id: 'o1',
        referrer_id: 'r1',
      }),
    ).toEqual({
      full_name: '李旻书',
      chinese_name: '李旻书',
      english_name: 'LI Minshu',
      gender: 'female',
      birth_date: '1990-01-02',
      owner_referrer_id: 'o1',
      referrer_id: 'r1',
    })
  })
})
