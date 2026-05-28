import { supabase, setRememberMe } from '../lib/supabase'
import type { Profile } from '../types/models'

export interface SignInInput {
  email: string
  password: string
  /** 记住我：true → 持久化登录（localStorage）；false → 仅当前标签页（sessionStorage） */
  remember: boolean
}

export async function signIn({ email, password, remember }: SignInInput) {
  // 必须在调用 signInWithPassword 之前设置，决定 session 落在 local 还是 session storage
  setRememberMe(remember)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/**
 * 读取当前用户的 profile（含角色）。profiles 表在 Phase 2 的 0001_init.sql 中创建。
 * 表不存在或无记录时返回 null，让上层（守卫/导航）据此降级，而不是崩溃。
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    // 表尚未创建（Phase 1）或网络错误：不阻断登录，仅记录
    console.warn('[auth] 读取 profile 失败（profiles 表可能尚未创建）：', error.message)
    return null
  }
  return data as Profile | null
}
