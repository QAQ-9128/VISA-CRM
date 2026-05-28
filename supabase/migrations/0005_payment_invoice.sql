-- ============================================================================
-- 0005 — 收款记录可附「发票(invoice)」文件
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。纯增量、可重复执行。
--
-- 发票文件存私有 bucket case-files（0001 已建 + RLS），路径含案件 id；
-- payments.invoice_path 存储路径，invoice_name 存原始文件名。
-- 收款属于哪个案件由 payments.case_id 决定（案件编号 = cases.case_number）。
-- ============================================================================

alter table public.payments add column if not exists invoice_path text;
alter table public.payments add column if not exists invoice_name text;
