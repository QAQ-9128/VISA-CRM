# Task: 审计修复五批（用户点名）

## Objective
按用户挑选顺序修复审计发现：批1 日常崩+护账目 → 批2 架构残留 → 批3 删除安全 → 批4 死代码 → 批5 🔵安全清理。每批 TDD + 全量验证后进下一批。

## Phases
- [x] 批1：D-1 checklist 死链→/customers/:id?case=、E-1 搜索 .or() 转义、E-2 七处 todayStr→todayYmd（各补测试）
- [x] 批2：A-1 ①只读报告 parent_sync_progress=true 行数 ②新前向 migration drop trigger/function（不删列，UPDATE 兜底）；C-1 selectExpiringDocs 传 caseById 过滤归档案件（补测试）
- [x] 批3：G-3b 彻底删除按钮 admin 门禁（/storage RoleRoute + isAdmin 隐藏 + handler 守卫）；G-3c deleteCustomer 末步 .select() 校验真删，(c) RPC 仅可行性评估
- [x] 批4：删死代码 A-2 caseRelationship / A-4 parentCase+joinFamilyNames+groupCodeOf / D-2 BarChart+cards+StatCard / D-3 useDashboard 六死字段+死查询；A-3 familyLinks 只报告不删
- [x] 批5：E-3 formatMoney -0 归整 / B-4 PaymentTab 复用 sumPaymentItemRows / B-5 负数 parity 测试 / B-3 computeDebtTotals 传 visiblePayments / C-3 进度行客户名兜底
- [x] 每批：test:run / lint / build 全绿 + 批内专测

## Constraints
- 🔒 账目算法/数据层不改（B-3 只换输入且改前=改后对账）；仅批2 A-1 允许 schema 变更且只 drop 旧触发器/函数
- 不回退：案件即组 / 删与其他案件关系 / 参与人下拉 / 财务只留月度账目 / 月度账目重做 / 概览重做 / 距今→获批
- A-3 家庭组相关存疑代码：报告，不删；RPC（G-3c-c）：只评估，不实现

## Success Criteria
- 五批全部全绿交付，每批附改动文件清单与专测结果
