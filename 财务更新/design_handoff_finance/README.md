# 交接:财务页(应收 · 分阶段收费 · 分期 · 月度账目)

## 目标
重做**财务页**(`src/pages/finance/FinancePage.tsx` 及 `components/finance/*`、`components/payments/*`),提升 UI 与 UX,**保留现有全部功能,一个都不删**。核心是把账目层级 **付款计划 → 款项明细(阶段)→ 分期节点 → 实收实付** 在一条应收里以「展开」方式完整呈现,同时界面保持干净。

预览:打开 `design_files/preview.html`(默认进财务页)。**高保真**,按数值还原。组件见 `crm-app.jsx` 的 `FinancePage / RecRow / StagePanel / StageRow / RecMenu / StatusCell / PayCell`;样式见 `crm-app.css`(`.tbl / .totbar / .phase-tag / .mtag / .txn` 等)。

## About the Design Files
HTML/JSX 参考稿,**非上线代码**。在现有栈(React 19 + TS + Tailwind v4 + TanStack Query + Supabase)里用既有 hooks(`useFinance` / `payments.ts`:`getPaymentPlanByCase`、`getAllPlanItems`、`listInstallments`、`listPaymentsByCase` 等)复刻,**逻辑、字段、提交、权限不变**。

---

## 页面结构(两张卡)

### 卡 1 · 近期案件应收(`pad=false`)
- 头部:标题「近期案件」+ 右侧弱说明「这里是当下应收状态,与下方月份筛选无关」。
- 表头:**客户·案件 | 已付 / 应收 | 未付 / 状态 | 操作**。
- 每行(`RecRow`):
  - 客户·案件:头像 + 姓名(蓝色可点进案件)+ `合并` 标签 + `· 签证`;若有分阶段,显示 **`分 N 期 ▾`** 紫色标签(点击展开)。
  - 已付/应收(`PayCell`):`已付`(绿,粗)`/ 应收`(灰),tabular。**不要进度条/KPI 条**(保持整洁)。
  - 未付/状态(`StatusCell`):`未设应收`(无应收时,灰)/ `欠 AUD X`(红)/ `已结清`(绿)。
  - 操作:有分阶段 → `展开/收起`;否则 → **`记账 ▾`** 下拉(`RecMenu`,菜单项:记应收 / 记收款 / 创建付款计划 / 付主代理 / 付介绍人)。
- **展开行 = 分阶段收费面板(`StagePanel`)**,缩进于该行下方、浅底:
  - `☑ 分阶段收费` 勾选 + 说明「按阶段/里程碑收费(阶段名·应收金额·期数·总计),如 意向金 5000×1、递交签证 80000×1。」
  - 阶段子表(`StageRow`)。表头:**阶段名 | 已付/应收 | 未付/状态 | 操作**。每个阶段(= `payment_plan_item`):
    - 阶段名 + 若期数>1 显示 `分 N 期 ▾`(可再展开)+ 副行「每期 AUD X · 共 N 期」。
    - 操作:有分期 → `分期/收起`;`记账` + `···`。
    - **再展开 = 分期节点(`installments`)**:每行 `第 N 期` + `到期 日期`(逾期红)| 金额 | 状态 Pill(已付绿 / 待付琥珀 / 逾期未付红)| 已付显 ✓,否则 `记收款`。
  - 阶段「合计」行;底部 `+ 新增阶段`。
- 卡底:**`查看全部应收(共 N 行,还有 M 行)`** 展开链接。
- 表尾「合计」行(已付/应收 + 欠款汇总)。

### 卡 2 · 月度账目(`pad=false`)
- 头部:标题 + 右侧月份切换:`‹` `[📅 2026年06月]` `›` `[全部]`(`全部`选中=主色,清空月份筛选)。
- 三张总计卡(`.totbar`):`本月总收款`(绿)/`本月总支出`(琥珀)/`净额`(负数转红);选「全部」时标题去掉「本月」。
- 两栏:
  - **收款明细(客户付款)**:右上「已收合计 AUD X」;列表(头像 + 姓名·费用 / 日期·方式 / +金额绿);空 → 「暂无收款记录」。
  - **支出/付款(付主代理·付介绍人)**:右上 `+ 加支出`;小计「付主代理合计 / 付介绍人合计」;列表(图标井 + 标签 / 日期·方式 / −金额红;付介绍人用紫色井);空 → 「暂无支出记录」。

## UX 要点(整洁优先)
- 去掉任何花哨装饰:**无进度条、无 KPI 速览条**,信息靠层级与留白。
- 三层「展开」共用同一种交互(箭头标签 + 展开/收起链接),不引入弹窗,保持上下文。
- 金额一律 `formatMoney`,`tabular-nums`;颜色语义统一(收/已结清=绿,欠/逾期=红,支出/待付=琥珀,付介绍人=紫)。
- 全部按 `domain.ts` 常量(费用类别、付款方向 `from_client/to_company/to_referrer`、付款方式)渲染,不硬编码。

## 必须保留的功能清单(勿删)
合并账单标记 · 已付/应收 · 未付/状态(含「未设应收」)· 记账下拉(记应收/记收款/付主代理/付介绍人/创建付款计划)· 合计行 · 查看全部应收(分页计数)· **分阶段收费(plan_items)** · 每阶段**分期节点(installments,到期日/状态/逾期)** · 新增阶段 · 月份切换 + 全部 · 三总计 · 已收合计 · 付主代理/付介绍人小计 · 加支出 · 空状态文案。

## Files
- `design_files/preview.html` — 默认进财务页,可展开张伟看「分阶段 → 分期」。
- `design_files/crm-app.jsx` — `FinancePage / RecRow / StagePanel / StageRow / RecMenu / StatusCell / PayCell` + `FIN`(数据结构:receivables[].stages[].inst[] / receipts / payouts / totals)。
- `design_files/crm-app.css` — 财务相关样式(`.tbl/.totbar/.phase-tag/.mtag/.txn/.tot`)。

## 施工建议
1. 用现有 `useFinance` + `payments.ts` 取应收/计划/明细/分期/收付款。
2. `RecRow` 展开渲染 `StagePanel`(plan_items),`StageRow` 再展开渲染 installments;无分阶段的客户仅显示 `记账▾`。
3. 月度账目接现有月份筛选与收付查询。
4. 自检:逐项对照「必须保留的功能清单」,功能与改造前一致,仅 UI/UX 变化。
