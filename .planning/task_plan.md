# Task: 概览/首页按 mockup 重做（精简 5 块、案件进度优先）

## Objective
DashboardPage 按 概览-mockup源.html 1:1 重排为 5 块；纯 UI，数据层/聚合零改动。

## Phases
- [ ] Phase 1（RED 先行）:
  - [ ] domain.stageColors.test.ts：断言 6 个 mockup 阶段色（todo #9ba59b / drafted #e0a23c / nomination_lodged #3f7cb5 / nomination_approved #36b3c2 / visa_lodged #7c6fd6 / granted #4e9a6b）
  - [ ] dashboardView.test.ts：countOwingCustomers（欠款户数 = clientOwes>0 的客户数）
  - [ ] DashboardPage.test.tsx（新建）：5 块齐全 / KPI 数值与 mock 一致 / 阶段计数逐一吻合 / 旧块缺席 / 空态 / 官方链接 target=_blank → immi.homeaffairs.gov.au / 逾期未付分期折进欠款总览底行
- [ ] Phase 2（GREEN）:
  - [ ] types/domain.ts CASE_STAGE_COLOR 六色对齐 mockup（其余阶段色不动；唯一性测试仍过）
  - [ ] lib/dashboardView.ts + countOwingCustomers
  - [ ] Donut.tsx：底环 #f1f6f1、中心字色 ink/faint、去圆角端点（mockup 平角）
  - [ ] Avatar.tsx：加可选 radius（mockup 头像 rounded-10），默认仍圆形
  - [ ] ChecklistCard.tsx：按 mockup 重排（输入框+添加 / 浅绿临近到期条 slot / titem 行），去掉关联下拉（mockup 无；存量关联 chip 照常显示）
  - [ ] DashboardPage.tsx 重写为 5 块；删 月度趋势柱图 / 星标客户 / 逾期未付款大卡 / 递交进度表 / 独立即将到期卡（折进清单顶条）
- [ ] Phase 3: test:run + tsc + lint 全绿；截图目检（dist CSS + 无头 Edge，注意 viewport meta / DSF / 最小窗宽坑）

## Constraints
- useDashboard / lib/dashboard.ts / api/* 不改（页面少用字段即可，hook 多算的字段保留）
- 删除块只去 UI：BarChart/StatCard/cards.tsx 文件保留（被测试/他处引用）
- 本月收款 / 欠款总额 / 阶段计数 改前=改后（同一 hook 字段直渲染）
- 色值全部用 mockup 给定（blue #3f7cb5 / blue-bg #e6edf7 无令牌 → 字面量）

## Success Criteria
- 概览恰好 5 块；全部数字真实派生；空数据优雅；全量验证绿
