import { describe, expect, it } from 'vitest'
import {
  VISA_TYPES,
  STREAM_OPTIONS,
  SPONSOR_TYPES,
  EMPLOYER_TYPES,
  STATIC_LOCATION,
  cascadeSubclass,
  cascadeStream,
  cascadeFromCase,
  pruneDetails,
} from './caseTypeCascade'

const mkCase = (over: Partial<Parameters<typeof cascadeFromCase>[0]>) => ({
  case_category: null,
  visa_subclass: '',
  visa_stream: null,
  sponsor_position: null,
  sponsor_employer_id: null,
  case_details: null,
  ...over,
})

describe('caseTypeCascade · 入库 visa_subclass 派生（复用现有列，驱动 TRT/阶段逻辑不破坏）', () => {
  it('签证申请：八个类型映射到目录子类（482sbs→SBS、407→407、配偶→820/801、309/100）', () => {
    expect(cascadeSubclass('签证申请', '482', '')).toBe('482')
    expect(cascadeSubclass('签证申请', '482sbs', '')).toBe('SBS')
    expect(cascadeSubclass('签证申请', '186', '')).toBe('186')
    expect(cascadeSubclass('签证申请', '407', '')).toBe('407')
    expect(cascadeSubclass('签证申请', '600', '')).toBe('600')
    expect(cascadeSubclass('签证申请', '820', '')).toBe('820/801')
    expect(cascadeSubclass('签证申请', '309', '')).toBe('309/100')
  })
  it('500 学生签：子类别选 Student Guardian → 入库 590，否则 500（目录两个独立子类）', () => {
    expect(cascadeSubclass('签证申请', '500', '')).toBe('500')
    expect(cascadeSubclass('签证申请', '500', '500')).toBe('500')
    expect(cascadeSubclass('签证申请', '500', '590')).toBe('590')
  })
  it('非签证大类：职业评估→Skill Assessment（目录已有）、De Facto、定制文件', () => {
    expect(cascadeSubclass('职业评估', '', '')).toBe('Skill Assessment')
    expect(cascadeSubclass('De Facto 关系认定', '', '')).toBe('De Facto')
    expect(cascadeSubclass('定制文件', '', '')).toBe('定制文件')
  })
  it('不完整选择 → 空串（保存按钮门禁）：没选大类 / 签证申请没选类型', () => {
    expect(cascadeSubclass('', '', '')).toBe('')
    expect(cascadeSubclass('签证申请', '', '')).toBe('')
  })
})

describe('caseTypeCascade · visa_stream 派生（值=现有目录 stream，标签照 mock）', () => {
  it('482 三个 stream 的入库值与 VISA_CATALOG 一致（TRT 检测等既有逻辑不破坏）', () => {
    const vals = STREAM_OPTIONS['482']!.options.map((o) => o.value)
    expect(vals).toEqual(['Core Skills', 'Specialist Skills', 'Labour Agreement'])
  })
  it('186 的 TRT 入库值 = Temporary Residence Transition（lib/trt 精确匹配依赖）', () => {
    const trt = STREAM_OPTIONS['186']!.options.find((o) => o.label.includes('TRT'))
    expect(trt?.value).toBe('Temporary Residence Transition')
  })
  it('cascadeStream：空→null；500 的子类别已折进 subclass → null；其余原样', () => {
    expect(cascadeStream('482', 'Core Skills')).toBe('Core Skills')
    expect(cascadeStream('482', '')).toBeNull()
    expect(cascadeStream('500', '590')).toBeNull()
    expect(cascadeStream('820', '801')).toBe('801')
  })
})

describe('caseTypeCascade · 字段可见性配置（担保职位/雇主并入相关类型，不再常驻）', () => {
  it('担保职位 482/186/407；担保雇主 482/186/482sbs/407（407 培训签同款担保字段）', () => {
    expect([...SPONSOR_TYPES].sort()).toEqual(['186', '407', '482'])
    expect([...EMPLOYER_TYPES].sort()).toEqual(['186', '407', '482', '482sbs'])
  })
  it('配偶签证带静态申请地点（820 Onshore / 309 Offshore）', () => {
    expect(STATIC_LOCATION['820']).toContain('Onshore')
    expect(STATIC_LOCATION['309']).toContain('Offshore')
  })
  it('VISA_TYPES 八项、key 唯一；407 紧随 186（同担保一组）', () => {
    expect(VISA_TYPES).toHaveLength(8)
    expect(new Set(VISA_TYPES.map((t) => t.key)).size).toBe(8)
    const keys = VISA_TYPES.map((t) => t.key)
    expect(keys.indexOf('407')).toBe(keys.indexOf('186') + 1)
    expect(VISA_TYPES.find((t) => t.key === '407')?.label).toBe('407 培训签')
  })
})

describe('cascadeFromCase · 编辑模式反向回填（新建/编辑共用同一套级联）', () => {
  it('7 类签证反推签证类型 + 大类（无 case_category 时按类型推「签证申请」）', () => {
    expect(cascadeFromCase(mkCase({ visa_subclass: '482', visa_stream: 'Core Skills' }))).toMatchObject({
      category: '签证申请', visaType: '482', stream: 'Core Skills',
    })
    expect(cascadeFromCase(mkCase({ visa_subclass: 'SBS' }))).toMatchObject({ category: '签证申请', visaType: '482sbs', stream: '' })
    expect(cascadeFromCase(mkCase({ visa_subclass: '820/801', visa_stream: '801' }))).toMatchObject({ visaType: '820', stream: '801' })
    expect(cascadeFromCase(mkCase({ visa_subclass: '309/100', visa_stream: '100' }))).toMatchObject({ visaType: '309', stream: '100' })
  })
  it('407 反推：visa_subclass=407 → 签证申请 / 407（担保职位/雇主原样带回）', () => {
    expect(cascadeFromCase(mkCase({ visa_subclass: '407', sponsor_position: 'Trainee Chef', sponsor_employer_id: 'e1' }))).toMatchObject({
      category: '签证申请', visaType: '407', stream: '', sponsorPosition: 'Trainee Chef', sponsorEmployerId: 'e1',
    })
  })
  it('500/590 折分回子类别（visaType=500，stream=500/590）', () => {
    expect(cascadeFromCase(mkCase({ visa_subclass: '500' }))).toMatchObject({ visaType: '500', stream: '500' })
    expect(cascadeFromCase(mkCase({ visa_subclass: '590' }))).toMatchObject({ visaType: '500', stream: '590' })
  })
  it('非签证大类反推大类、不带签证类型/子类别；details/担保原样带回', () => {
    expect(cascadeFromCase(mkCase({ visa_subclass: 'Skill Assessment', case_details: { 评估机构: 'VETASSESS' } }))).toMatchObject({
      category: '职业评估', visaType: '', stream: '', details: { 评估机构: 'VETASSESS' },
    })
    expect(cascadeFromCase(mkCase({ visa_subclass: 'De Facto' })).category).toBe('De Facto 关系认定')
    expect(cascadeFromCase(mkCase({ visa_subclass: '定制文件' })).category).toBe('定制文件')
    expect(cascadeFromCase(mkCase({ visa_subclass: '482', sponsor_position: 'Cook', sponsor_employer_id: 'e1' }))).toMatchObject({
      sponsorPosition: 'Cook', sponsorEmployerId: 'e1',
    })
  })
  it('显式 case_category 优先于按签证推断（矛盾旧数据以大类为准）', () => {
    expect(cascadeFromCase(mkCase({ case_category: '定制文件', visa_subclass: '482' }))).toMatchObject({ category: '定制文件', visaType: '' })
  })
  it('旧库 7 类外的签证（189/494/300…已下线）→ 大类/类型留空（旧值打开即空）', () => {
    expect(cascadeFromCase(mkCase({ visa_subclass: '189' }))).toMatchObject({ category: '', visaType: '' })
    expect(cascadeFromCase(mkCase({ visa_subclass: '887', visa_stream: 'x' }))).toMatchObject({ category: '', visaType: '' })
  })
  it('旧目录允许、新目录已删的 stream（482 Subsequent Entrant / 600 ADS / 自由文本）→ 置空重选，不隐身回写', () => {
    // 受控下拉对目录外 value 显示为空白，但旧实现把隐藏值原样带回 → 提交时在用户不知情下回写/覆盖
    expect(cascadeFromCase(mkCase({ visa_subclass: '482', visa_stream: 'Subsequent Entrant' })).stream).toBe('')
    expect(cascadeFromCase(mkCase({ visa_subclass: '600', visa_stream: 'Approved Destination Status' })).stream).toBe('')
    expect(cascadeFromCase(mkCase({ visa_subclass: '186', visa_stream: '自由填写的旧值' })).stream).toBe('')
    // 无 stream 下拉的类型（407）残留旧值同样置空
    expect(cascadeFromCase(mkCase({ visa_subclass: '407', visa_stream: 'x' })).stream).toBe('')
    // 仍在目录里的值原样保留
    expect(cascadeFromCase(mkCase({ visa_subclass: '482', visa_stream: 'Core Skills' })).stream).toBe('Core Skills')
    expect(cascadeFromCase(mkCase({ visa_subclass: '186', visa_stream: 'Temporary Residence Transition' })).stream).toBe('Temporary Residence Transition')
  })
})

describe('pruneDetails（case_details 入库前清空值）', () => {
  it('去掉空串/空白值；全空 → null', () => {
    expect(pruneDetails({ 评估机构: 'VETASSESS', 评估职位: ' ', ABN: '' })).toEqual({ 评估机构: 'VETASSESS' })
    expect(pruneDetails({ ABN: '  ' })).toBeNull()
    expect(pruneDetails({})).toBeNull()
  })
})
