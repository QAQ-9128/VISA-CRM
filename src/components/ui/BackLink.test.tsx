import { describe, expect, it, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { BackLink } from './BackLink'

function renderAt() {
  return render(
    <MemoryRouter initialEntries={['/prev-page', '/current']} initialIndex={1}>
      <Routes>
        <Route path="/prev-page" element={<div>PREV PAGE</div>} />
        <Route path="/current" element={<BackLink to="/fallback" label="返回" />} />
        <Route path="/fallback" element={<div>FALLBACK PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  window.history.replaceState(null, '')
})

describe('BackLink（从哪来回哪去）', () => {
  it('应用内有历史（history.state.idx > 0）→ 真·后退，精确回到上一个界面', () => {
    window.history.replaceState({ idx: 3 }, '') // 模拟 browser router 的会话序号
    renderAt()
    fireEvent.click(screen.getByText('返回'))
    expect(screen.getByText('PREV PAGE')).toBeInTheDocument()
    expect(screen.queryByText('FALLBACK PAGE')).not.toBeInTheDocument()
  })

  it('无应用内历史（刷新/直链，idx 缺失或 0）→ 走 to 兜底', () => {
    window.history.replaceState({ idx: 0 }, '')
    renderAt()
    fireEvent.click(screen.getByText('返回'))
    expect(screen.getByText('FALLBACK PAGE')).toBeInTheDocument()
    expect(screen.queryByText('PREV PAGE')).not.toBeInTheDocument()
  })
})
