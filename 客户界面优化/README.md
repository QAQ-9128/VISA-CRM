# 交接:新建 / 编辑客户表单

## 目标
重做**客户表单页**(`src/pages/customers/CustomerFormPage.tsx`,组件 `src/components/customers/CustomerForm.tsx`),用统一设计系统提升可读性与填写体验。**字段、校验、提交、下拉选项、权限全部不变**,只换视觉。同一套规范适用于「新建客户」与「编辑客户」。

预览:浏览器打开 `design_files/preview.html`(直接显示表单)。**高保真**,按数值还原。

## About the Design Files
`design_files/` 是 HTML/JSX 参考稿,**非上线代码**。在现有栈(React 19 + TS + Tailwind v4 + React Hook Form/现有表单逻辑 + TanStack Query + Supabase)里用既有逻辑复刻。表单结构/控件见 `crm-app.jsx` 的 `CustomerFormPage` 与 `Check` 组件,样式见 `crm-app.css` 的「表单」段。

---

## 页面布局
- 顶部:返回链接 `‹ 客户列表`(`.back`)+ 页面标题 `新建客户` / `编辑客户`(在 AppShell 顶栏)。
- 主体:一张白卡 `.card`(`max-width:660px`,`padding:28px 30px`,圆角 24,`shadow-soft`),内部 `.form`(纵向 `gap:22px`)。

## 字段(顺序与现状一致,逻辑不变)
1. **姓名 `*`**(必填,text)— `客户姓名` 占位。标签带红色 `*`。
2. **客户来源**(select)+ 同行右侧 **优先客户(星标)** 勾选框。
   - 选项用 `domain.ts` 的 `CLIENT_SOURCE_OPTION_LABELS`:`未分类` / `⚫ 黑色(公司派的)` / `🟢 绿色(自己的)` / `🟡 黄色(帮别人擦屁股的)`。
   - 星标 = 自定义勾选框(选中蓝底白勾),对应 `is_starred`。
3. **担保雇主**(select `无 / 未指定` + 雇主列表)+ 右侧 **「+ 新建」**(`.btn-ghost`,沿用现有快速新建雇主流程)。
4. **担保职位**(text)— 占位 `如:Senior Cook、Marketing Manager`。
5. **介绍人**(select)+ **「+ 新建」**(同上,新建介绍人)。
6. **家庭组 / 主副申请人**(`fieldset.fset`,浅灰底分区):一个说明性小标题「作为副申请人挂靠到(留空 = 本人是主申请人)」+ select(`— 本人是主申请人 —` / 现有主申请人列表)。对应现有家庭关联逻辑。
7. **生日**(date)+ **性别**(select:未填/男/女/其他)— 两列并排 `.fgrid2`。
8. **备注**(textarea,多行,可纵向拉伸)。
9. 底部 **保存(主)/ 取消**,右对齐(`.fform-foot`)。**姓名为空时「保存」禁用**(`.btn[disabled]`,浅蓝不可点)。

## 控件规范(可读性核心)
- 标签 `.flabel`:13.5px / 600 / `--body`;必填星号 `--rose`。
- 输入/选择/文本域统一:**高 48px、圆角 14px、1px `--line-2` 边框、15px 字**;聚焦 → `border:--brand` + `box-shadow:0 0 0 3px --brand-100`。
- select 用自定义下拉箭头(去原生外观)。textarea `min-height:104px` 可拉伸。
- 行内组合(雇主/介绍人 + 新建按钮)用 `.frow`(flex + gap 10),按钮 `flex:none`。
- fieldset 用浅底 `--surface-2` + 1px 边,和主表单分区。
- 间距:字段之间 `gap:22px`;label 与控件 `gap:8px`。

## Tailwind v4 速查
- 卡:`max-w-[660px] mx-auto bg-white rounded-card shadow-soft p-7`
- field:`flex flex-col gap-2`;label:`text-[13.5px] font-semibold text-[color:var(--body)]`
- input/select/textarea:`h-12 rounded-[14px] border border-line-2 bg-white px-3.5 text-[15px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-100`(textarea 改 `h-auto py-3 min-h-[104px] resize-y`)
- 行内 + 新建:`flex gap-2.5`,按钮 `shrink-0 …(btn-ghost)`
- fieldset:`rounded-[18px] border border-line-2 bg-surface-2 p-[18px]`
- 两列:`grid grid-cols-2 gap-[18px] max-[640px]:grid-cols-1`
- 勾选框:`w-5 h-5 rounded-md border-2 border-slate-300 grid place-items-center [&.on]:bg-brand [&.on]:border-brand`
- 页脚:`flex justify-end gap-3 pt-1.5`;禁用主按钮:`disabled:bg-brand-100 disabled:shadow-none disabled:cursor-not-allowed`

## 交互 / 校验(不改)
- 必填:姓名;为空时禁用保存(沿用现有 RHF / zod 校验)。
- 下拉数据:雇主 `useEmployers`、介绍人 `useReferrers`、主申请人候选用现有 hooks。
- 「+ 新建雇主/介绍人」沿用现有弹窗/内联新建流程。
- 提交:`useCreateCustomer` / `useUpdateCustomer`,成功后回客户列表(沿用现有跳转)。
- 编辑态:同一表单预填现有值,标题改「编辑客户」。
- 过渡仅 `transition`(150ms);移动端字段全宽,两列降为单列。

## Files
- `design_files/preview.html` — 直接打开即表单。
- `design_files/crm-app.jsx` — `CustomerFormPage` + `Check`(勾选框)。
- `design_files/crm-app.css` — 「表单」样式段(`.field/.flabel/.finput/.fselect/.ftext/.fset/.fcheck/.fform-foot`)。

## 施工建议
1. 先落表单控件类(input/select/textarea/checkbox)到你的 `ui/` 表单组件,全站表单复用。
2. 按上面字段顺序套到 `CustomerForm.tsx`,保留 RHF 字段名、校验、默认值、提交。
3. 选项用 `domain.ts` 常量,不要硬编码。
4. 自检:新建/编辑提交结果与改造前一致,仅外观变化。
