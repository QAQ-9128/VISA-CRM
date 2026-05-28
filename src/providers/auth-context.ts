import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile } from '../types/models'
import type { SignInInput } from '../api/auth'

export interface AuthContextValue {
  /** 首次会话恢复 / profile 加载期间为 true，用于守卫显示骨架而非误判未登录 */
  loading: boolean
  session: Session | null
  user: User | null
  profile: Profile | null
  isAdmin: boolean
  signIn: (input: SignInInput) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
