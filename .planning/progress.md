# Progress Log

## Session 2026-06-06 · 快速建档弹窗 + 归属人（完成）
- [x] 0030 迁移：referrers.kind('referrer'|'owner') + customers.owner_referrer_id 外键（待用户在 Dashboard 执行）
- [x] OwnerSelect：Notion 式选择/创建 combobox（输入过滤/创建行/Enter 不冒泡提交/清空，6 测试）；useCreateOwner hook
- [x] QuickCustomerDialog：五字段小卡片（姓名/性别/生日/归属人/介绍人），lib/quickCustomer 锁五键无案件字段；成功跳客户详情
- [x] 入口（用户纠偏后）：原「新建客户」整页表单保留不动，概览+客户列表各加「⚡ 快速新建」额外入口
- [x] 介绍人页 pill 开关 介绍人/归属人（kind 过滤、新建带 kind、空态随 kind）；ReferrerForm 加类型 Select；ReferrerSelect 只列介绍人（kind 缺失防御=介绍人）
- [x] 编辑大表单关系区加 OwnerSelect；SummaryBand 概要带加「归属人」格（useReferrer 解析名）
- [x] 测试工厂批量补 owner_referrer_id/kind（9 文件）；765 测试全绿 / lint / tsc+build
- [x] 预览：page=quick（弹窗直渲染）/referrers；截图验收 弹窗/开关/概要带归属人 全部正确
- ⚠ 注意：新功能（建归属人/保存归属人字段）需先跑 0030 迁移；既有功能不受未迁移影响（kind 过滤均在客户端）

## Session 2026-06-05 · 视觉验收两观察项修复（完成）
- [x] 0 元行：selectFinanceReceipts/Payouts 过滤「金额 0 且无发票」的明细行（带发票的保留以便查看/编辑；负数冲红保留；合计本就 +0 不变）——TDD 2 测试，/finance 与客户页账目同享
- [x] 登录页对齐薄荷绿主题：logo 渐变改用侧栏同款 #4e9a6b→#2e6a48；「记住我」勾选框 accent-brand
- [x] 视觉复核截图：finance-fixed/login-final（裸 0 元探针不再出现，logo/勾选框/按钮全绿）；743 测试全绿 / lint / build

## Session 2026-06-05 · UI/UX 视觉验收（完成）
- [x] __preview__ 扩成全站多页预览：?page=dashboard|customer|finance|cases|archive|recycle + admin=0 staff 视角 + 归档泄漏探针种子（fetch 冻结防线上数据覆盖）
- [x] 无头 Edge 截 16 张（桌面 1320 / 移动 520 / 放大 2x），逐张目检：概览/账目/客户页/递交表/档案库/回收站 全部正常
- [x] 归档探针 3 项全部正确隐藏；本月收款两页同口径 1,500（排除归档 8,888）；staff 视角彻底删除/回收站全消失
- [x] 发现 2 条小观察：0 元发票载体付款会作为 0.00 收入行出现在账目明细；登录页 logo 紫蓝色与全站薄荷绿主题不一致
- [x] build/lint 收尾全绿；Edge 临时 profile 已删

## Session 2026-06-05 · 审计修复五批（全部完成）
- [x] 批1：D-1 checklist 死链→/customers/:id?case=（测试改断言）；E-1 搜索 .or() 双引号包裹+转义（5 组特殊字符测试）；E-2 七处 todayStr 改 todayYmd（PayablePanel 假时钟测试锁本地日）
- [x] 批2：C-1 selectExpiringDocs 增 caseById 维度（测试先行）；A-1 写 0029 迁移（drop trigger/function + UPDATE 兜底，不删列）+ scripts/count-parent-sync.mjs 只读统计（需用户带凭据跑）
- [x] 批3：G-3c deleteCustomer 末步 .select() 校验真删否则抛错（0 行测试）；G-3b 五处彻底删除按钮 isAdmin 门禁 + 档案库回收站 tab admin 专属 + 5 个 useDelete* hook 入口守卫（4 个新组件测试）；RPC 原子化=可行但需迁移，仅评估未做
- [x] 批4：删 caseRelationship/parentCase/BarChart/cards/StatCard（9 文件）+ joinFamilyNames/groupCodeOf/selectMyOpenTasks/sortPriorityCustomers/monthOverMonth/monthlyClientReceipts/selectLodgementProgressRows/selectCustomersWithOpenTasks/showReceiptsTrend 死导出 + useDashboard 6 死字段与 openTasks/lodgements 死查询 + useOpenTaskRecords/getOpenTaskRecords/keys.openTasks；A-3 familyLinks 链只报告未删
- [x] 批5：E-3 formatAmount 负零归整（测试）；B-5 负数付款夹0 parity 护栏测试；B-4 PaymentTab 复用 sumPaymentItemRows；B-3 debtTotals/customerDebts 对称传 visiblePayments（注释论证等价）；C-3 核验为已有兜底（渲染层 displayCustomerName/（未知客户）+ selectCaseRows 参与人顶位），零改动
- [x] 终态验证：87 文件 741 测试全绿 / lint 0 / tsc+build 514ms（测试数 783→741 = 删除死代码测试 −48 + 新增 +6）

## Session 2026-06-05 · 全站只读审计（完成，未改任何代码）
- [x] test:run 775 全绿 / lint 0 / tsc+build 531ms
- [x] 6 个并行只读审计代理（A–E、G）+ F 类自查全部完成
- [x] 顶级发现逐条人工核验（checklist 死链、.or() 注入、0021 触发器、7 处 toISOString、selectExpiringDocs、deleteCustomer 部分写）均属实
- [x] 汇总：🔴×2（待办清单案件死链 / 客户搜索 .or() 特殊字符破坏）🟠×5（DB 同步触发器残留 / 概览到期卡泄漏归档案件文件 / staff 删客户静默部分写 / 删除按钮无角色门禁 / 7 处 UTC 默认日期跨月）🟡×8 🔵×9
- [x] 报告已交用户，等点名再修

## Session 2026-06-05 · 归档可见性收口（完成）
- [x] 审计全站归档泄漏点（findings.md）：3 个要修，其余已核实走 visibleCaseIds/跳过未知 id 口径无泄漏
- [x] 档案库：selectArchiveFiles 隐藏归档客户/归档案件名下的文件与发票（TDD 4 测试；纯 selector，零新查询，恢复即自动回来）
- [x] 档案库客户筛选下拉只列在册客户（useArchiveFiles 返回前过滤）
- [x] 概览 KPI 本月收款/环比/近6月改用 visiblePayments，与 /finance 同口径（之前归档案件的款泄漏进概览且两页数字不一致）
- [x] 决策：客户详情页挂在已归档案件上的文件保留（文件属于在册客户，且 documentsView 不显示案件信息）
- [x] 验证：90 文件 775 测试全绿 / lint / tsc+build 529ms

## Session 2026-06-05 · 全面找虫（进行中）
- [x] e2e 探针（用户跑的）：数据层 11/11 全通 → 「加入案件」真凶=未选案件默默存独立客户（已修防呆）；「档案库找不到」=当时上传根本没落库（库里仅探针 1 文件），现失败必弹 toast
- [x] 档案库类型列只显「发票」；筛选简化 全部/仅发票
- [ ] 4 个找虫代理后台扫描中：财务金额 / 客户案件表单 / 记录文件档案 / hooks 路由机制
- [ ] 代理发现 → 人工验证 → 修复 → 全量回归

## Session 2026-06-05 · 五个用户反馈修复
- [x] 新建客户「加入已有案件」排除归档客户的案件（visibleCaseIds 过滤）
- [x] 档案库「关联到」修复：名字解析改用含归档的客户/案件全量（之前用在册列表，归档后变（未知客户））
- [x] 阶段日期禁未来：StageControl + StageTimeline 行内编辑（max 属性 + isFutureYmd 兜底 + toast）
- [x] 待办截止禁过去 / 跟进记录日禁未来：CaseTodosCard + RecordsSection（新建表单 + InlineDate min/max/rangeError）
- [x] 上传 20MB 限制：lib/upload 单一事实来源，api uploadFile 咽喉强制（全部上传入口覆盖），DocumentForm 选中即校验 + 提示文案
- [x] 新 lib：dateRules.ts / upload.ts 带测试；751 测试全绿 / tsc / lint / build 643ms

## Session 2026-06-05 · UX 四批改进（全部完成）
- [x] 批1：toast 系统（store/ui + Toaster + queryClient MutationCache 全局挂钩：失败一律红 toast 带真实错误；成功按 meta.success 选择性弹）；39 个 mutation 挂了成功文案；「保存并新建案件」「保存并记账」分支按钮 + goto=fees 自动滚到费用卡
- [x] 批2：ConfirmDangerDialog（彻底删除客户=输姓名 / 删案件=输「删除」）；KPI 四卡可点（/cases /finance + 页内锚点）；客户搜索支持案件号（caseNumberMatchedCustomerIds 客户端并集，api 零改动）
- [x] 批3：客户详情移动端 sticky 锚点条（概要/案件/费用）；进度表首列移动端粘性（横滚保留案件号）；CaseFeesCard 参与人组头真折叠（折叠时显 N 项·未收 X）
- [x] 批4：「待递交」签证列对称标注；清单 ✕ 按钮 32px 点击目标；window.alert 全部替换为 toastError；RecordsSection alertErr 删除（全局接管）
- [x] 已核实为误报不改：表单 pending 态（本就有）；5 字截断是既定规格
- [x] 验证：87 文件 745 测试全绿 / tsc / lint / build 607ms

## 坑
- PS5.1 数组 @(@(a,b)) 单元素时被展开成扁平数组 → 批量编辑脚本把 useCaseApplicants.ts 写坏，git checkout 恢复后用 Edit 工具重做。多元素嵌套数组无此问题。
- react-hooks/set-state-in-effect：对话框「打开时重置输入」不要用 effect，把内层拆成 open 时才挂载的子组件，useState 初始值天然重置。
