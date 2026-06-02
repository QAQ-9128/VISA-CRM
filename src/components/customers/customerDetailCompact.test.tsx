import { describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../../providers/auth-context'
import type { AuthContextValue } from '../../providers/auth-context'
import { RecordsSection } from '../records/RecordsSection'
import { DocumentsSection } from '../documents/DocumentsSection'

const authValue = {
  user: { id: 'u1' },
  loading: false,
  session: null,
  profile: null,
  isAdmin: true,
  signIn: async () => {},
  signOut: async () => {},
} as unknown as AuthContextValue

function renderWith(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter>{node}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('记录区 compact 变体（统计去重，子功能保留）', () => {
  it('compact：无大「记录统计」卡，统计收成一行小字；快速添加 + 时间线仍在', () => {
    renderWith(<RecordsSection customerId="cu1" variant="compact" />)
    expect(screen.queryByText('记录统计')).not.toBeInTheDocument() // 大卡标题不出现
    expect(screen.getByText('快速添加记录')).toBeInTheDocument()
    expect(screen.getByText('记录时间线')).toBeInTheDocument()
    expect(screen.getByText('保存记录')).toBeInTheDocument()
    expect(screen.getByText('待跟进事项')).toBeInTheDocument()
    expect(screen.getByText(/总记录/)).toBeInTheDocument() // 小字统计
  })

  it('full：仍有「记录统计」大卡', () => {
    renderWith(<RecordsSection customerId="cu1" />)
    expect(screen.getByText('记录统计')).toBeInTheDocument()
  })
})

describe('文件区 compact 变体（统计去重，子功能保留）', () => {
  it('compact：无「文件总数」大卡，改「文件与材料」标题 + 小字摘要；上传 + 待补充仍在', () => {
    renderWith(<DocumentsSection customerId="cu1" variant="compact" />)
    expect(screen.queryByText('文件总数')).not.toBeInTheDocument() // 大统计卡不出现
    expect(screen.getByText('文件与材料')).toBeInTheDocument()
    expect(screen.getByText(/文件 .* 待补 .* 最近上传/)).toBeInTheDocument() // 小字摘要
    expect(screen.getByText('选择文件上传')).toBeInTheDocument()
    expect(screen.getByText('待补充 / 缺失提醒')).toBeInTheDocument()
  })

  it('full：仍有「文件总数」大统计卡', () => {
    renderWith(<DocumentsSection customerId="cu1" />)
    expect(screen.getByText('文件总数')).toBeInTheDocument()
  })
})
