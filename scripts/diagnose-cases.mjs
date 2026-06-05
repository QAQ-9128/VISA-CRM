/**
 * 只读诊断：复刻「递交进度」页的取数管道，逐层打印行数与被排除原因。
 * 不写不删任何数据。用法：node scripts/diagnose-cases.mjs <email> <password>
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
if (loginErr) {
  console.log(`登录失败：${loginErr.message}`)
  process.exit(2)
}
console.log(`（已登录 ${email}，只读诊断开始）\n`)

async function fetchAll(name, builder) {
  const { data, error } = await builder
  if (error) {
    console.log(`❌ ${name} 查询失败：${error.message} [${error.code ?? ''}]  ← 页面会因此整页报错/空白`)
    return null
  }
  console.log(`✅ ${name}：${data?.length ?? 0} 行`)
  return data ?? []
}

// 页面用到的 8 个查询，逐个测
const cases = await fetchAll('cases（未归档案件）', supabase.from('cases').select('*').eq('is_archived', false))
const customers = await fetchAll('customers（未归档客户）', supabase.from('customers').select('*').eq('is_archived', false))
const applicants = await fetchAll('case_applicants（参与人）', supabase.from('case_applicants').select('*'))
const history = await fetchAll('case_stage_history（阶段历史）', supabase.from('case_stage_history').select('*'))
const lodgements = await fetchAll('lodgements（递交记录）', supabase.from('lodgements').select('*'))
await fetchAll('records（待办/跟进，open）', supabase.from('records').select('*').eq('is_done', false))
await fetchAll('employers（雇主）', supabase.from('employers').select('*').eq('is_archived', false))
await fetchAll('referrers（介绍人）', supabase.from('referrers').select('*').eq('is_archived', false))

if (!cases || !customers) process.exit(1)

// 复刻 visibleCaseIds（2026-06-05 新口径）：任一参与人（案件客户或 case_applicants 成员）在册即可见
const customerIds = new Set(customers.map((c) => c.id))
const activeParticipantCases = new Set(
  (applicants ?? []).filter((a) => customerIds.has(a.customer_id)).map((a) => a.case_id),
)
const isVisible = (c) => customerIds.has(c.customer_id) || activeParticipantCases.has(c.id)
const visible = cases.filter(isVisible)
const hidden = cases.filter((c) => !isVisible(c))

console.log(`\n── 页面可见性推演 ──`)
console.log(`未归档案件 ${cases.length} 件，其中页面会显示 ${visible.length} 件`)
if (hidden.length > 0) {
  console.log(`⚠️ 有 ${hidden.length} 件案件被隐藏（全部参与人都已归档/不存在）：`)
  for (const c of hidden) {
    const { data: owner } = await supabase.from('customers').select('id,full_name,is_archived').eq('id', c.customer_id).maybeSingle()
    const why = !owner ? '客户行不存在（被删）' : owner.is_archived ? `客户「${owner.full_name}」已归档` : '未知'
    console.log(`   - 案件 ${c.case_number}（${c.visa_subclass}）→ ${why}，且无其他在册参与人`)
  }
  console.log(`   ↑ 去 档案库→回收站 恢复任一参与客户即可重新显示`)
}
for (const c of visible) {
  const hasHist = (history ?? []).some((h) => h.case_id === c.id)
  const lodged = (history ?? []).some(
    (h) => h.case_id === c.id && (h.to_stage === 'nomination_lodged' || h.to_stage === 'visa_lodged'),
  )
  console.log(
    `   · ${c.case_number}（${c.visa_subclass}）阶段=${c.current_stage} 历史=${hasHist ? '有' : '无'} ${
      lodged ? '已递交（显示日期+距今）' : '未递交（整行浅黄 + 待递交标签）'
    }`,
  )
}
console.log(`\n（lodgements 行数 ${lodgements?.length ?? 0}，applicants 行数 ${applicants?.length ?? 0}——仅供参考，不影响行是否显示）`)
console.log('诊断结束：未写入/修改任何数据')
