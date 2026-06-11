import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

// dismiss 走 updateCase(id, { trt_reminder_dismissed: true })；mock 掉避免真连库
vi.mock('../../api/cases', async (orig) => {
  const actual = await orig<typeof import('../../api/cases')>()
  return { ...actual, updateCase: vi.fn().mockResolvedValue({ id: 'ca1' }) }
})

import { TrtReminderCard } from './TrtReminderCard'
import { updateCase } from '../../api/cases'

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TrtReminderCard customerId="cu1" caseId="ca1" months={23} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TrtReminderCard（482→186 TRT 永居提醒绿卡）', () => {
  it('文案 + 月数 + 两个动作；「新建 186 TRT 案件」带 prefill 预填链接', () => {
    renderCard()
    expect(screen.getByText('下签满 22 个月，及时启动 186 TRT 永居')).toBeInTheDocument()
    expect(screen.getByText(/23/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '新建 186 TRT 案件' })).toHaveAttribute(
      'href',
      '/cases/new?customer=cu1&prefill=186trt',
    )
    expect(screen.getByRole('button', { name: /不再提醒/ })).toBeInTheDocument()
  })

  it('点「不再提醒」→ updateCase(caseId, { trt_reminder_dismissed: true })（持久化）', async () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /不再提醒/ }))
    await waitFor(() =>
      expect(updateCase).toHaveBeenCalledWith('ca1', { trt_reminder_dismissed: true }),
    )
  })
})
