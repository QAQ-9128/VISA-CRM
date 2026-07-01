-- ============================================================================
-- 0044 — 收款「共享 · 全案」款项标记（additive，零回归）
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。纯增量、可重复执行。
--
-- 「共享 · 全案」= 属于整个案件、不归任何 applicant 的收款（政府申请费等）。
--   - payment_plan_items.is_shared：应收行是否共享（费用卡「共享·全案」组）
--   - payments.is_shared：该笔 from_client 收款是否共享
-- 二者默认 false（现有行零回归）；账目算法(computeAccounting/getCaseTotals)一字不改——
-- 共享款项仍是真实 from_client 收款，只是在费用卡里单列一个「共享·全案」分组、不按人分账，
-- 本案净额(所有分组求和)照旧包含它。仅 additive 两列，不动 RLS / 默认账目口径。
-- ★仅收款(from_client)用；支出不加 shared。
-- ============================================================================

alter table public.payment_plan_items
  add column if not exists is_shared boolean not null default false;

alter table public.payments
  add column if not exists is_shared boolean not null default false;
