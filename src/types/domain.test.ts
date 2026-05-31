import { describe, expect, it } from 'vitest'
import { CLIENT_SOURCE_DOT } from './domain'

describe('客户来源颜色映射', () => {
  it('「公司派的」改为黑/深色（slate-900），不再用红色', () => {
    expect(CLIENT_SOURCE_DOT.red).toBe('bg-slate-900')
  })
  it('绿色 / 黄色 不变', () => {
    expect(CLIENT_SOURCE_DOT.green).toBe('bg-green-600')
    expect(CLIENT_SOURCE_DOT.yellow).toBe('bg-yellow-500')
  })
})
