# 交接:概览仪表盘重设计(Layout A · 经典栅格 + 环形图)

## Overview
本包是签证 CRM **「概览 / Dashboard」页**的视觉重设计(方向 A)。目标:把现有较扁平的概览页升级为参考图的「明亮工作台」质感 —— 亮蓝主色、圆润大卡、分层柔和阴影、彩色渐变头像、环形图。功能信息架构不变,仍是同一批数据模块,只是排布与视觉升级。

页面模块(自上而下):
1. 顶部问候栏(头像问候 + 搜索 + 通知 + 新建客户)
2. 概览统计卡 ×4(进行中案件 / 待办事项 / 本月收款 / 未付总额,带升降趋势)
3. 案件阶段分布(环形图 + 图例) ＋ 待办案件列表
4. 即将到期提醒 ＋ 月度收款条形趋势图
5. 递交进度表(带进度条)

---

## About the Design Files
`design_files/` 里的文件是**用 HTML/JSX 做的设计参考稿**(展示预期外观与行为的原型),**不是要直接拷贝进生产环境的代码**。它们刻意用了普通 JSX + 一个独立 CSS 变量样式表(`crm.css`),**没有用 Tailwind、没有 TypeScript、没有接真实数据**。

你的任务是:**在现有代码库(React 19 + TypeScript + Tailwind CSS v4 + React Router v7 + TanStack Query + Zustand + Supabase)里,用既有的组件/约定把这套设计 1:1 复刻出来**,而不是把这些 HTML 直接搬上线。下面的 Design Tokens 与组件规格给出了精确数值,Tailwind 映射一节给出了对应的 class。

预览参考稿:浏览器打开 `design_files/Dashboard-A.html`(已设为可独立打开)。

## Fidelity
**高保真 (hifi)**。颜色、字号、间距、圆角、阴影均为最终值,请按数值像素级复刻;数据请接你现有的 TanStack Query + Supabase 查询。

---

## 集成到现有框架的推荐路径

> 现有概览页大概率是一个路由组件(例如 `src/pages/Dashboard.tsx` 或 `src/routes/overview`)。本设计是**替换该页的渲染内容**,不动路由、不动数据层。

**步骤:**
1. **设计令牌**:把下方「Design Tokens」加入你的 Tailwind 主题。Tailwind v4 用 CSS-first 配置 —— 在全局 `@theme { … }` 里加自定义色板(亮蓝 `--color-brand-*`、柔和阴影、24px 卡片圆角),这样可直接用 `bg-brand`、`rounded-card`、`shadow-soft` 等类。见「Tailwind v4 主题」一节。
2. **基础组件**:在 `src/components/dashboard/` 下建一组小组件(`StatCard`、`Donut`、`BarChart`、`ListCard`、`Pill`、`Avatar`、`Well`、`ProgressBar`)。逻辑直接参考 `crm-shared.jsx` 与 `crm-layoutA.jsx`,把内联样式翻成 Tailwind class、把 props 加上 TS 类型。`Donut` / `BarChart` / `Spark` 是纯 SVG,可几乎原样照搬(只改成 TSX)。
3. **图标**:`crm-shared.jsx` 里的 `GLYPH` 是 24×24 / stroke 1.9 的线性图标。你的代码库已有自绘图标集(`src/components/ui/icons.tsx`,24×24 / stroke 1.8)。**优先复用现有图标**,缺的(`wallet`/`clipboard`/`trendUp`/`trendDown`/`banknote`/`passport` 等)按 1.8 stroke 风格补,不要引入图标库。
4. **页面组装**:在概览路由组件里按「Screens」描述的栅格拼装,数据用现有 hooks。
5. **头像**:产品本身无真人头像 —— 这里用「姓名首字 + 渐变底」的方案(见 Avatar 规格),可作为全站头像组件。
6. **响应式**:`md` 以下隐藏左侧栏、改用现有底部 tab 栏;统计卡 4 列→2 列;两栏区块堆叠为单列;表格横向滚动。移动版参考 `crm-mobile.jsx` 的 `MobileA`。

> ⚠️ 注意:本设计的主色用的是更亮的蓝 `#3b6bff`,而非产品原本的 `indigo-600 #4f46e5`;头像改为彩色渐变。这是参考图风格的有意偏离。**若需保持品牌一致,把 `--color-brand` 换回 `#4f46e5` 即可,其余不变。** 请与设计确认后再定。

---

## Screens / Views

### 概览 (Dashboard) — 桌面 `≥1024px`
- **Purpose**:代理登录后的首页,一眼掌握案件量、待办、收款、到期、递交进度。
- **整体布局**:左侧固定侧栏 `232px` + 右侧主区。主区 = 顶部问候栏(透明,贴页面底色)+ 可滚动内容区 `padding:26px 30px 38px`,内容块之间 `gap:20px`。内容区最大不设硬上限(参考稿按 1320 设计)。
- **页面底色**:`#eef1f8`(冷调浅灰,让白卡浮起)。

**① 顶部问候栏 `.topbar`**
- 左:`早上好,Amy 👋`(23px / 700 / color `#172033` / letter-spacing -.02em)+ 副行 `今天有 3 件待办、2 个临近到期提醒 · 本月已收款 $48,600`(13.5px / `#6b7589`)。
- 右(从左到右,gap 18px,搜索与按钮之间另有间距):
  - 搜索框:白底、1px 边 `#e6eaf2`、圆角 full、高 46px、宽 248px、内左放搜索图标(18px,`#9aa4b8`)+ placeholder `搜索客户 / 案件 / 参考号`。
  - 通知按钮:46×46 圆形白底图标按钮,右上有 8px 红点(`#f43f5e`,2px 白描边)。
  - 主按钮 `新建客户`:亮蓝底 `#3b6bff`、白字、圆角 full、高 46px、左侧 `+` 图标、阴影 `0 14px 26px -10px rgba(59,107,255,.5)`;hover→`#2f5cf0`。

**② 概览统计卡 ×4(`grid` 4 列,gap 20px)** —— 组件 `StatCard`
- 卡:白底、圆角 **24px**、阴影 `--sh`、内边距 22px。
- 顶行:左为**图标井**(50×50、圆角 16px、浅色底 + 同色图标),右为**趋势标签**(圆角 full、3px 9px、12px/700;升=绿底绿字 `#e7faf3`/`#10b981`,降=红底红字 `#fff0f3`/`#f43f5e`,图标 trendUp/trendDown 13px)。
- 数值:32px / 700 / `#172033` / letter-spacing -.02em / tabular-nums,上下 margin `18px 0 4px`。
- 标签:13px / `#6b7589`。
- 四张内容与配色:
  | 图标 | 井配色 | 数值 | 标签 | 趋势 |
  |---|---|---|---|---|
  | briefcase | brand 蓝 `#eef3ff`/`#3b6bff` | `38` | 进行中案件 | ↑2.5% |
  | clipboard | sky `#e8f7fe`/`#0284c7` | `12` | 待办事项 | ↑3 件 |
  | banknote | emerald `#e7faf3`/`#0f9d6e` | `$48.6k` | 本月收款 (AUD) | ↑8.2% |
  | alert | rose `#fff0f3`/`#e11d48` | `$21.4k` | 未付总额 (AUD) | ↓3.1% |

**③ 阶段环形图 + 待办案件(`grid`,列宽比 `1.05fr 1fr`,gap 20px)**
- **案件阶段分布卡**:卡头 `案件阶段分布`(16px/700)+ 副 `共 38 个进行中案件`(12.5px/`#9aa4b8`),右上 `全部案件 ›` 链接(13px/600/`#3b6bff`)。主体:左**环形图** + 右**图例**,gap 30px。
  - 环形图:SVG,尺寸 190、环宽 26、圆角端点、整体 `rotate(-90deg)` 从 12 点起;底环 `#e6eaf2`;中心大数 `38`(34px/700/`#172033`)+ 下方小字 `进行中案件`(12px/`#9aa4b8`)。
  - 6 段(name / value / color):待办 6 `#94a3b8`、提名递交 8 `#3b82f6`、提名获批 5 `#0891b2`、签证递交 9 `#6366f1`、要求补件 3 `#f59e0b`、下签 7 `#10b981`。
  - 图例每行:10px 圆色点 + 名称(13px/`#3a4458`,flex:1)+ 数值(700/`#172033`/tabular)。
- **待办案件卡**:卡头 `待办案件` + 蓝色计数 chip `7`(11px/700,底 `#eef3ff` 字 `#3b6bff`,圆角 full,padding 3px 9px),右上 `全部 ›`。列表 5 行,行高 padding 11px、行间 1px 顶边 `#eef1f6`(首行无):
  - 左:头像(42px 渐变)+ 姓名(14px/600/`#172033`)/ 签证类型副文(12px/`#9aa4b8`);右:阶段 Pill + 到期文字(12px,宽 54px 右对齐;含「逾期」时红色 `#f43f5e`,否则 `#9aa4b8`)。
  - 数据:张伟·482 雇主担保·提名递交(blue)·今天 / 李娜·485 毕业生工签·待办(slate)·明天 / 陈静·500 学生签·要求补件(amber)·逾期 2 天 / 王强·186 永居·签证递交(indigo)·3 天后 / 邓韬·482 Subsequent·待办(slate)·5 天后。

**④ 即将到期 + 月度收款条形图(`grid`,列宽比 `1fr 1.1fr`)**
- **即将到期提醒卡**:卡头 + 副 `签证 / 文件 / TRT`。每行:**图标井**(42px,rose/amber/indigo 按紧急度)+ 姓名/事项 + 右侧天数 Pill(`6 天` 等;无天数则 `可办理` indigo Pill,无圆点)。
  - 数据:陈静·体检有效期·6 天(rose,clock)/ 王强·护照到期·18 天(amber,passport)/ 周婷·无犯罪证明·27 天(amber,doc)/ 刘洋·186 TRT 可办·可办理(indigo,shield)。
- **月度收款趋势卡**:卡头 `月度收款趋势` + 副 `近 6 个月 (AUD)`,右上绿趋势标签 `↑8.2%`。主体:6 根柱(条形图),高度容器 188px,柱宽 max 30、圆角 9;当前月(5月)高亮:亮蓝实心 + 蓝阴影 + 顶部标值 `$48.6k`,其余月浅蓝 `#dbe6ff`;柱底月份标签(11.5px/`#9aa4b8`)。
  - 数据(label/value):1月31 2月28 3月42 4月39 **5月48(高亮)** 6月22。

**⑤ 递交进度表 `TableShell`**(整卡 padding:0)
- 卡头区 padding `22px 22px 14px`:`递交进度`(16px/700)+ 副 `按递交时间排序`,右 `打开案件表 ›`。
- 表:列 `客户 / 签证类型 / 递交日期 / 状态 / 处理进度(26%) / 至今`。
  - 表头:11px/700/`#9aa4b8`/大写/letter-spacing .05em/padding `0 14px 14px`。
  - 单元格:padding `13px 14px`、顶边 `#eef1f6`、`#3a4458`;行 hover 底 `#f7f9fd`。
  - 客户列:头像 34px + 姓名。日期:tabular,`#9aa4b8`。状态:Pill。处理进度:进度条(高 8、圆角 full、轨 `#e6eaf2`)+ 右侧剩余/超期文字(12px tabular;超期红);至今:右对齐 `xx 天`。
  - 进度条颜色规则:已超期 `#f43f5e`、已下签 `#10b981`、进度>80% `#f59e0b`、否则 `#3b6bff`。
  - 数据(name/visa/date/status/elapsed/total):周婷·482 提名·2025-02-10·处理中·111/120 / 王强·186 签证·2025-04-02·处理中·60/150 / 张伟·482 提名·2025-05-18·处理中·14/120 / 陈静·500 签证·2025-03-15·已超期·78/60 / 刘洋·189 签证·2024-11-20·已下签·100/100。

### 概览 — 移动 `<768px`(参考 `crm-mobile.jsx` 的 `MobileA`)
- 顶栏:问候 + 通知按钮 + 头像;底部固定 tab 栏(沿用现有产品的底部导航,中间为蓝色 `+` FAB)。
- 统计卡 2×2;环形图卡(尺寸 172/环宽 24)+ 图例;待办案件 4 行。卡片圆角与配色同桌面,字号略缩(数值 23px、卡头 15px)。

---

## Interactions & Behavior
- **hover**:主按钮变深 `#2f5cf0`;白底图标按钮图标转 `#172033`;表格行底 `#f7f9fd`;链接 `›` 变深蓝 `#2f5cf0`;卡片本身**不**位移(扁平稳定)。
- **趋势标签 / Pill / 进度条**:纯展示,颜色由数据驱动(见上表规则)。
- **审批/操作**:本页无;到期、待办、表格行点击应路由到对应案件详情(沿用现有 `案件 ›` 钻取)。
- **加载/空/错误态**:沿用产品现有文案风格(`加载中…` / `暂无待办` / `部分概览数据加载失败,请刷新重试`),不要新造。
- **数字格式**:金额 `formatMoney`→`$48,600`;`$48.6k` 仅用于统计卡缩写,完整值用于表格/明细。所有数字 `tabular-nums`。
- **过渡**:仅 `transition: colors .15s`,无滑入/弹跳/滚动特效(与产品克制的动效一致)。

## State Management
- 不新增前端状态;复用现有数据。概览页所需查询(建议各自 TanStack Query):
  - 概览统计(进行中案件数、待办数、本月收款、未付总额 + 同比)
  - 案件阶段分布(按 stage 分组计数)
  - 待办案件列表(取前 5,带 stage、due)
  - 即将到期(签证/文件/TRT,按天数升序)
  - 月度收款序列(近 6 个月)
  - 递交进度(各案件 elapsed/total/status)
- 搜索框接现有全局搜索;`新建客户` 触发现有新建流程。

---

## Design Tokens（精确值)

**主色(亮蓝)**:`--brand #3b6bff` · hover `--brand-600 #2f5cf0` · `--brand-700 #264fd6` · soft `--brand-50 #eef3ff` · `--brand-100 #dbe6ff`
**底色 / 表面**:画布 `#eef1f8` · 卡面 `#ffffff` · 卡内浅区 `#f7f9fd` · 描边 `#eef1f6` / `#e6eaf2`
**文本**:标题 `#172033` · 正文 `#3a4458` · 次要 `#6b7589` · 占位/超弱 `#9aa4b8`
**语义色(base / 50 底 / 100)**:
- emerald `#10b981` / `#e7faf3` / `#d1f5e6`(深字用 `#0f9d6e`)
- rose `#f43f5e` / `#fff0f3` / `#ffe0e6`(深字 `#e11d48`)
- amber `#f59e0b` / `#fff7e8` / `#fdedc8`(深字 `#c87f06` / `#d97706`)
- sky `#0ea5e9` / `#e8f7fe` / `#cdeefd`(深字 `#0284c7`)
- violet `#8b5cf6` / `#f3effe` / `#e7defd`(深字 `#7c4ddb`)
- indigo `#6366f1` / `#eef0ff` / `#e0e3ff`

**阶段色(环形/Pill 用)**:待办 `#94a3b8` · 提名递交 `#3b82f6` · 提名获批 `#0891b2` · 签证递交 `#6366f1` · 要求补件 `#f59e0b` · 下签 `#10b981`

**圆角**:卡片 `24px` · 大 `18px` · 中 `14px`(图标井) · 小 `10px` · full `999px`
**阴影**:
- `--sh-xs` `0 1px 2px rgba(23,32,51,.05)`(搜索框/小按钮)
- `--sh` `0 10px 28px -14px rgba(28,40,75,.28), 0 3px 8px -4px rgba(28,40,75,.10)`(所有卡片)
- `--sh-brand` `0 14px 26px -10px rgba(59,107,255,.5)`(主按钮/品牌元素)

**间距**:基数 4px;卡片内边距 22px(移动 15–18px);内容块间距 20px;滚动区 padding `26px 30px 38px`。
**字体**:沿用产品系统字体栈 `system-ui, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif`。字重仅 400/500/600/700。
**字号**:页面问候 23px/700;卡头 16px/700;统计数值 32px/700;环形中心 34px/700;正文 14px/600(姓名)与 13–14px(普通);副文/标签 12–13px;表头 11px/700 大写。

**头像(Avatar)规格**:圆形,内容=姓名首字(白、600、字号≈尺寸×0.4),底为渐变(按姓名 hash 选一),含投影 `0 4px 10px -4px rgba(23,32,51,.4)`。8 套渐变(135deg):
`#5b7cfa→#8b6cf0` · `#2f8fff→#38c6ff` · `#ff7a59→#ff5e84` · `#12b886→#5fd0a0` · `#f5a623→#ffce4f` · `#a55eea→#ec5bb0` · `#0ea5e9→#22d3ee` · `#f43f5e→#fb7185`。

**图标井(Well)**:50×50(列表内 42×42),圆角 16px,浅色底 + 同色描线图标(24px),配色取语义 50 底 + base 线色。

---

## Tailwind v4 主题(建议加到全局 CSS)

```css
@theme {
  /* 亮蓝主色 */
  --color-brand:      #3b6bff;
  --color-brand-600:  #2f5cf0;
  --color-brand-700:  #264fd6;
  --color-brand-50:   #eef3ff;
  --color-brand-100:  #dbe6ff;
  /* 仪表盘画布与描边 */
  --color-canvas:     #eef1f8;
  --color-surface-2:  #f7f9fd;
  --color-line:       #eef1f6;
  --color-line-2:     #e6eaf2;
  --color-ink:        #172033;
  /* 圆角 */
  --radius-card: 24px;
  /* 阴影 */
  --shadow-soft:  0 10px 28px -14px rgb(28 40 75 / .28), 0 3px 8px -4px rgb(28 40 75 / .10);
  --shadow-brand: 0 14px 26px -10px rgb(59 107 255 / .5);
}
```
之后可用:`bg-brand` / `text-brand` / `bg-canvas` / `border-line-2` / `rounded-card` / `shadow-soft` / `shadow-brand`。语义色直接用 Tailwind 自带的 `emerald/rose/amber/sky/violet/indigo` 调色板即可(数值已对齐)。

### 常用组件 → Tailwind class 速查
- **卡片**:`bg-white rounded-card shadow-soft p-[22px]`
- **统计数值**:`text-[32px] font-bold text-ink tracking-[-0.02em] tabular-nums`
- **趋势标签(升)**:`inline-flex items-center gap-1 text-xs font-bold px-[9px] py-1 rounded-full bg-emerald-50 text-emerald-600`
- **主按钮**:`h-[46px] px-5 rounded-full bg-brand text-white font-semibold shadow-brand hover:bg-brand-600 transition-colors`
- **图标井**:`w-[50px] h-[50px] rounded-[16px] grid place-items-center bg-brand-50 text-brand`
- **Pill**:`inline-flex items-center gap-1.5 px-[11px] py-1 rounded-full text-xs font-semibold`(底/字用语义 50/600)
- **表头**:`text-[11px] font-bold tracking-[0.05em] uppercase text-[#9aa4b8]`
- **进度条**:轨 `h-2 rounded-full bg-line-2`,填充 `h-full rounded-full`(色按规则)

---

## Assets
- **无外部图片素材**。所有图标为内联 SVG 线性图标(见 `crm-shared.jsx` 的 `GLYPH`,或复用现有 `src/components/ui/icons.tsx`)。
- **无真人头像** —— 用「首字 + 渐变」头像组件代替。
- 图表(环形 / 条形 / sparkline / 半环仪表)均为手写 SVG,无图表库依赖。

## Files（本包内设计参考文件)
- `design_files/Dashboard-A.html` — Layout A 独立预览页(浏览器直接打开)。
- `design_files/crm.css` — 全部设计令牌 + 组件样式(CSS 变量版,Tailwind 映射的来源)。
- `design_files/crm-shared.jsx` — 共享组件与图表:`Icon/GLYPH`、`Avatar`、`NameCell`、`Pill`、`Well`、`Donut`、`Gauge`、`BarChart`、`Spark`、`Sidebar`,以及全部 mock 数据。
- `design_files/crm-layoutA.jsx` — Layout A 页面组装(各区块结构与 props 用法)。
- `design_files/crm-mobile.jsx` — 移动端 `MobileA`(响应式参考)。

> 复刻顺序建议:先落 Tailwind 主题 → `Avatar`/`Pill`/`Well`/`StatCard` 等原子组件 → `Donut`/`BarChart`(照搬 SVG)→ 在概览路由里按 Screens 栅格组装 → 接数据 → 补响应式。
