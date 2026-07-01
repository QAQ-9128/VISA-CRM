# Progress Log

## Session 2026-06-14：三处调整（净额卡 / 阶段记录只显日期 / 概览待办置底全显）
- [x] A 客户头部「已收」卡 → 「净额（全部案件）」卡
      - lib/finance `customerNetTotal(f)` 纯函数：净额 = receivableTotals.paid − (payouts 三类合计)
        = Σ各案(收−支)，复用既有双流聚合，与费用卡「本案净额」同口径；账目算法零改动
      - SummaryBand：第一张财务卡换标题+数值（≥0 绿/<0 红，小字「收款 X − 支出 Y」）；去掉「已收」数字+「应收合计」行；未收卡不动
      - 单测：finance.test customerNetTotal（值=1050、恒等含负净额）；CustomerDetailPage 显示swap
- [x] B 阶段流转记录只显日期：StageTimeline `toLocaleString` → `localYmd(new Date(effective_at))`（本地 YYYY-MM-DD）
      - dateRules 加语义别名 `localYmd`（= todayYmd 实现）；grep 确认仅此一处精确阶段时间戳
      - 单测：StageTimeline.test 日期匹配 /\d{4}-\d{2}-\d{2}/ 且无 ':'
- [x] C 概览「待办阶段案件」：去 `.slice(0,5)` 全列；区块移到页面最底（⑥，⑤官方处理时间之后）；
      max-h-[480px] overflow-y-auto 可滚动；案件阶段分布(③)改整宽 section
      - 单测：DashboardPage 8 条全显（第6/7/8条出现）+ 区块在官方链接之后（compareDocumentPosition）
- [x] 全量验证：vitest 1011/1011 绿，tsc -b 0 错，eslint 0 错
- 不变量守住：A 仅换展示聚合不动账目算法/归账口径；B/C 纯展示/布局；零迁移、不动 RLS

## Session 2026-06-14（二）：概览「待办」区纳入「已草拟」阶段
- [x] lib/dashboard selectTodoCases 筛选 'todo' → {todo, drafted}（TODO_STAGES Set）；
      TodoCaseItem 加 stage + stageLabel（CASE_STAGE_LABELS），行内 pill 随各案显「待办」/「已草拟」
- [x] DashboardPage ⑥ 标题「待办阶段案件」→「待办 / 已草拟 案件」；空态文案同步；pill 用 t.stageLabel
      （沿用上一轮：置底 + 全列无上限 + 区内滚动，未动）
- [x] 单测：dashboard.test 纯待办/纯已草拟/两者都有各正确、其它阶段不混入、归档滤除、带阶段标签；
      DashboardPage.test mock 加 stage/stageLabel、3 待办+2 已草拟 pill 计数、底部位置、>5 全列
- [x] 全量验证：vitest 1013 绿、tsc -b 0 错、eslint 0 错
- 不变量守住：仅扩筛选范围 + 标题/标签文案；阶段枚举/数据/账目不动；零迁移、不动 RLS

## Session 2026-06-13（二）：客户中文名/英文名
- [x] lib/customerName.ts `customerDisplayName`（中文 ?? 英文 ?? 旧 full_name；4 测试）
- [x] 迁移 0039_customer_names.sql（customers.chinese_name / english_name，additive nullable，不动 RLS）+ database.ts
- [x] 表单 lib：customerForm / quickCustomer 状态+payload（full_name=派生显示名；老数据兜底保留）
- [x] NameFields 共用组件（两栏 + 英文占位「如 DENG Tao（姓全大写 + 名首字母大写）」）
- [x] CustomerForm + QuickPersonCreate 两栏化（至少填一个名；Enter/Esc 行为保持）
- [x] api/customers 搜索 or() 扩到 chinese/english；排序沿用 full_name
- [x] 全站显示点替换（25 文件）：CaseForm 参与人/CaseJoinPicker/CustomerActionsMenu/SummaryBand/
      RelatedCasesCard(chips/排序/筛选)/PaymentEntryForm/RecordPaymentForm/PaymentPlanForm/
      useFinance/useCustomerFinance/caseFees/cohab/trt/archive/checklist/casesTable/dashboard/family/
      CaseFormPage/ArchivePage/RecycleBin/CustomerDetailPage/CustomerListPage/GroupManagementPage
- [x] 测试更新（姓名→中文名/英文名）+ 新增显示点集成测试（详情头+chip / 账目行 / 进度表行）
- [x] 全量验证：vitest 979/979 绿，tsc -b 0 错，eslint 0 错
- 待用户操作：Supabase SQL Editor 跑 0038_immi_accounts.sql 与 0039_customer_names.sql
- 备注：familyMember.ts/addFamilyMember 无 UI 引用（遗留），按不变量未动

## Session 2026-06-13（三）：全站 UI/UX bug 批量修复
- [x] 新增 `components/ui/useConfirm.tsx`（Promise 版统一确认弹窗）+ 测试；ConfirmDialog Esc 改 document 监听
- [x] 🔴 记账▾ 菜单去冗余（记应收/记收款/创建付款计划 三标签→「应收/收款」单项）
- [x] 🔴 删款项/阶段/分期/收付款/支出/归档文件 全部补统一确认弹窗（替散落 window.confirm）
- [x] 🔴 金额 >0 统一校验：PaymentEntryForm/PaymentsPanel/PlanItemsTable/PlanInstallments/InstallmentsPanel/PayablePanel
- [x] 🟠 方向配色统一：MonthlyLedgerTable 付主代理=amber/付介绍人=violet（对齐 PaymentsPanel/ExpensesPanel/pillTones）
- [x] 🟠 PaymentsPanel 切方向清 installmentId 且非 from_client 不写
- [x] 🟠 日期 input onChange 不再中途关编辑器（StageTimeline/RecordsSection 改 onBlur 关）
- [x] 🟠 LodgementForm DHA 天数正整数守卫 + 「更新于」max=今天
- [x] 🟠 DocumentForm 至少需文件/到期日/标签之一
- [x] 🟠 RecordsSection group 作用域 ol→li（悬停只亮本行删除）
- [x] 🟠 CustomerForm Esc/取消 脏检查确认；ReferrerListPage ?kind= 以 URL 为唯一源
- [x] 🟡 ExpiryBadge/状态：待上传=中性灰，与即将到期黄区分
- [x] 🟡 触控目标 sweep：StarToggle 36→44、min-h-9→min-h-11（7 文件）、BottomTabBar 标签防挤、DocumentsSection h-9→h-11 + aria-label
- [x] 全量验证：vitest 983 绿、tsc -b 0 错、eslint 0 错、build 通过
- 误报未动：Toaster 自动消失（store 已有 setTimeout）、407 担保字段（有意设计，反更新 CLAUDE.md）
- 未改（评估后）：Dashboard 案件行嵌套 role=link（功能正常，纯语义；重构风险>收益）

## Errors Encountered
- ReferrerListPage 用 useEffect+setKind 同步 URL → eslint react-hooks/set-state-in-effect 报错；改为「URL 唯一数据源 + setSearchParams」无 effect 方案
- Customer Row 加字段后 10 个全字段工厂 fixture 类型错 → 补 chinese_name/english_name: null
