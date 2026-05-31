-- ============================================================================
-- 0022 — 付款计划「账单付款方」（billed_to_customer_id）
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。纯增量、additive、可重复执行。
--
-- 欠款聚合改为按「实际付款方」归集，而不再一律算到案件主申请头上：
--   payment_plans.billed_to_customer_id 非空 → 该案件费用挂此客户名下（可跨家庭组：
--     家庭成员 / 介绍人 / 任何第三方付款人均可）
--   为空 → 回落到 cases.customer_id（主申请），保持向后兼容
--
-- on delete set null：billed_to 指向的客户被删除时，仅把该列置空、欠款自动回落主申请，
-- 不影响付款计划本身。与 0018 的 payment_plan_items（应收多明细）结构无冲突——
-- billed_to 只决定「整张计划的欠款归到谁名下」，明细金额/已付计算不变。
-- ============================================================================

alter table public.payment_plans
  add column if not exists billed_to_customer_id uuid
    references public.customers(id) on delete set null;

create index if not exists idx_payment_plans_billed_to
  on public.payment_plans(billed_to_customer_id);
