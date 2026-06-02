import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Avatar } from './Avatar'
import { avatarInitial } from '../../lib/avatar'

describe('avatarInitial（首字符 + 无名兜底）', () => {
  it('中文取首字', () => {
    expect(avatarInitial('张三')).toBe('张')
  })
  it('拉丁取首字母大写', () => {
    expect(avatarInitial('amy chen')).toBe('A')
  })
  it('空白名 → 兜底「·」（不出现「?」）', () => {
    expect(avatarInitial('')).toBe('·')
    expect(avatarInitial('   ')).toBe('·')
  })
})

describe('Avatar 渲染', () => {
  it('渲染名字首字符', () => {
    render(<Avatar name="王五" />)
    expect(screen.getByText('王')).toBeInTheDocument()
  })
  it('同一 seed 取色稳定（同色板内同一格）', () => {
    const { container: a } = render(<Avatar name="甲" seed="cust-1" />)
    const { container: b } = render(<Avatar name="乙" seed="cust-1" />)
    const bg = (el: HTMLElement) => (el.firstChild as HTMLElement).style.background
    expect(bg(a)).toBe(bg(b)) // 颜色只由 seed 决定，与名字无关
  })
})
