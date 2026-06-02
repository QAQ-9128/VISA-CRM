import { describe, expect, it } from 'vitest'
import { errorMessage } from './errorMessage'

describe('errorMessage', () => {
  it('null / undefined / 空串 → null', () => {
    expect(errorMessage(null)).toBeNull()
    expect(errorMessage(undefined)).toBeNull()
    expect(errorMessage('  ')).toBeNull()
  })
  it('字符串 / Error 实例 → 原文', () => {
    expect(errorMessage('炸了')).toBe('炸了')
    expect(errorMessage(new Error('boom'))).toBe('boom')
  })
  it('Supabase PostgrestError（非 Error 对象）→ message·details·hint [code]，不再被吞', () => {
    const pgErr = {
      message: "Could not find the 'referrer_total' column of 'payment_plans' in the schema cache",
      details: null,
      hint: null,
      code: 'PGRST204',
    }
    expect(errorMessage(pgErr)).toBe(
      "Could not find the 'referrer_total' column of 'payment_plans' in the schema cache [PGRST204]",
    )
  })
  it('RLS 拒绝（含 details/hint）→ 拼接', () => {
    const e = { message: 'new row violates row-level security policy', details: 'for table payment_plans', hint: '', code: '42501' }
    expect(errorMessage(e)).toBe('new row violates row-level security policy · for table payment_plans [42501]')
  })
  it('只有 code → 返回 code', () => {
    expect(errorMessage({ code: '23503' })).toBe('[23503]')
  })
  it('无可读字段 → JSON 兜底', () => {
    expect(errorMessage({ foo: 1 })).toBe('{"foo":1}')
  })
})
