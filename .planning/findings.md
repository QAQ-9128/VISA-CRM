# Findings

## Key Discoveries
- 设计令牌已全局存在（src/index.css @theme）：mockup 的 --green/--coral/--line 等与现有 brand/rose/line 令牌一一对应；body 背景渐变与 mockup 完全相同 → 页面无需自带背景。
- `--font-serif` 已配置中文宋体栈（零网络依赖），衬线标题直接 `font-serif`。
- useFinance(month) 已提供 receipts(from_client 明细+total)、payouts(to_company/to_referrer 明细+两组 total)，全部出自 lib/finance.ts 现有 selector——新页面只消费，不再求和。
- PayoutItem 无 visaSubclass（收入行有）→ 支出行 tag 需要 hook 增派生 map visaByCaseId（visibleCases 客户端派生，零新查询）。
- to_company 没有"主代理公司名"字段 → 支出行名称用真实 customerName（该案客户）；to_referrer 用 referrerName。mockup 里的公司名是虚构示例数据。
- 「开票应收/已收率」无真实月度口径来源 → 按任务要求整行省略。
- 「较上月」可真实派生：visiblePayments 全量在手，filterPaymentsByMonth(shiftMonth(month,-1)) + 现有 selector。
- 记收款/加支出/编辑/发票等操作入口在客户详情 CustomerPaymentsSection（内嵌 MonthlyLedgerTable）仍完整保留，财务页移除不丢功能。
- FinanceReceivablesTable / MonthlyLedgerTable / financeRows.ts 仍被 CustomerPaymentsSection 引用，不能删文件，只从 FinancePage 解除引用。

## Decisions Made
- 净额/小计完全引用 selector 输出（receipts.total / payouts.toCompanyTotal / payouts.toReferrerTotal），新 lib 只做恒等式算术 + 格式化 + 分组，附对账 parity 测试。
- 月份 pill 不再提供「全部」模式：新页 month 恒为 'YYYY-MM'（mockup 即如此）；MonthSelector 组件不动（客户详情还在用）。
- 非当前月时 KPI/净额条文案前缀「本月」→「当月」，月份 pill 的「本月」chip 只在当前月显示。
- 收入行小字 = [feeCategory, note] join '·'，兜底付款方式标签；支出行小字 = note 兜底付款方式标签——全为真实字段，永不为空。

## Open Questions
- 无。
