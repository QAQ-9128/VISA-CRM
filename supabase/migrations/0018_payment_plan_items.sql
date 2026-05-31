-- ============================================================================
-- 0018 — 应收拆成多条款项明细（payment_plan_items）
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 背景：一个客户-案件下可有多条收费款项（律师费/文案费/公证费/翻译费/其他），
-- 每条独立 应收(amount_due) / 已付(Σ关联收款) / 未付。收款归属到某条款项明细。
--
-- 增量 + 不破坏现存：
--   1) 新表 payment_plan_items（plan 下多条，fee_category 不强制唯一，允许分阶段重复）
--   2) payments 加 plan_item_id（一笔收款归属一条款项；null = 未归类，过渡期允许）
--   3) 数据迁移：每个现存 plan 建一条默认款项(律师费, amount_due=client_total)；
--      每条现存 from_client 收款链到其 plan 的款项（迁移时每 plan 仅一条 → 全部归默认款项）
--   payment_plans.client_total 列保留不删（老查询照跑）；新代码一律 SUM(amount_due) 派生。
--   company_total（付主代理应收）保持原结构，不受影响。
-- 可重复执行。
-- ============================================================================

-- ── 1. 款项明细表 ────────────────────────────────────────────────────────────
create table if not exists public.payment_plan_items (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references public.payment_plans(id) on delete cascade,
  fee_category text not null,
  amount_due   numeric(12,2) not null default 0,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_ppi_plan_id on public.payment_plan_items(plan_id);

-- updated_at 触发器（复用 0001 的 set_updated_at）
drop trigger if exists trg_payment_plan_items_updated on public.payment_plan_items;
create trigger trg_payment_plan_items_updated
  before update on public.payment_plan_items
  for each row execute function public.set_updated_at();

-- ── 2. payments 加 plan_item_id ──────────────────────────────────────────────
alter table public.payments
  add column if not exists plan_item_id uuid references public.payment_plan_items(id) on delete set null;
create index if not exists idx_payments_plan_item_id on public.payments(plan_item_id);

-- ── 3. RLS：与现有业务表同级（authed 读/增/改；仅 admin 删）──────────────────
alter table public.payment_plan_items enable row level security;
drop policy if exists ppi_select on public.payment_plan_items;
drop policy if exists ppi_insert on public.payment_plan_items;
drop policy if exists ppi_update on public.payment_plan_items;
drop policy if exists ppi_delete on public.payment_plan_items;
create policy ppi_select on public.payment_plan_items for select to authenticated using (true);
create policy ppi_insert on public.payment_plan_items for insert to authenticated with check (true);
create policy ppi_update on public.payment_plan_items for update to authenticated using (true) with check (true);
create policy ppi_delete on public.payment_plan_items for delete to authenticated using (public.is_admin());

-- ── 4. 数据迁移（additive）───────────────────────────────────────────────────
-- 4a. 每个现存 plan 建一条默认款项（律师费 = 原应收总额）；已建过则跳过（可重复执行）
insert into public.payment_plan_items (plan_id, fee_category, amount_due)
select pl.id, '律师费', coalesce(pl.client_total, 0)
from public.payment_plans pl
where not exists (
  select 1 from public.payment_plan_items i where i.plan_id = pl.id
);

-- 4b. 现存 from_client 收款链到其案件/申请人对应 plan 的款项（迁移时每 plan 仅一条 → 默认款项）
update public.payments p
set plan_item_id = i.id
from public.payment_plan_items i
join public.payment_plans pl on pl.id = i.plan_id
where p.plan_item_id is null
  and p.direction = 'from_client'
  and pl.case_id = p.case_id
  and coalesce(pl.applicant_id::text, '') = coalesce(p.applicant_id::text, '');
