import { vi } from 'vitest'

export interface SbResult {
  data: unknown
  error: { message: string } | null
}

export type SbBuilder = Record<string, ReturnType<typeof vi.fn>> & {
  then: (resolve: (r: SbResult) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>
}

/** 构造一个可链式调用、await 时解析为 result 的 supabase query builder mock。 */
export function makeBuilder(result: SbResult): SbBuilder {
  const builder = {} as SbBuilder
  const chain = ['select', 'insert', 'update', 'delete', 'eq', 'is', 'not', 'or', 'ilike', 'order', 'limit', 'lt', 'gte', 'lte']
  for (const m of chain) builder[m] = vi.fn(() => builder)
  builder.single = vi.fn(() => builder)
  builder.maybeSingle = vi.fn(() => builder)
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  return builder
}

/**
 * 为多张表分别准备 builder，并让 from(table) 分发到对应 builder。
 * 用法：const b = wireFrom(fromMock, { cases: { data: row }, case_stage_history: {} })
 *       然后断言 b.cases.update(...)、b.case_stage_history.insert(...)
 */
export function wireFrom(
  fromMock: ReturnType<typeof vi.fn>,
  tables: Record<string, { data?: unknown; error?: { message: string } | null }>,
): Record<string, SbBuilder> {
  const builders: Record<string, SbBuilder> = {}
  for (const [t, r] of Object.entries(tables)) {
    builders[t] = makeBuilder({ data: r.data ?? null, error: r.error ?? null })
  }
  fromMock.mockImplementation((t: string) => builders[t] ?? makeBuilder({ data: null, error: null }))
  return builders
}
