-- ============================================================================
-- 0023 — 案件阶段(case_stage) 再新增 2 个阶段
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 新增（存储键 / 中文）：
--   appeal(上诉/复议)    — 通常在「拒签」之后
--   withdrawn(主动撤签)  — 主动撤回申请的终态
--
-- case_stage 在 0004 已是 text + CHECK，这里只扩 CHECK 允许值，绝不改现有数据/默认值。
-- 纯增量、可重复执行（drop if exists + add）。沿用 0016 的完整列表并追加两项。
-- ============================================================================

alter table public.cases drop constraint if exists cases_current_stage_check;
alter table public.cases add constraint cases_current_stage_check
  check (current_stage in (
    'todo','drafted','nomination_lodged','nomination_approved','visa_lodged',
    'docs_requested','docs_completed','additional_docs','granted','refused',
    'appeal','withdrawn'
  ));

alter table public.case_stage_history drop constraint if exists cstage_hist_to_check;
alter table public.case_stage_history add constraint cstage_hist_to_check
  check (to_stage in (
    'todo','drafted','nomination_lodged','nomination_approved','visa_lodged',
    'docs_requested','docs_completed','additional_docs','granted','refused',
    'appeal','withdrawn'
  ));

alter table public.case_stage_history drop constraint if exists cstage_hist_from_check;
alter table public.case_stage_history add constraint cstage_hist_from_check
  check (from_stage is null or from_stage in (
    'todo','drafted','nomination_lodged','nomination_approved','visa_lodged',
    'docs_requested','docs_completed','additional_docs','granted','refused',
    'appeal','withdrawn'
  ));
