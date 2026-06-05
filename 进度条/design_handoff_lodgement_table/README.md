# 交接:递交进度表(案件 → 递交进度)

## 目标
重做**递交进度宽表**(案件区的「递交进度」视图,对应 `src/pages/cases/CasesTablePage.tsx` 及递交数据 `src/api/lodgements.ts` / `components/cases/LodgementProgressBar.tsx`),在**保留全部列与数据**的前提下大幅提升可读性。**一列都不省略**,只改呈现。

预览:打开 `design_files/preview.html`(自动进入「案件 → 递交进度」)。**高保真**,按数值还原。

## About the Design Files
`design_files/` 是 HTML/JSX 参考稿,**非上线代码**。在现有栈(React 19 + TS + Tailwind v4 + TanStack Query + Supabase)里用既有数据 hooks 复刻。表格组件见 `crm-app.jsx` 的 `LodgementTable`(及 `Ago` / `Dt` / `Note` 子件、`LODGE_ROWS` 字段),样式见 `crm-app.css` 的「递交进度表」段(`.ltbl …`)。

---

## 列(全部保留,顺序与现状一致)
1. **案件编号**(蓝色 mono 链接 `idlink`,点击进案件详情)
2. **主申请**(渐变头像 + 姓名)
3. **副申请**(有则头像+姓名,无则浅灰 `—`)
4. **签证类型**(粗体类别 + 灰色 stream 副行,如 `482 / Core Skills`)
5. **状态**(`StageBadge`,复用 `domain.ts` 阶段标签与色)
6. **提名递交时间**(日期,tabular)
7. **提名距今**(时长文字 + 颜色进度条)
8. **签证递交时间**(日期)
9. **签证距今**(时长文字 + 颜色进度条)
10. **待办**(⚠️/‼️/💬 提醒文字,如「下签后再带副申请」「学历未满足签证要求」)

## 可读性设计要点
- **单行表头**(不要双行分组表头——在横向滚动表里会与表体错位)。用**底色块**区分两组:**提名两列 = 浅蓝 `#f1f5ff`**(表头 `#e7eefc`)、**签证两列 = 浅紫 `#f6f3fe`**(表头 `#efeafe`),组首列加 2px 左分隔线 `.g-split`。**不冻结任何列**(用户确认:前两列也不冻结),整表横向滚动。
- **「距今」= 文字 + 颜色条**(核心可读性):保留原文字(如「6 个月 18 天」),下方加一根进度条,颜色按等待时长:
  - `<3 个月` 绿 `#10b981` · `3–6 个月` 琥珀 `#f59e0b` · `≥6 个月` 红 `#f43f5e`
  - 条宽 = 月数 / 8(参考上限)× 100%,封顶 100%。
  - 已获批/已下签等终态:灰色「✓ 已获批 / ✓ 已下签」,不画条。
- **待办行**(尚未递交):提名递交时间列显「待递交」琥珀小胶囊,该行整行浅黄底 `#fffdf6`,清楚表示"在跟进、尚未递交",而非空白。
- **待办列**:`⚠️` 琥珀(提醒)/ `‼️` 红(严重)/ `💬` 灰(信息),emoji + 文字,可换行,最大宽 ~210。
- 空值统一浅灰 `—`(`.none`,`--slate-300`),降噪。日期/时长 `tabular-nums`。行高 ≥ 48,行 hover `--surface-2`。
- 入口:案件页顶部段控「案件列表 / 递交进度」切换(`.tabs`),递交进度即本表。

## 数据 / 交互(不改功能)
- 数据来自现有 `useLodgements` / 案件查询:每案的提名(nomination)与签证(visa)两条递交记录的**递交日期**与**距今**(由递交日期算到今天,沿用现有 `lib` 时长格式 `X 个月 Y 天`)。
- 「待办」列 = 该案的提醒/标记(沿用现有 records / follow-up 标记或案件备注)。
- 终态判定(已获批/已下签)沿用现有 `LodgementOutcome` / stage 逻辑;颜色阈值(3/6 月)可按你实际处理时长基准调整。
- 排序:建议默认「距今」降序(等最久的置顶),表头可点排序;搜索/筛选复用现有逻辑。
- 整行或案件编号点击 → 案件详情。

## Tailwind v4 速查
- 容器:`overflow-x-auto`;表 `min-w-[1240px] border-separate border-spacing-0`。
- 表头 th:`bg-surface-2 text-[11px] font-bold tracking-wider uppercase text-muted px-3.5 py-[11px] text-left border-b border-line-2`。
- 提名列:`bg-[#f1f5ff]`(表头 `bg-[#e7eefc]`);签证列:`bg-[#f6f3fe]`(表头 `bg-[#efeafe]`);组首列 `border-l-2 border-line-2`。
- 距今:`text-[13px] font-bold tabular-nums`(色按阈值)+ 进度条 `h-1.5 rounded-full bg-line-2` 内 `<span>` 着色。
- 待办行:`bg-[#fffdf6]`;「待递交」胶囊:`text-xs font-semibold text-amber-700 bg-amber-50 rounded-full px-2.5 py-0.5`。
- 单元格:`px-3.5 py-[13px] border-b border-line whitespace-nowrap`。

## Files
- `design_files/preview.html` — 自动进入「案件 → 递交进度」。
- `design_files/crm-app.jsx` — `LodgementTable` + `Ago/Dt/Note` + `LODGE_ROWS`(字段:name/id/sub/visa/stream/stage/提名 nd·nm·nt/签证 vd·vm·vt/note·nlev)。
- `design_files/crm-app.css` — 「递交进度表」样式段(`.ltbl/.tn/.tv/.g-split/.ago/.waitchip` 等)。

## 施工建议
1. 在案件区加「案件列表 / 递交进度」切换。
2. 用现有递交数据渲染本表;`提名/签证距今`接现有时长计算,套颜色条阈值。
3. `StageBadge`、阶段色、待办标记复用现有定义,不要硬编码。
4. 自检:列与数据与改造前一致,仅外观/可读性变化。
