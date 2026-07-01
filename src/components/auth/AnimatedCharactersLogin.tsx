'use client'

import { useState, useEffect, useRef } from 'react'
import type { FormEvent, RefObject } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui/Button'
import { EyeIcon, EyeOffIcon, ShieldIcon } from '../ui/icons'

/*
 * 动画角色登录页。改编自 21st.dev「Animated Characters Login Page」
 * (aghasisahakyan1)。改造点：
 *  - 去 Next/shadcn/lucide 依赖：原生 input/checkbox + 项目 <Button> + 项目内联 SVG 图标
 *    （lucide-react 在 Vite8+React19 下预打包会链到 null 的 React 副本，故弃用）。
 *  - 配色重映射到项目「清新绿」令牌（左面板深绿渐变、右面板白底/绿按钮），
 *    不引入组件自带深色 CSS 变量 → 全站令牌零污染。
 *  - 接真实 Supabase 登录（useAuth().signIn），删掉 demo 假校验/假跳转/Google/注册。
 *  - 文案中文化。动画核心（眼球追踪/眨眼/对视/偷看）原样保留。
 */

// ── 瞳孔：跟随鼠标，或被强制看向某方向 ──────────────────────────────
interface PupilProps {
  size?: number
  maxDistance?: number
  pupilColor?: string
  forceLookX?: number
  forceLookY?: number
}

const Pupil = ({ size = 12, maxDistance = 5, pupilColor = 'black', forceLookX, forceLookY }: PupilProps) => {
  const [mouseX, setMouseX] = useState<number>(0)
  const [mouseY, setMouseY] = useState<number>(0)
  const pupilRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX)
      setMouseY(e.clientY)
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const calculatePupilPosition = () => {
    if (!pupilRef.current) return { x: 0, y: 0 }
    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY }
    }
    const pupil = pupilRef.current.getBoundingClientRect()
    const pupilCenterX = pupil.left + pupil.width / 2
    const pupilCenterY = pupil.top + pupil.height / 2
    const deltaX = mouseX - pupilCenterX
    const deltaY = mouseY - pupilCenterY
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance)
    const angle = Math.atan2(deltaY, deltaX)
    return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance }
  }

  // 动画固有：每次 mousemove 触发重渲染时读取实时 DOM 位置定位瞳孔
  // eslint-disable-next-line react-hooks/refs
  const pupilPosition = calculatePupilPosition()

  return (
    <div
      ref={pupilRef}
      className="rounded-full"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: pupilColor,
        transform: `translate(${pupilPosition.x}px, ${pupilPosition.y}px)`,
        transition: 'transform 0.1s ease-out',
      }}
    />
  )
}

// ── 眼球：白眼底 + 瞳孔，支持眨眼（高度压扁）与强制视线 ────────────────
interface EyeBallProps {
  size?: number
  pupilSize?: number
  maxDistance?: number
  eyeColor?: string
  pupilColor?: string
  isBlinking?: boolean
  forceLookX?: number
  forceLookY?: number
}

const EyeBall = ({
  size = 48,
  pupilSize = 16,
  maxDistance = 10,
  eyeColor = 'white',
  pupilColor = 'black',
  isBlinking = false,
  forceLookX,
  forceLookY,
}: EyeBallProps) => {
  const [mouseX, setMouseX] = useState<number>(0)
  const [mouseY, setMouseY] = useState<number>(0)
  const eyeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX)
      setMouseY(e.clientY)
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const calculatePupilPosition = () => {
    if (!eyeRef.current) return { x: 0, y: 0 }
    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY }
    }
    const eye = eyeRef.current.getBoundingClientRect()
    const eyeCenterX = eye.left + eye.width / 2
    const eyeCenterY = eye.top + eye.height / 2
    const deltaX = mouseX - eyeCenterX
    const deltaY = mouseY - eyeCenterY
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance)
    const angle = Math.atan2(deltaY, deltaX)
    return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance }
  }

  // 动画固有：渲染期读取实时 DOM 位置定位瞳孔（见 Pupil 同款说明）
  // eslint-disable-next-line react-hooks/refs
  const pupilPosition = calculatePupilPosition()

  return (
    <div
      ref={eyeRef}
      className="flex items-center justify-center rounded-full transition-all duration-150"
      style={{
        width: `${size}px`,
        height: isBlinking ? '2px' : `${size}px`,
        backgroundColor: eyeColor,
        overflow: 'hidden',
      }}
    >
      {!isBlinking && (
        <div
          className="rounded-full"
          style={{
            width: `${pupilSize}px`,
            height: `${pupilSize}px`,
            backgroundColor: pupilColor,
            transform: `translate(${pupilPosition.x}px, ${pupilPosition.y}px)`,
            transition: 'transform 0.1s ease-out',
          }}
        />
      )}
    </div>
  )
}

interface LocationState {
  from?: { pathname: string }
}

export function AnimatedCharactersLogin() {
  const { session, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as LocationState | null)?.from?.pathname ?? '/'

  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const [mouseX, setMouseX] = useState<number>(0)
  const [mouseY, setMouseY] = useState<number>(0)
  const [isPurpleBlinking, setIsPurpleBlinking] = useState(false)
  const [isBlackBlinking, setIsBlackBlinking] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [isLookingAtEachOther, setIsLookingAtEachOther] = useState(false)
  const [isPurplePeeking, setIsPurplePeeking] = useState(false)
  const purpleRef = useRef<HTMLDivElement>(null)
  const blackRef = useRef<HTMLDivElement>(null)
  const yellowRef = useRef<HTMLDivElement>(null)
  const orangeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX)
      setMouseY(e.clientY)
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // 紫色角色随机眨眼（3-7 秒）
  useEffect(() => {
    const getRandomBlinkInterval = () => Math.random() * 4000 + 3000
    let inner: ReturnType<typeof setTimeout>
    const scheduleBlink = (): ReturnType<typeof setTimeout> => {
      const blinkTimeout = setTimeout(() => {
        setIsPurpleBlinking(true)
        inner = setTimeout(() => {
          setIsPurpleBlinking(false)
          outer = scheduleBlink()
        }, 150)
      }, getRandomBlinkInterval())
      return blinkTimeout
    }
    let outer = scheduleBlink()
    return () => {
      clearTimeout(outer)
      clearTimeout(inner)
    }
  }, [])

  // 黑色角色随机眨眼（3-7 秒）
  useEffect(() => {
    const getRandomBlinkInterval = () => Math.random() * 4000 + 3000
    let inner: ReturnType<typeof setTimeout>
    const scheduleBlink = (): ReturnType<typeof setTimeout> => {
      const blinkTimeout = setTimeout(() => {
        setIsBlackBlinking(true)
        inner = setTimeout(() => {
          setIsBlackBlinking(false)
          outer = scheduleBlink()
        }, 150)
      }, getRandomBlinkInterval())
      return blinkTimeout
    }
    let outer = scheduleBlink()
    return () => {
      clearTimeout(outer)
      clearTimeout(inner)
    }
  }, [])

  // 开始输入时角色互相对视
  useEffect(() => {
    if (isTyping) {
      // 输入聚焦瞬间触发一次性「对视」动画，0.8s 后回落 → 同步设值是刻意的
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLookingAtEachOther(true)
      const timer = setTimeout(() => setIsLookingAtEachOther(false), 800)
      return () => clearTimeout(timer)
    }
    setIsLookingAtEachOther(false)
  }, [isTyping])

  // 密码可见时紫色角色偷看
  useEffect(() => {
    if (password.length > 0 && showPassword) {
      const peekInterval = setTimeout(
        () => {
          setIsPurplePeeking(true)
          setTimeout(() => setIsPurplePeeking(false), 800)
        },
        Math.random() * 3000 + 2000,
      )
      return () => clearTimeout(peekInterval)
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsPurplePeeking(false)
  }, [password, showPassword, isPurplePeeking])

  const calculatePosition = (ref: RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return { faceX: 0, faceY: 0, bodySkew: 0 }
    const rect = ref.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 3
    const deltaX = mouseX - centerX
    const deltaY = mouseY - centerY
    const faceX = Math.max(-15, Math.min(15, deltaX / 20))
    const faceY = Math.max(-10, Math.min(10, deltaY / 30))
    const bodySkew = Math.max(-6, Math.min(6, -deltaX / 120))
    return { faceX, faceY, bodySkew }
  }

  // 动画固有：渲染期读取各角色实时 DOM 位置以驱动脸/身体朝向
  /* eslint-disable react-hooks/refs */
  const purplePos = calculatePosition(purpleRef)
  const blackPos = calculatePosition(blackRef)
  const yellowPos = calculatePosition(yellowRef)
  const orangePos = calculatePosition(orangeRef)
  /* eslint-enable react-hooks/refs */

  // 已登录直接进入应用
  if (!loading && session) return <Navigate to={from} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setIsLoading(true)
    try {
      await signIn({ email: email.trim(), password, remember })
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? mapAuthError(err.message) : '登录失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* 左侧角色舞台（仅桌面）：深绿渐变底，亮色角色在其上更跳 */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[linear-gradient(150deg,#0f3022,#2e6a48_55%,#173d28)] p-12 text-white lg:flex">
        <div className="relative z-20">
          <div className="flex items-center gap-2.5 text-lg font-semibold">
            <span className="grid size-9 place-items-center rounded-[12px] bg-white/12 ring-1 ring-white/25 backdrop-blur-sm">
              <ShieldIcon className="size-5" />
            </span>
            <span>签证 CRM</span>
          </div>
        </div>

        <div className="relative z-20 flex h-[500px] items-end justify-center">
          {/* 卡通角色 */}
          <div className="relative" style={{ width: '550px', height: '400px' }}>
            {/* 紫色高方块 — 后层 */}
            <div
              ref={purpleRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: '70px',
                width: '180px',
                height: isTyping || (password.length > 0 && !showPassword) ? '440px' : '400px',
                backgroundColor: '#6C3FF5',
                borderRadius: '10px 10px 0 0',
                zIndex: 1,
                transform:
                  password.length > 0 && showPassword
                    ? `skewX(0deg)`
                    : isTyping || (password.length > 0 && !showPassword)
                      ? `skewX(${(purplePos.bodySkew || 0) - 12}deg) translateX(40px)`
                      : `skewX(${purplePos.bodySkew || 0}deg)`,
                transformOrigin: 'bottom center',
              }}
            >
              <div
                className="absolute flex gap-8 transition-all duration-700 ease-in-out"
                style={{
                  left:
                    password.length > 0 && showPassword
                      ? `20px`
                      : isLookingAtEachOther
                        ? `55px`
                        : `${45 + purplePos.faceX}px`,
                  top:
                    password.length > 0 && showPassword
                      ? `35px`
                      : isLookingAtEachOther
                        ? `65px`
                        : `${40 + purplePos.faceY}px`,
                }}
              >
                <EyeBall
                  size={18}
                  pupilSize={7}
                  maxDistance={5}
                  eyeColor="white"
                  pupilColor="#2D2D2D"
                  isBlinking={isPurpleBlinking}
                  forceLookX={password.length > 0 && showPassword ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined}
                  forceLookY={password.length > 0 && showPassword ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined}
                />
                <EyeBall
                  size={18}
                  pupilSize={7}
                  maxDistance={5}
                  eyeColor="white"
                  pupilColor="#2D2D2D"
                  isBlinking={isPurpleBlinking}
                  forceLookX={password.length > 0 && showPassword ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined}
                  forceLookY={password.length > 0 && showPassword ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined}
                />
              </div>
            </div>

            {/* 黑色高方块 — 中层 */}
            <div
              ref={blackRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: '240px',
                width: '120px',
                height: '310px',
                backgroundColor: '#2D2D2D',
                borderRadius: '8px 8px 0 0',
                zIndex: 2,
                transform:
                  password.length > 0 && showPassword
                    ? `skewX(0deg)`
                    : isLookingAtEachOther
                      ? `skewX(${(blackPos.bodySkew || 0) * 1.5 + 10}deg) translateX(20px)`
                      : isTyping || (password.length > 0 && !showPassword)
                        ? `skewX(${(blackPos.bodySkew || 0) * 1.5}deg)`
                        : `skewX(${blackPos.bodySkew || 0}deg)`,
                transformOrigin: 'bottom center',
              }}
            >
              <div
                className="absolute flex gap-6 transition-all duration-700 ease-in-out"
                style={{
                  left:
                    password.length > 0 && showPassword
                      ? `10px`
                      : isLookingAtEachOther
                        ? `32px`
                        : `${26 + blackPos.faceX}px`,
                  top:
                    password.length > 0 && showPassword
                      ? `28px`
                      : isLookingAtEachOther
                        ? `12px`
                        : `${32 + blackPos.faceY}px`,
                }}
              >
                <EyeBall
                  size={16}
                  pupilSize={6}
                  maxDistance={4}
                  eyeColor="white"
                  pupilColor="#2D2D2D"
                  isBlinking={isBlackBlinking}
                  forceLookX={password.length > 0 && showPassword ? -4 : isLookingAtEachOther ? 0 : undefined}
                  forceLookY={password.length > 0 && showPassword ? -4 : isLookingAtEachOther ? -4 : undefined}
                />
                <EyeBall
                  size={16}
                  pupilSize={6}
                  maxDistance={4}
                  eyeColor="white"
                  pupilColor="#2D2D2D"
                  isBlinking={isBlackBlinking}
                  forceLookX={password.length > 0 && showPassword ? -4 : isLookingAtEachOther ? 0 : undefined}
                  forceLookY={password.length > 0 && showPassword ? -4 : isLookingAtEachOther ? -4 : undefined}
                />
              </div>
            </div>

            {/* 橙色半圆 — 前左 */}
            <div
              ref={orangeRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: '0px',
                width: '240px',
                height: '200px',
                zIndex: 3,
                backgroundColor: '#FF9B6B',
                borderRadius: '120px 120px 0 0',
                transform: password.length > 0 && showPassword ? `skewX(0deg)` : `skewX(${orangePos.bodySkew || 0}deg)`,
                transformOrigin: 'bottom center',
              }}
            >
              <div
                className="absolute flex gap-8 transition-all duration-200 ease-out"
                style={{
                  left: password.length > 0 && showPassword ? `50px` : `${82 + (orangePos.faceX || 0)}px`,
                  top: password.length > 0 && showPassword ? `85px` : `${90 + (orangePos.faceY || 0)}px`,
                }}
              >
                <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D" forceLookX={password.length > 0 && showPassword ? -5 : undefined} forceLookY={password.length > 0 && showPassword ? -4 : undefined} />
                <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D" forceLookX={password.length > 0 && showPassword ? -5 : undefined} forceLookY={password.length > 0 && showPassword ? -4 : undefined} />
              </div>
            </div>

            {/* 黄色高方块 — 前右 */}
            <div
              ref={yellowRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: '310px',
                width: '140px',
                height: '230px',
                backgroundColor: '#E8D754',
                borderRadius: '70px 70px 0 0',
                zIndex: 4,
                transform: password.length > 0 && showPassword ? `skewX(0deg)` : `skewX(${yellowPos.bodySkew || 0}deg)`,
                transformOrigin: 'bottom center',
              }}
            >
              <div
                className="absolute flex gap-6 transition-all duration-200 ease-out"
                style={{
                  left: password.length > 0 && showPassword ? `20px` : `${52 + (yellowPos.faceX || 0)}px`,
                  top: password.length > 0 && showPassword ? `35px` : `${40 + (yellowPos.faceY || 0)}px`,
                }}
              >
                <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D" forceLookX={password.length > 0 && showPassword ? -5 : undefined} forceLookY={password.length > 0 && showPassword ? -4 : undefined} />
                <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D" forceLookX={password.length > 0 && showPassword ? -5 : undefined} forceLookY={password.length > 0 && showPassword ? -4 : undefined} />
              </div>
              {/* 嘴巴 */}
              <div
                className="absolute h-[4px] w-20 rounded-full bg-[#2D2D2D] transition-all duration-200 ease-out"
                style={{
                  left: password.length > 0 && showPassword ? `10px` : `${40 + (yellowPos.faceX || 0)}px`,
                  top: password.length > 0 && showPassword ? `88px` : `${88 + (yellowPos.faceY || 0)}px`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="relative z-20 flex items-center gap-6 text-sm text-white/60">
          <span>实时签证进度</span>
          <span className="size-1 rounded-full bg-white/30" />
          <span>双流账务</span>
          <span className="size-1 rounded-full bg-white/30" />
          <span>到期预警</span>
        </div>

        {/* 装饰光斑 */}
        <div className="pointer-events-none absolute right-1/4 top-1/4 size-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-1/4 left-1/4 size-96 rounded-full bg-white/5 blur-3xl" />
      </div>

      {/* 右侧登录表单 */}
      <div className="flex items-center justify-center bg-canvas p-8">
        <div className="w-full max-w-[420px]">
          {/* 移动端 Logo */}
          <div className="mb-12 flex items-center justify-center gap-2.5 text-lg font-semibold text-ink lg:hidden">
            <span className="grid size-9 place-items-center rounded-[12px] bg-[linear-gradient(135deg,#4e9a6b,#2e6a48)] text-white shadow-brand">
              <ShieldIcon className="size-5" />
            </span>
            <span>签证 CRM</span>
          </div>

          {/* 标题 */}
          <div className="mb-10 text-center">
            <h1 className="mb-2 font-serif text-3xl font-bold tracking-tight text-ink">欢迎回来</h1>
            <p className="text-sm text-muted">请输入账号信息登录工作台</p>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-semibold text-body">
                邮箱
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                required
                className="block h-12 w-full rounded-[14px] border border-line-2 bg-white px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-semibold text-body">
                密码
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="block h-12 w-full rounded-[14px] border border-line-2 bg-white px-3.5 pr-11 text-[15px] text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-brand"
                >
                  {showPassword ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="remember" className="flex cursor-pointer items-center gap-2 text-sm text-muted">
                <input
                  id="remember"
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="size-4 rounded border-line-2 accent-brand focus:ring-brand"
                />
                记住我（约 30 天）
              </label>
              <button
                type="button"
                onClick={() => {
                  setError('')
                  setInfo('账号与密码由管理员分配，如需重置请联系管理员。')
                }}
                className="text-sm font-medium text-brand hover:underline"
              >
                忘记密码？
              </button>
            </div>

            {info && (
              <div className="rounded-[14px] border border-brand-100 bg-brand-50 px-3.5 py-2.5 text-sm text-brand-700">
                {info}
              </div>
            )}

            {error && (
              <div className="rounded-[14px] border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
                {error}
              </div>
            )}

            <Button type="submit" block disabled={isLoading} className="h-12 text-base">
              {isLoading ? '登录中…' : '登录'}
            </Button>
          </form>

          <p className="mt-8 text-center text-[12.5px] text-faint">请使用管理员分配的账号登录</p>
        </div>
      </div>
    </div>
  )
}

/** 把 Supabase 的英文错误转成中文提示 */
function mapAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return '邮箱或密码不正确'
  if (/email not confirmed/i.test(message)) return '邮箱尚未确认，请联系管理员'
  return message
}
