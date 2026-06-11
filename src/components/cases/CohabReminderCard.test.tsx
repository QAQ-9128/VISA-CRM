import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

// 「本次已更新」走 updateCase(id, { cohab_reminder_last: 今天 })；mock 掉避免真连库
vi.mock('../../api/cases', async (orig) => {
  const actual = await orig<typeof import('../../api/cases')>()
  return { ...actual, updateCase: vi.fn().mockResolvedValue({ id: 'ca1' }) }
})

import { CohabReminderCard } from './CohabReminderCard'
import { updateCase } from '../../api/cases'
import { todayYmd } from '../../lib/dateRules'

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CohabReminderCard caseId="ca1" months={4} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CohabReminderCard（186/配偶签 · 3 个月更新同居材料提醒绿卡）', () => {
  it('文案 + 月数 + 「本次已更新」动作', () => {
    renderCard()
    expect(screen.getByText('该更新同居材料了')).toBeInTheDocument()
    expect(screen.getByText(/4/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /本次已更新/ })).toBeInTheDocument()
  })

  it('点「本次已更新」→ updateCase(caseId, { cohab_reminder_last: 今天 })（顺延一个 3 个月周期）', async () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /本次已更新/ }))
    await waitFor(() =>
      expect(updateCase).toHaveBeenCalledWith('ca1', { cohab_reminder_last: todayYmd() }),
    )
  })
})
