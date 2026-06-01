-- ============================================================================
-- 0025 — 收款「实际付款方」（from_client_customer_id）
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。纯增量、additive、可重复执行。
--
-- 月度账目「收款明细(客户付款)」此前一律显示案件主申请名，导致副申请/他人付的款也显示成
-- 主申请。新增 from_client_customer_id：记一笔客户收款时可指定实际付款方（家庭成员/任意客户），
-- 收款明细按它显示名字与链接；为空则回落案件主申请（向后兼容）。
--
-- 只影响展示归属，不动金额/聚合/记账双流。on delete set null：付款方客户被删 → 仅置空、回落主申。
-- ============================================================================

alter table public.payments
  add column if not exists from_client_customer_id uuid
    references public.customers(id) on delete set null;

create index if not exists idx_payments_from_client_customer
  on public.payments(from_client_customer_id);
