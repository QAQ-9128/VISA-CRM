-- ============================================================================
-- 0004 — 案件阶段(case_stage) 改为客户实际在用的 6 个阶段
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 新阶段(存储键 / 中文标签)：
--   todo(待办) / nomination_lodged(提名递交) / visa_lodged(签证递交)
--   / additional_docs(补件) / granted(下签) / refused(拒签)
--
-- 旧值迁移到最接近的新值：
--   consulting(咨询中), preparing(准备材料), withdrawn(撤案) → todo
--   nomination_approved(提名批)                              → nomination_lodged
--   nomination_lodged / visa_lodged / additional_docs / refused → 不变
--   granted(授签)                                            → granted（仅标签改“下签”）
--
-- 做法：把 case_stage 枚举列改成 text + CHECK 约束（避免枚举增删值的麻烦）。
-- 纯增量、可重复执行。
-- ============================================================================

-- ── 1. 去掉旧默认值（枚举字面量），列类型 enum → text ─────────────────────────
alter table public.cases               alter column current_stage drop default;
alter table public.cases               alter column current_stage type text using current_stage::text;
alter table public.case_stage_history  alter column from_stage    type text using from_stage::text;
alter table public.case_stage_history  alter column to_stage      type text using to_stage::text;

-- ── 2. 旧值迁移 ──────────────────────────────────────────────────────────────
update public.cases set current_stage = case
  when current_stage in ('consulting','preparing','withdrawn') then 'todo'
  when current_stage = 'nomination_approved'                   then 'nomination_lodged'
  else current_stage end;

update public.case_stage_history set to_stage = case
  when to_stage in ('consulting','preparing','withdrawn') then 'todo'
  when to_stage = 'nomination_approved'                   then 'nomination_lodged'
  else to_stage end;

update public.case_stage_history set from_stage = case
  when from_stage in ('consulting','preparing','withdrawn') then 'todo'
  when from_stage = 'nomination_approved'                   then 'nomination_lodged'
  else from_stage end
  where from_stage is not null;

-- ── 3. 新默认值 + CHECK 约束（限定 6 个新值）──────────────────────────────────
alter table public.cases alter column current_stage set default 'todo';

alter table public.cases drop constraint if exists cases_current_stage_check;
alter table public.cases add constraint cases_current_stage_check
  check (current_stage in ('todo','nomination_lodged','visa_lodged','additional_docs','granted','refused'));

alter table public.case_stage_history drop constraint if exists cstage_hist_to_check;
alter table public.case_stage_history add constraint cstage_hist_to_check
  check (to_stage in ('todo','nomination_lodged','visa_lodged','additional_docs','granted','refused'));

alter table public.case_stage_history drop constraint if exists cstage_hist_from_check;
alter table public.case_stage_history add constraint cstage_hist_from_check
  check (from_stage is null or from_stage in ('todo','nomination_lodged','visa_lodged','additional_docs','granted','refused'));

-- ── 4. 丢弃不再使用的枚举类型 ────────────────────────────────────────────────
drop type if exists public.case_stage;
