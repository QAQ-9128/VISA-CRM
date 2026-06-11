import { describe, expect, it } from 'vitest'
import { matchRoutes } from 'react-router-dom'
import { appRoutes } from './index'

/**
 * 全站链接通达性：源码里所有 <Link to> / navigate() 的内部目标（动态参数代入样例 id），
 * 每条都必须被路由表承接、且不落到 '*' 兜底 404。新增页面链接时把目标加进这里。
 * （清单由 grep 收集：to=`...` / to="..." / navigate(`...`)，去重后参数化。）
 */
const APP_LINKS = [
  '/', // 概览
  '/login',
  '/customers',
  '/customers/new',
  '/customers/abc', // 客户详情（含 ?case= 选中）
  '/customers/abc/edit',
  '/customers/abc/group', // 案件参与管理
  '/cases',
  '/cases/new', // 含 ?customer= / ?with= / ?prefill=186trt
  '/cases/abc/edit',
  '/employers',
  '/employers/new',
  '/employers/abc/edit',
  '/referrers',
  '/referrers/new', // 含 ?kind=owner
  '/referrers/abc/edit',
  '/finance',
  '/storage', // 档案库（含回收站 tab）
  '/admin/users',
]

/** 命中路由链的最末一段是否 '*'（NotFound 兜底）。 */
function hitsNotFound(pathname: string): boolean {
  const matches = matchRoutes(appRoutes, { pathname })
  if (!matches || matches.length === 0) return true
  return matches[matches.length - 1].route.path === '*'
}

describe('链接通达性（没通的链接 = 红灯）', () => {
  it.each(APP_LINKS)('%s 有路由承接、不落 404', (path) => {
    expect(hitsNotFound(path), `${path} 没有路由承接`).toBe(false)
  })

  it('未知路径确实落 404 兜底（校验方法本身有效）', () => {
    expect(hitsNotFound('/no-such-page')).toBe(true)
    expect(hitsNotFound('/cases/abc')).toBe(true) // 案件详情页已删，裸 /cases/:id 不应有路由
  })
})
