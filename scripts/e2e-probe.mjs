/**
 * 端到端探针：直连 Supabase 把核心业务流真实跑一遍（建客户→建案件→加入案件→记账→传文件→档案库查询），
 * 输出每步成败与真实报错。测试数据全部带【测试】前缀，跑完自动清理。
 * 用法：node scripts/e2e-probe.mjs <email> <password>
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
const created = { customers: [], cases: [], documents: [], payments: [], plans: [], planItems: [], storagePaths: [] }
let pass = 0, fail = 0

async function step(name, fn) {
  try {
    const out = await fn()
    pass++
    console.log(`✅ ${name}${out ? ` — ${out}` : ''}`)
    return true
  } catch (e) {
    fail++
    console.log(`❌ ${name}\n   → ${e?.message ?? e}${e?.details ? ` · ${e.details}` : ''}${e?.hint ? ` · ${e.hint}` : ''}${e?.code ? ` [${e.code}]` : ''}`)
    return false
  }
}
const ins = async (table, row) => {
  const { data, error } = await supabase.from(table).insert(row).select().single()
  if (error) throw error
  return data
}

// ── 登录 ─────────────────────────────────────────────
if (!email) {
  // 无凭据：先试匿名注册探测（多数项目开了邮箱确认会拿不到 session）
  const probeEmail = `claude.probe.${Date.now()}@example.com`
  const { data, error } = await supabase.auth.signUp({ email: probeEmail, password: 'Probe123!Probe' })
  if (error) {
    console.log(`登录不可用：signUp 被拒 → ${error.message}`)
    process.exit(2)
  }
  if (!data.session) {
    console.log('登录不可用：注册成功但需邮箱确认（无 session）。请用 node scripts/e2e-probe.mjs <邮箱> <密码> 提供测试账号。')
    process.exit(2)
  }
  console.log(`（使用临时注册账号 ${probeEmail}）`)
} else {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    console.log(`登录失败：${error.message}`)
    process.exit(2)
  }
  console.log(`（已登录 ${email}）`)
}

// ── 业务流 ───────────────────────────────────────────
let cuA, cuB, kase
await step('① 新建客户 A（主申）', async () => {
  cuA = await ins('customers', { full_name: '【测试】探针客户A' })
  created.customers.push(cuA.id)
  return cuA.id.slice(0, 8)
})
await step('② 给 A 新建案件（482）', async () => {
  kase = await ins('cases', { customer_id: cuA.id, visa_subclass: '482', currency: 'AUD', destination_country: 'Australia' })
  created.cases.push(kase.id)
  return `案件号 ${kase.case_number}`
})
await step('③ 新建客户 B（独立）', async () => {
  cuB = await ins('customers', { full_name: '【测试】探针客户B' })
  created.customers.push(cuB.id)
})
await step('④ B 加入已有案件（case_applicants）——用户报的 bug 点', async () => {
  const { error } = await supabase.from('case_applicants').insert({ case_id: kase.id, customer_id: cuB.id })
  if (error) throw error
})
await step('⑤ 读回参与人（应含 B）', async () => {
  const { data, error } = await supabase.from('case_applicants').select('*').eq('case_id', kase.id)
  if (error) throw error
  if (!data.some((a) => a.customer_id === cuB.id)) throw new Error('插入成功但读不到 B')
  return `${data.length} 位副参与人`
})

let plan, item
await step('⑥ 付款计划 + 款项 + 收款（记账链）', async () => {
  plan = await ins('payment_plans', { case_id: kase.id, client_total: 0, company_total: 0 })
  created.plans.push(plan.id)
  item = await ins('payment_plan_items', { plan_id: plan.id, fee_category: '【测试】律师费', amount_due: 100 })
  created.planItems.push(item.id)
  const pay = await ins('payments', { case_id: kase.id, direction: 'from_client', amount: 50, plan_item_id: item.id, paid_at: '2026-06-05' })
  created.payments.push(pay.id)
})

await step('⑦ 阶段流转写历史（todo→nomination_lodged）', async () => {
  const { error: e1 } = await supabase.from('cases').update({ current_stage: 'nomination_lodged' }).eq('id', kase.id)
  if (e1) throw e1
  const { error: e2 } = await supabase.from('case_stage_history').insert({ case_id: kase.id, from_stage: 'todo', to_stage: 'nomination_lodged' })
  if (e2) throw e2
})

let docRow
const storagePath = `${''}`
await step('⑧ 上传文件到 case-files + 写 documents 行——用户报的档案库 bug 点', async () => {
  const path = `${cuA.id}/general/probe-${Date.now()}-test.txt`
  const { error: upErr } = await supabase.storage.from('case-files').upload(path, new Blob(['probe']), { contentType: 'text/plain' })
  if (upErr) throw upErr
  created.storagePaths.push(path)
  docRow = await ins('documents', { customer_id: cuA.id, doc_type: 'other', title: '【测试】探针文件', storage_path: path, file_name: 'test.txt' })
  created.documents.push(docRow.id)
})
await step('⑨ 档案库查询（listAllDocuments 同款）应包含刚传的文件', async () => {
  const { data, error } = await supabase
    .from('documents').select('*').eq('is_archived', false).not('storage_path', 'is', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  if (!data.some((d) => d.id === docRow.id)) throw new Error(`查询返回 ${data.length} 行但不含刚上传的文件！`)
  return `共 ${data.length} 个文件，包含探针文件 ✓`
})
await step('⑩ 发票路径写入 payments（档案库发票来源）', async () => {
  const { error } = await supabase.from('payments').update({ invoice_path: created.storagePaths[0], invoice_name: 'test.txt' }).eq('id', created.payments[0])
  if (error) throw error
})

// ── 清理 ─────────────────────────────────────────────
console.log('\n── 清理测试数据 ──')
await step('清理：payments/items/plan/历史/参与人/案件/客户/文件', async () => {
  for (const id of created.payments) await supabase.from('payments').delete().eq('id', id)
  for (const id of created.planItems) await supabase.from('payment_plan_items').delete().eq('id', id)
  for (const id of created.plans) await supabase.from('payment_plans').delete().eq('id', id)
  for (const id of created.cases) {
    await supabase.from('case_stage_history').delete().eq('case_id', id)
    await supabase.from('case_applicants').delete().eq('case_id', id)
    await supabase.from('cases').delete().eq('id', id)
  }
  for (const id of created.documents) await supabase.from('documents').delete().eq('id', id)
  for (const id of created.customers) await supabase.from('customers').delete().eq('id', id)
  if (created.storagePaths.length) await supabase.storage.from('case-files').remove(created.storagePaths)
})

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail > 0 ? 1 : 0)
