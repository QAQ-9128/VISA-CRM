-- ============================================================================
-- 0033 — 案件阶段(case_stage) 新增「awaiting_payment(等待付款)」
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 流程位置：已草拟(drafted) 的下一阶段——
--   todo(待办) → drafted(已草拟) → awaiting_payment(等待付款) → nomination_lodged(提名递交) → …
--
-- case_stage 在 0004 已是 text + CHECK，这里只扩 CHECK 允许值，绝不改现有数据/默认值。
-- 纯增量、可重复执行（drop if exists + add）。沿用 0023 的完整列表并追加一项。
-- ============================================================================

alter table public.cases drop constraint if exists cases_current_stage_check;
alter table public.cases add constraint cases_current_stage_check
  check (current_stage in (
    'todo','drafted','awaiting_payment','nomination_lodged','nomination_approved','visa_lodged',
    'docs_requested','docs_completed','additional_docs','granted','refused',
    'appeal','withdrawn'
  ));

alter table public.case_stage_history drop constraint if exists cstage_hist_to_check;
alter table public.case_stage_history add constraint cstage_hist_to_check
  check (to_stage in (
    'todo','drafted','awaiting_payment','nomination_lodged','nomination_approved','visa_lodged',
    'docs_requested','docs_completed','additional_docs','granted','refused',
    'appeal','withdrawn'
  ));

alter table public.case_stage_history drop constraint if exists cstage_hist_from_check;
alter table public.case_stage_history add constraint cstage_hist_from_check
  check (from_stage is null or from_stage in (
    'todo','drafted','awaiting_payment','nomination_lodged','nomination_approved','visa_lodged',
    'docs_requested','docs_completed','additional_docs','granted','refused',
    'appeal','withdrawn'
  ));
