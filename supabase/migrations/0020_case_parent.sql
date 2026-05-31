-- ============================================================================
-- 0020 — 案件「依附于哪个主案件」软关联（parent_case_id）
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 场景：副申请独立办自己的案件时，标注其依附于家庭组「主申请」名下的某个案件。
-- 这是【纯展示用的软关联】：两个案件的 current_stage / lodgements / payments /
-- case_stage_history / records 完全独立，互不同步——主案件阶段变化绝不传染副案件，反向亦然。
-- 与既有的 sync_tracking 并存：sync_tracking 处理「同申请合并账单」，parent_case_id 处理
-- 「独立申请之间的关联展示」。
--
-- on delete set null：删除主案件不会级联删副案件，只把副案件的 parent_case_id 置回 null，
-- 副案件本身完好保留；主案件软删(is_archived=true)时该列不变，副案件继续展示「依附于[已归档主案件]」。
--
-- 纯增量、可重复执行。
-- ============================================================================

alter table public.cases
  add column if not exists parent_case_id uuid
    references public.cases(id) on delete set null;

create index if not exists idx_cases_parent on public.cases(parent_case_id);
