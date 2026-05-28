import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    '缺少 Supabase 环境变量。请在 .env.local 中配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY（见 .env.example）。',
  )
}

/**
 * “记住我” 实现：
 * - 勾选（默认）→ session 存 localStorage，关闭浏览器后仍保持登录（配合 Supabase 项目里 ≥30 天的 refresh token 有效期）。
 * - 不勾选 → session 存 sessionStorage，仅当前标签页有效，关闭即登出。
 *
 * client 是单例、storage 只能定一次，所以用一个“转发”适配器：每次读写时根据
 * localStorage 里的 remember 标记动态选择落点。登录前用 setRememberMe() 设置标记。
 */
const REMEMBER_KEY = 'crm.remember-me'

export function setRememberMe(remember: boolean): void {
  localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false')
}

function activeStore(): Storage {
  // 默认记住我（true）；只有显式设为 'false' 才用 sessionStorage
  return localStorage.getItem(REMEMBER_KEY) === 'false' ? sessionStorage : localStorage
}

const rememberAwareStorage = {
  getItem: (key: string) => activeStore().getItem(key),
  setItem: (key: string, value: string) => activeStore().setItem(key, value),
  removeItem: (key: string) => activeStore().removeItem(key),
}

export const supabase: SupabaseClient<Database> = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: rememberAwareStorage,
    storageKey: 'crm.auth',
  },
})
