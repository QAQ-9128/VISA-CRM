/**
 * 澳洲常见签证类别 + 子类别(stream)目录。**前端常量，不入库**：
 * 案件只存 visa_subclass(text) + visa_stream(text 可空)，可选项配置放这里，
 * 以便随移民政策变化随时增改，不必跑数据库迁移。（核对：2026-05）
 *
 * - 每个 VisaTypeOption.subclass 是存进 cases.visa_subclass 的值（如 '482'、'820/801'）。
 * - streams 为空数组 = 无子类别，选好类别即可、不强制选子类别。
 * - allowOtherStream = 该类别下额外提供「其他(手填)」自由文本子类别。
 * - 「其他(手填)」整类(完全手填 subclass)不在目录里，由表单用 OTHER_TYPE 哨兵单列。
 */

/** 表单哨兵：完全手填的签证类别 / 手填子类别。不会写进数据库（写的是用户输入的实际文本）。 */
export const OTHER_TYPE = '__other_type__'
export const OTHER_STREAM = '__other_stream__'

export interface VisaStreamOption {
  value: string
  label: string
}

export interface VisaTypeOption {
  /** 存进 cases.visa_subclass 的值 */
  subclass: string
  /** 下拉显示名 */
  name: string
  /** 子类别选项；空数组 = 无子类别 */
  streams: VisaStreamOption[]
  /** 是否在子类别里追加「其他(手填)」自由文本项 */
  allowOtherStream?: boolean
}

export interface VisaCategory {
  label: string
  types: VisaTypeOption[]
}

const s = (...labels: string[]): VisaStreamOption[] => labels.map((l) => ({ value: l, label: l }))

export const VISA_CATALOG: VisaCategory[] = [
  {
    label: '工作 / 雇主担保',
    types: [
      { subclass: '482', name: 'Skills in Demand', streams: s('Core Skills', 'Specialist Skills', 'Labour Agreement'), allowOtherStream: true },
      { subclass: '186', name: 'Employer Nomination Scheme (ENS)', streams: s('Direct Entry', 'Temporary Residence Transition', 'Labour Agreement'), allowOtherStream: true },
      { subclass: '494', name: 'Skilled Employer Sponsored Regional', streams: s('Employer Sponsored', 'Labour Agreement', 'Subsequent Entrant'), allowOtherStream: true },
      { subclass: '407', name: 'Training Visa（培训签证）', streams: [] },
      // SBS 严格说是雇主担保「资格」申请、非签证，但属客户实际办理的业务，先并入此处（visa_subclass 为 text）。
      { subclass: 'SBS', name: 'Standard Business Sponsor（雇主担保资格申请）', streams: [] },
    ],
  },
  {
    label: '技术移民',
    types: [
      { subclass: '189', name: 'Skilled Independent', streams: s('Points-tested', 'New Zealand'), allowOtherStream: true },
      { subclass: '190', name: 'Skilled Nominated', streams: [] },
      { subclass: '491', name: 'Skilled Work Regional (Provisional)', streams: s('State/Territory Nominated', 'Family Sponsored'), allowOtherStream: true },
    ],
  },
  {
    label: '学生 / 毕业生',
    types: [
      { subclass: '485', name: 'Temporary Graduate', streams: s('Post-Vocational Education Work', 'Post-Higher Education Work', 'Second Post-Higher Education Work', 'Replacement'), allowOtherStream: true },
      { subclass: '500', name: 'Student', streams: [] },
      { subclass: '590', name: 'Student Guardian', streams: [] },
    ],
  },
  {
    label: '配偶',
    types: [
      { subclass: '820/801', name: 'Partner (Onshore)', streams: [] },
      { subclass: '309/100', name: 'Partner (Offshore)', streams: [] },
      { subclass: '300', name: 'Prospective Marriage', streams: [] },
      { subclass: '461', name: 'NZ Citizen Family Relationship', streams: [] },
    ],
  },
  {
    label: '父母',
    types: [
      { subclass: '143', name: 'Contributory Parent', streams: [] },
      { subclass: '173', name: 'Contributory Parent (Temporary)', streams: [] },
      { subclass: '864', name: 'Contributory Aged Parent', streams: [] },
      { subclass: '884', name: 'Contributory Aged Parent (Temporary)', streams: [] },
      { subclass: '103', name: 'Parent', streams: [] },
      { subclass: '804', name: 'Aged Parent', streams: [] },
      { subclass: '870', name: 'Sponsored Parent (Temporary)', streams: [] },
    ],
  },
  {
    label: '子女 / 家庭',
    types: [
      { subclass: '101', name: 'Child', streams: [] },
      { subclass: '802', name: 'Child (Onshore)', streams: [] },
      { subclass: '445', name: 'Dependent Child', streams: [] },
      { subclass: '117', name: 'Orphan Relative', streams: [] },
      { subclass: '114', name: 'Aged Dependent Relative', streams: [] },
      { subclass: '115', name: 'Remaining Relative', streams: [] },
      { subclass: '116', name: 'Carer', streams: [] },
    ],
  },
  {
    label: '商业 / 投资',
    types: [
      { subclass: '858', name: 'National Innovation Visa', streams: [] },
      { subclass: '188', name: 'Business Innovation & Investment (存量)', streams: s('Business Innovation', 'Investor', 'Significant Investor', 'Entrepreneur'), allowOtherStream: true },
      { subclass: '888', name: 'Business Innovation & Investment (Permanent)', streams: [] },
    ],
  },
  {
    label: '访客',
    types: [
      { subclass: '600', name: 'Visitor', streams: s('Tourist', 'Sponsored Family', 'Business Visitor', 'Approved Destination Status', 'Frequent Traveller'), allowOtherStream: true },
      { subclass: '601', name: 'Electronic Travel Authority (ETA)', streams: [] },
      { subclass: '651', name: 'eVisitor', streams: [] },
      { subclass: '462', name: 'Work and Holiday', streams: [] },
      { subclass: '417', name: 'Working Holiday Maker', streams: [] },
    ],
  },
  {
    label: '其他',
    types: [
      { subclass: '155', name: 'Five Year Resident Return', streams: [] },
      { subclass: '157', name: 'Three Month Resident Return', streams: [] },
      { subclass: '866', name: 'Protection', streams: [] },
      { subclass: '408', name: 'Temporary Activity', streams: [] },
      { subclass: '403', name: 'Temporary Work (International Relations)', streams: [] },
      { subclass: 'Citizenship', name: '入籍 Citizenship（独立流程）', streams: [] },
      // Skill Assessment 严格说是技术评估、非签证，但属客户实际办理的业务，先并入此处（visa_subclass 为 text）。
      { subclass: 'Skill Assessment', name: '技术评估', streams: [] },
    ],
  },
]
