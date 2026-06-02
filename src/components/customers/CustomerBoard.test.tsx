import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { FamilyCard, NoCaseCard } from './CustomerBoard'
import type { BoardCard, NoCaseCard as NoCaseCardData } from '../../lib/customerBoard'

const card = (over: Partial<BoardCard> = {}): BoardCard => ({
  key: 'k',
  customerId: 'cust-1',
  stage: 'visa_lodged',
  headName: '张伟',
  seed: 'cust-1',
  role: 'solo',
  cases: [{ caseId: 'case-a', visaLabel: '482' }],
  participants: [],
  primaryId: null,
  primaryName: null,
  ...over,
})

const renderCard = (c: BoardCard) =>
  render(
    <MemoryRouter>
      <FamilyCard card={c} employerName={null} owe={0} paid={false} />
    </MemoryRouter>,
  )

const hrefOf = (el: HTMLElement | null) => el?.closest('a')?.getAttribute('href')

describe('FamilyCard（按主体渲染 + 导航）', () => {
  it('点头像/姓名 → 该主体客户详情（正确客户 id）', () => {
    renderCard(card())
    expect(hrefOf(screen.getByText('张伟'))).toBe('/customers/cust-1')
  })

  it('点签证 → 对应案件详情（正确案件 id）', () => {
    renderCard(card())
    expect(hrefOf(screen.getByText('482'))).toBe('/cases/case-a')
  })

  it('副申卡：以副申为主，头像/名字/签证用副申，并标注主申（可跳主申客户详情）', () => {
    renderCard(
      card({
        customerId: 'sub-1',
        headName: '邓韬',
        role: 'sub',
        cases: [{ caseId: 'case-sub', visaLabel: '482' }],
        primaryId: 'prim-1',
        primaryName: '李旻书',
      }),
    )
    // 头像/名字 → 副申本人
    expect(hrefOf(screen.getByText('邓韬'))).toBe('/customers/sub-1')
    // 签证 → 副申自己的案件
    expect(hrefOf(screen.getByText('482'))).toBe('/cases/case-sub')
    // 「主申:李旻书」一行，且跳主申客户详情
    expect(screen.getByText('李旻书')).toBeInTheDocument()
    expect(hrefOf(screen.getByText('李旻书'))).toBe('/customers/prim-1')
    // 副申标签
    expect(screen.getByText('副申')).toBeInTheDocument()
  })

  it('主申卡：不显示「主申:」标注（不串副申/主申进度）', () => {
    renderCard(card({ customerId: 'prim-1', headName: '李旻书', role: 'primary', primaryId: null, primaryName: null }))
    expect(hrefOf(screen.getByText('李旻书'))).toBe('/customers/prim-1')
    expect(screen.queryByText(/主申：/)).not.toBeInTheDocument()
    // 不出现「其他进度」混合展示
    expect(screen.queryByText('其他进度')).not.toBeInTheDocument()
  })

  it('一主体多签证 → 每个签证各进各的案件', () => {
    renderCard(
      card({
        cases: [
          { caseId: 'case-a', visaLabel: '482' },
          { caseId: 'case-b', visaLabel: '186' },
        ],
      }),
    )
    expect(hrefOf(screen.getByText('482'))).toBe('/cases/case-a')
    expect(hrefOf(screen.getByText('186'))).toBe('/cases/case-b')
  })

  it('点签证不冒泡到客户：签证链接与客户链接是不同 <a>、不嵌套', () => {
    renderCard(card())
    const visaLink = screen.getByText('482').closest('a')!
    const nameLink = screen.getByText('张伟').closest('a')!
    expect(visaLink).not.toBe(nameLink)
    expect(nameLink.contains(visaLink)).toBe(false)
  })

  it('无案件 → 显示「暂无案件」、无案件链接，不崩；头像入口仍在', () => {
    renderCard(card({ cases: [] }))
    expect(screen.getByText('暂无案件')).toBeInTheDocument()
    const links = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    expect(links.some((h) => h?.startsWith('/cases/'))).toBe(false)
    expect(hrefOf(screen.getByText('张伟'))).toBe('/customers/cust-1')
  })

  it('共享案件参与者：和主体同卡显示，头像/名字 → 该副申客户详情 + 副申标签', () => {
    renderCard(
      card({
        customerId: 'jia',
        headName: '贾乃亮',
        participants: [{ customerId: 'pgone', name: 'PGone' }],
      }),
    )
    expect(hrefOf(screen.getByText('贾乃亮'))).toBe('/customers/jia') // 主体（主申为头）
    expect(hrefOf(screen.getByText('PGone'))).toBe('/customers/pgone') // 参与副申 → 其客户详情
    expect(screen.getByText('副申')).toBeInTheDocument()
  })
})

const noCase = (over: Partial<NoCaseCardData> = {}): NoCaseCardData => ({
  key: 'nocase:p',
  headId: 'p',
  headName: '主申P',
  seed: 'p',
  role: 'primary',
  members: [],
  relations: [],
  ...over,
})

const renderNoCase = (c: NoCaseCardData) =>
  render(
    <MemoryRouter>
      <NoCaseCard card={c} employerName={null} />
    </MemoryRouter>,
  )

describe('NoCaseCard（暂时无案件卡）', () => {
  it('头像/姓名 → 客户详情；「+ 新建案件」→ 复用新建案件 flow（带 head 客户）', () => {
    renderNoCase(noCase())
    expect(hrefOf(screen.getByText('主申P'))).toBe('/customers/p')
    expect(hrefOf(screen.getByText('+ 新建案件'))).toBe('/cases/new?customer=p')
  })

  it('合并卡：列出无案副申，姓名各自 → 其客户详情', () => {
    renderNoCase(noCase({ members: [{ customerId: 's1', name: '副申S1' }] }))
    expect(hrefOf(screen.getByText('副申S1'))).toBe('/customers/s1')
  })

  it('标注「副申·已有案件」：名字可点 → 该副申客户详情', () => {
    renderNoCase(noCase({ relations: [{ kind: 'subHasCase', customerId: 's', name: '副申S' }] }))
    expect(screen.getByText(/已有案件/)).toBeInTheDocument()
    expect(hrefOf(screen.getByText('副申S'))).toBe('/customers/s')
  })

  it('副申卡：标注「是 <主申> 的副申」，主申名可点', () => {
    renderNoCase(noCase({ headId: 's', headName: '副申S', role: 'sub', relations: [{ kind: 'subOf', customerId: 'p', name: '主申P' }] }))
    expect(hrefOf(screen.getByText('副申S'))).toBe('/customers/s')
    expect(screen.getByText(/的副申/)).toBeInTheDocument()
    expect(hrefOf(screen.getByText('主申P'))).toBe('/customers/p')
  })
})
