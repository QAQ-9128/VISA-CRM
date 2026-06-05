# 交接:财务页(近期案件应收 · 图一式上半部 + 分阶段/分期 + 月度账目)

## 目标
重做**财务页**(`src/pages/finance/FinancePage.tsx` 及 `components/finance/*`、`components/payments/*`),UI/UX 升级,**不删任何功能**。上半部「近期案件应收」按新参考(统计卡 + 工具条 + 总进度/分期进度/下一期 富表)重做;**底部保留「合计」总额行 + 「查看全部应收(共 N 行)」点击展开**;下半部「月度账目」沿用。

预览:打开 `design_files/preview.html`(默认进财务页,展开「张伟」看 分阶段→分期)。**高保真**。组件见 `crm-app.jsx` 的 `FinancePage / RecRow / FStat / StagePanel / StageRow / RecMenu / PayCell`;样式见 `crm-app.css`(`.fstat / .dots / .fbar / .fsel / .tbl / .totbar`)。

## About the Design Files
HTML/JSX 参考稿,非上线代码。在现有栈用既有 hooks(`useFinance` / `payments.ts`)复刻,逻辑/字段/提交/权限不变。

---

## 上半部 · 近期案件应收(按参考图重做)

1. **标题区**:大标题「近期案件应收」+ 副「支持分期收款管理 · 快速查看总进度、分期进度与下一期安排」。
2. **4 张统计卡(`FStat`,彩色圆标 + 标签 + 大数字)**:
   - 总应收(蓝 `#3b6bff`,banknote)= Σ应收;已收款(绿 `#10b981`,wallet)= Σ已收;待收款(橙 `#f59e0b`,clock)= Σ欠款;欠款客户(紫 `#8b5cf6`,users)= 欠款客户数。
3. **工具条**(独立卡):搜索客户/案件号 · 月份选择(本月 2026年06月 ▾)· 全部状态 ▾ · 右侧「导出」。接现有筛选/搜索逻辑。
4. **富表(`RecRow`)**,列:
   - **客户**:头像 + 姓名 + `合并`/`主申`/`副申`标签。
   - **案件**:签证类别(482/500…)。家庭副申用缩进 + `└─`(沿用现有)。
   - **总进度**:`已收 / 应收`(绿/灰)+ 绿色进度条 + 百分比。
   - **分期进度**:实心/空心圆点(已付期数填实)+ `x/N 期`;无分期显「未设置」。
   - **下一期**:下一期名称(如「律师费第 3 期」)+ 到期日;逾期显红色「已逾期 N 天」;已结清/无显 `—`。
   - **状态**:`待收`(琥珀)/ `逾期`(红)/ `已结清`(绿)/ `未设应收`(灰)。
   - **操作**:按状态/能力给 `记账 / 跟进 / 查看 / 设置`;有分阶段的行点击可**展开「分阶段收费」面板**(`StagePanel`)。
5. **底部(保留,勿删)**:
   - 表尾 **「合计」行**:Σ已收 / Σ应收 + 欠款总额 Pill。
   - **「查看全部应收(共 N 行,还有 M 行)」**点击展开/收起全部行(不是分页;用户要点击展开看全部 + 永远显示合计)。

### 展开:分阶段收费 → 分期(保留)
点有分阶段的行 → 行下内嵌 `分阶段收费` 面板:`☑ 分阶段收费` + 说明、阶段子表(阶段名 + `分 N 期 ▾` + 每期金额·共N期 / 已付·应收 / 未付·状态 / 记账···)、阶段可再展开到**分期节点**(第N期 · 到期日 · 金额 · 状态:已付/待付/逾期未付)、阶段「合计」、`+ 新增阶段`。对应 `payment_plans → plan_items → installments → payments`。

## 下半部 · 月度账目(沿用)
月份切换(‹ ›+全部)· 本月总收款/总支出/净额 · 收款明细(客户付款,已收合计)· 支出(付主代理/付介绍人小计 + 加支出)· 空状态。

## 必须保留的功能(勿删)
统计卡 · 搜索/月份/状态筛选 · 导出 · 客户/案件/总进度/分期进度/下一期/状态/操作 · 合并/主副申标签 · **合计行** · **查看全部应收(点击展开)** · 分阶段收费(plan_items)· 每阶段分期节点(installments,逾期)· 新增阶段 · 记账下拉 · 月度账目全部子项。

## Tailwind v4 速查
- 统计卡:`flex items-center gap-3.5 bg-white border border-line rounded-[18px] p-4 shadow-sm`,圆标 `w-12 h-12 rounded-full grid place-items-center text-white`(底色按上)。
- 进度条:`h-2 rounded-full bg-line-2` 内 `bg-emerald-500`;百分比 `text-xs font-bold`。
- 分期圆点:`w-2.5 h-2.5 rounded-full bg-line-2`,已付 `bg-emerald-500`。
- 状态 Pill:待收 amber / 逾期 rose / 已结清 emerald / 未设应收 slate(50 底 + 600 字)。
- 工具条选择器:`h-11 px-3.5 border border-line-2 rounded-xl`。

## Files
- `design_files/preview.html` — 默认进财务页。
- `design_files/crm-app.jsx` — `FinancePage / RecRow / FStat / StagePanel / StageRow / PayCell / RecMenu` + `FIN`(receivables[].{billed,received,owe,paid,total,next,status,op,stages[].inst[]})。
- `design_files/crm-app.css` — 财务样式段。

## 施工建议
1. 用现有 `useFinance` + `payments.ts` 取应收/计划/明细/分期/收付款。
2. 上半部按参考图重排(统计卡 + 工具条 + 富表),底部保留合计行 + 查看全部(点击展开)。
3. `RecRow` 展开渲染 `StagePanel`,`StageRow` 再展开渲染 installments。
4. 自检:对照「必须保留的功能」逐项核对,仅 UI/UX 变化。
