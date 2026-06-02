import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AlertCard } from './cards'

describe('AlertCard（空状态压缩）', () => {
  it('count=0 → 只渲染一行空状态提示，不渲染列表内容（高度随内容收缩）', () => {
    render(
      <AlertCard title="我的待办" count={0} empty="暂无待办">
        <div data-testid="rows">不应出现的列表</div>
      </AlertCard>,
    )
    expect(screen.getByText('暂无待办')).toBeInTheDocument()
    // 空状态下不渲染 children（无撑高的列表）
    expect(screen.queryByTestId('rows')).not.toBeInTheDocument()
    // 空状态不显示计数胶囊
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('count>0 → 渲染列表内容与计数胶囊，不显示空状态文案', () => {
    render(
      <AlertCard title="我的待办" count={2} empty="暂无待办">
        <div data-testid="rows">两行待办</div>
      </AlertCard>,
    )
    expect(screen.getByTestId('rows')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.queryByText('暂无待办')).not.toBeInTheDocument()
  })
})
