# Findings — 归档可见性审计（2026-06-05）

## 泄漏点（要修）
1. **档案库文件列表**（主诉求）：`selectArchiveFiles` 不看归档状态——归档客户/归档案件名下的文件与发票照常显示。maps 来自 includeArchived 全量（名字解析需要），但行本身没过滤。
2. **档案库客户筛选下拉**：`useArchiveFiles` 返回的 `customers` 是含归档全量 → 下拉里能看到归档客户。
3. **概览 KPI「本月收款/环比/近6月」**：`useDashboard` 用 `payments.data` 原始全量（含归档案件的款）；而月度账目页 `useFinance` 用 visibleIds 过滤 → 两页数字会对不上，且归档案件的钱泄漏进概览。

## 已核实无泄漏（不动）
- 概览/财务/案件表/新建客户加入案件：都走 `visibleCaseIds`（一案一组口径）✓
- `selectExpiringDocs`/`selectMyOpenTasks`/`selectLodgementProgressRows`/`selectOverdueInstallments`/`selectCustomerDebts`：customer/case 查不到（=归档）即跳过 ✓
- 待办清单 `selectVisibleChecklist`：已有归档隐藏 + 测试 ✓
- 归档客户详情页：`getCustomer` 带 `is_archived=false` → 打不开 ✓
- Employer/Referrer 下拉：list 默认排除归档 ✓；GroupManagementPage 用 `useCustomers({})`（在册）✓
- `useFinance`/`useCustomerFinance` referrers includeArchived：仅名字解析（付给已归档介绍人的历史款显示名字），不是展示归档实体本身 ✓
- archiveCustomer 级联：归档客户 = TA 参与的所有案件一并归档（2026-06-05 拍板）→「客户归档但案件在册」常态下不存在，仅回收站单独恢复案件会出现

## Decisions
- 档案库隐藏规则：文件 → 客户归档 OR 所挂案件归档 即隐藏；发票 → 案件归档 OR 案件客户归档 即隐藏。纯 selector 过滤，零新查询（maps 本就含 is_archived）。
- 客户详情页里挂在已归档案件上的文件**保留**：文件属于在册客户本人，展示的不是归档实体；且 documentsView 根本不显示案件信息。
- 概览 KPI 改用 visibleIds 过滤的 payments，与 /finance 同口径。

## Open Questions
- 无
