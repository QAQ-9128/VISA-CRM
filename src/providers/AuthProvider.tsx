import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import * as authApi from '../api/auth'
import type { SignInInput } from '../api/auth'
import type { Profile } from '../types/models'
import { AuthContext } from './auth-context'
import type { AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  // 会话是否已解析（首次 getSession / 首个 auth 事件之后为 true）
  const [authReady, setAuthReady] = useState(false)
  // 是否正在拉取 profile
  const [profileLoading, setProfileLoading] = useState(false)

  // 1) 会话订阅。
  //    ⚠️ onAuthStateChange 回调内绝不能 await supabase 调用，否则会与 auth 客户端内部锁
  //    死锁、回调永不返回（supabase-js 已知坑）。这里回调只做同步的 setState；
  //    拉 profile 交给下面监听 user 变化的独立 effect。
  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setAuthReady(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // 仅同步操作，不要在此 await supabase
      setSession(nextSession)
      setAuthReady(true)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // 2) user 变化时拉取 profile（独立 effect，脱离 auth 回调的锁，await 安全）。
  //    成功 / 出错 / 无 user 三条路径都收敛 profileLoading，避免无限转圈。
  useEffect(() => {
    const userId = session?.user?.id
    let active = true

    const load = async () => {
      setProfileLoading(true)
      try {
        const next = userId ? await authApi.getProfile(userId) : null
        if (active) setProfile(next)
      } catch (err) {
        // 兜底：profile 拉取失败也结束 loading，让用户能进登录页 / 应用，而不是卡死
        console.warn('[auth] 拉取 profile 失败，按无 profile 处理：', err)
        if (active) setProfile(null)
      } finally {
        if (active) setProfileLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [session?.user?.id])

  const signIn = useCallback(async (input: SignInInput) => {
    await authApi.signIn(input)
    // session 通过 onAuthStateChange 自动回流
  }, [])

  const signOut = useCallback(async () => {
    await authApi.signOut()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      // 会话未解析、或正在拉 profile，都算加载中
      loading: !authReady || profileLoading,
      session,
      user: session?.user ?? null,
      profile,
      isAdmin: profile?.role === 'admin',
      signIn,
      signOut,
    }),
    [authReady, profileLoading, session, profile, signIn, signOut],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
