# 交接:签证 CRM 全站视觉重设计(在现有功能上"重皮肤" + 提升可读性)

## 一句话目标
**保留现有全部功能、路由、数据与交互逻辑不变**,只把全站的**视觉与可读性**升级到本包的统一设计系统(亮蓝主色、圆润大卡、分层柔和阴影、彩色渐变头像、清晰的层级与留白)。这是一次**重皮肤(restyle)**,不是重写功能。

> 适用范围:`src/pages/**` 下的**每一个页面**和 `src/components/**` 下的**每一个 UI 组件**。下面先给「全局设计系统」(一次定义、全站复用),再给「逐页改造清单」(覆盖你仓库现有的所有页面)。

---

## About the Design Files
`design_files/` 是用 HTML/JSX 做的**高保真设计参考稿**(可在浏览器打开 `design_files/preview.html`,左侧导航点开看「概览/客户/案件/案件详情/财务」),**不是要直接搬上线的代码** —— 它用的是普通 JSX + 一个 CSS 变量样式表,没有 Tailwind、没有 TS、没有接真实数据。

**你的任务**:在现有代码库(**React 19 + TypeScript + Tailwind CSS v4 + React Router v7 + TanStack Query + Zustand + Supabase**)里,用既有组件与数据 hooks,把每个页面的视觉改成这套系统的样子。**功能、字段、查询、提交、权限、路由统统不动**,只动 className / 结构层级 / 间距 / 颜色 / 圆角 / 阴影。

## Fidelity
**高保真**。已在 `design_files/preview.html` 里实现了 5 个页面(概览 / 客户列表 / 案件列表 / 案件详情 / 财务)作为**像素级参照**;其余页面(登录、客户详情、各类表单、雇主、介绍人、档案库、用户管理、404)**没有单独出图**,请套用同一套「全局设计系统 + 组件规范」保持一致。

---

# 一、全局设计系统(先做,全站基础)

## 1. Tailwind v4 主题令牌
Tailwind v4 用 CSS-first 配置。在全局样式(如 `src/index.css`)里加:

```css
@theme {
  /* 主色 —— 亮蓝(可整站一处切换;若要回品牌靛蓝改成 #4f46e5) */
  --color-brand:      #3b6bff;
  --color-brand-600:  #2f5cf0;
  --color-brand-700:  #264fd6;
  --color-brand-50:   #eef3ff;
  --color-brand-100:  #dbe6ff;
  /* 画布与表面 */
  --color-canvas:     #eef1f8;   /* 页面底色,让白卡浮起 */
  --color-surface-2:  #f7f9fd;   /* 卡内浅区 / hover */
  --color-line:       #eef1f6;   /* 卡内分隔 */
  --color-line-2:     #e6eaf2;   /* 卡描边 / 输入框 */
  --color-ink:        #172033;   /* 标题 */
  /* 圆角 */
  --radius-card: 24px;           /* 大卡 */
  --radius-ctl:  14px;           /* 输入/按钮内元素 */
  /* 阴影 */
  --shadow-soft:  0 10px 28px -14px rgb(28 40 75 / .28), 0 3px 8px -4px rgb(28 40 75 / .10);
  --shadow-brand: 0 14px 26px -10px rgb(59 107 255 / .5);
}
```
用法:`bg-brand` / `text-brand` / `bg-canvas` / `bg-surface-2` / `border-line` / `border-line-2` / `text-ink` / `rounded-card` / `shadow-soft` / `shadow-brand`。语义色直接用 Tailwind 自带 `emerald / rose / amber / sky / violet / indigo / teal / cyan`(数值已对齐你 `domain.ts` 的阶段色)。

## 2. 全局基调(从"扁平描边"升级为"柔和大卡")
| 维度 | 现状 | 改为 |
|---|---|---|
| 页面底色 | `slate-50` | `bg-canvas`(#eef1f8) |
| 卡片 | `rounded-xl border border-slate-200`(无阴影) | `rounded-card bg-white shadow-soft`(去边框,用阴影分层) |
| 卡片内边距 | `p-4` | `p-[22px]`(移动 `p-4`) |
| 区块间距 | `space-y-3/4` | `space-y-5`(20px) |
| 标题 | `text-xl font-semibold` | `text-2xl font-bold text-ink tracking-[-0.02em]` |
| 头像 | 无(首字纯色或无) | 渐变头像组件(见 §3) |
| 主按钮 | `bg-indigo-600` | `bg-brand shadow-brand rounded-full hover:bg-brand-600` |
| 圆角节奏 | xl(12) | 卡 24 / 控件 14 / 徽章 full |

**可读性专项**(这是本次重点):
- 加大**字号与行高对比**:正文 14px、次要信息 12–13px 用 `text-faint`;标题 24/16 加粗。别让所有文字挤在 `text-sm`。
- 用**留白和分隔线**(`border-line`)而不是密排;列表行高 ≥ 48px(`min-h-12`)。
- 关键数字用 `tabular-nums` + 加粗 + 变大;金额按状态着色(欠款 `text-rose-600`、已收/已付清 `text-emerald-600`、付主代理/付介绍人 `text-amber-600`)。
- 每个区块一个**清晰的卡头**(标题 16/700 + 可选副标题 12.5/`faint` + 右侧操作链接)。

## 3. 原子组件(在 `src/components/ui/` 下新建或改造,全站复用)
> 逻辑/取值请参考 `design_files/crm-shared.jsx`(`Icon/GLYPH`、`Avatar`、`NameCell`、`Pill`、`Well`、`Donut`、`Gauge`、`BarChart`、`Spark`)与 `crm-app.jsx`。把内联样式翻成 Tailwind、补 TS 类型。

- **Avatar / NameCell**:圆形,首字白字(字号≈尺寸×0.4),底为按姓名 hash 选的渐变;投影 `shadow-[0_4px_10px_-4px_rgba(23,32,51,.4)]`。渐变 8 套见 `crm-shared.jsx` 的 `GRADS`。全站凡是显示"人"的地方(客户行、案件客户、收款人)都用它。
- **Pill / StageBadge**:圆角 full、`px-[11px] py-1 text-xs font-semibold`,底/字用语义 50/600。**`StageBadge` 直接复用你 `domain.ts` 的 `CASE_STAGE_LABELS`**,色调映射:todo→slate、drafted→amber、nomination_lodged→blue、nomination_approved→cyan、visa_lodged→indigo、docs_requested→amber、docs_completed→teal、granted→emerald、refused→rose、appeal→violet、withdrawn→slate。
- **Well(图标井)**:`w-[50px] h-[50px] rounded-[16px] grid place-items-center`,浅色底 + 同色描线图标(语义 50 底 + base 线)。用于统计卡、列表项图标、空状态。
- **Card**:`bg-white rounded-card shadow-soft p-[22px]`;卡头组件 = 标题 16/700 + 副标 + 右侧 `link`。
- **Button**:主 `bg-brand text-white rounded-full h-[46px] px-5 font-semibold shadow-brand`;次 `bg-white border border-line-2 text-ink rounded-full shadow-[0_1px_2px_rgba(23,32,51,.05)]`;ghost 透明 hover `bg-surface-2`。改造你现有的 `ui/Button`。
- **图标**:沿用你现有 `src/components/ui/icons.tsx`(24×24 / stroke 1.8);缺的按同风格补,**不要引入图标库**。
- **状态组件**(`ui/states`:Loading/Error/Empty):空状态用大 emoji/Well + 标题 + 说明 + 主按钮,居中、`text-faint`,文案沿用现有(`暂无待办`/`还没有客户`/`加载中…`)。

## 4. 应用外壳(`src/layouts/`)
- **桌面(`md+`)**:左固定侧栏 `w-[232px]`,白底、右描边;品牌区(logo 渐变方块 + 名称)+ 分组导航。导航项 `h-11 rounded-[13px]`,**选中=亮蓝实心 `bg-brand text-white shadow-brand`**,hover=`bg-surface-2`;计数徽标红底白字。底部当前用户卡。
- **顶栏**:左为页面标题(+ 副标),右为全局搜索(圆角 full 输入)+ 通知按钮(右上红点)+ 主操作按钮。内容区 `bg-canvas` 可滚动,内层用 `max-w-*` 居中(列表 920、详情 1040、概览 1280、财务 1040)。
- **移动(`<md`)**:沿用你现有底部 tab 栏,改成本系统配色(选中 `text-brand`,中间蓝色 `+` FAB)。所有核心流程在 375px 可用(保持你"移动优先"原则)。

参照 `design_files/crm-app.jsx` 的 `AppSidebar` / `AppShell`。

---

# 二、逐页改造清单(覆盖你仓库现有全部页面)

> 原则:**结构与数据照旧**,把容器换成卡、把文字分级、把状态着色、把人显示为头像、阶段用 StageBadge。下面每页给出"现状文件 + 改造要点";有 ⭐ 的在 `preview.html` 里有像素级参照。

### ⭐ 概览 `src/pages/DashboardPage.tsx` + `components/dashboard/*`
对照 preview「概览」。统计 4 卡(图标井 + 大数字 + 趋势标签)、案件阶段**环形图**(`Donut`,色取 domain 阶段色)、待办案件列表(头像 + StageBadge + 到期着色)、即将到期/TRT 提醒(图标井 + 天数 Pill)、月度收款**条形图**、递交进度表。`ChecklistCard` 改成卡内带勾选的记录样式。

### ⭐ 客户列表 `src/pages/customers/CustomerListPage.tsx`
对照 preview「客户」。家庭分组=一张大卡,主申一行、副申缩进并加 `└─` 连接线(`font-mono text-slate-300`);每行:`StarToggle`(改造成 9px 圆角按钮,选中 amber)+ **渐变头像** + 姓名(**按欠款着色**:`CUSTOMER_PAYMENT_TEXT_CLASS` → 欠款红 / 已付清绿)+ `ClientSourceDot`(黑/绿/黄,原样保留语义)+ `↗独立档案` 标签;副信息行:`签证 | 职位 | 担保雇主 | StageBadge`。顶部独立搜索条(圆角 full、48px 高)。

### ⭐ 案件列表 `src/pages/cases/CasesTablePage.tsx`
对照 preview「案件」。卡片包表格:列 客户(头像+stream)| 签证类别 | 担保雇主 | 当前阶段(StageBadge) | 最近更新 | ›。行 hover `bg-surface-2`、整行可点。顶部搜索 + 筛选按钮。保留现有筛选/排序逻辑。

### ⭐ 案件详情 `src/pages/cases/CaseDetailPage.tsx`(最核心)
对照 preview「案件详情」。标题区(签证类型 + 客户/雇主/职位副行 + 编辑按钮);TRT 提醒→`banner-warn` 横幅;`StageControl` + `StageTimeline` 两栏卡(阶段步进条 + 推进/回退按钮;竖向时间线带圆点轨);`LodgementSection`→递交卡(提名/签证,进度条 + 天数);`PaymentsSection`→**双流账目**(应收/已收/欠款 emerald 卡 + 应付/已付主代理 amber 卡 + 流水行,方向用 Pill:客户付款/付主代理/付介绍人,金额带正负色);`DocumentsSection`→文档行(Well + 名称 + 到期 Pill,临期 rose);`RecordsSection`→待办(勾选框)/ 跟进(emoji 标记)。关联主案件 🔗/📎、归档/删除按钮保留,套新按钮样式。

### ⭐ 财务 `src/pages/finance/FinancePage.tsx` + `components/finance/*`
对照 preview「财务」。`ReceivablesTable`→近期应收表(应收/已收/欠款列,欠款红、状态 Pill);`MonthSelector`→段控 tabs(本月/上月/全部);月度总计三卡(总收款 emerald / 总支出 amber / 净额);`ReceiptsList`(客户付款,头像 + 正金额绿)与 `ExpensesPanel`(付主代理 amber / 付介绍人 violet,负金额红)左右两栏。

### 登录 `src/pages/LoginPage.tsx`(无单独出图,套系统)
居中卡 `rounded-card shadow-soft`(可比内容卡更强阴影);顶部 logo 渐变方块 + 标题;输入框 `h-12 rounded-[14px] border-line-2 focus:border-brand focus:ring-2 focus:ring-brand-100`;主按钮 `bg-brand shadow-brand` 满宽。背景 `bg-canvas`。

### 客户详情 `src/pages/customers/CustomerDetailPage.tsx`(最大文件,套系统)
顶部:返回链接 + 客户头部卡(大渐变头像 + 姓名 + 来源点 + 星标 + 基本信息 grid:电话/邮箱/性别/雇主)。下分卡片区块:名下案件(每案 = 案件列表那种行,StageBadge)、家庭成员(头像堆叠/列表)、文档、待办/跟进、账目摘要。每个区块一张 `Card` + 清晰卡头。保留所有编辑/关联/快速加家庭成员操作,只换皮肤。

### 案件表单 `cases/CaseFormPage.tsx` · 客户表单 `customers/CustomerFormPage.tsx` · 雇主/介绍人表单 · 文档表单(套系统)
统一**表单规范**:外层 `Card`;字段纵向 `space-y-5`;`label` 13.5/600/`text-body`;输入/选择/`textarea` 统一 `h-12 rounded-[14px] border border-line-2 bg-white px-3.5 text-[15px] focus:border-brand focus:ring-2 focus:ring-brand-100`;分区用小标题 + 分隔线;底部操作右对齐(主「保存」+ ghost「取消」)。下拉里的 emoji/彩色圆点(客户来源、跟进标记)原样保留。

### 雇主 `employers/EmployerListPage.tsx` · 介绍人 `referrers/ReferrerListPage.tsx`(套系统)
列表卡:每行 Well/头像 + 名称 + 副信息(关联案件数/联系方式)+ ›。空状态用统一 Empty。

### 档案库 `archive/ArchivePage.tsx`(套系统)
同案件/客户列表的卡片+行式,行尾加「恢复」按钮;顶部说明条用 `banner`(中性/info 变体)。

### 用户管理 `admin/UserManagementPage.tsx`(套系统)
表格卡:用户(头像+邮箱)| 角色 Pill(admin/staff)| 操作。仅 admin 可见,逻辑不动。

### 404 `NotFoundPage.tsx`(套系统)
居中卡:大 emoji/图标 + 标题 + 返回首页主按钮。

---

## Interactions & Behavior(全站统一)
- 过渡仅 `transition-colors`(150ms);**不加**滑入/弹跳/滚动特效(保持产品克制感)。卡片不位移。
- hover:主按钮变深、行 `bg-surface-2`、链接深蓝、导航 `bg-surface-2`;选中导航=亮蓝实心。
- focus:输入框 `border-brand + ring-2 ring-brand-100`;tap 目标 ≥ 44px。
- 文案、空/错/加载态文字**全部沿用现状**(`加载中…`/`暂无待办`/`部分概览数据加载失败,请刷新重试`),不新造、不加营销腔。
- 金额走 `formatMoney`;时长用中文单位(`逾期 5 天`/`下签 22 个月`)。

## Design Tokens(精确值速查)
主色 `#3b6bff` / hover `#2f5cf0` / `#264fd6` / 50 `#eef3ff` / 100 `#dbe6ff`;画布 `#eef1f8`;卡内浅区 `#f7f9fd`;描边 `#eef1f6`、`#e6eaf2`;文本 标题 `#172033` / 正文 `#3a4458` / 次要 `#6b7589` / 占位 `#9aa4b8`。
语义(base):emerald `#10b981` · rose `#f43f5e` · amber `#f59e0b` · sky `#0ea5e9` · violet `#8b5cf6` · indigo `#6366f1` · teal `#14b8a6` · cyan `#0891b2`(深字各取 600/800)。
阶段色见上(对齐 `domain.ts`)。圆角:卡 24 / 控件 14 / 徽章 full。阴影:`--shadow-soft`(卡)、`--shadow-brand`(主按钮)。间距基数 4px;卡内 22、块距 20。字体沿用系统栈,字重 400/500/600/700。

## Assets
无外部图片/图标库。图标=内联 SVG(复用现有 `ui/icons.tsx`);头像=首字+渐变;图表(环形/条形/sparkline/半环仪表)=手写 SVG(见 `crm-shared.jsx`),可原样转 TSX。

## Files(本包源码)
- `design_files/preview.html` — 可点击的全站参考原型(浏览器直接打开,点左栏切页)。
- `design_files/crm.css` + `crm-app.css` — 全部设计令牌与组件样式(Tailwind 映射来源)。
- `design_files/crm-shared.jsx` — 原子组件 + 图表 + 图标。
- `design_files/crm-layoutA.jsx` — 概览页结构。
- `design_files/crm-app.jsx` — 外壳 + 路由 + 客户/案件/详情/财务页结构(各组件 props 与层级)。
- `design_files/crm-app-data.jsx` — 示例数据结构(对照你真实字段)。

## 建议施工顺序
1. Tailwind 主题令牌 + 全局基调(canvas/卡/按钮/输入)→ 立刻全站观感提升。
2. 原子组件(Avatar/Pill/StageBadge/Well/Card/Button/states)+ 外壳(侧栏/顶栏/tab)。
3. 高频页:概览 → 客户列表 → 案件详情 → 案件列表 → 财务(对照 preview 像素级还原)。
4. 其余页:客户详情 → 各表单 → 雇主/介绍人 → 档案库 → 登录 → 用户管理 → 404(套系统)。
5. 移动端逐页核对 375px。
6. 自检:每页功能(增删改查/筛选/提交/权限)与改造前完全一致,仅外观变化。
