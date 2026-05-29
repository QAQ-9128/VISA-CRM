-- ============================================================================
-- 0006 — 案件阶段(case_stage) 新增「drafted(已草拟)」
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 在「待办」和「提名递交」之间插入一个新阶段：
--   todo(待办) → drafted(已草拟) → nomination_lodged(提名递交)
--     → visa_lodged(签证递交) → additional_docs(补件) → granted(下签) → refused(拒签)
--
-- 纯增量：只把 CHECK 约束的允许值集合扩一个 'drafted'，不改任何现有数据、不动默认值。
-- case_stage 列在 0004 已是 text + CHECK（不是枚举），所以无需 ALTER TYPE。
-- 可重复执行（drop if exists + add）。
-- ============================================================================

alter table public.cases drop constraint if exists cases_current_stage_check;
alter table public.cases add constraint cases_current_stage_check
  check (current_stage in ('todo','drafted','nomination_lodged','visa_lodged','additional_docs','granted','refused'));

alter table public.case_stage_history drop constraint if exists cstage_hist_to_check;
alter table public.case_stage_history add constraint cstage_hist_to_check
  check (to_stage in ('todo','drafted','nomination_lodged','visa_lodged','additional_docs','granted','refused'));

alter table public.case_stage_history drop constraint if exists cstage_hist_from_check;
alter table public.case_stage_history add constraint cstage_hist_from_check
  check (from_stage is null or from_stage in ('todo','drafted','nomination_lodged','visa_lodged','additional_docs','granted','refused'));
