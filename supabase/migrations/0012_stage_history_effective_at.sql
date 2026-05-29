-- ============================================================================
-- 0012 — 阶段历史的「实际发生时间」effective_at
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- case_stage_history 原有 changed_at = 录入时间。新增 effective_at = 阶段实际发生时间，
-- 用于「事后补录」（如：其实昨天就提名递交了，今天才录）。所有展示/排序改用 effective_at。
-- 旧数据 effective_at 回填为 changed_at，避免空。
-- 同时放开该表删除给登录用户（时间线可删，与 records 一致）。
-- 纯增量、可重复执行。
-- ============================================================================

alter table public.case_stage_history add column if not exists effective_at timestamptz;
update public.case_stage_history set effective_at = changed_at where effective_at is null;
alter table public.case_stage_history alter column effective_at set default now();
alter table public.case_stage_history alter column effective_at set not null;

drop policy if exists case_stage_history_delete on public.case_stage_history;
create policy case_stage_history_delete on public.case_stage_history
  for delete to authenticated using (true);
