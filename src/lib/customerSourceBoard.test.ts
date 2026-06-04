import { describe, expect, it } from 'vitest'
import { selectSourceBoardColumns } from './customerSourceBoard'
import type { Customer } from '../types/models'

const mk = (o: Partial<Customer>): Customer =>
  ({ id: 'c1', full_name: '甲', client_source: null, is_starred: false, is_archived: false, ...o }) as Customer

describe('selectSourceBoardColumns（客户来源看板：黑/绿/黄 三列）', () => {
  it('固定三列顺序：黑(公司派 red) → 绿(自己) → 黄(擦屁股)；客户落对应列', () => {
    const cols = selectSourceBoardColumns([
      mk({ id: 'a', client_source: 'green' }),
      mk({ id: 'b', client_source: 'red' }),
      mk({ id: 'c', client_source: 'yellow' }),
      mk({ id: 'd', client_source: 'red' }),
    ])
    expect(cols.map((c) => c.source)).toEqual(['red', 'green', 'yellow'])
    expect(cols[0].customers.map((c) => c.id)).toEqual(['b', 'd'])
    expect(cols[1].customers.map((c) => c.id)).toEqual(['a'])
    expect(cols[2].customers.map((c) => c.id)).toEqual(['c'])
  })

  it('未分类（null/未知历史值）→ 追加灰色「未分类」列；没有未分类客户则不出现', () => {
    const withNone = selectSourceBoardColumns([
      mk({ id: 'a', client_source: 'green' }),
      mk({ id: 'b', client_source: null }),
      mk({ id: 'c', client_source: 'legacy-vip' }),
    ])
    expect(withNone.map((c) => c.source)).toEqual(['red', 'green', 'yellow', null])
    expect(withNone[3].customers.map((c) => c.id)).toEqual(['b', 'c'])

    const noNone = selectSourceBoardColumns([mk({ id: 'a', client_source: 'red' })])
    expect(noNone.map((c) => c.source)).toEqual(['red', 'green', 'yellow'])
  })

  it('列内星标客户排前（其余保持原序）', () => {
    const cols = selectSourceBoardColumns([
      mk({ id: 'a', client_source: 'green' }),
      mk({ id: 'b', client_source: 'green', is_starred: true }),
      mk({ id: 'c', client_source: 'green' }),
    ])
    expect(cols[1].customers.map((c) => c.id)).toEqual(['b', 'a', 'c'])
  })

  it('空列保留（列出空态，三列结构稳定）', () => {
    const cols = selectSourceBoardColumns([])
    expect(cols.map((c) => c.source)).toEqual(['red', 'green', 'yellow'])
    expect(cols.every((c) => c.customers.length === 0)).toBe(true)
  })
})
