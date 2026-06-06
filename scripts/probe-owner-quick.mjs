/**
 * 0030 迁移后端到端探针：归属人（referrers.kind）+ 客户 owner_referrer_id 全链路。
 * 测试数据全部带【测试】前缀，跑完自动清理。用法：node scripts/probe-owner-quick.mjs <email> <password>
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

const [email, password] = process.argv.slice(2)
const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password })
if (loginErr) { console.log(`登录失败：${loginErr.message}`); process.exit(2) }

let pass = 0, fail = 0
const created = { customers: [], referrers: [] }
async function step(name, fn) {
  try { const out = await fn(); pass++; console.log(`✅ ${name}${out ? ` — ${out}` : ''}`) }
  catch (e) { fail++; console.log(`❌ ${name}\n   → ${e?.message ?? e}${e?.code ? ` [${e.code}]` : ''}`) }
}
const one = async (q) => { const { data, error } = await q; if (error) throw error; return data }

let owner, plainRef, cust1, cust2

await step('① 创建归属人（kind=owner）', async () => {
  owner = await one(supabase.from('referrers').insert({ name: '【测试】归属人A', kind: 'owner' }).select().single())
  created.referrers.push(owner.id)
  if (owner.kind !== 'owner') throw new Error(`kind 回读=${owner.kind}`)
  return owner.id.slice(0, 8)
})

await step('② 不传 kind 创建 → 默认 referrer（存量介绍人兼容）', async () => {
  plainRef = await one(supabase.from('referrers').insert({ name: '【测试】介绍人B' }).select().single())
  created.referrers.push(plainRef.id)
  if (plainRef.kind !== 'referrer') throw new Error(`kind 默认=${plainRef.kind}`)
})

await step('③ kind 过滤查询：owner 列表只含归属人', async () => {
  const rows = await one(supabase.from('referrers').select('id,kind').eq('kind', 'owner').eq('is_archived', false))
  if (!rows.some((r) => r.id === owner.id)) throw new Error('归属人A 不在 owner 列表')
  if (rows.some((r) => r.id === plainRef.id)) throw new Error('介绍人B 混进了 owner 列表')
  return `owner 共 ${rows.length} 人`
})

await step('④ 非法 kind 被 CHECK 约束拒绝', async () => {
  const { error } = await supabase.from('referrers').insert({ name: '【测试】坏kind', kind: 'boss' }).select().single()
  if (!error) throw new Error('竟然插入成功了——CHECK 约束没生效')
  return `已拒绝（${error.code}）`
})

await step('⑤ 快速建档五键 payload：建客户带归属人', async () => {
  cust1 = await one(supabase.from('customers').insert({
    full_name: '【测试】快速建档客户', gender: 'male', birth_date: '1990-01-02',
    owner_referrer_id: owner.id, referrer_id: plainRef.id,
  }).select().single())
  created.customers.push(cust1.id)
  if (cust1.owner_referrer_id !== owner.id) throw new Error('owner_referrer_id 没存上')
})

await step('⑥ 回读 + 名字解析（概要带口径）', async () => {
  const c = await one(supabase.from('customers').select('*').eq('id', cust1.id).single())
  const o = await one(supabase.from('referrers').select('name').eq('id', c.owner_referrer_id).maybeSingle())
  if (o?.name !== '【测试】归属人A') throw new Error(`解析到 ${o?.name}`)
})

await step('⑦ 清空归属人（update null）', async () => {
  const c = await one(supabase.from('customers').update({ owner_referrer_id: null }).eq('id', cust1.id).select().single())
  if (c.owner_referrer_id !== null) throw new Error('没清掉')
})

await step('⑧ 删除归属人实体 → 挂靠客户自动置空（on delete set null）', async () => {
  cust2 = await one(supabase.from('customers').insert({ full_name: '【测试】挂靠客户', owner_referrer_id: owner.id }).select().single())
  created.customers.push(cust2.id)
  await one(supabase.from('referrers').delete().eq('id', owner.id).select())
  created.referrers = created.referrers.filter((id) => id !== owner.id)
  const c = await one(supabase.from('customers').select('owner_referrer_id').eq('id', cust2.id).single())
  if (c.owner_referrer_id !== null) throw new Error(`仍指向 ${c.owner_referrer_id}`)
})

// ── 清理 ─────────────────────────────────────────────
for (const id of created.customers) {
  await step(`清理客户 ${id.slice(0, 8)}`, async () => {
    const rows = await one(supabase.from('customers').delete().eq('id', id).select('id'))
    if (!rows?.length) throw new Error('删除命中 0 行（需要 admin）')
  })
}
for (const id of created.referrers) {
  await step(`清理介绍人 ${id.slice(0, 8)}`, async () => {
    const rows = await one(supabase.from('referrers').delete().eq('id', id).select('id'))
    if (!rows?.length) throw new Error('删除命中 0 行（需要 admin）')
  })
}

console.log(`\n通过 ${pass} / 失败 ${fail}`)
process.exit(fail ? 1 : 0)
