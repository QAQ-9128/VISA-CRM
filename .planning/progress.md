# Progress Log

## Session 2026-06-05 · 案件进度获批显示 + 距今统一绿
- [x] RED→GREEN：lib/approval（提名获批/签证获批判定，绑定阶段枚举）+ CaseRow.nomApproved/visaGranted + WaitCell/MilestoneCard 获批标签
- [x] 距今/已过时间统一 emerald-700(#357a52)，删 amber/rose/灰分级；「—」用 text-faint
- [x] 纯签证案件下签不冒充「提名获批」（提名证据门控：有提名递交日或历史出现提名获批）
- [x] 83 文件 723 测试全绿；tsc/lint 干净；build 505ms

## Session 2026-06-05 · 概览重做（精简 5 块）
- [x] RED：stageColors 六色断言 + countOwingCustomers + DashboardPage.test.tsx 11 测试（14 失败确认）
- [x] GREEN：domain 六阶段色 / dashboardView.countOwingCustomers / Donut(mockup 几何) / Avatar radius / ChecklistCard 重排(notice 插槽) / DashboardPage 重写 5 块
- [x] 测试断言修正：『户欠款』子串撞上『客户欠款总额』→ 改 /\d+ 户欠款/
- [x] 全量：81 文件 706 测试全绿；tsc -b 干净；eslint 干净；build 526ms
- [x] 截图目检 overview-desktop2x.png vs 概览-精简案件优先.png：五块对位、阶段六色、角标、浅绿到期条、欠款底行全部一致

## Session 2026-06-05 · 月度账目页 mockup 重做（已完成，见上一轮）
- 全绿；溢出伪象坑与 Tailwind 扫描假死坑均已记忆。

## Errors Encountered
- RTL 子串断言撞车：queryByText('户欠款',{exact:false}) 命中『客**户欠款**总额』→ 用带数字的正则。
