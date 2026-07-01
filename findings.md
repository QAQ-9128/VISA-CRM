# Findings（本轮：中文名/英文名）

## Key Discoveries（本轮）
- 已有 `displayCustomerName`（lib/dashboardView）只是「无名兜底」格式化，输入是已解析的 name 字符串——与新解析互补：新 `customerDisplayName(c)` 负责三字段择一，输出可继续喂给它
- createCustomer/updateCustomer 透传 payload（无白名单）；搜索 or() 串硬编码 full_name/phone/email → 需补 chinese/english；排序 order('full_name') 保留（full_name 保存时同步为显示名）
- 表单写库策略：full_name = 中文 ?? 英文 ?? 旧值（DB not null + 老消费方/排序/搜索全兼容）
- 显示点（非测试）：CaseForm 参与人、CustomerActionsMenu、CaseJoinPicker、CustomerForm companions、PaymentEntryForm/RecordPaymentForm/PaymentPlanForm、SummaryBand、RelatedCasesCard、useFinance/useCustomerFinance、caseFees、cohab、archive、checklist、casesTable、dashboard、family、CaseFormPage、ArchivePage、RecycleBin、CustomerDetailPage、CustomerListPage、GroupManagementPage、trt
- 测试要同步改：CustomerForm.test / QuickPersonCreate.test / CustomerFormPage.test / CaseForm.test 里所有 getByLabelText(/姓名/)（字段拆成中文名/英文名）；quickCustomer.test 键集锁定 5→7

## Decisions Made（本轮）
- 解析放 `lib/customerName.ts`：`customerDisplayName(c)` = trim(中文) ?? trim(英文) ?? trim(full_name) ?? ''（英文不改大小写，原样）
- 共用字段组件 `components/customers/NameFields.tsx`（中文名 + 英文名两栏，英文占位「如 DENG Tao（姓全大写 + 名首字母大写）」），主表单与快速建档同用
- 校验：至少填一个名（编辑老数据时旧 full_name 非空也可保存，不强迫补录）

# Findings

## Key Discoveries
- 最简 lookup 模板 = referrers（0002 迁移 + api/referrers.ts + useReferrers + ReferrerSelect 行内「下拉+新建」）
- 案件详情页已删，案件信息显示在 `components/customers/overview/RelatedCasesCard.tsx` 的「本案信息」InfoRow 区（担保雇主用 useEmployer(detail) 异步解析名字，账号照搬）
- CaseForm：`CaseFormValues extends CaseInsert`；编辑模式整个 values 作 patch → 在 submit() 加 `immi_account_id` 即新建/编辑双写
- CaseFormPage 编辑用 updateM.mutate({patch: values})，新建 createM → setApplicants → 跳转
- api 测试模板：`src/test/sbMock.ts` makeBuilder/wireFrom
- database.ts 加表必须带 Relationships: []

## Decisions Made
- 表名 `immi_accounts`：DHA 在线系统本名就叫 ImmiAccount，自文档化；列 `cases.immi_account_id`
- api 仅 list/get/create（用户只要 select-or-create + 详情显示名字；管理页不在本轮范围）
- ImmiAccountSelect 放 `components/cases/`（仅案件用），置于 restBlocks 顶部独立一行（渐进披露：选完类型才出现，与 Group 区一致）
- 新表 RLS 照 0002 referrers 四策略（select/insert/update=authenticated，delete=admin）——「不动 RLS」指不改既有表策略

## Open Questions
- 无
