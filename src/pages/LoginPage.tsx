import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { TextField } from '../components/ui/TextField'
import { ShieldIcon } from '../components/ui/icons'

interface LocationState {
  from?: { pathname: string }
}

export function LoginPage() {
  const { session, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as LocationState | null)?.from?.pathname ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // 已登录则直接进入应用（避免重复登录）
  if (!loading && session) return <Navigate to={from} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn({ email: email.trim(), password, remember })
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? mapAuthError(err.message) : '登录失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-card bg-white p-6 shadow-soft sm:p-8">
      <div className="mb-5 flex items-center gap-3">
        {/* 与侧栏品牌区同款薄荷绿渐变（2026-06 全站换肤后登录页一并对齐，别回退旧亮蓝） */}
        <span className="grid size-11 place-items-center rounded-[14px] bg-[linear-gradient(135deg,#4e9a6b,#2e6a48)] text-white shadow-brand">
          <ShieldIcon className="size-6" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-[-0.01em] text-ink">签证 CRM</h1>
          <p className="text-[13px] text-faint">移民事务工作台</p>
        </div>
      </div>
      <p className="text-sm text-muted">请使用管理员分配的账号登录</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <TextField
          label="邮箱"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <TextField
          label="密码"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />

        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="size-4 rounded border-line-2 accent-brand focus:ring-brand"
          />
          记住我（保持登录约 30 天）
        </label>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}

        <Button type="submit" block disabled={submitting}>
          {submitting ? '登录中…' : '登录'}
        </Button>
      </form>
    </div>
  )
}

/** 把 Supabase 的英文错误转成中文提示 */
function mapAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return '邮箱或密码不正确'
  if (/email not confirmed/i.test(message)) return '邮箱尚未确认，请联系管理员'
  return message
}
