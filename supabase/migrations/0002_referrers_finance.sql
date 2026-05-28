-- ============================================================================
-- 0002 — 介绍人(referrers) + 财务扩展（付款方式/方向）
-- 依据《数据模型规格.md》之外的增量需求。在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- ⚠️ 纯增量迁移：只 CREATE / ALTER ADD，绝不 DROP 或改动 0001 已有对象。
--    可安全重复执行（全部带 IF NOT EXISTS / 幂等守卫）。
--
-- 注：ALTER TYPE ... ADD VALUE 在 PG12+ 可于事务内执行，但新值不能在「同一事务」中被使用；
--    本迁移不在同一脚本里使用这两个新枚举值，故安全。若 SQL Editor 仍报
--    “ALTER TYPE ... ADD cannot run inside a transaction block”，请把第 1 段两行单独先跑一次。
-- ============================================================================

-- ── 1. 枚举扩展 ─────────────────────────────────────────────────────────────
-- 付款方式新增「垫付」advance（现金 cash / 转账 transfer 已在 0001）。
alter type public.payment_method    add value if not exists 'advance';
-- 付款方向新增「付给介绍人」to_referrer（from_client 收款 / to_company 付主代理 已在 0001）。
alter type public.payment_direction add value if not exists 'to_referrer';

-- ── 2. referrers：介绍人（参照 employers，更精简）────────────────────────────
create table if not exists public.referrers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_phone text,
  contact_email text,
  notes         text,
  is_archived   boolean not null default false,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- updated_at 触发器（复用 0001 的 public.set_updated_at）
drop trigger if exists trg_referrers_updated on public.referrers;
create trigger trg_referrers_updated
  before update on public.referrers
  for each row execute function public.set_updated_at();

-- ── 3. customers.referrer_id：客户的介绍人（可空，一介绍人对多客户）──────────
alter table public.customers
  add column if not exists referrer_id uuid references public.referrers(id) on delete set null;
create index if not exists idx_customers_referrer_id on public.customers(referrer_id);

-- ── 4. RLS：referrers（沿用业务表策略：增删改查 authenticated，DELETE 仅 admin）──
alter table public.referrers enable row level security;

drop policy if exists referrers_select on public.referrers;
drop policy if exists referrers_insert on public.referrers;
drop policy if exists referrers_update on public.referrers;
drop policy if exists referrers_delete on public.referrers;

create policy referrers_select on public.referrers
  for select to authenticated using (true);
create policy referrers_insert on public.referrers
  for insert to authenticated with check (true);
create policy referrers_update on public.referrers
  for update to authenticated using (true) with check (true);
create policy referrers_delete on public.referrers
  for delete to authenticated using (public.is_admin());
