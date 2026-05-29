-- ============================================================================
-- 0013 — 客户担保职位(sponsor_position)
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 给 customers 增加 sponsor_position（可空 text）：担保雇主下的担保职位，
-- 如 "Senior Cook" / "Marketing Manager"。与 sponsor_employer_id 互不依赖
-- （可只填职位不填雇主，反之亦可）。无 DB check 约束，前端自由录入。
-- 纯增量、可重复执行。
-- ============================================================================

alter table public.customers add column if not exists sponsor_position text;
