/**
 * 只读统计：cases 表里 parent_sync_progress=true 的遗留行数（0029 迁移前的核查）。
 * 不写不删任何数据。用法：node scripts/count-parent-sync.mjs <email> <password>
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

const { count, error } = await supabase
  .from('cases')
  .select('*', { count: 'exact', head: true })
  .eq('parent_sync_progress', true)
if (error) {
  console.log(`查询失败：${error.message}`)
  process.exit(1)
}
console.log(`parent_sync_progress=true 的案件行数：${count}`)

// 顺带列出这些行（若有），便于判断影响面
if (count && count > 0) {
  const { data } = await supabase
    .from('cases')
    .select('id, case_number, visa_subclass, current_stage, parent_case_id, is_archived')
    .eq('parent_sync_progress', true)
  for (const c of data ?? []) {
    console.log(`  - #${c.case_number} ${c.visa_subclass} stage=${c.current_stage} parent=${c.parent_case_id} archived=${c.is_archived}`)
  }
}
