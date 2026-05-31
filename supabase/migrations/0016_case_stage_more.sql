-- ============================================================================
-- 0016 — 案件阶段(case_stage) 新增 3 个阶段
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 新增（存储键 / 中文）：
--   nomination_approved(提名获批)  — 在「提名递交」之后
--   docs_requested(要求补件)        — 可能在任何 lodgement 之后
--   docs_completed(补件完毕)        — 紧接「要求补件」
--
-- 新完整顺序：
--   待办 → drafted → 提名递交 → 提名获批 → 签证递交 → 要求补件 → 补件完毕 → 下签 → 拒签
--
-- 旧「补件」单阶段 additional_docs 保留在允许值里（旧数据继续兼容），但前端下拉不再显示，
-- 用「要求补件」「补件完毕」替代。case_stage 列在 0004 已是 text + CHECK，故只扩 CHECK，
-- 绝不改任何现有数据、不动默认值。纯增量、可重复执行（drop if exists + add）。
-- ============================================================================

alter table public.cases drop constraint if exists cases_current_stage_check;
alter table public.cases add constraint cases_current_stage_check
  check (current_stage in (
    'todo','drafted','nomination_lodged','nomination_approved','visa_lodged',
    'docs_requested','docs_completed','additional_docs','granted','refused'
  ));

alter table public.case_stage_history drop constraint if exists cstage_hist_to_check;
alter table public.case_stage_history add constraint cstage_hist_to_check
  check (to_stage in (
    'todo','drafted','nomination_lodged','nomination_approved','visa_lodged',
    'docs_requested','docs_completed','additional_docs','granted','refused'
  ));

alter table public.case_stage_history drop constraint if exists cstage_hist_from_check;
alter table public.case_stage_history add constraint cstage_hist_from_check
  check (from_stage is null or from_stage in (
    'todo','drafted','nomination_lodged','nomination_approved','visa_lodged',
    'docs_requested','docs_completed','additional_docs','granted','refused'
  ));
