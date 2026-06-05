# 交接:客户页 → 看板(销售渠道)视图

## 目标
把现有 **客户列表页**(`src/pages/customers/CustomerListPage.tsx`)增加一个**看板视图**:按**案件阶段**分列的销售渠道(Kanban),与现有「列表(家庭分组)」视图通过顶部「看板 / 列表」标签切换。**保留现有全部功能与数据**,只新增一种呈现方式。

预览:浏览器打开 `design_files/preview.html`(默认进入「客户」页,点顶部「看板 / 列表」切换)。属于**高保真**参照,请按数值还原。

## About the Design Files
`design_files/` 是 HTML/JSX 设计参考稿,**不是上线代码**。请在现有栈(React 19 + TS + Tailwind v4 + React Router + TanStack Query + Zustand + Supabase)里用既有组件与 hooks 复刻。看板组件的结构/取值见 `crm-app.jsx` 里的 `CustomersPage` / `CustomerBoard` / `KCard`,样式见 `crm-app.css` 的「客户看板」段。

---

## 视图结构

### 顶部工具条
- 左:段控标签 **看板 / 列表**(`.tabs`,选中=白底 `text-brand` + 轻阴影)。默认进「看板」。
- 右:**筛选 / 搜索** 图标按钮(`.iconbtn`,圆形 46px 白底)。搜索逻辑沿用现有 `useCustomers({search})`。
- 标题区:`客户` + 副标题「追踪并管理客户关系 · 按案件阶段查看销售渠道」。

### 看板(Kanban)
- 横向滚动容器,列之间 `gap:16px`。每列固定宽 **296px**,圆角 18px,**列背景=该阶段的浅色 tint**,内边距 `12px 12px 16px`,卡片纵向 `gap:10px`。
- **列 = 案件阶段**(取 `domain.ts` 的 `CASE_STAGES` / `CASE_STAGE_LABELS`,按流程顺序)。建议默认展示这几列(可配置):

  | 列(阶段) | 键 | 圆点色 | 列底色 tint |
  |---|---|---|---|
  | 待办 | `todo` | `#94a3b8` | `#f3f5f8` |
  | 提名递交 | `nomination_lodged` | `#3b82f6` | `#eef4ff` |
  | 提名获批 | `nomination_approved` | `#0891b2` | `#e7f6fb` |
  | 要求补件 | `docs_requested` | `#f59e0b` | `#fff7e9` |
  | 签证递交 | `visa_lodged` | `#6366f1` | `#eeeffe` |
  | 下签 | `granted` | `#10b981` | `#e9faf2` |

  > 其余阶段(已草拟 / 补件完毕 / 拒签 / 上诉 / 撤签)可作为可选列或收进「更多」。是否展示由你按业务定,**不要在 domain 里删任何阶段**。

- **列头 `.col-hd`**:`圆点(9px,阶段色)` + `阶段名(13.5/700)` + 右侧 `计数 chip`(白底圆角,`.cct`)。
- 列底:`+ 添加`(`text-faint`,点击在该阶段下新建案件/客户,沿用现有新建流程)。

### 卡片 `.kcard`(白底 / 圆角 15 / 1px `--line` 边 / `--sh-sm`,hover 上浮 + 阴影)
一张卡 = **一个案件**(及其客户)。结构:
1. **头部 `.kh`**:渐变头像(34px) + 客户姓名(14.5/600,溢出省略) + 右侧 `客户来源点`(`ClientSourceDot`:黑/绿/黄,原样保留)。
2. **签证标签 `.ktag`**(`margin-top:11`):品牌浅底圆角小标签,显示签证类别 + stream,如 `482 Core Skills`。
3. **副信息 `.ksub`**(`margin-top:9`,`text-muted`):`担保雇主 · 职位`(空则不显示)。
4. **页脚 `.kf`**(顶部 1px `--line` 分隔):左 = 来源说明(`公司派的/自己的/帮带的/未分类`,`text-faint` 11.5);右 = **欠款**(`欠 $1,200`,`text-rose` 700)或 **已结清**(`text-emerald`)。欠款判定沿用现有 `useCustomerDebts` / `CUSTOMER_PAYMENT_TEXT_CLASS` 逻辑。

整卡点击 → 跳对应**案件详情**(`/cases/:id`);若一个客户多案件,每案一张卡(同一客户可出现在不同列)。

### 列表视图(保留)
点「列表」切回现有的**家庭分组**列表(主申 + 副申 `└─` 连线、来源点、欠款着色、`↗独立档案`)——即你现在的 `CustomerListPage` 内容,套用新设计系统皮肤即可,逻辑不变。

---

## 数据与交互(不改功能)
- 列归属:卡片按其**案件 `current_stage`** 落入对应列。数据来自现有 `useCases()` + `useCustomers()`(+ `useEmployers()` 取雇主名、`useCustomerDebts()` 取欠款色),**不新增查询字段**。
- **拖拽(可选,二期)**:卡片跨列拖拽 = 调用现有「改阶段」mutation 更新 `current_stage`。一期可先做**只读看板**(点击进详情改阶段),不强制实现拖拽。
- 搜索 / 筛选 / 新建:全部复用现有逻辑与权限。
- 过渡仅 `transition`(150ms);卡片 hover 上浮 1px + 阴影,无其他动效。
- 移动端(`<md`):看板改为可横向滑动的窄列,或退化为「列表」视图(按你现有移动优先策略)。

## Design Tokens / Tailwind v4
沿用全站设计系统(见全站交接包的 `@theme`)。看板专用类的 Tailwind 写法速查:
- 列容器:`flex-[0_0_296px] rounded-[18px] p-3 pb-4 flex flex-col gap-2.5`(底色用上表 tint,可做成 `bg-[var(--tint)]`)。
- 列头:`flex items-center gap-2 text-[13.5px] font-bold text-ink`,圆点 `w-2.5 h-2.5 rounded-full`,计数 `ml-auto bg-white rounded-full px-2.5 py-px text-xs font-bold text-faint`。
- 卡片:`bg-white rounded-[15px] border border-line shadow-[var(--shadow-sm)] p-3.5 cursor-pointer hover:shadow-[var(--shadow-soft)] hover:-translate-y-px transition`。
- 签证标签:`inline-block text-xs font-semibold text-brand bg-brand-50 rounded-lg px-2.5 py-0.5`。
- 欠款:`text-xs font-bold text-rose-600`;已结清:`text-[11.5px] font-semibold text-emerald-600`。
- 看板容器:`flex gap-4 overflow-x-auto pb-2.5 items-start`。

## Files
- `design_files/preview.html` — 全站原型(默认进客户页,可切看板/列表)。
- `design_files/crm-app.jsx` — `CustomersPage` / `CustomerBoard` / `KCard` / `KSTAGES`(列定义)/ `KCARDS`(示例数据,对照你真实字段:客户名、签证、雇主、职位、阶段、来源、欠款)。
- `design_files/crm-app.css` — 「客户看板」样式段(`.board/.col/.col-hd/.kcard/.ktag` 等)。
- `design_files/crm-shared.jsx` — `Avatar` 等原子组件。

## 施工建议
1. 在 `CustomerListPage.tsx` 加 `view` 状态 + 顶部「看板 / 列表」标签。
2. 列表分支 = 现有内容(套新皮肤)。
3. 看板分支:用 `useCases`+`useCustomers` 把案件按 `current_stage` 分组成列,渲染 `KCard`。
4. 列定义用 `domain.ts` 的阶段(标签/顺序/色),不要硬编码中文。
5. 一期只读;二期再加拖拽改阶段。
6. 自检:列表视图与改造前功能一致;看板只是同一批数据的新视图。
